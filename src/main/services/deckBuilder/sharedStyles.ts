/**
 * ONE StylesService for the whole app. The `style-library` module serves it to the Styles screens and the
 * `deck-builder` module reads profiles from it for lessons, so both must share the instance (it keeps the
 * styles in memory and writes them through to `<dataRoot>/modules/style-library`).
 *
 * Use from a module's main.ts:
 *   const styles = getSharedStyles()                                   // same object in every module
 *   setStyleEventEmitter((name, payload) => ctx.emit(name, payload))   // style-library only: its `progress`/`changed`
 *   ... deactivate: await disposeSharedStyles()
 *
 * Events emitted before `setStyleEventEmitter` is called are dropped (nothing listens yet).
 */
import type { StyleProfileView } from '@shared/contracts/style-library'
import type { StyleProfile } from '@shared/style/types'
import { getContainer } from '../container'
import { moduleDataDir } from '../paths'
import type { StyleSource } from '../lessons/types'
import { StylesService } from '../styles/service'
import type { EmitStyleEvent } from '../styles/types'

/** Where the style-library module keeps its styles. */
export const STYLE_LIBRARY_ID = 'style-library'

let emitter: EmitStyleEvent | null = null
let shared: StylesService | null = null

/** Routes the styles service's events to the style-library module's `ctx.emit` (null stops them). */
export function setStyleEventEmitter(next: EmitStyleEvent | null): void {
  emitter = next
}

/** The shared styles service (created on first use from the shared container's AI service). */
export function getSharedStyles(): StylesService {
  shared ??= new StylesService({
    dir: moduleDataDir(STYLE_LIBRARY_ID),
    ai: getContainer().ai,
    emit: (name, payload) => emitter?.(name, payload)
  })
  return shared
}

/** Stops learning jobs and timers (app quit) and forgets the instance. Safe to call more than once. */
export async function disposeSharedStyles(): Promise<void> {
  const current = shared
  shared = null
  emitter = null
  await current?.dispose()
}

/** What the lessons need from styles: a profile for rendering and export, and a view for the editor. */
export interface StyleLookup extends StyleSource {
  /** The profile as the editor's SlideView needs it; null for the plain style or an unknown id. */
  viewOf(styleId: string | null): Promise<StyleProfileView | null>
}

/** Adapts the styles service (or any stand-in with the same two methods) to `StyleLookup`. */
export function createStyleLookup(styles: Pick<StylesService, 'getProfile' | 'get'>): StyleLookup {
  return {
    getProfile: (styleId): Promise<StyleProfile | undefined> => styles.getProfile(styleId),
    async viewOf(styleId) {
      if (!styleId) return null
      const result = await styles.get(styleId)
      return result.ok ? result.style.profile : null
    }
  }
}
