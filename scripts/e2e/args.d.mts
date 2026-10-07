export interface RunArgs {
  only: string | null
  exe: string | null
  timeoutSeconds: number
  list: boolean
}
export interface ShotArgs {
  moduleId: string
  intent: unknown
  seed: string | null
  size: { width: number; height: number }
  name: string
  exe: string | null
}

export function parseRunArgs(argv: string[]): RunArgs
export function parseSize(text: string): { width: number; height: number }
export function defaultShotName(moduleId: string, seed?: string | null): string
export function parseShotArgs(argv: string[]): ShotArgs
export function formatFlowLine(
  name: string,
  passed: boolean,
  seconds: number,
  checks: number
): string
export function cleanElectronEnv(
  env: Record<string, string | undefined>
): Record<string, string | undefined>
export function briefError(error: unknown, maxLines?: number): string
