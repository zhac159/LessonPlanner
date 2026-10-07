import { describe, expect, it } from 'vitest'
import type { Slide } from '../deck/types'
import {
  CREDIT_PREFIX,
  LICENCES,
  appendCreditLine,
  creditLine,
  creditLinesForSlide,
  isFreeToUse,
  licenceFromProviderCode,
  notesWithCredits
} from './credits'
import type { AssetCredit } from './types'

const credit = (over: Partial<AssetCredit> = {}): AssetCredit => ({
  text: '"Volcano diagram" by A. Author, CC BY-SA 4.0 (https://example.org/by-sa). Source: Wikimedia Commons (https://commons.example/v).',
  inNotes: true,
  provider: 'wikimedia',
  author: 'A. Author',
  title: 'Volcano diagram',
  pageUrl: 'https://commons.example/v',
  licenceUrl: null,
  ...over
})

describe('creditLine', () => {
  it('prefixes the stored credit text', () => {
    expect(creditLine({ credit: credit() })).toBe(`${CREDIT_PREFIX}${credit().text}`)
  })
  it('is null when no credit is needed, empty or missing', () => {
    expect(creditLine({ credit: credit({ inNotes: false }) })).toBeNull()
    expect(creditLine({ credit: credit({ text: '  ' }) })).toBeNull()
    expect(creditLine({ credit: null })).toBeNull()
  })
  it('credits an AI-made picture with its own line', () => {
    const made = credit({
      text: 'Picture made with Nano Banana Pro (AI-generated).',
      provider: null,
      author: null,
      title: null,
      pageUrl: null
    })
    expect(creditLine({ credit: made })).toBe(
      'Picture credit: Picture made with Nano Banana Pro (AI-generated).'
    )
  })
})

describe('appendCreditLine and the export safety net', () => {
  it('appends on a new line and never twice', () => {
    expect(appendCreditLine(undefined, 'L')).toBe('L')
    expect(appendCreditLine('Notes\n', 'L')).toBe('Notes\nL')
    expect(appendCreditLine('Notes\nL', 'L')).toBe('Notes\nL')
  })

  const image = (id: string, assetId?: string): Slide['elements'][number] => ({
    id,
    type: 'image',
    x: 0,
    y: 0,
    w: 10,
    h: 10,
    fit: 'cover',
    alt: '',
    ...(assetId ? { assetId } : { placeholder: { description: 'spot' } })
  })
  const slide: Slide = {
    id: 's',
    kind: 'content',
    notes: 'Say hello',
    elements: [image('a', 'ast_1'), image('b', 'ast_1'), image('c', 'ast_2'), image('d')]
  }
  const assets = new Map([
    ['ast_1', { credit: credit() }],
    ['ast_2', { credit: credit({ inNotes: false }) }]
  ])

  it('collects one line per picture that needs a credit', () => {
    expect(creditLinesForSlide(slide, assets)).toHaveLength(1)
    expect(notesWithCredits(slide, assets)?.startsWith('Say hello\nPicture credit: ')).toBe(true)
    expect(notesWithCredits({ ...slide, elements: [] }, assets)).toBe('Say hello')
  })
})

describe('licences', () => {
  it('keeps CC0, public domain, CC BY, CC BY-SA and the free libraries only', () => {
    const free = ['cc0', 'public-domain', 'cc-by', 'cc-by-sa', 'pexels', 'unsplash'] as const
    expect(free.every((id) => isFreeToUse({ id }))).toBe(true)
    const notFree = ['cc-by-nc', 'cc-by-nd', 'cc-by-nc-nd', 'other', 'unknown', 'own'] as const
    expect(notFree.some((id) => isFreeToUse({ id }))).toBe(false)
  })

  it('maps the provider layer’s codes to ours', () => {
    expect(licenceFromProviderCode('by-sa')).toBe('cc-by-sa')
    expect(licenceFromProviderCode('PDM')).toBe('public-domain')
    expect(licenceFromProviderCode('by-nc-nd')).toBe('cc-by-nc-nd')
    expect(licenceFromProviderCode('mystery')).toBe('other')
    expect(LICENCES[licenceFromProviderCode('by')].requiresCredit).toBe(true)
  })
})
