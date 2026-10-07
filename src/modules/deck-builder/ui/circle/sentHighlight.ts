/**
 * A tiny shared store for "show this sent region on the slide". The chat panel (hovering a RegionChip of a
 * past message) writes it and the circle layer reads it, so the seam between the two parts needs no
 * extra props: sent regions are no longer drafts, so the editor does not hold them (06 §8.4 step 11).
 */
import { useSyncExternalStore } from 'react'
import type { StrokePath } from '@shared/contracts/deck-builder-chat'

/** A region of a sent message, re-drawn while its chip is hovered or focused. */
export interface SentHighlight {
  id: string
  n: number
  slideId: string
  path: StrokePath
  /** The message cut to about 24 characters. */
  caption: string
}

let current: SentHighlight | null = null
const listeners = new Set<() => void>()

/** Sets (or, with null, clears) the highlighted sent region. */
export function setSentHighlight(next: SentHighlight | null): void {
  if (current === next) return
  current = next
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The sent region to highlight right now, or null. */
export function useSentHighlight(): SentHighlight | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null
  )
}

/** The sent region highlighted right now (for tests and non-React readers). */
export const currentSentHighlight = (): SentHighlight | null => current
