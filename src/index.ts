import { build, buildOrThrow } from './builder.js';
import { writeDoc } from './doc-writer.js';
import { createConfigValidationError } from './errors.js';
import type { Builder, ThrowableBuilder } from './types.js';

const buildConfigs: Builder = build as Builder;
const buildConfigsOrThrow: ThrowableBuilder = buildOrThrow as ThrowableBuilder;

export * from './errors.js';
export * from './types.js';

export {
  writeDoc,
  buildConfigsOrThrow,
  buildConfigs,
  createConfigValidationError,
};
