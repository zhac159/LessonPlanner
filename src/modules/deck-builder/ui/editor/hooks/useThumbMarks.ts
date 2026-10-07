import { useEffect, type RefObject } from 'react'

/** The extra states of a filmstrip thumbnail the kit does not draw itself. */
export interface ThumbMarks {
  /** Part of a multi-selection but not the slide on the stage: orange shadow, white badge (06 §8.1). */
  multi: readonly string[]
  /** Just added by the AI: flashes orange for a second (06 §7). */
  flash: readonly string[]
  /** Its ResultChip is hovered: outlined in orange (06 §8.6). */
  highlight: readonly string[]
  /** A circled region waits on it: a small orange dot (06 §8.4). */
  region: readonly string[]
}

const NAMES: ReadonlyArray<keyof ThumbMarks> = ['multi', 'flash', 'highlight', 'region']

/**
 * Sets `data-mark-<name>` on the filmstrip's thumbnail buttons (`button[data-slide-id]`) so the editor's CSS can draw
 * them. The Filmstrip kit only knows one selected slide; these marks add the rest without touching the kit. A flash
 * also scrolls the first flashed slide into view. Re-runs whenever the slides change, because thumbnails come and go.
 */
export function useThumbMarks(
  container: RefObject<HTMLElement | null>,
  marks: ThumbMarks,
  slideKey: string
): void {
  const { multi, flash, highlight, region } = marks
  useEffect(() => {
    const root = container.current
    if (!root) return
    const lists: Record<keyof ThumbMarks, ReadonlySet<string>> = {
      multi: new Set(multi),
      flash: new Set(flash),
      highlight: new Set(highlight),
      region: new Set(region)
    }
    let firstFlashed: HTMLElement | null = null
    root.querySelectorAll<HTMLElement>('button[data-slide-id]').forEach((thumb) => {
      const id = thumb.dataset.slideId ?? ''
      for (const name of NAMES) {
        if (lists[name].has(id)) thumb.setAttribute(`data-mark-${name}`, '')
        else thumb.removeAttribute(`data-mark-${name}`)
      }
      if (!firstFlashed && lists.flash.has(id)) firstFlashed = thumb
    })
    ;(firstFlashed as HTMLElement | null)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [container, multi, flash, highlight, region, slideKey])
}
