import type { LicenceCode, LicenceInfo } from './types'

interface Base {
  label: string
  attribution: boolean
  commercial: boolean
  free: boolean
}

const BASE: Record<LicenceCode, Base> = {
  cc0: { label: 'CC0', attribution: false, commercial: true, free: true },
  pdm: { label: 'Public domain', attribution: false, commercial: true, free: true },
  by: { label: 'CC BY', attribution: true, commercial: true, free: true },
  'by-sa': { label: 'CC BY-SA', attribution: true, commercial: true, free: true },
  'by-nd': { label: 'CC BY-ND', attribution: true, commercial: true, free: false },
  'by-nc': { label: 'CC BY-NC', attribution: true, commercial: false, free: false },
  'by-nc-sa': { label: 'CC BY-NC-SA', attribution: true, commercial: false, free: false },
  'by-nc-nd': { label: 'CC BY-NC-ND', attribution: true, commercial: false, free: false },
  // Free-library licences: free for lessons, and the libraries ask for a credit ("Photo by X on Pexels").
  pexels: { label: 'Pexels licence', attribution: true, commercial: true, free: true },
  unsplash: { label: 'Unsplash licence', attribution: true, commercial: true, free: true },
  other: { label: 'Unknown licence', attribution: true, commercial: false, free: false }
}

const FIXED_URL: Partial<Record<LicenceCode, string>> = {
  cc0: 'https://creativecommons.org/publicdomain/zero/1.0/',
  pdm: 'https://creativecommons.org/publicdomain/mark/1.0/',
  pexels: 'https://www.pexels.com/license/',
  unsplash: 'https://unsplash.com/license'
}

const CODES = Object.keys(BASE) as LicenceCode[]
const isCode = (value: string): value is LicenceCode => (CODES as string[]).includes(value)

/** Build a `LicenceInfo` from a canonical code (and optionally the version and the provider's own licence URL). */
export function licenceFromCode(code: string, version?: string, url?: string): LicenceInfo {
  const key = code.trim().toLowerCase()
  const known: LicenceCode = isCode(key) ? key : 'other'
  const base = BASE[known]
  const cleanVersion = version && /^\d(\.\d)?$/.test(version) ? version : undefined
  let name = base.label
  if (known.startsWith('by') && cleanVersion) name = `${name} ${cleanVersion}`
  if (known === 'cc0') name = cleanVersion ? `CC0 ${cleanVersion}` : 'CC0'
  if (known === 'other' && code.trim()) name = code.trim()
  const fallback =
    FIXED_URL[known] ??
    (known.startsWith('by') && cleanVersion
      ? `https://creativecommons.org/licenses/${known}/${cleanVersion}/`
      : '')
  return {
    code: known,
    name,
    url: url && /^https?:\/\//.test(url) ? url : fallback,
    requiresAttribution: base.attribution,
    commercialOk: base.commercial
  }
}

/** Free to use in lessons: CC0, public domain, CC BY, CC BY-SA and the free-library licences. */
export function isFreeToUse(licence: Pick<LicenceInfo, 'code'>): boolean {
  return BASE[licence.code].free
}

/**
 * Read a licence from free text as Wikimedia Commons writes it ("CC BY-SA 4.0", "cc-by-sa-4.0", "Public domain",
 * "CC0"). Anything not recognised becomes `other` (never free).
 */
export function parseLicenceText(text: string, url?: string): LicenceInfo {
  const t = text.trim().toLowerCase()
  if (!t) return licenceFromCode('other', undefined, url)
  if (/^cc[- ]?0\b/.test(t) || /^cc[- ]zero\b/.test(t) || /\bcc0\b/.test(t)) {
    return licenceFromCode('cc0', '1.0', url)
  }
  const cc = /\bcc[- ]by((?:[- ](?:nc|nd|sa))*)(?:[- ](\d(?:\.\d)?))?/.exec(t)
  if (cc) {
    const parts = cc[1].split(/[- ]/)
    const code = [
      'by',
      parts.includes('nc') && 'nc',
      parts.includes('sa') && 'sa',
      parts.includes('nd') && 'nd'
    ]
      .filter(Boolean)
      .join('-')
    return licenceFromCode(code, cc[2], url)
  }
  if (/public domain|^pd\b|^pd-|\bpdm\b|no known copyright|no restrictions/.test(t)) {
    return licenceFromCode('pdm', undefined, url)
  }
  return licenceFromCode('other', undefined, url)
}
