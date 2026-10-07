import { readdirSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fail, ok } from '@shared/result'
import { createHarness, type Harness } from './testing'

let h: Harness
beforeEach(() => {
  h = createHarness()
})
afterEach(() => h.cleanup())

async function learnedStyle() {
  const { styleId } = await h.service.create()
  await h.service.addFiles(styleId, [h.pdf('a.pdf')])
  await h.service.whenIdle(styleId)
  return styleId
}
const view = async (id: string) => {
  const result = await h.service.get(id)
  if (!result.ok) throw new Error('missing style')
  return result.style
}

describe('correct', () => {
  it('applies the correction, bumps the version, records it and keeps history', async () => {
    const id = await learnedStyle() // synthesis made version 2
    const result = await h.service.correct(id, '  I never use yellow on title slides ')
    expect(result).toEqual({ ok: true, message: 'Got it', version: 3 })
    expect(h.stub.correctCalls).toEqual(['I never use yellow on title slides'])
    const profile = (await h.service.getProfile(id))!
    expect(profile.habits).toContain('Correction: I never use yellow on title slides')
    expect(profile.corrections).toMatchObject([
      { text: 'I never use yellow on title slides', appliedInVersion: 3 }
    ])
    const style = await view(id)
    expect(style.corrections).toHaveLength(1)
    expect(style.profile?.version).toBe(3)
    expect(readdirSync(`${h.dir}/${id}/history`).sort()).toEqual([
      'profile.v2.json',
      'profile.v3.json'
    ])
  })

  it('emits the new profile in a progress event and persists across a restart', async () => {
    const id = await learnedStyle()
    await h.service.correct(id, 'Use Arial')
    const last = h.progress().at(-1)!
    expect(last.partialProfile?.version).toBe(3)
    const restarted = await h.restart().get(id)
    expect(restarted.ok && restarted.style.corrections).toHaveLength(1)
  })

  it('numbers successive corrections and keeps all of them', async () => {
    const id = await learnedStyle()
    await h.service.correct(id, 'one')
    await h.service.correct(id, 'two')
    const profile = (await h.service.getProfile(id))!
    expect(profile.version).toBe(4)
    expect(profile.corrections.map((c) => [c.text, c.appliedInVersion])).toEqual([
      ['one', 3],
      ['two', 4]
    ])
  })

  it('refuses blank text and styles with nothing learned, without calling Claude', async () => {
    const id = await learnedStyle()
    expect(await h.service.correct(id, '   ')).toMatchObject({ ok: false, code: 'invalid-input' })
    const empty = (await h.service.create()).styleId
    expect(await h.service.correct(empty, 'x')).toMatchObject({ ok: false, code: 'invalid-input' })
    expect(await h.service.correct('nope', 'x')).toMatchObject({ ok: false, code: 'not-found' })
    expect(h.stub.correctCalls).toEqual([])
  })

  it('passes the AI error through and changes nothing', async () => {
    const id = await learnedStyle()
    h.stub.correctResult = () => fail('overloaded', 'Claude is busy')
    expect(await h.service.correct(id, 'x')).toMatchObject({ ok: false, code: 'overloaded' })
    expect((await h.service.getProfile(id))?.version).toBe(2)
    expect((await view(id)).corrections).toEqual([])
  })

  it('rejects a corrected profile that does not validate', async () => {
    const id = await learnedStyle()
    h.stub.correctResult = (profile) => {
      const broken = structuredClone(profile)
      broken.tokens.colors.text.hex = 'navy'
      return ok({ profile: broken, message: 'Done' })
    }
    expect(await h.service.correct(id, 'x')).toMatchObject({ ok: false, code: 'invalid-input' })
    expect((await h.service.getProfile(id))?.tokens.colors.text.hex).not.toBe('navy')
  })

  it('does not let the AI change identity, default flag or sources', async () => {
    const id = await learnedStyle()
    h.stub.correctResult = (profile) =>
      ok({
        profile: { ...profile, id: 'evil', isDefault: false, sources: [] },
        message: 'ok'
      })
    await h.service.correct(id, 'x')
    const profile = (await h.service.getProfile(id))!
    expect(profile).toMatchObject({ id, isDefault: true })
    expect(profile.sources).toHaveLength(1)
    expect((await h.service.listSummaries())[0].id).toBe(id)
  })

  it('survives new files: the local vote never overwrites a correction', async () => {
    const id = await learnedStyle()
    await h.service.correct(id, 'keep me')
    h.stub.synthResult = () => fail('overloaded', 'busy') // so only the local merge could change habits
    await h.service.addFiles(id, [h.pdf('b.pdf')])
    await h.service.whenIdle(id)
    expect((await h.service.getProfile(id))?.habits).toContain('Correction: keep me')
  })
})
