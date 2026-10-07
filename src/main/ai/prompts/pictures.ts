/**
 * Prompts of the picture calls (agents/ASSETS.md §5.2, §5.6). The instruction strings are the stable head of
 * the cached prompt: no ids, times or other per-call data in them. Per-call facts go in the user message.
 */
import type { DescribeImageInput } from '@shared/ai/types'
import { ASSET_NAME_MAX, ASSET_NAME_MIN, aspectRatioFor, type AssetKind } from '@shared/assets'

export const DESCRIBE_INSTRUCTIONS = `You label pictures from a teacher's old slide decks so she can reuse them. For each numbered picture give:
- title: 1 to 4 words saying what it is ("School logo").
- name: lower_snake_case, ${ASSET_NAME_MIN} to ${ASSET_NAME_MAX} characters, the subject first and the kind as a suffix where natural (beaker_icon, school_logo, do_now_banner, forest_photo).
- kind: logo, icon, picture (an illustration or AI scene), photo (a real photograph), diagram, banner, character, or symbol-card (a word and a picture in a bordered card).
- description: 1 to 2 plain sentences another AI could use to decide where the picture fits. Mention colours, subject and any text on it, and where it usually goes if the hints say so.
- tags: up to 5 lower-case words.
- maybePupils: true if the picture shows people who could be children in a school.
- blurry: true if it is clearly low quality.
- olderVersionOf: the number of a clearly better copy of the same picture in this batch, else -1.
British spelling. Never invent text you cannot read, and do not name a specific place, person or artwork unless it is written on the picture. A school's own logo is named school_logo. Do not use any name from the taken list. Answer for every numbered picture, once each.`

/** Label placed right before each image block, so the numbers cannot drift. */
export const pictureLabel = (index: number): string => `Picture ${index}:`

/** The text after the images: the extractor's facts per number, the names in use, and the ask. */
export function describeTask(images: DescribeImageInput[], taken: string[]): string {
  const facts = images.map((image) => {
    const parts = [
      `Picture ${image.index}`,
      `looks like: ${image.hint === 'other' ? 'unknown' : image.hint}`,
      image.nearbyText.trim() ? `text near it: "${image.nearbyText.trim().slice(0, 160)}"` : '',
      image.fileNames.length ? `from: ${image.fileNames.slice(0, 3).join(', ')}` : ''
    ]
    return `- ${parts.filter(Boolean).join(' · ')}`
  })
  return [
    'What the app already knows about each picture (a hint, it can be wrong):',
    ...facts,
    `Names already taken: ${taken.length ? taken.slice(0, 200).join(', ') : 'none'}`,
    `Label all ${images.length} picture${images.length === 1 ? '' : 's'}.`
  ].join('\n')
}

export const STYLE_INSTRUCTIONS = `You describe the visual style of a set of pictures so an illustrator can match it.`

export const STYLE_TASK = `Describe the visual style shared by these pictures in one paragraph of at most 60 words, as instructions for an illustrator: line weight and colour, fill colours (name them and give hex codes if clear), shading or flat, corner shape, level of detail, background, and how realistic it is. Do not describe what the pictures show, and ignore any card frame, border or caption around a picture: describe the drawing itself. Plain text, no lists.`

/** The viewBox for a kind, from the picture maker's aspect ratio. */
export function viewBoxFor(kind: AssetKind): { w: number; h: number; text: string } {
  const ratio = aspectRatioFor(kind)
  const [w, h] = ratio === '21:9' ? [420, 180] : ratio === '4:3' ? [400, 300] : [400, 400]
  return { w, h, text: `0 0 ${w} ${h}` }
}

export const SVG_INSTRUCTIONS = `You draw simple, clean vector pictures for a teacher's slides, as complete SVG documents.

Rules for every drawing:
- One <svg> element with xmlns and the viewBox you are given, nothing outside it. No width or height attributes.
- Only shapes and paths: rect, circle, ellipse, line, polyline, polygon, path, g, defs and marker. No images, no scripts, no styles, no filters, no gradients, no fonts, no external references.
- No text, letters or numbers unless the request asks for words (then use <text> with font-family sans-serif).
- One clear subject, centred, with a generous margin. Flat, clean shapes, a handful of colours, a plain white or transparent background. No frame, border or card around the picture.
- No real or recognisable people; no faces of children.
- Follow the style description exactly when one is given (stroke weight, fill colours, corner shape).
When asked for several versions, make them clearly different takes on the same request.`

export function svgTask(input: {
  prompt: string
  styleDescription: string
  kind: AssetKind
  versions: number
}): string {
  const box = viewBoxFor(input.kind)
  return [
    `Draw ${input.versions} version${input.versions === 1 ? '' : 's'} of: ${input.prompt.trim()}`,
    `Kind of picture: ${input.kind}.`,
    `Use viewBox="${box.text}" in every drawing.`,
    input.styleDescription.trim()
      ? `Match this style: ${input.styleDescription.trim()}`
      : 'No style description: use a clean, friendly flat style.',
    `Return exactly ${input.versions} complete SVG document${input.versions === 1 ? '' : 's'}.`
  ].join('\n')
}
