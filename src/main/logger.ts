export interface Logger {
  info(...args: unknown[]): void
  warn(...args: unknown[]): void
  error(...args: unknown[]): void
}

/** Minimal scoped console logger. Swap the body for electron-log or similar if file logs are needed. */
export function createLogger(scope: string): Logger {
  const prefix = `[${scope}]`
  return {
    info: (...args) => console.log(prefix, ...args),
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args)
  }
}
