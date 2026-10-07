/**
 * Picture credits: a picture that needs one (or was made by AI) gets one plain line in the speaker notes of
 * every slide that uses it, and never twice (agents/ASSETS.md §6). The line itself is built ONCE, when the
 * asset is saved, by `attributionCredit` in src/main/services/imageProviders/attribution.ts and kept as
 * `AssetCredit.text`; this file only places it. Pure.
 */
import type { Slide } from '../deck/types'
import type { Asset, AssetLicence, LicenceId } from './types'

export const CREDIT_PREFIX = 'Picture credit: '

/** The licences the app knows by id, with the label a teacher reads and whether a credit is required. */
export const LICENCES: Readonly<Record<LicenceId, AssetLicence>> = {
  own: { id: 'own', label: 'Yours', requiresCredit: false },
  unknown: { id: 'unknown', label: 'From your files', requiresCredit: false },
  generated: { id: 'generated', label: 'Made for you', requiresCredit: false },
  cc0: { id: 'cc0', label: 'CC0', requiresCredit: false },
  'public-domain': { id: 'public-domain', label: 'Public domain', requiresCredit: false },
  'cc-by': { id: 'cc-by', label: 'CC BY', requiresCredit: true },
  'cc-by-sa': { id: 'cc-by-sa', label: 'CC BY-SA', requiresCredit: true },
  'cc-by-nc': { id: 'cc-by-nc', label: 'CC BY-NC', requiresCredit: true },
  'cc-by-nc-sa': { id: 'cc-by-nc-sa', label: 'CC BY-NC-SA', requiresCredit: true },
  'cc-by-nc-nd': { id: 'cc-by-nc-nd', label: 'CC BY-NC-ND', requiresCredit: true },
  'cc-by-nd': { id: 'cc-by-nd', label: 'CC BY-ND', requiresCredit: true },
  pexels: { id: 'pexels', label: 'Pexels licence', requiresCredit: true },
  unsplash: { id: 'unsplash', label: 'Unsplash licence', requiresCredit: true },
  other: { id: 'other', label: 'Check the licence', requiresCredit: true }
}

/** Licence codes of the provider layer (`LicenceCode` in imageProviders/types.ts) mapped to ours. */
const PROVIDER_CODES: Readonly<Record<string, LicenceId>> = {
  cc0: 'cc0',
  pdm: 'public-domain',
  by: 'cc-by',
  'by-sa': 'cc-by-sa',
  'by-nd': 'cc-by-nd',
  'by-nc': 'cc-by-nc',
  'by-nc-sa': 'cc-by-nc-sa',
  'by-nc-nd': 'cc-by-nc-nd',
  pexels: 'pexels',
  unsplash: 'unsplash'
}

/** Our licence for a provider's code; anything unrecognised is `other` ("Check the licence"). */
export const licenceFromProviderCode = (code: string): LicenceId =>
  PROVIDER_CODES[code.trim().toLowerCase()] ?? 'other'

/** Licences the "Free to use in lessons" filter keeps (credit allowed; no non-commercial or no-derivatives). */
export const FREE_TO_USE_LICENCES: readonly LicenceId[] = [
  'cc0',
  'public-domain',
  'cc-by',
  'cc-by-sa',
  'pexels',
  'unsplash'
]

export const isFreeToUse = (licence: Pick<AssetLicence, 'id'>): boolean =>
  FREE_TO_USE_LICENCES.includes(licence.id)

type Creditable = Pick<Asset, 'credit'>

/** The note line for a picture, or null when it needs none (her own pictures, CC0, public domain). */
export function creditLine(asset: Creditable): string | null {
  const credit = asset.credit
  if (!credit?.inNotes) return null
  const text = credit.text.trim()
  return text ? `${CREDIT_PREFIX}${text}` : null
}

/** `notes` with `line` appended on its own line, unchanged when it is already there. */
export function appendCreditLine(notes: string | undefined, line: string): string {
  if (!notes) return line
  if (notes.split('\n').some((existing) => existing.trim() === line)) return notes
  return `${notes.replace(/\s+$/, '')}\n${line}`
}

/** Credit lines for every picture on a slide whose asset needs one, in slide order, without repeats. */
export function creditLinesForSlide(
  slide: Slide,
  assetsById: ReadonlyMap<string, Creditable>
): string[] {
  const lines: string[] = []
  for (const element of slide.elements) {
    if (element.type !== 'image' || !element.assetId) continue
    const asset = assetsById.get(element.assetId)
    const line = asset ? creditLine(asset) : null
    if (line && !lines.includes(line)) lines.push(line)
  }
  return lines
}

/** The speaker notes to export: the slide's own notes plus any credit line that is missing (the safety net). */
export function notesWithCredits(
  slide: Slide,
  assetsById: ReadonlyMap<string, Creditable>
): string | undefined {
  return creditLinesForSlide(slide, assetsById).reduce<string | undefined>(
    (notes, line) => appendCreditLine(notes, line),
    slide.notes
  )
}
