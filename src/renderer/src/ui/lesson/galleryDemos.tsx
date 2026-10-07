/** Interactive specimens for the lesson gallery. Not part of the public API. */
import { useState } from 'react'
import type { Slide } from '@shared/deck/types'
import { sampleDeck, sampleStyle } from '../slide/galleryData'
import { ContextMenu, type Point } from '../overlays'
import { Filmstrip, LessonCard, type AfterId } from './index'

/** Move `id` after `after` (or to the front) in a copy of `slides`. */
function moved(slides: Slide[], id: string, after: AfterId): Slide[] {
  const slide = slides.find((s) => s.id === id)
  if (!slide) return slides
  const rest = slides.filter((s) => s.id !== id)
  const at = after === null ? 0 : rest.findIndex((s) => s.id === after) + 1
  return [...rest.slice(0, at), slide, ...rest.slice(at)]
}

/** A filmstrip you can click, drag, reorder with Alt+arrows, delete from and add to. */
export function FilmstripDemo({ layout }: { layout: 'horizontal' | 'vertical' }) {
  const [slides, setSlides] = useState<Slide[]>(sampleDeck.slides)
  const [selected, setSelected] = useState<string | null>(sampleDeck.slides[0]?.id ?? null)
  return (
    <Filmstrip
      slides={slides}
      styleProfile={sampleStyle}
      selectedId={selected}
      layout={layout}
      onSelect={setSelected}
      onMove={(id, after) => setSlides((current) => moved(current, id, after))}
      onDelete={(id) => setSlides((current) => current.filter((s) => s.id !== id))}
      onAdd={() =>
        setSlides((current) => [
          ...current,
          { id: `new-${current.length}`, kind: 'custom', elements: [] }
        ])
      }
    />
  )
}

const MENU_ITEMS = ['Open', 'Duplicate', 'Rename…', 'Delete…']

/** A LessonCard whose ⋯ button and right-click open a ContextMenu (selected while it is open). */
export function LessonCardMenuDemo({ now }: { now: Date }) {
  const [anchor, setAnchor] = useState<Point | null>(null)
  return (
    <>
      <LessonCard
        title="Photosynthesis"
        yearTag="Year 8"
        slideCount={sampleDeck.slides.length}
        updatedAt={new Date(now.getTime() - 3 * 86_400_000).toISOString()}
        now={now}
        slide={sampleDeck.slides[0]}
        styleProfile={sampleStyle}
        selected={anchor !== null}
        onOpen={() => {}}
        onMenu={setAnchor}
      />
      <ContextMenu
        open={anchor !== null}
        anchor={anchor}
        label="Lesson actions"
        onClose={() => setAnchor(null)}
        items={MENU_ITEMS.map((label) => ({
          id: label,
          label,
          danger: label.startsWith('Delete'),
          onSelect: () => {}
        }))}
      />
    </>
  )
}
