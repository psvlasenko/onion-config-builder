import { describe, it } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';

import { buildConfigsOrThrow, buildConfigs } from './index.js';
import { ConfigsBuildError } from './errors.js';

import type { Config, ConfigLoader, Merger, Params } from './types.js';

const merge: Merger = (...objects) => objects.reduce((result, config) => Object.assign(result, config), {});

const commonOptions: Pick<Params, 'dir' | 'env' | 'merge'> = {
  dir: './config',
  env: 'test',
  merge,
};

type CreateFL = (...configEntries: [string, Config][]) => ConfigLoader;

const createFakeLoader: CreateFL = (...configEntries) => {
  const fakeFiles = new Map<string, Config>(configEntries);

  return filePath => {
    const config: Config = fakeFiles.get(filePath) ?? {};

    return Promise.resolve(config);
  };
};

describe('config builder test suite', () => {
  const fileName = 'pg';

  it('base config was loaded', async () => {
    // arrange
    const baseConfig = { host: 'base-host', port: 12345 };
    const fakeLoader = createFakeLoader(['./config/base/pg.json', baseConfig]);

    // act
    const configs = await buildConfigsOrThrow({
      ...commonOptions,
      configOptions: [{ fileName }],
      loadConfigFile: fakeLoader,
    });

    // assert
    assert.ok(configs.size === 1);
    const config = configs.get(fileName);
    assert.deepStrictEqual(config, baseConfig);
  });

  it('config chain was loaded and merged', async () => {
    // arrange
    const fakeLoader = createFakeLoader(
      ['./config/base/pg.json', { host: 'base-host', port: 12345 }],
      ['./config/test/pg.json', { host: 'test-host' }],
    );

    // act
    const configs = await buildConfigsOrThrow({
      ...commonOptions,
      configOptions: [{ fileName: 'pg' }],
      loadConfigFile: fakeLoader,
    });

    // assert
    const config = configs.get(fileName);
    assert.deepStrictEqual(config, { host: 'test-host', port: 12345 });
  });

  it('config from priority dir redefine other ones', async () => {
    // arrange
    const priorityDir = 'priority-dir';

    const priorityConfig = { host: 'priority-host', port: 3 };

    const fakeLoader = createFakeLoader(
      ['./config/base/pg.json', { host: 'base-host', port: 1 }],
      ['./config/test/pg.json', { host: 'test-host', port: 2 }],
      [`./config/${priorityDir}/pg.json`, priorityConfig],
    );

    // act
    const configs = await buildConfigsOrThrow({
      ...commonOptions,
      priorityDir,
      configOptions: [{ fileName: 'pg' }],
      loadConfigFile: fakeLoader,
    });

    // assert
    const config = configs.get(fileName);
    assert.deepStrictEqual(config, priorityConfig);
  });

  it('values from env redefine any configs', async () => {
    // arrange
    const priorityDir = 'test-dir';

    const fakeLoader = createFakeLoader(
      ['./config/base/pg.json', { host: 'base-host', port: 1 }],
      ['./config/test/pg.json', { host: 'test-host', port: 2 }],
      [`./config/${priorityDir}/pg.json`, { host: 'priority-host', port: 3 }],
    );

    const PG_HOST = 'host-from-env';
    const PG_PORT = '123';

    // act
    const configs = await buildConfigsOrThrow({
      ...commonOptions,
      priorityDir,
      loadConfigFile: fakeLoader,
      envSource: { PG_HOST, PG_PORT },
      configOptions: [{
        fileName: 'pg',
        keyOptions: {
          host: { env: 'PG_HOST' },
          port: { env: 'PG_PORT', parser: Number },
        },
      }],
    });

    // assert
    const config = configs.get(fileName);
    assert.deepStrictEqual(config, { host: PG_HOST, port: Number(PG_PORT) });
  });

  it('values from env redefine nested config key values', async () => {
    // arrange
    const priorityDir = 'test-dir';

    const fakeLoader = createFakeLoader(
      [
        './config/base/pg.json',
        {
          dbName: 'base-db-name',
          connections: [{ host: 'base-host', port: 123 }],
        },
      ],
    );

    const DB_NAME = 'env-db-name';

    const PG_HOST_1 = 'host-from-env-1';
    const PG_PORT_1 = '1';

    const PG_HOST_2 = 'host-from-env-2';
    const PG_PORT_2 = '2';

    // act
    const configs = await buildConfigsOrThrow({
      ...commonOptions,
      priorityDir,
      loadConfigFile: fakeLoader,
      envSource: { DB_NAME, PG_HOST_1, PG_PORT_1, PG_HOST_2, PG_PORT_2 },
      configOptions: [{
        fileName: 'pg',
        keyOptions: {
          'dbName': { env: 'DB_NAME' },
          'connections.0.host': { env: 'PG_HOST_1' },
          'connections.1.host': { env: 'PG_HOST_2' },
          'connections.0.port': { env: 'PG_PORT_1', parser: Number },
          'connections.1.port': { env: 'PG_PORT_2', parser: Number },
        },
      }],
    });

    // assert
    const expected = {
      dbName: DB_NAME,
      connections: [
        { host: PG_HOST_1, port: Number(PG_PORT_1) },
        { host: PG_HOST_2, port: Number(PG_PORT_2) },
      ],
    };

    const config = configs.get(fileName);
    assert.deepStrictEqual(config, expected);
  });

  it('only files with default extension (json, js, cjs) were loaded when sortedExtension is not defined', async () => {
    // arrange
    const loadedFileExtensions = new Set<string>();

    // act
    await buildConfigsOrThrow({
      ...commonOptions,
      loadConfigFile: (filePath: string) => {
        loadedFileExtensions.add(path.extname(filePath));
        return {};
      },
      configOptions: [{ fileName: 'pg' }],
    });

    // assert
    assert.deepStrictEqual([...loadedFileExtensions], ['.json', '.js', '.cjs']);
  });

  it('files were loaded according ro sortedExtension argument when one is defined', async () => {
    // arrange
    const loadedFileExtensions = new Set<string>();

    // act
    await buildConfigsOrThrow({
      ...commonOptions,
      sortedExtension: ['xml', 'json', 'txt'],
      loadConfigFile: (filePath: string) => {
        loadedFileExtensions.add(path.extname(filePath));
        return {};
      },
      configOptions: [{ fileName: 'pg' }],
    });

    // assert
    assert.deepStrictEqual([...loadedFileExtensions], ['.xml', '.json', '.txt']);
  });

  it('returns ConfigsBuildError when config validation was failed', async () => {
    // arrange
    const baseConfig = { hos: 'some-host', por: 123 };

    const validate = (config: unknown) => {
      if (config === null || typeof config !== 'object') {
        return ['config is not a valid DTO'];
      }

      const errMessages: string[] = [
        ...(!('host' in config) ? ['host is undefined'] : []),
        ...(!('port' in config) ? ['port is undefined'] : []),
      ];

      return errMessages.length > 0 ? new Error(errMessages.join(', ')) : null;
    };

    const fakeLoader = createFakeLoader(['./config/base/pg.json', baseConfig]);

    // act
    const [error] = await buildConfigs({
      ...commonOptions,
      configOptions: [{ fileName, validate }],
      loadConfigFile: fakeLoader,
    });

    // assert
    assert.ok(error instanceof ConfigsBuildError);
  });

  it('result map key was redefined to the key from params', async () => {
    // arrange
    const key = Symbol('PG_CONFIG_KEY');
    const baseConfig = { host: 'base-host', port: 12345 };
    const fakeLoader = createFakeLoader(['./config/base/pg.json', baseConfig]);

    // act
    const configs = await buildConfigsOrThrow({
      ...commonOptions,
      configOptions: [
        { fileName, key },
      ],
      loadConfigFile: fakeLoader,
    });

    // assert
    assert.ok(configs.size === 1);
    assert.ok(configs.has(key));
  });
});
