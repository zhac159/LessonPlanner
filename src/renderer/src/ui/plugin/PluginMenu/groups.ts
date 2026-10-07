import type { PluginScope, PluginSummary } from '@shared/contracts/deck-builder-plugins'

export interface PluginGroup {
  scope: PluginScope
  /** Heading shown when more than one scope is present; null for a single ungrouped list. */
  heading: string | null
  plugins: PluginSummary[]
}

const SCOPE_ORDER: PluginScope[] = ['lesson', 'slides', 'region']

/** Group headings (06 §4, design-system: PluginMenu). */
export const SCOPE_HEADINGS: Record<PluginScope, string> = {
  lesson: 'Whole lesson',
  slides: 'This slide',
  region: 'Circled area'
}

/** Case-insensitive match of a search text against plugin names. An empty search keeps everyone. */
export function matchesSearch(plugin: PluginSummary, search: string): boolean {
  return plugin.name.toLowerCase().includes(search.trim().toLowerCase())
}

/**
 * Orders plugins by `order` (ties keep their given order) and groups them by scope. A single
 * scope gives one group without a heading; several give one headed group per scope in the order
 * Whole lesson, This slide, Circled area. Empty groups are dropped.
 */
export function groupPlugins(plugins: PluginSummary[]): PluginGroup[] {
  const sorted = [...plugins].sort((a, b) => a.order - b.order)
  const scopes = SCOPE_ORDER.filter((scope) => sorted.some((p) => p.scope === scope))
  const headed = scopes.length > 1
  return scopes.map((scope) => ({
    scope,
    heading: headed ? SCOPE_HEADINGS[scope] : null,
    plugins: sorted.filter((p) => p.scope === scope)
  }))
}
