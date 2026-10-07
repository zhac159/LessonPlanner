/**
 * Module discovery and validation, shared by the main process and the renderer.
 *
 * Both sides discover modules with `import.meta.glob` (one lazy loader per file) and hand the
 * loaders here. Every module is imported and validated independently, so a module that throws
 * or is malformed is reported in `issues` and skipped instead of taking the whole app down.
 */

/** Module folder names and ids: lowercase kebab-case, starting with a letter, no leading/trailing/double hyphens. */
export const MODULE_ID_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

export type ModuleLoader = () => Promise<unknown>

export interface RegistryIssue {
  /** Folder name of the offending module. */
  moduleId: string
  /** Glob key of the offending file. */
  path: string
  message: string
}

export interface LoadModulesOptions<T extends { id: string }> {
  /** Entry kind for error messages, e.g. 'ui' or 'main'. */
  kind: string
  /** Extra checks on the default export. Return an error message, or null when valid. */
  validate?: (definition: T) => string | null
  /** Sort order of the result. Defaults to alphabetical by id. */
  compare?: (a: T, b: T) => number
}

export interface LoadedModules<T> {
  modules: T[]
  issues: RegistryIssue[]
}

/** 'src/modules/home/ui.tsx' -> 'home'. Accepts either slash style. */
export function folderIdFromPath(path: string): string | null {
  const match = /(?:^|\/)modules\/([^/]+)\/[^/]+$/.exec(path.replace(/\\/g, '/'))
  return match ? match[1] : null
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function loadModules<T extends { id: string }>(
  loaders: Record<string, ModuleLoader>,
  options: LoadModulesOptions<T>
): Promise<LoadedModules<T>> {
  const entries = Object.entries(loaders)
  const settled = await Promise.allSettled(entries.map(async ([, load]) => load()))

  const modules: T[] = []
  const issues: RegistryIssue[] = []

  settled.forEach((result, index) => {
    const path = entries[index][0]
    const folder = folderIdFromPath(path) ?? path
    const reject = (message: string): void => {
      issues.push({ moduleId: folder, path, message })
    }

    if (result.status === 'rejected') {
      reject(`Failed to load ${options.kind} entry: ${errorMessage(result.reason)}`)
      return
    }

    const definition = (result.value as { default?: unknown } | null)?.default as T | undefined
    if (!definition || typeof definition !== 'object') {
      reject(`The ${options.kind} entry must default-export a module definition`)
      return
    }
    if (typeof definition.id !== 'string' || !MODULE_ID_PATTERN.test(definition.id)) {
      reject(`Invalid module id "${String(definition.id)}" (use lowercase kebab-case)`)
      return
    }
    if (definition.id !== folder) {
      reject(`Module id "${definition.id}" must match its folder name "${folder}"`)
      return
    }
    const problem = options.validate?.(definition)
    if (problem) {
      reject(problem)
      return
    }
    modules.push(definition)
  })

  modules.sort(options.compare ?? ((a, b) => a.id.localeCompare(b.id)))
  return { modules, issues }
}
