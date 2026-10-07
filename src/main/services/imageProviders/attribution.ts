/**
 * Credit lines for speaker notes. One builder for every source, so a found picture, an Unsplash photo and an
 * AI-made picture are credited in the same plain, copyable style.
 */
import type { LicenceInfo } from './types'

export interface CreditSource {
  title?: string
  author?: string
  authorUrl?: string
  /** Display name of the library ("Wikimedia Commons"). */
  source?: string
  sourceUrl?: string
  licence?: Pick<LicenceInfo, 'code' | 'name' | 'url' | 'requiresAttribution'>
  /** Set for AI-made pictures, e.g. "Nano Banana Pro". */
  generatedBy?: string
}

const clean = (value: string | undefined): string => (value ?? '').replace(/\s+/g, ' ').trim()

/** The credit line for one asset, or '' when nothing needs crediting (her own upload). */
export function attributionCredit(asset: CreditSource): string {
  const generatedBy = clean(asset.generatedBy)
  if (generatedBy) return `Picture made with ${generatedBy} (AI-generated).`
  const title = clean(asset.title)
  const author = clean(asset.author)
  const source = clean(asset.source)
  const url = clean(asset.sourceUrl)
  const licence = asset.licence
  if (!licence && !source && !url) return ''
  const where = source ? `${source}${url ? ` (${url})` : ''}` : url

  if (licence?.code === 'pexels' || licence?.code === 'unsplash') {
    const site = licence.code === 'pexels' ? 'Pexels' : 'Unsplash'
    const by = author ? ` by ${author}${asset.authorUrl ? ` (${clean(asset.authorUrl)})` : ''}` : ''
    return `Photo${by} on ${site}${url ? ` (${url})` : ''}.`
  }
  const parts: string[] = []
  parts.push(
    title
      ? `“${title}”${author ? ` by ${author}` : ''}`
      : author
        ? `Picture by ${author}`
        : 'Picture'
  )
  if (licence) {
    const free = licence.requiresAttribution ? '' : ' (no credit needed)'
    parts.push(`${licence.name}${licence.url ? ` (${licence.url})` : ''}${free}`)
  }
  let line = parts.join(', ')
  if (where) line += `. Source: ${where}`
  return `${line}.`
}

/** The "Picture credits" paragraph for a slide's speaker notes: unique lines, '' when none. */
export function creditsForNotes(assets: CreditSource[]): string {
  const lines = [...new Set(assets.map(attributionCredit).filter(Boolean))]
  return lines.length ? `Picture credits: ${lines.join(' ')}` : ''
}
