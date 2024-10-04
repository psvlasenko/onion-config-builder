import path from 'node:path';
import { ConfigsBuildError, createConfigValidationError } from './errors.js';

import type {
  ConfigLoader,
  ConfigLoaderParams,
  ConfigOptions,
  KeyOptions,
  ParamsWithKey,
  Validator,
  Config,
  ConfigOptionsWithKey,
} from './types.js';
import { isDefined, Optional } from './utils/index.js';

const defaultValidator: Validator = () => null;
const DEFAULT_EXTENSIONS: Readonly<string>[] = ['json', 'js', 'cjs'];

type ConfEntry = [unknown, [Error | null, Config]];
type Build = (params: ParamsWithKey<unknown>) => Promise<[Error | null, Map<unknown, Config>]>;

const build: Build = async params => {
  const { configOptions, envSource = process.env, ...loaderParams } = params;

  const loadConfig = createConfigLoader(loaderParams);
  const toConfigEntry = createParamsToConfEntryMapper(loadConfig, envSource);

  const configEntries = await Promise.all(configOptions.map(toConfigEntry));

  const error = createBuilderError(errorsFrom(configEntries));
  const configs = configMapFrom(configEntries);

  return [error, configs];
};

type CreateBE = (errors: Error[]) => ConfigsBuildError | null;
const createBuilderError: CreateBE = errors => errors.length > 0 ? new ConfigsBuildError(errors) : null;

type EF = (entries: ConfEntry[]) => Error[];
const errorsFrom: EF = entries => entries.filter(([, [err]]) => err !== null).map(([, [err]]) => err) as Error[];

type CMF = (entries: ConfEntry[]) => Map<unknown, Config>;
const configMapFrom: CMF = entries => new Map(entries.map(([key, [, conf]]) => [key, conf]));

type ParamsToCE = (params: ConfigOptionsWithKey<unknown>) => Promise<ConfEntry>;
type CreatePEM = (...params: [ConfigLoader, NodeJS.ProcessEnv]) => ParamsToCE;

const createParamsToConfEntryMapper: CreatePEM = (loadConfig, envs) => async it => {
  const [validationErr, config] = await loadValidatedConfig(it, loadConfig, envs);

  const error = validationErr !== null
    ? createConfigValidationError(it.fileName, validationErr)
    : null;

  return [it.key ?? it.fileName, [error, config]];
};

type BuildOT = (params: ParamsWithKey<unknown>) => Promise<Map<unknown, Config>>;

const buildOrThrow: BuildOT = async params => {
  const [error, configs] = await build(params);

  if (error !== null) {
    throw error;
  }

  return configs;
};

type LoadVC = (...params: [ConfigOptions, ConfigLoader, NodeJS.ProcessEnv]) => Promise<[unknown, Config]>;

const loadValidatedConfig: LoadVC = async (params, loadConfig, envSource) => {
  const { fileName, validate = defaultValidator, keyOptions = {} } = params;
  const config = await loadConfig(fileName);
  setValuesFromEnv(config, envSource, keyOptions);
  const err = await validate(config) ?? null;

  return [err, config];
};

type SetVFE = (...params: [Config, NodeJS.ProcessEnv, ConfigOptions['keyOptions']?]) => Config;

const setValuesFromEnv: SetVFE = (config, envSource, useEnv = {}) => {
  const usingEnvEntries = Object.entries(useEnv);

  if (usingEnvEntries.length === 0) {
    return config;
  }

  return usingEnvEntries.reduce(
    (cfg, [keyPath, nameOrNameAndParser]) => {
      const value = getValueFromEnv(envSource, nameOrNameAndParser);

      if (isDefined(value)) {
        setValue(cfg, keyPath, value);
      }

      return cfg;
    },
    config,
  );
};

type GetVFE = (...params: [NodeJS.ProcessEnv, KeyOptions]) => unknown;

const getValueFromEnv: GetVFE = (envSource, params) => {
  const { env, parser: parse = identity } = params;
  const value = Optional.map(envName => envSource[envName], env);

  return Optional.map(parse, value);
};

type CrFCh = (params: Omit<ConfigLoaderParams, 'merge' | 'loadConfigFile'>) => (name: string) => string[];

const createConfigFileChainFactory: CrFCh = params => name => {
  const { dir, env, baseDir = 'base', priorityDir = 'local', sortedExtension = DEFAULT_EXTENSIONS } = params;

  const pathWithoutExtension = [
    `${dir}/${baseDir}/${name}`,
    `${dir}/${env}/${name}`,
    `${dir}/${priorityDir}/${name}`,
  ];

  return pathWithoutExtension.flatMap(filePath => sortedExtension?.map(ext => `${filePath}.${ext}`));
};

type CreateCL = (params: ConfigLoaderParams) => ConfigLoader;
type GetCC = (fileName: string) => Promise<Config[]>;

const createConfigLoader: CreateCL = params => {
  const { merge, loadConfigFile = importConfig, ...rest } = params;

  const getConfigFileChain = createConfigFileChainFactory(rest);

  const getConfigChain: GetCC = async fileName =>
    await Promise.all(getConfigFileChain(fileName).map(filePath => loadConfigFile(filePath)));

  const loadConfigs: ConfigLoader = async name => {
    const configChain = await getConfigChain(name);

    return merge({}, ...configChain);
  };

  return loadConfigs;
};

const importConfig: ConfigLoader = async configPath => {
  try {
    const ext = path.extname(configPath).replace('.', '');

    if (!DEFAULT_EXTENSIONS.includes(ext)) {
      throw new Error(`Config build works with: *.json, *.js, *.cjs files only. Unsupported extension: ${ext}`);
    }

    const configModule = ext === 'json'
      ? await import(configPath, { assert: { type: 'json' } })
      : await import(configPath);

    return configModule.default;
  }
  catch (err) {
    if ((err as { code: unknown }).code === 'ERR_MODULE_NOT_FOUND') {
      return {};
    }

    throw err;
  }
};

interface InjectionParams {
  target: Record<string, unknown>;
  key: string;
  isArray: boolean;
}

const injectObject = (params: InjectionParams): object => {
  const { target, key, isArray } = params;
  const injected = isArray ? [] : {};

  if (Array.isArray(target)) {
    target.push(injected);
  }
  else {
    target[key] = injected;
  }

  return injected;
};

const mayBeCastToInt = (value: unknown) => Number.isInteger(Number(value));

type GetInjTtg = (...params: [Config, string[]]) => Record<string, unknown>;

const getInjectionTarget: GetInjTtg = (root, keyChain) => keyChain.reduce(
  (obj, key, ind, list) => {
    if (key in obj) {
      return obj[key] as Config;
    }

    const injected = injectObject({
      target: obj,
      key,
      isArray: mayBeCastToInt(list[ind + 1]),
    });

    return injected as Config;
  },
  root as Config,
);

type SetVal = (...params: [Config, string, unknown]) => Config;

const setValue: SetVal = (root, keyPath, value) => {
  const pathList = keyPath.split('.');
  const key = pathList.at(-1) as string;
  const keyChain = pathList.slice(0, -1);

  const target = getInjectionTarget(root, keyChain);

  target[key] = value;

  return root;
};

const identity = <T>(val?: T) => val;

export {
  buildOrThrow,
  build,
  createConfigValidationError,
};
