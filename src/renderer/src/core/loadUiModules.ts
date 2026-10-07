import { loadModules, type LoadedModules } from '@shared/registry'
import type { UiModule } from './types'

/**
 * Every src/modules/<id>/ui.tsx is discovered here, with no registry to edit.
 * A folder starting with "_" is ignored, which is the easy way to switch a module off.
 */
const loaders = import.meta.glob(['../../../modules/*/ui.tsx', '!../../../modules/_*/ui.tsx'])

const DEFAULT_ORDER = 100

/** A function component, or a memo / forwardRef / lazy wrapper (what lucide icons and lazy() produce). */
const WRAPPER_TYPES = ['react.memo', 'react.forward_ref', 'react.lazy'].map((name) =>
  Symbol.for(name)
)
const isComponent = (value: unknown): boolean =>
  typeof value === 'function' ||
  (typeof value === 'object' &&
    value !== null &&
    WRAPPER_TYPES.includes((value as { $$typeof?: symbol }).$$typeof as symbol))

function validate(module: UiModule): string | null {
  if (typeof module.title !== 'string' || module.title.trim() === '') return 'Missing "title"'
  if (!isComponent(module.icon)) return 'Missing "icon" (pass a component, e.g. from lucide-react)'
  if (!isComponent(module.component)) return 'Missing "component"'
  return null
}

let pending: Promise<LoadedModules<UiModule>> | undefined

/** Loads and validates all UI modules once; later calls share the same promise. */
export function loadUiModules(): Promise<LoadedModules<UiModule>> {
  pending ??= loadModules<UiModule>(loaders, {
    kind: 'ui',
    validate,
    compare: (a, b) =>
      (a.order ?? DEFAULT_ORDER) - (b.order ?? DEFAULT_ORDER) || a.id.localeCompare(b.id)
  })
  return pending
}
