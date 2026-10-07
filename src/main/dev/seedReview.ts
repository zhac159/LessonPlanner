/**
 * The pending review batch of the `assets` seed (agents/ASSETS.md §2.7): "Found 12 · keeping 9" of design A2 and the
 * "12 assets found while learning your Science KS3 style" banner of A1. Written with the review queue's own disk
 * layout (`review/<batchId>/batch.json`, pictures, thumbnails), so the app loads it like any batch that survived a
 * restart. Nine are ticked; `class_photo`, `school_logo_old` and `hills_photo` are left out with their reasons.
 */
import type { AssetKind } from '@shared/assets/types'
import { ReviewDisk } from '../services/assets/review/disk'
import { REVIEW_SCHEMA_VERSION, type StoredCandidate } from '../services/assets/review/types'
import { createPureImageTools, THUMB_SIDE } from '../services/assets/thumbs'
import { SCIENCE_STYLE_ID } from './seedData'
import { SEED_ART } from './seedAssetArt'

const PEOPLE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect width="120" height="90" rx="8" fill="#f1dcc9"/>' +
  '<circle cx="42" cy="38" r="12" fill="#b08968"/><circle cx="80" cy="38" r="12" fill="#c69c7b"/>' +
  '<path d="M20 84 C20 62 64 62 64 84 Z" fill="#7a4e3a"/><path d="M58 84 C58 62 102 62 102 84 Z" fill="#8a5a44"/></svg>'

interface Spec {
  name: string
  title: string
  kind: AssetKind
  art: string
  decks: number
  hint: StoredCandidate['hint']
  /** Why it starts unticked. */
  out?: 'pupils' | 'blurry' | 'older'
}

const SPECS: readonly Spec[] = [
  {
    name: 'school_logo',
    title: 'School logo',
    kind: 'logo',
    art: SEED_ART.school_logo!,
    decks: 24,
    hint: 'logo'
  },
  {
    name: 'do_now_banner',
    title: 'Do Now banner',
    kind: 'banner',
    art: SEED_ART.do_now_banner!,
    decks: 18,
    hint: 'banner'
  },
  {
    name: 'owl_mascot',
    title: 'Owl mascot',
    kind: 'character',
    art: SEED_ART.owl_mascot!,
    decks: 9,
    hint: 'other'
  },
  {
    name: 'beaker_icon',
    title: 'Beaker',
    kind: 'icon',
    art: SEED_ART.beaker_icon!,
    decks: 11,
    hint: 'icon'
  },
  {
    name: 'microscope_icon',
    title: 'Microscope',
    kind: 'icon',
    art: SEED_ART.microscope_icon!,
    decks: 6,
    hint: 'icon'
  },
  {
    name: 'timer_icon',
    title: '5-minute timer',
    kind: 'icon',
    art: SEED_ART.timer_icon!,
    decks: 12,
    hint: 'icon'
  },
  {
    name: 'plant_cell_diagram',
    title: 'Plant cell',
    kind: 'diagram',
    art: SEED_ART.plant_cell_diagram!,
    decks: 3,
    hint: 'other'
  },
  {
    name: 'leaf_icon',
    title: 'Leaf',
    kind: 'icon',
    art: SEED_ART.leaf_icon!,
    decks: 7,
    hint: 'icon'
  },
  {
    name: 'mini_whiteboard_icon',
    title: 'Mini-whiteboard',
    kind: 'icon',
    art: SEED_ART.mini_whiteboard_icon!,
    decks: 16,
    hint: 'icon'
  },
  {
    name: 'class_photo',
    title: 'Class photo',
    kind: 'photo',
    art: PEOPLE,
    decks: 1,
    hint: 'photo',
    out: 'pupils'
  },
  {
    name: 'school_logo_old',
    title: 'Old school logo',
    kind: 'logo',
    art: SEED_ART.school_logo!.replace('#1f3a6e', '#3a4a70'),
    decks: 2,
    hint: 'logo',
    out: 'older'
  },
  {
    name: 'hills_photo',
    title: 'Hills',
    kind: 'picture',
    art: SEED_ART.forest_photo!,
    decks: 1,
    hint: 'photo',
    out: 'blurry'
  }
]

