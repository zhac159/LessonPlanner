import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createHarness, type Harness } from './testing'

let h: Harness
beforeEach(() => {
  h = createHarness()
})
afterEach(() => h.cleanup())

const names = async () => (await h.service.listSummaries()).map((s) => s.name)

describe('create / list', () => {
  it('creates an empty draft with the default name and persists it', async () => {
    const { styleId } = await h.service.create()
    const summaries = await h.service.listSummaries()
    expect(summaries).toHaveLength(1)
    expect(summaries[0]).toMatchObject({
      id: styleId,
      name: 'My style',
      status: 'draft',
      deckCount: 0,
      learning: null
    })
    expect(existsSync(join(h.dir, styleId, 'profile.json'))).toBe(true)
    await expect(h.restart().listSummaries()).resolves.toHaveLength(1)
  })

  it('trims and limits names to 40 characters; blank falls back to the default', async () => {
    await h.service.create('  ' + 'x'.repeat(60))
    await h.service.create('   ')
    expect((await names()).sort()).toEqual(['My style', 'x'.repeat(40)])
  })

  it('emits `changed` with the updated list', async () => {
    await h.service.create('A')
    const changed = h.events.filter((e) => e.name === 'changed')
    expect(changed.at(-1)?.payload).toMatchObject([{ name: 'A' }])
  })

  it('lists the default first, then the most recently changed', async () => {
    const a = await h.service.create('A')
    await h.service.create('B')
    const c = await h.service.create('C')
    await h.service.update(a.styleId, { name: 'A2' }) // most recently changed non-default is now A2
    expect(await names()).toEqual(['A2', 'C', 'B'])
    await h.service.setDefault(c.styleId)
    expect((await names())[0]).toBe('C')
  })

  it('reports unknown styles as not-found', async () => {
    expect(await h.service.get('nope')).toMatchObject({ ok: false, code: 'not-found' })
    expect(await h.service.save('nope')).toMatchObject({ ok: false, code: 'not-found' })
    expect(await h.service.update('nope', { name: 'x' })).toMatchObject({
      ok: false,
      code: 'not-found'
    })
    expect(await h.service.delete('nope')).toMatchObject({ ok: false, code: 'not-found' })
  })
})

describe('default style invariant', () => {
  const defaults = async () => (await h.service.listSummaries()).filter((s) => s.isDefault)

  it('makes the first style the default and keeps exactly one', async () => {
    const a = await h.service.create('A')
    const b = await h.service.create('B')
    expect((await defaults()).map((s) => s.id)).toEqual([a.styleId])
    await h.service.setDefault(b.styleId)
    expect((await defaults()).map((s) => s.id)).toEqual([b.styleId])
    await h.service.update(a.styleId, { isDefault: true })
    expect((await defaults()).map((s) => s.id)).toEqual([a.styleId])
  })

  it('ignores un-ticking the only default', async () => {
    const a = await h.service.create('A')
    const result = await h.service.update(a.styleId, { isDefault: false })
    expect(result).toMatchObject({ ok: true, style: { isDefault: true } })
    expect(await defaults()).toHaveLength(1)
  })

  it('promotes another style when the default is deleted', async () => {
    const a = await h.service.create('A')
    await h.service.create('B')
    await h.service.delete(a.styleId)
    expect(await defaults()).toMatchObject([{ name: 'B' }])
  })

  it('repairs a store with no or several defaults when loading', async () => {
    const a = await h.service.create('A')
    const b = await h.service.create('B')
    await h.service.setDefault(a.styleId)
    // make both default on disk, then restart
    const { atomicWriteJson, readJsonSafe } = await import('../fsx')
    const file = join(h.dir, b.styleId, 'profile.json')
    const raw = (await readJsonSafe<Record<string, unknown>>(file))!
    await atomicWriteJson(file, { ...raw, isDefault: true })
    const restarted = h.restart()
    expect((await restarted.listSummaries()).filter((s) => s.isDefault)).toHaveLength(1)
  })

  it('exposes the default profile for lesson generation', async () => {
    expect(await h.service.getDefaultProfile()).toBeUndefined()
    const a = await h.service.create('A')
    expect((await h.service.getDefaultProfile())?.id).toBe(a.styleId)
    expect((await h.service.getProfile(a.styleId))?.name).toBe('A')
    expect(await h.service.getProfile('nope')).toBeUndefined()
  })
})

describe('update (rename)', () => {
  it('renames, marks the name as user-chosen and persists', async () => {
    const { styleId } = await h.service.create()
    const result = await h.service.update(styleId, { name: '  Form time ' })
    expect(result).toMatchObject({ ok: true, style: { name: 'Form time', nameSource: 'user' } })
    expect((await h.restart().get(styleId)) as { style: { name: string } }).toMatchObject({
      style: { name: 'Form time', nameSource: 'user' }
    })
  })

  it('refuses an empty name with the screen’s message and changes nothing', async () => {
    const { styleId } = await h.service.create('Keep')
    expect(await h.service.update(styleId, { name: '   ' })).toMatchObject({
      ok: false,
      code: 'invalid-input',
      message: 'Give this style a name.'
    })
    expect(await names()).toEqual(['Keep'])
  })
})

describe('delete', () => {
  it('removes the style and its folder', async () => {
    const { styleId } = await h.service.create()
    await h.service.delete(styleId)
    expect(await h.service.listSummaries()).toEqual([])
    expect(existsSync(join(h.dir, styleId))).toBe(false)
  })
})

describe('save', () => {
  it('needs at least one learned file', async () => {
    const { styleId } = await h.service.create()
    expect(await h.service.save(styleId)).toMatchObject({ ok: false, code: 'invalid-input' })
  })

  it('turns a learned draft into a ready style and emits changed', async () => {
    const { styleId } = await h.service.create()
    await h.service.addFiles(styleId, [await h.pptx('a.pptx')])
    await h.service.whenIdle(styleId)
    const saved = await h.service.save(styleId)
    expect(saved).toMatchObject({ ok: true, style: { id: styleId, status: 'ready', deckCount: 1 } })
    expect(h.events.at(-1)?.name).toBe('changed')
  })
})
