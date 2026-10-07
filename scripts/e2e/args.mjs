// Pure helpers for the e2e runner and shot.mjs (no Electron, no I/O) so they can be unit-tested
// from src/tooling/e2eArgs.test.ts. Types: args.d.mts.

/** Reads `--name value` pairs and bare flags from argv; returns { flags, values, positional }. */
function split(argv, valueFlags) {
  const values = {}
  const flags = new Set()
  const positional = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) {
      positional.push(arg)
    } else if (valueFlags.includes(arg)) {
      const value = argv[i + 1]
      if (value === undefined || value.startsWith('--')) throw new Error(`${arg} needs a value`)
      values[arg.slice(2)] = value
      i++
    } else {
      flags.add(arg.slice(2))
    }
  }
  return { values, flags, positional }
}

/** `node scripts/e2e/run.mjs [--only <fragment>] [--exe <path>] [--timeout <seconds>] [--list]` */
export function parseRunArgs(argv) {
  const { values, flags, positional } = split(argv, ['--only', '--exe', '--timeout'])
  if (positional.length > 0) throw new Error(`Unexpected argument "${positional[0]}"`)
  const timeoutSeconds = values.timeout === undefined ? 120 : Number(values.timeout)
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
    throw new Error(`--timeout must be a positive number of seconds, got "${values.timeout}"`)
  }
  return {
    only: values.only ?? null,
    exe: values.exe ?? null,
    timeoutSeconds,
    list: flags.has('list')
  }
}

/** Parses `1280x800` (also `1280X800`) into { width, height }. */
export function parseSize(text) {
  const match = /^(\d{3,5})[xX](\d{3,5})$/.exec(text)
  if (!match) throw new Error(`--size must look like 1440x900, got "${text}"`)
  return { width: Number(match[1]), height: Number(match[2]) }
}

/** The default screenshot name: `<module>[-<seed>]`, safe for a file name. */
export function defaultShotName(moduleId, seed) {
  return [moduleId, seed]
    .filter(Boolean)
    .join('-')
    .replace(/[^\w.-]+/g, '_')
}

/**
 * `node scripts/shot.mjs <moduleId> [--intent <json>] [--seed <name>] [--size 1440x900]
 *   [--name <file>] [--exe <path>]`
 */
export function parseShotArgs(argv) {
  const { values, positional } = split(argv, ['--intent', '--seed', '--size', '--name', '--exe'])
  const [moduleId, ...extra] = positional
  if (!moduleId)
    throw new Error('Usage: node scripts/shot.mjs <moduleId> [--intent <json>] [--seed <name>]')
  if (extra.length > 0) throw new Error(`Unexpected argument "${extra[0]}"`)
  let intent
  if (values.intent !== undefined) {
    try {
      intent = JSON.parse(values.intent)
    } catch {
      throw new Error(`--intent must be JSON, got "${values.intent}"`)
    }
  }
  const name = (values.name ?? defaultShotName(moduleId, values.seed)).replace(/\.png$/i, '')
  return {
    moduleId,
    intent,
    seed: values.seed ?? null,
    size: parseSize(values.size ?? '1440x900'),
    name,
    exe: values.exe ?? null
  }
}

/** One report line per flow: `PASS  startup  7.2s  (11 checks)`. */
export function formatFlowLine(name, passed, seconds, checks) {
  const status = passed ? 'PASS' : 'FAIL'
  const detail = checks > 0 ? `  (${checks} checks)` : ''
  return `${status}  ${name}  ${seconds.toFixed(1)}s${detail}`
}

/** A copy of `env` that Electron can start from: VS Code sets ELECTRON_RUN_AS_NODE, which breaks it. */
export function cleanElectronEnv(env) {
  const { ELECTRON_RUN_AS_NODE: _ignored, ...rest } = env
  return rest
}

/** Shortens an error to its first lines so a failing flow costs few tokens to read. */
export function briefError(error, maxLines = 6) {
  const text = error instanceof Error ? `${error.message}` : String(error)
  const lines = text.split('\n').filter((line) => line.trim() !== '')
  const head = lines.slice(0, maxLines).join('\n')
  return lines.length > maxLines ? `${head}\n… (${lines.length - maxLines} more lines)` : head
}