type SeedFile = readonly [name: string, kind: 'pptx' | 'pdf', found: number]

const FILES: readonly SeedFile[] = [
  ['Y8 Photosynthesis.pptx', 'pptx', 4],
  ['Y7 Cells and organelles.pdf', 'pdf', 3],
  ['Y9 Forces recap.pptx', 'pptx', 2],
  ...Array.from({ length: 5 }, (_, i): SeedFile => [
    `Science deck ${i + 4}.pptx`,
    'pptx',
    i === 0 ? 3 : 0
  ])
]

export const SEED_REVIEW_BATCH_ID = 'rvb_seed_science'

/** Writes the batch into `<assets dir>/review`. */
export async function writeSeedReview(assetsDir: string, now: Date): Promise<void> {
  const disk = new ReviewDisk(assetsDir)
  const tools = createPureImageTools()
  const at = new Date(now.getTime() - 5 * 60_000).toISOString()
  const encoder = new TextEncoder()
  const candidates: StoredCandidate[] = []
  for (const [i, spec] of SPECS.entries()) {
    const id = `rc_seed_${String(i + 1).padStart(2, '0')}`
    const bytes = encoder.encode(spec.art)
    const seen = await tools.inspect(bytes, '.svg')
    const older = spec.out === 'older' ? 'rc_seed_01' : null
    const candidate: StoredCandidate = {
      id,
      fileId: 'rvf_seed_01',
      foundId: id,
      occurrences: [id],
      name: spec.name,
      title: spec.title,
      kind: spec.kind,
      description: `${spec.title} from the Science KS3 decks.`,
      tags: [spec.kind],
      ext: '.svg',
      width: seen?.width ?? 120,
      height: seen?.height ?? 120,
      bytes: bytes.byteLength,
      sha256: `seed${i}`.padEnd(64, '0'),
      keep: !spec.out,
      suggestedKeep: !spec.out,
      extractorReason:
        spec.out === 'blurry' ? 'blurry' : spec.out === 'older' ? 'older-version' : null,
      duplicateOf: null,
      olderOf: older,
      claudePupils: spec.out === 'pupils',
      hint: spec.hint,
      nearbyText: '',
      fileNames: [FILES[0][0]],
      named: true,
      edited: [],
      foundIn: Array.from({ length: spec.decks }, (_, n) => ({
        styleId: SCIENCE_STYLE_ID,
        sourceId: `src_science_ks3_${String(n + 1).padStart(2, '0')}`,
        fileName: n === 0 ? FILES[0][0] : `Science deck ${n + 1}.pptx`,
        page: 1
      })),
      source: { kind: 'extracted', styleId: SCIENCE_STYLE_ID, fileName: FILES[0][0], page: 1, at },
      licence: { id: 'unknown', label: 'From your files', requiresCredit: false },
      credit: null,
      autoName: true
    }
    candidates.push(candidate)
    await disk.writePicture(SEED_REVIEW_BATCH_ID, candidate, bytes)
    const thumb = await tools.scale(bytes, '.svg', THUMB_SIDE)
    if (thumb) await disk.writeThumb(SEED_REVIEW_BATCH_ID, id, thumb.png)
  }
  await disk.save({
    schemaVersion: REVIEW_SCHEMA_VERSION,
    id: SEED_REVIEW_BATCH_ID,
    origin: { kind: 'style', styleId: SCIENCE_STYLE_ID, styleName: 'Science KS3' },
    startedAt: at,
    files: FILES.map(([name, kind, found], i) => ({
      id: `rvf_seed_${String(i + 1).padStart(2, '0')}`,
      name,
      kind,
      found,
      state: 'done' as const,
      progress: null
    })),
    working: false,
    candidates
  })
}
