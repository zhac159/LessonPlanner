/** Fake answers of the picture calls: deterministic names and descriptions, tiny SVG drawings. No network. */
import type { DescribedAsset, DescribeImageInput } from '@shared/ai/types'
import { slugifyAssetName, type AssetKind } from '@shared/assets'
import { sanitiseSvg } from '@shared/deck/svg'
import { fail, ok } from '@shared/result'
import { viewBoxFor } from '../prompts/pictures'
import { describedFrom, kindFromHint, SVG_VERSIONS_MAX } from '../schemas/pictures'

const titleCase = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

/** Words for the name: what is written near the picture, else its kind. */
function stemOf(image: DescribeImageInput, kind: AssetKind): string {
  const near = slugifyAssetName(image.nearbyText, 20)
  return near.length >= 2 && near !== kind ? near : kind.replace('-', '_')
}

export function fakeDescribe(images: DescribeImageInput[], taken: string[]) {
  const used = new Set(taken.map((name) => name.toLowerCase()))
  const described: DescribedAsset[] = images.map((image) => {
    const kind = kindFromHint(image.hint)
    const stem = stemOf(image, kind)
    const name = stem === kind.replace('-', '_') ? stem : `${stem}_${kind.replace('-', '_')}`
    return describedFrom(
      image.index,
      {
        title: titleCase(stem.replace(/_/g, ' ')).slice(0, 40),
        name,
        kind,
        description: `A ${kind.replace('-', ' ')} from the teacher’s decks${
          image.nearbyText.trim()
            ? `, near the words “${image.nearbyText.trim().slice(0, 40)}”`
            : ''
        }.`,
        tags: [kind],
        maybePupils: false,
        blurry: false
      },
      null,
      used
    )
  })
  return ok({ described })
}

export const fakeStyleDescription = (count: number) =>
  count === 0
    ? fail('invalid-input', 'Pick at least one picture to describe.')
    : ok({
        description:
          'Flat vector style with even 4 px dark blue outlines (#1F3A5F), solid fills in teal (#0E9AA7) and amber (#F2A900), rounded corners, no shading, a plain white background and very little detail.'
      })

const COLOURS = ['#0E9AA7', '#F2A900', '#6C5CE7', '#E4572E']

export function fakeSvgs(input: { prompt: string; kind: AssetKind; versions: number }) {
  if (input.kind === 'photo') return fail('invalid-input', 'A photograph can’t be drawn.')
  if (!input.prompt.trim()) return fail('invalid-input', 'Say what to draw.')
  const box = viewBoxFor(input.kind)
  const count = Math.min(SVG_VERSIONS_MAX, Math.max(1, Math.round(input.versions) || 1))
  const svgs = Array.from({ length: count }, (_, i) => {
    const r = Math.round(Math.min(box.w, box.h) / 4)
    const raw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.text}"><rect width="${box.w}" height="${box.h}" fill="#ffffff"/><circle cx="${box.w / 2}" cy="${box.h / 2}" r="${r + i * 8}" fill="${COLOURS[i % COLOURS.length]}" stroke="#1F3A5F" stroke-width="4"/></svg>`
    const clean = sanitiseSvg(raw)
    return clean.ok ? clean.svg : raw
  })
  return ok({ svgs })
}
