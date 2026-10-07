/**
 * Development only (part of `scripts/render-check.mjs`): renders the generated example slides of the teacher's
 * own decks (`.artifacts/example/{profile,slides}.json`) next to her page images, to see the rendering defects
 * of agents/ASSETS.md §5.7 gone. Runs only when RENDER_CHECK_EXAMPLE names the `.artifacts` folder.
 *   example-N-spots.png  slides exactly as stored: picture spots are not drawn (present mode, thumbnails)
 *   example-N-filled.png the logo and photo spots filled with her extracted pictures (`.artifacts/example-assets`)
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ImageElement, Slide } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'
import type { createSlideRenderer } from './index'

type Renderer = ReturnType<typeof createSlideRenderer>
type Save = (name: string, make: () => Promise<Uint8Array>) => Promise<void>

const read = (path: string): Uint8Array => new Uint8Array(readFileSync(path))

/** Her logo into `school logo` and one photo into every other spot. */
function filled(slide: Slide): Slide {
  return {
    ...slide,
    elements: slide.elements.map((element) => {
      if (element.type !== 'image' || element.assetId || !element.placeholder) return element
      const assetId = element.name === 'school logo' ? 'school_logo.jpg' : 'photo_p4.jpg'
      return { ...element, assetId } as ImageElement
    })
  }
}

export async function renderExamples(
  renderer: Renderer,
  save: Save,
  artifacts: string
): Promise<void> {
  const style = (
    JSON.parse(readFileSync(join(artifacts, 'example', 'profile.json'), 'utf8')) as {
      profile: StyleProfile
    }
  ).profile
  const stored = JSON.parse(
    readFileSync(join(artifacts, 'example', 'slides.json'), 'utf8')
  ) as Record<string, { slide: Slide }>
  const assets = {
    'school_logo.jpg': read(join(artifacts, 'example-assets', 'school_logo.jpg')),
    'photo_p4.jpg': read(join(artifacts, 'example-assets', 'photo_p4.jpg'))
  }
  for (const [index, { slide }] of Object.entries(stored)) {
    await save(`example-${index}-spots.png`, () => renderer.renderSlidePng({ slide, style }))
    await save(`example-${index}-filled.png`, () =>
      renderer.renderSlidePng({ slide: filled(slide), style, assets })
    )
  }
}
