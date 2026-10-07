import { describe, expect, it } from 'vitest'
import { badgePng } from '../testing'
import { createPureImageTools } from '../thumbs'
import { kindFromHint, leftOutOf, pictureFileOf, refreshSuggestions } from './candidates'
import type { StoredCandidate } from './types'

function candidate(id: string, over: Partial<StoredCandidate> = {}): StoredCandidate {
  return {
    id,
    fileId: 'f',
    foundId: id,
    occurrences: [id],
    name: id,
    title: id,
    kind: 'picture',
    description: '',
    tags: [],
    ext: '.png',
    width: 10,
    height: 10,
    bytes: 1,
    sha256: id,
    keep: true,
    suggestedKeep: true,
    extractorReason: null,
    duplicateOf: null,
    olderOf: null,
    claudePupils: false,
    hint: 'other',
    nearbyText: '',
    fileNames: [],
    named: false,
    edited: [],
    foundIn: [],
    source: { kind: 'uploaded', fileName: 'a.png', at: '' },
    licence: { id: 'unknown', label: 'From your files', requiresCredit: false },
    credit: null,
    autoName: true,
    ...over
  }
}

const byId = (list: StoredCandidate[]) => new Map(list.map((c) => [c.id, c]))

describe('why a picture is unticked', () => {
  it('puts a library duplicate first, then possible pupils, then the extractor reason', () => {
    const all = [
      candidate('a', { duplicateOf: 'school_logo', claudePupils: true, extractorReason: 'blurry' }),
      candidate('b', { claudePupils: true, extractorReason: 'blurry' }),
      candidate('c', { extractorReason: 'low-resolution' }),
      candidate('d')
    ]
    const map = byId(all)
    expect(all.map((c) => leftOutOf(c, map))).toEqual([
      { reason: 'duplicate', ofName: 'school_logo' },
      { reason: 'pupils' },
      { reason: 'low-resolution' },
      null
    ])
  })

  it('names the better copy for an older version, and follows its renames', () => {
    const better = candidate('new', { name: 'school_logo' })
    const older = candidate('old', { olderOf: 'new', extractorReason: 'older-version' })
    expect(leftOutOf(older, byId([better, older]))).toEqual({
      reason: 'older-version',
      ofName: 'school_logo'
    })
    better.name = 'crest'
    expect(leftOutOf(older, byId([better, older]))?.ofName).toBe('crest')
  })

  it('moves the tick with the suggestion unless she changed it', () => {
    const untouched = candidate('u', { keep: true, suggestedKeep: true, claudePupils: true })
    const hers = candidate('h', { keep: false, suggestedKeep: true, claudePupils: true })
    const overridden = candidate('o', { keep: true, suggestedKeep: false, claudePupils: true })
    refreshSuggestions([untouched, hers, overridden])
    expect(untouched).toMatchObject({ keep: false, suggestedKeep: false })
    expect(hers).toMatchObject({ keep: false, suggestedKeep: false })
    // she ticked a left-out picture: it stays ticked
    expect(overridden).toMatchObject({ keep: true, suggestedKeep: false })
  })

  it('never keeps a duplicate ticked', () => {
    const dup = candidate('d', { duplicateOf: 'x', keep: true, suggestedKeep: false })
    refreshSuggestions([dup])
    expect(dup.keep).toBe(false)
  })
})

describe('what the library can hold', () => {
  const tools = createPureImageTools()

  it('passes PNG through byte for byte and measures it', async () => {
    const bytes = badgePng(64)
    const file = await pictureFileOf({ bytes, mime: 'image/png' }, tools)
    expect(file).toMatchObject({ ext: '.png', width: 64, height: 64 })
    expect(file?.bytes).toEqual(bytes)
    expect(file?.sha256).toHaveLength(64)
  })

  it('leaves out formats it cannot save and pictures it cannot read', async () => {
    expect(await pictureFileOf({ bytes: badgePng(), mime: 'image/x-emf' }, tools)).toBeNull()
    expect(
      await pictureFileOf({ bytes: new Uint8Array([1, 2, 3]), mime: 'image/png' }, tools)
    ).toBeNull()
  })

  it('maps the extractor hint to a kind', () => {
    expect(kindFromHint('other')).toBe('picture')
    expect(kindFromHint('symbol-card')).toBe('symbol-card')
  })
})
