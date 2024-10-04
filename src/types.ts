export type ConfigLoader = (name: string) => Promise<Config>;
export type Merger = (...configs: Config[]) => Config;
export type FileLoader = (filePath: string) => Config | Promise<Config>;
export type EnvParser = (value: string) => unknown;

export interface KeyOptions {
  /**
   * name of environment variable
   */
  env?: string;
  parser?: EnvParser;
  description?: string;
};

type ValidationResult = unknown;

export type Validator = (config: unknown) => ValidationResult | Promise<ValidationResult>;

export interface ConfigOptions {
  fileName: string;
  validate?: Validator;
  keyOptions?: Record<string, KeyOptions>;
}

/**
 * @typeParam T - type of data keys
 */
export type KeyDocOptions<T extends string> = Partial<Record<T, { toString(): string }>>;

/**
 * @typeParam T - type of data keys using in keyOptions dictionary values
 */
export interface ConfigDocOptions<T extends string> {
  fileName: string;
  description?: string;
  keyOptions?: Record<string, KeyDocOptions<T>>;
};

export interface ConfigOptionsWithKey<T = unknown> extends ConfigOptions {
  /**
   * key for config in the result map
   * @defaultValue the filename
   */
  key?: T;
}

export interface Params {
  /**
   * path to directory containing env related config subdirectories
   */
  dir: string;
  /**
   * environment value determining the choice of config subdirectory
   */
  env: string;
  /**
   * path to directory containing config files with defaults
   * @defaultValue `base`
   */
  baseDir?: string;
  /**
   * path to directory which config files values override any other ones
   * @defaultValue `local`
   */
  priorityDir?: string;
  /**
   * array of loaded file extension in ascending priority order
   * @defaultValue ['json', 'js', 'cjs']
   *
   * when extensions not included to default list are defined, loadConfigFile parameter
   * must be defined
   */
  sortedExtension?: string[];
  /**
   * function using for config merge
   */
  envSource?: NodeJS.ProcessEnv;
  merge: Merger;
  configOptions: ConfigOptions[];
  /**
   * redefine file upload mechanism, by default using async import of .js, .json, .csj files as modules
   */
  loadConfigFile?: FileLoader;
}

export interface ParamsWithKey<T = unknown> extends Omit<Params, 'configOptions'> {
  configOptions: ConfigOptionsWithKey<T>[];
}

export type Config = Record<string | symbol | number, unknown>;

export type ConfigLoaderParams = Omit<Params, 'configOptions'>;

export interface Builder {
  (params: Params): Promise<[Error | null, Map<string, Config>]>;
  <T>(params: ParamsWithKey<T>): Promise<[Error | null, Map<T, Config>]>;
};

export interface ThrowableBuilder {
  (params: Params): Promise<Map<string, Config>>;
  <T>(params: ParamsWithKey<T>): Promise<Map<T, Config>>;
};

/**
 * @typeParam T - type of data keys using in configOptions items
 */
export interface DocOptions<T extends string> {
  header?: string;
  description?: string;
  keyHeaders: Record<T, string>;
  configOptions: ConfigDocOptions<T>[];
  emptyValuePlaceholder?: string;
}
