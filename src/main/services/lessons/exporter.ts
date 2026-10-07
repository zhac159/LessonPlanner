/** "Export to PowerPoint" for one lesson (06 §8.11): Save dialog, then `exportToFile`, then a typed outcome. */
import { basename, extname } from 'node:path'
import type { Asset } from '@shared/assets/types'
import type { ExportResult } from '@shared/contracts/deck-builder'
import type { Deck } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'
import { exportSpotsStatus } from '../../export/spots'
import { defaultExportName, exportToFile } from '../../export/save'
import type { DialogPort } from './types'

const MISSING_FONT = /The font “(.+?)” may not be installed/

/** The family names the exporter warned about. */
export function missingFontsOf(warnings: readonly string[]): string[] {
  return warnings.flatMap((w) => MISSING_FONT.exec(w)?.[1] ?? [])
}

export interface ExportLessonInput {
  deck: Deck
  style: StyleProfile | null
  readAsset(assetId: string): Promise<Uint8Array | undefined>
  dialogs: Pick<DialogPort, 'pickSavePath'>
  installedFonts?: ReadonlySet<string>
  /** Library pictures used in the deck, for the "Picture credit:" safety net in the notes. */
  assetCredits?: ReadonlyMap<string, Pick<Asset, 'credit'>>
  /** "Export anyway": skip the empty-picture-spot warning. */
  ignoreSpots?: boolean
}

/**
 * Asks where to save, writes the `.pptx` atomically and reports what happened. Empty picture spots come first: they
 * never export, so unless she chose "Export anyway" the answer is `spots` and no dialog opens. Never throws.
 */
export async function exportLesson(input: ExportLessonInput): Promise<ExportResult> {
  const { deck } = input
  if (deck.slides.length === 0)
    return { status: 'error', code: 'io', message: 'There are no slides to export yet.' }
  const spots = input.ignoreSpots ? null : exportSpotsStatus(deck)
  if (spots) return spots
  const picked = await input.dialogs.pickSavePath(defaultExportName(deck))
  if (!picked) return { status: 'cancelled' }
  const path = extname(picked).toLowerCase() === '.pptx' ? picked : `${picked}.pptx`
  const result = await exportToFile(
    deck,
    input.style,
    {
      readAsset: input.readAsset,
      installedFonts: input.installedFonts,
      assetCredits: input.assetCredits
    },
    path
  )
  if (!result.ok)
    return {
      status: 'error',
      code: result.code === 'file-locked' ? 'file-locked' : 'io',
      message: result.message
    }
  return {
    status: 'saved',
    path: result.path,
    fileName: basename(result.path),
    missingFonts: missingFontsOf(result.warnings)
  }
}

/** Remembers the files this session exported: only those may be opened or shown later (06 §6). */
export class LessonExports {
  private readonly exported = new Set<string>()

  /** Exports and remembers the saved path. */
  async run(input: ExportLessonInput): Promise<ExportResult> {
    const result = await exportLesson(input)
    if (result.status === 'saved') this.exported.add(result.path)
    return result
  }

  /** True for paths this session exported. */
  wasExported(path: string): boolean {
    return this.exported.has(path)
  }
}
