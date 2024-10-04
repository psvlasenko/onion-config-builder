export class ConfigValidationError extends Error {
  constructor(fileName: string, cause: unknown) {
    super(`Config validation error. See cause for more info. File name: ${fileName}`, { cause });
  }
}

export const createConfigValidationError = (fileName: string, cause: unknown) =>
  cause instanceof ConfigValidationError
    ? cause
    : new ConfigValidationError(fileName, cause);

export class ConfigsBuildError extends Error {
  constructor(cause: unknown) {
    super('Configs build error. See cause for more info.', { cause });
  }
}
