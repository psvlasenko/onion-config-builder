import { describe, it } from 'node:test';
import assert from 'node:assert';

import type { ConfigDocOptions } from './types.js';
import { writeDoc } from './doc-writer.js';
import { joinAsLines } from './utils/index.js';

describe('config doc writer tests', () => {
  it('configuration doc have been successfully written', async () => {
    const CONFIG_DOC_TABLE_OPTIONS = {
      env: 'env variable',
      description: 'description',
      type: 'type',
      presence: 'presence',
    } as const;

    type ConfigDocKey = keyof typeof CONFIG_DOC_TABLE_OPTIONS;

    const configParams: ConfigDocOptions<ConfigDocKey>[] = [
      {
        fileName: 'server',
        keyOptions: {
          host: {
            env: 'SERVER_HOST',
            description: 'server host',
            type: 'string',
          },
          port: {
            env: 'SERVER_HOST',
            description: 'server port',
            type: 'integer',
          },
        },
      },
      {
        fileName: 'db',
        description: 'database connection config',
        keyOptions: {
          host: {
            env: 'DB_HOST',
            description: 'db server host',
          },
          port: {
            env: 'DB_PORT',
            description: 'db server port',
          },
        },
      },
    ];

    const expectedDoc = joinAsLines(
      '## Configuration',
      '### server',
      '|key|env variable|description|type|presence|',
      '|-|-|-|-|-|',
      '|host|SERVER_HOST|server host|string|-|',
      '|port|SERVER_HOST|server port|integer|-|',
      '### db - database connection config',
      '|key|env variable|description|type|presence|',
      '|-|-|-|-|-|',
      '|host|DB_HOST|db server host|-|-|',
      '|port|DB_PORT|db server port|-|-|',
      '',
    );

    const doc = writeDoc<ConfigDocKey>({
      keyHeaders: CONFIG_DOC_TABLE_OPTIONS,
      configOptions: configParams,
      emptyValuePlaceholder: '-',
    });

    assert.equal(doc, expectedDoc);
  });
});
