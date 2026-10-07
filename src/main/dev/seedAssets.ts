/**
 * The `assets` seed (agents/ASSETS.md §2.7): the twelve assets of design A1 written into
 * `<dataRoot>/modules/assets` through the real store (so the files, `meta.json` and the index are exactly what
 * the app writes). The newest is `school_logo`, so the grid reads like the mock-up.
 *
 * Also written: the pending review batch (the "12 assets found" banner, `./seedReview`).
 * Not seeded: the "14 lessons" counts, because `usedIn` is rebuilt from the real lessons when the app starts.
 */
import { join } from 'node:path'
import { LICENCES } from '@shared/assets/credits'
import type { AssetFoundIn, AssetKind, AssetSource } from '@shared/assets/types'
import { AssetStore } from '../services/assets/store'
import { createPureImageTools } from '../services/assets/thumbs'
import { SCIENCE_STYLE_ID } from './seedData'
import { SEED_ART } from './seedAssetArt'
import { writeSeedReview } from './seedReview'

export const assetsDir = (dataRoot: string): string => join(dataRoot, 'modules', 'assets')

interface SeedAsset {
  name: string
  title: string
  kind: AssetKind
  description: string
  tags: string[]
  from: 'deck' | 'upload' | 'online' | 'made'
  /** How many other decks it was found in (deck assets). */
  alsoIn?: number
}

/** The mock-up's order, first card first. */
const ASSETS: readonly SeedAsset[] = [
  {
    name: 'school_logo',
    title: 'School logo',
    kind: 'logo',
    description:
      'School crest: navy shield with a gold chevron and star. Goes in the top-right corner of title slides.',
    tags: ['logo', 'title slides'],
    from: 'deck',
    alsoIn: 23
  },
  {
    name: 'do_now_banner',
    title: 'Do Now banner',
    kind: 'banner',
    description: 'A teal rounded banner reading DO NOW, used at the top of starter slides.',
    tags: ['starter', 'do now'],
    from: 'deck',
    alsoIn: 17
  },
  {
    name: 'owl_mascot',
    title: 'Owl mascot',
    kind: 'character',
    description: 'A friendly brown owl with big eyes, used to point at tips and key words.',
    tags: ['owl', 'mascot'],
    from: 'deck',
    alsoIn: 8
  },
  {
    name: 'beaker_icon',
    title: 'Beaker',
    kind: 'icon',
    description:
      'Line icon of a conical flask half full of teal liquid. Practical and experiment slides.',
    tags: ['practical', 'lab'],
    from: 'upload'
  },
  {
    name: 'microscope_icon',
    title: 'Microscope',
    kind: 'icon',
    description: 'Line icon of a microscope. Cells and observation slides.',
    tags: ['cells', 'lab'],
    from: 'upload'
  },
  {
    name: 'leaf_icon',
    title: 'Leaf',
    kind: 'icon',
    description: 'A green leaf with a midrib. Plants and photosynthesis.',
    tags: ['plants', 'leaf'],
    from: 'upload'
  },
  {
    name: 'timer_icon',
    title: '5-minute timer',
    kind: 'icon',
    description: 'A stopwatch with a gold wedge showing five minutes. Timed tasks.',
    tags: ['timer', 'activity'],
    from: 'upload'
  },
  {
    name: 'lightbulb_icon',
    title: 'Lightbulb',
    kind: 'icon',
    description: 'A gold lightbulb. Ideas, tips and challenge questions.',
    tags: ['idea', 'challenge'],
    from: 'made'
  },
  {
    name: 'mini_whiteboard_icon',
    title: 'Mini-whiteboard',
    kind: 'icon',
    description: 'A small whiteboard on a stand. Show-me activities.',
    tags: ['activity', 'whiteboard'],
    from: 'upload'
  },
  {
    name: 'plant_cell_diagram',
    title: 'Plant cell',
    kind: 'diagram',
    description: 'Simple diagram of a plant cell with nucleus and chloroplasts.',
    tags: ['cells', 'plants', 'diagram'],
    from: 'deck',
    alsoIn: 2
  },
  {
    name: 'leaf_cross_section',
    title: 'Leaf cross-section',
    kind: 'diagram',
    description:
      'Layers of a leaf in cross-section: top skin, palisade cells, spongy layer and bottom skin.',
    tags: ['plants', 'photosynthesis', 'diagram'],
    from: 'deck',
    alsoIn: 1
  },
  {
    name: 'forest_photo',
    title: 'Forest photo',
    kind: 'picture',
    description: 'A sunny forest with green hills and blue sky.',
    tags: ['forest', 'habitat'],
    from: 'online'
  }
]

const foundIn = (count: number): AssetFoundIn[] => [
  {
    styleId: SCIENCE_STYLE_ID,
    sourceId: 'src_science_ks3_01',
    fileName: 'Y8 Photosynthesis.pptx',
    page: 1
  },
  ...Array.from({ length: count }, (_, i) => ({
    styleId: SCIENCE_STYLE_ID,
    sourceId: `src_science_ks3_${String(i + 2).padStart(2, '0')}`,
    fileName: `Science deck ${i + 2}.pptx`,
    page: 1
  }))
]

/** Writes the twelve assets, oldest first, a few seconds apart, all before `now`. Returns their ids by name. */
export async function writeSeedAssets(dataRoot: string, now: Date): Promise<Map<string, string>> {
  let tick = now.getTime() - 10 * 60_000
  const store = new AssetStore({
    dir: assetsDir(dataRoot),
    tools: createPureImageTools(),
    now: () => new Date((tick += 1000))
  })
  await store.load()
  const ids = new Map<string, string>()
  for (const spec of [...ASSETS].reverse()) {
    const at = new Date(tick).toISOString()
    const source: AssetSource =
      spec.from === 'deck'
        ? {
            kind: 'extracted',
            styleId: SCIENCE_STYLE_ID,
            fileName: 'Y8 Photosynthesis.pptx',
            page: 1,
            at
          }
        : spec.from === 'online'
          ? { kind: 'online', provider: 'wikimedia', at }
          : spec.from === 'made'
            ? { kind: 'generated', model: 'claude-svg', prompt: spec.description, basedOn: [], at }
            : { kind: 'uploaded', fileName: `${spec.name}.svg`, at }
    const asset = await store.create({
      bytes: new TextEncoder().encode(SEED_ART[spec.name]!),
      ext: '.svg',
      name: spec.name,
      title: spec.title,
      kind: spec.kind,
      description: spec.description,
      tags: spec.tags,
      source,
      licence:
        spec.from === 'online'
          ? LICENCES['cc-by-sa']
          : spec.from === 'made'
            ? LICENCES.generated
            : LICENCES.unknown,
      credit:
        spec.from === 'online'
          ? {
              text: '“Forest” by A. Photographer, CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Source: Wikimedia Commons.',
              inNotes: true,
              provider: 'wikimedia',
              author: 'A. Photographer',
              title: 'Forest',
              pageUrl: 'https://commons.wikimedia.org/wiki/File:Forest.jpg',
              licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/'
            }
          : null,
      foundIn: spec.from === 'deck' ? foundIn(spec.alsoIn ?? 0) : []
    })
    ids.set(spec.name, asset.id)
  }
  await writeSeedReview(assetsDir(dataRoot), now)
  return ids
}
