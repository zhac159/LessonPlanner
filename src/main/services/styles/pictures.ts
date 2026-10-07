/**
 * The picture step of learning a style (agents/ASSETS.md §5.1): the local extraction service reads every picture out of
 * each learned file (free, no Claude), the findings of all new files are grouped once, and per file the FACTS are stored
 * (`sources/<id>.pictures.json`: every slide with its kind, every picture with its box). The habits are built from those
 * facts (habits.ts), the grouped candidates go to the review queue as "Assets I found", naming them is the queue's job.
 */
import { readFile } from 'node:fs/promises'
import type { FileAnalysis } from '@shared/ai/types'
import type { PictureFact, SlideFact } from '@shared/assets/habits'
import type { PictureFactsFile } from '@shared/assets/schema'
import type { AssetKind } from '@shared/assets/types'
import type { SlideKind } from '@shared/deck/types'
import {
  extractAssets,
  groupFindings,
  type ExtractedImage,
  type Findings,
  type KindHint
} from '../../import/assets'
import { ImportError } from '../../import/errors'
import type { PagePicture } from './exemplars'

export type ExtractFn = typeof extractAssets

/** What one file gave: its pictures (with bytes, kept in memory only until the batch is made) and its slide count. */
export interface FileFindings {
  sourceId: string
  fileName: string
  units: number
  images: ExtractedImage[]
  analysis: FileAnalysis
  /** Pages that are a source plan: not slides, so they count nowhere. */
  planPages: readonly number[]
}

const ASSET_KIND: Readonly<Record<KindHint, AssetKind>> = {
  logo: 'logo',
  'symbol-card': 'symbol-card',
  photo: 'photo',
  icon: 'icon',
  banner: 'banner',
  other: 'picture'
}

/** Reads one stored file; throws what the extractor throws (ImportError) so the caller can isolate the failure. */
export async function extractFile(
  extract: ExtractFn,
  input: { path: string; fileName: string },
  signal?: AbortSignal
): Promise<{ units: number; images: ExtractedImage[]; scanned: boolean }> {
  const bytes = await readFile(input.path).then(
    (buffer) => new Uint8Array(buffer),
    () => Promise.reject(new ImportError('missing'))
  )
  const result = await extract({ name: input.fileName, bytes }, { signal })
  return { units: result.units, images: result.images, scanned: result.scanned }
}

export interface Grouped {
  findings: Findings
  /** Facts per source, ready to store. */
  facts: Map<string, PictureFactsFile>
  /** Occurrence id -> the name proposed for its group (for exemplar picture elements). */
  nameOf: Map<string, string>
}

const slidesOf = (file: FileFindings): SlideFact[] =>
  Array.from({ length: file.units }, (_, i) => i + 1)
    .filter((page) => !file.planPages.includes(page))
    .map((page) => ({
      sourceId: file.sourceId,
      slideNumber: page,
      slideKind: (file.analysis.slideKinds.find((k) => k.page === page)?.kind ??
        null) as SlideKind | null
    }))

/** Groups the findings of every file once and turns each file's pictures into facts keyed by their group. */
export function groupAndFacts(files: readonly FileFindings[]): Grouped {
  const findings = groupFindings(files.flatMap((f) => f.images))
  const groupOf = new Map<string, { key: string; kind: AssetKind; name: string }>()
  for (const asset of findings.assets)
    for (const id of asset.occurrenceIds)
      groupOf.set(id, { key: asset.id, kind: ASSET_KIND[asset.kind], name: asset.suggestedName })
  const facts = new Map<string, PictureFactsFile>()
  const nameOf = new Map<string, string>()
  for (const file of files) {
    const slides = slidesOf(file)
    const kindOf = new Map(slides.map((s) => [s.slideNumber, s.slideKind]))
    const seen = new Set<string>()
    const pictures: PictureFact[] = []
    for (const image of file.images) {
      const group = groupOf.get(image.id)
      if (!group || image.origin === 'background') continue
      nameOf.set(image.id, group.name)
      const shownOn =
        image.origin === 'layout' || image.origin === 'master'
          ? image.repeatedOn
          : [image.pageOrSlide]
      for (const page of shownOn) {
        const dedupe = `${group.key}#${page}`
        if (seen.has(dedupe) || file.planPages.includes(page)) continue
        seen.add(dedupe)
        pictures.push({
          sourceId: file.sourceId,
          slideNumber: page,
          slideKind: kindOf.get(page) ?? null,
          assetKey: group.key,
          box: { ...image.box },
          kind: group.kind
        })
      }
    }
    facts.set(file.sourceId, { schemaVersion: 1, slides, pictures })
  }
  return { findings, facts, nameOf }
}

/** The pictures of a file as exemplar picture elements (named by their group). */
export function pagePictures(
  file: FileFindings,
  nameOf: ReadonlyMap<string, string>
): PagePicture[] {
  return file.images.flatMap((image) => {
    const name = nameOf.get(image.id)
    return name && image.origin === 'slide'
      ? [
          {
            page: image.pageOrSlide,
            box: { ...image.box },
            name,
            alt: image.nearbyText.slice(0, 80)
          }
        ]
      : []
  })
}
