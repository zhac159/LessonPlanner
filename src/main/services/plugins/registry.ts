/**
 * `PluginRegistry`: discovers `src/plugins/<id>/manifest.ts` (shared data) and `run.ts` (main only), the same
 * pattern as modules (design/plugin-architecture.md §5). Every file is imported and validated on its own, so a
 * broken plugin is skipped with an issue and the others still load.
 */
import type { PluginManifestView, PluginSummary } from '@shared/contracts/deck-builder-plugins'
import { loadModules, type ModuleLoader, type RegistryIssue } from '@shared/registry'
import { toSummary, toView, validateManifest, type PluginManifest } from '@shared/plugins/manifest'
import type { PluginDefinition } from '@shared/plugins/types'
import { silentLogger, type Logger } from '../lessons/types'

/** Where a plugin with no `order` of its own is listed: after the ones that have one. */
const LAST = 1000

export interface PluginSources {
  /** One loader per `src/plugins/<id>/manifest.ts`. */
  manifests: Record<string, ModuleLoader>
  /** One loader per `src/plugins/<id>/run.ts`. */
  runs: Record<string, ModuleLoader>
}

/** A plugin whose manifest and run file both loaded. */
export interface LoadedPlugin {
  manifest: PluginManifest
  definition: PluginDefinition
  order: number
}

/**
 * `loadModules` finds a module's folder in `.../modules/<id>/<file>`; plugin files live in `.../plugins/<id>/<file>`.
 * The keys are renamed for that check (the loaders themselves are untouched), and renamed back in the issues.
 */
const asModuleKeys = (loaders: Record<string, ModuleLoader>): Record<string, ModuleLoader> =>
  Object.fromEntries(
    Object.entries(loaders).map(([k, v]) => [k.replace(/(^|\/)plugins\//, '$1modules/'), v])
  )

const issuePath = (path: string): string => path.replace(/(^|\/)modules\//, '$1plugins/')

export class PluginRegistry {
  private plugins: LoadedPlugin[] = []
  private problems: RegistryIssue[] = []

  constructor(
    private readonly sources: PluginSources,
    private readonly log: Logger = silentLogger
  ) {}

  /** Imports every plugin. Never throws; look at `issues` for what was skipped. Safe to call again. */
  async load(): Promise<void> {
    const [manifests, runs] = await Promise.all([
      loadModules<PluginManifest>(asModuleKeys(this.sources.manifests), {
        kind: 'manifest',
        validate: validateManifest
      }),
      loadModules<PluginDefinition>(asModuleKeys(this.sources.runs), {
        kind: 'run',
        validate: (definition) =>
          typeof definition.run === 'function' ? null : 'the run entry must export a run() function'
      })
    ])
    const issues = [...manifests.issues, ...runs.issues]
    const runsById = new Map(runs.modules.map((definition) => [definition.id, definition]))
    const loaded: LoadedPlugin[] = []
    for (const manifest of manifests.modules) {
      const definition = runsById.get(manifest.id)
      if (!definition) {
        issues.push({
          moduleId: manifest.id,
          path: `plugins/${manifest.id}/run.ts`,
          message: 'The plugin has a manifest but no working run.ts'
        })
        continue
      }
      runsById.delete(manifest.id)
      loaded.push({ manifest, definition, order: manifest.order ?? LAST })
    }
    for (const id of runsById.keys())
      issues.push({
        moduleId: id,
        path: `plugins/${id}/manifest.ts`,
        message: 'The plugin has a run.ts but no working manifest'
      })
    this.problems = issues.map((i) => ({ ...i, path: issuePath(i.path) }))
    for (const issue of this.problems)
      this.log.error(`Skipped plugin "${issue.moduleId}" (${issue.path}): ${issue.message}`)
    this.plugins = loaded.sort(
      (a, b) => a.order - b.order || a.manifest.id.localeCompare(b.manifest.id)
    )
  }

  /** What was skipped and why. */
  get issues(): readonly RegistryIssue[] {
    return this.problems
  }

  /** The "+" menu rows, in display order. */
  list(): PluginSummary[] {
    return this.plugins.map((p) => toSummary(p.manifest, p.order))
  }

  get(pluginId: string): LoadedPlugin | undefined {
    return this.plugins.find((p) => p.manifest.id === pluginId)
  }

  /** The renderer-safe manifest of one plugin. */
  view(pluginId: string): PluginManifestView | undefined {
    const plugin = this.get(pluginId)
    return plugin ? toView(plugin.manifest) : undefined
  }
}
