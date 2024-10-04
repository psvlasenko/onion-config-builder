# Build config objects in accordance with the configuration files hierarchy and env variables

* Node.js, typescript, configs
* config hierarchy
* multiple environments support, overwrites from priority dir
* environment variables support
* custom validation support
* automatically write documentation for configs

## Usage example:
import { buildConfigsOrThrow } from '@onion/config-builder';

```typescript
const configs = await buildConfigs({
  dir: './config',
  env: 'test',
  merge: (...configs) => configs.reduce((result, config) => Object.assign(result, config), {}),
  envSource: process.env,
  configParams: [{
  fileName: 'pg',
    keyOptions: {
      'dbName': {
        env: DB_NAME
      },
      'connections.0.host': { env: PG_HOST_1 },
      'connections.0.port': { env: PG_PORT_1, parser: Number },
      'connections.1.host': { env: PG_HOST_2 },,
      'connections.1.port': { env: PG_PORT_2, parser: Number },
    },
  }]
});

const configs = await buildConfigsOrThrow();
// Map(1) {
//   'pg' => {
//     dbName: DB_NAME_VALUE,
//     connections: [
//       { host: 'PG_HOST_1_VALUE', port: PG_PORT_1_NUMBER_VALUE },
//       { host: 'PG_HOST_2_VALUE', port: PG_PORT_2_NUMBER_VALUE }
//     ]
//   }
// }
```
