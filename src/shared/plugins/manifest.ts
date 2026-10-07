/**
 * A plugin's manifest: pure data shared by main and (through `PluginManifestView`) the renderer
 * (design/plugin-architecture.md §2). The "+" menu and the options sheet are generated from it.
 */
import type {
  PluginInput,
  PluginManifestView,
  PluginSummary
} from '../contracts/deck-builder-plugins'
import { MODULE_ID_PATTERN } from '../registry'

export type { PluginInput } from '../contracts/deck-builder-plugins'

/** What a plugin folder's `manifest.ts` default-exports. */
export interface PluginManifest extends PluginManifestView {
  /** Must the result follow the style profile? (almost always yes) */
  usesStyle: boolean
  /** Position in the "+" menu (ascending). Defaults to the backlog order of the registry. */
  order?: number
}

/** Typed identity helper so a manifest file gets full checking: `export default defineManifest({ … })`. */
export const defineManifest = (manifest: PluginManifest): PluginManifest => manifest

const MAX_NAME_WORDS = 2
const MAX_DESCRIPTION_LENGTH = 44

const words = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length

function inputProblem(input: PluginInput): string | null {
  if (!input.id.trim() || !input.label.trim()) return 'every input needs an id and a label'
  switch (input.type) {
    case 'number':
      if (!(input.step > 0)) return `input "${input.id}": step must be positive`
      if (!(input.min <= input.default && input.default <= input.max))
        return `input "${input.id}": default is outside min..max`
      return null
    case 'choice':
      return input.options.some((o) => o.value === input.default)
        ? null
        : `input "${input.id}": default is not one of the options`
    case 'multi': {
      const values = new Set(input.options.map((o) => o.value))
      return input.default.every((v) => values.has(v))
        ? null
        : `input "${input.id}": default has values that are not options`
    }
    default:
      return null
  }
}

/** Why this manifest breaks the design rules (plugin-architecture.md §8), or null when it is fine. */
export function validateManifest(manifest: PluginManifest): string | null {
  if (!MODULE_ID_PATTERN.test(manifest.id)) return `invalid plugin id "${manifest.id}"`
  if (!manifest.name.trim() || words(manifest.name) > MAX_NAME_WORDS)
    return 'name must be 1 or 2 words'
  if (!manifest.title.trim()) return 'title is required'
  if (!manifest.description.trim() || manifest.description.length > MAX_DESCRIPTION_LENGTH)
    return `description must be 1 to ${MAX_DESCRIPTION_LENGTH} characters`
  if (!/^[a-z][a-z0-9-]*$/.test(manifest.icon)) return 'icon must be a lucide icon name'
  if (!manifest.action.trim()) return 'action (the button label) is required'
  if (manifest.output.length === 0) return 'output must list at least one of slides, file, message'
  const ids = new Set<string>()
  for (const input of manifest.inputs) {
    if (ids.has(input.id)) return `duplicate input id "${input.id}"`
    ids.add(input.id)
    const problem = inputProblem(input)
    if (problem) return problem
  }
  return null
}

/** The "+" menu row. */
export function toSummary(manifest: PluginManifest, order: number): PluginSummary {
  return {
    id: manifest.id,
    name: manifest.name,
    description: manifest.description,
    icon: manifest.icon,
    tint: manifest.tint,
    scope: manifest.scope,
    hasInputs: manifest.inputs.length > 0,
    needsSlides: manifest.needsSlides,
    order
  }
}

/** The part of the manifest the renderer may see. */
export function toView(manifest: PluginManifest): PluginManifestView {
  const { usesStyle: _usesStyle, order: _order, ...view } = manifest
  return view
}
