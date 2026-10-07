/** Sample pictures and assets for the gallery and its tests: simple SVG shapes, no files. */
import { LICENCES } from '@shared/assets/credits'
import type { AssetDetail } from '@shared/contracts/assets'
import type { PickerAsset } from './AssetPicker/AssetPicker'

/** An inline SVG picture as a data URL (sample content, not interface colour). */
export const svg = (shapes: string, background = 'none'): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${background}"/>${shapes}</svg>`
  )}`

const shield = svg(
  '<path d="M32 8 52 16v16c0 12-9 20-20 24C21 52 12 44 12 32V16z" fill="#1f3a6e"/><path d="M22 32l10 8 10-8" stroke="#e0b030" stroke-width="5" fill="none"/>'
)
const banner = svg(
  '<rect x="6" y="22" width="52" height="20" rx="4" fill="#0e7c6b"/><rect x="14" y="30" width="36" height="4" rx="2" fill="#fff"/>'
)
const owl = svg(
  '<circle cx="32" cy="34" r="20" fill="#8a5a2b"/><circle cx="24" cy="30" r="6" fill="#fff"/><circle cx="40" cy="30" r="6" fill="#fff"/><circle cx="24" cy="30" r="2.5" fill="#000"/><circle cx="40" cy="30" r="2.5" fill="#000"/>'
)
const beaker = svg(
  '<path d="M26 8h12v16l12 26a4 4 0 0 1-4 6H18a4 4 0 0 1-4-6l12-26z" fill="none" stroke="#1b1530" stroke-width="3"/><path d="M20 40h24l5 12H15z" fill="#5cc4b5"/>'
)
const leaf = svg('<path d="M12 52C12 24 32 10 54 10 54 36 40 54 12 52z" fill="#3fae4a"/>')
const timer = svg(
  '<circle cx="32" cy="36" r="18" fill="none" stroke="#1b1530" stroke-width="3"/><path d="M32 36V24" stroke="#1b1530" stroke-width="3"/><path d="M32 36l12 4" stroke="#f2c230" stroke-width="5"/>'
)
const bulb = svg(
  '<circle cx="32" cy="28" r="14" fill="#f7d44c"/><rect x="26" y="44" width="12" height="8" rx="2" fill="#1b1530"/>'
)
const board = svg(
  '<rect x="8" y="12" width="48" height="32" rx="3" fill="none" stroke="#1b1530" stroke-width="3"/><path d="M20 52l12-8 12 8" stroke="#1b1530" stroke-width="3" fill="none"/>'
)
const cell = svg(
  '<rect x="8" y="10" width="48" height="44" rx="10" fill="#cfe9c4" stroke="#2f8f4e" stroke-width="3"/><circle cx="34" cy="30" r="8" fill="#a98bd8"/>'
)
const section = svg(
  '<rect x="8" y="12" width="48" height="8" rx="3" fill="#bfe3b4"/><rect x="14" y="26" width="6" height="14" rx="3" fill="#4cae5c"/><rect x="26" y="26" width="6" height="14" rx="3" fill="#4cae5c"/><rect x="38" y="26" width="6" height="14" rx="3" fill="#4cae5c"/><rect x="8" y="46" width="48" height="8" rx="3" fill="#bfe3b4"/>'
)
const forest = svg(
  '<rect width="64" height="64" fill="#cfe3f7"/><path d="M0 52 22 30 40 46 52 36 64 52V64H0z" fill="#46a35e"/><circle cx="18" cy="16" r="5" fill="#f7d44c"/>'
)

/** Volcano-style pictures for the online results. */
export const volcano = svg(
  '<path d="M6 56 26 18h12l20 38z" fill="#8a6f64"/><rect x="29" y="20" width="6" height="36" fill="#ff6b3d"/>',
  '#fdf0c4'
)

export const lavaNight = svg(
  '<path d="M6 56 26 22h12l20 34z" fill="#5a3a2e"/><path d="M24 4l8 14 8-14z" fill="#ff6b3d"/>',
  '#2e2a3a'
)

const base = (
  name: string,
  title: string,
  kind: PickerAsset['kind'],
  thumbDataUrl: string,
  lastUsedAt: string | null = null
): PickerAsset => ({
  id: `ast_${name}`,
  name,
  title,
  kind,
  thumbDataUrl,
  tags: [],
  lastUsedAt,
  createdAt: '2026-03-01T00:00:00Z'
})

/** The twelve assets of A1, newest use first among the first three. */
export const SAMPLE_ASSETS: PickerAsset[] = [
  base('school_logo', 'School logo', 'logo', shield, '2026-03-03T10:00:00Z'),
  base('do_now_banner', 'Do Now banner', 'banner', banner, '2026-03-02T10:00:00Z'),
  base('owl_mascot', 'Owl mascot', 'character', owl),
  base('beaker_icon', 'Beaker', 'icon', beaker),
  base('microscope_icon', 'Microscope', 'icon', beaker),
  base('leaf_icon', 'Leaf', 'icon', leaf),
  base('timer_icon', '5-minute timer', 'icon', timer, '2026-03-01T10:00:00Z'),
  base('lightbulb_icon', 'Lightbulb', 'icon', bulb),
  base('mini_whiteboard_icon', 'Mini-whiteboard', 'icon', board),
  base('plant_cell_diagram', 'Plant cell', 'diagram', cell),
  base('leaf_cross_section', 'Leaf cross-section', 'diagram', section),
  base('forest_photo', 'Forest photo', 'picture', forest)
]

/** Lessons used, as on the A1 mockup. */
export const SAMPLE_USED: Record<string, number> = {
  school_logo: 14,
  do_now_banner: 18,
  owl_mascot: 9,
  beaker_icon: 11,
  microscope_icon: 6,
  leaf_icon: 7,
  timer_icon: 12,
  lightbulb_icon: 5,
  mini_whiteboard_icon: 16,
  plant_cell_diagram: 3,
  leaf_cross_section: 2,
  forest_photo: 1
}

export const SAMPLE_DETAIL: AssetDetail = {
  ...SAMPLE_ASSETS[0]!,
  lastUsedAt: '2026-03-03T10:00:00Z',
  createdAt: '2026-03-01T00:00:00Z',
  tags: ['logo', 'title slides'],
  width: 512,
  height: 512,
  sourceKind: 'extracted',
  licenceBadge: null,
  usedInCount: 14,
  foundInCount: 24,
  description:
    'School crest: navy shield with a gold chevron and star. Goes in the top-right corner of title slides.',
  source: {
    kind: 'extracted',
    styleId: null,
    fileName: 'Y8 Photosynthesis.pptx',
    page: 1,
    at: '2026-03-01T00:00:00Z'
  },
  licence: LICENCES.unknown,
  credit: null,
  foundIn: [
    { styleId: null, sourceId: 's1', fileName: 'Y8 Photosynthesis.pptx', page: 1 },
    ...Array.from({ length: 23 }, (_, i) => ({
      styleId: null,
      sourceId: `s${i + 2}`,
      fileName: `Deck ${i + 2}.pptx`,
      page: 1
    }))
  ],
  bytes: 24_000,
  previewDataUrl: shield
}

export interface SampleResult {
  id: string
  title: string
  providerLabel: string
  licence: (typeof LICENCES)[keyof typeof LICENCES]
  thumbSrc: string
}

export const SAMPLE_RESULTS: SampleResult[] = [
  {
    id: 'r1',
    title: 'Volcano cross-section',
    providerLabel: 'Wikimedia Commons',
    licence: LICENCES['cc-by-sa'],
    thumbSrc: volcano
  },
  {
    id: 'r2',
    title: 'Eruption at night',
    providerLabel: 'Openverse',
    licence: LICENCES['cc-by'],
    thumbSrc: lavaNight
  },
  {
    id: 'r3',
    title: 'Cartoon volcano',
    providerLabel: 'Openverse',
    licence: LICENCES['public-domain'],
    thumbSrc: volcano
  },
  {
    id: 'r4',
    title: 'Volcano illustration',
    providerLabel: 'Openverse',
    licence: LICENCES.cc0,
    thumbSrc: volcano
  },
  {
    id: 'r5',
    title: 'Lava flow',
    providerLabel: 'Openverse',
    licence: LICENCES['cc-by-nc'],
    thumbSrc: lavaNight
  },
  {
    id: 'r6',
    title: 'Mount Etna from the south',
    providerLabel: 'Wikimedia Commons',
    licence: LICENCES['cc-by-sa'],
    thumbSrc: volcano
  }
]
