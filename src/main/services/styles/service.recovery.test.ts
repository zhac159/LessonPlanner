import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createHarness, type Harness } from './testing'

let h: Harness
beforeEach(() => {
  h = createHarness()
})
afterEach(() => h.cleanup())

async function learnedStyle(...names: string[]) {
  const { styleId } = await h.service.create('Science')
  await h.service.addFiles(
    styleId,
    names.map((n) => h.pdf(n))
  )
  await h.service.whenIdle(styleId)
  return styleId
}
const damage = (id: string, file: string, content = '{ not json') =>
  writeFileSync(join(h.dir, id, file), content)
const get = async (service: typeof h.service, id: string) => {
  const result = await service.get(id)
  if (!result.ok) throw new Error('missing style')
  return result.style
}

describe('recovery from damaged files', () => {
  it('restores the latest history version when profile.json is corrupt', async () => {
    const id = await learnedStyle('a.pdf') // synthesis wrote history/profile.v2.json
    damage(id, 'profile.json')
    const style = await get(h.restart(), id)
    expect(style.name).toBe('Science KS3') // the synthesised, auto-named version
    expect(style.profile?.version).toBe(2)
    expect(style.files).toHaveLength(1)
  })

  it('rebuilds a draft from the sources when profile.json and history are both gone', async () => {
    const id = await learnedStyle('a.pdf', 'b.pdf')
    damage(id, 'profile.json')
    rmSync(join(h.dir, id, 'history'), { recursive: true })
    const style = await get(h.restart(), id)
    expect(style.name).toBe('Recovered style')
    expect(style.files.map((f) => f.name)).toEqual(['a.pdf', 'b.pdf'])
    expect(style.files.every((f) => f.status === 'learned')).toBe(true) // analyses were still on disk
  })

  it('treats a profile that fails validation like a corrupt one', async () => {
    const id = await learnedStyle('a.pdf')
    damage(id, 'profile.json', JSON.stringify({ schemaVersion: 1, id, name: 'bad' }))
    expect((await get(h.restart(), id)).profile?.version).toBe(2)
  })

  it('still rejects duplicates after meta.json was lost (hashes are recomputed)', async () => {
    const id = await learnedStyle('a.pdf')
    damage(id, 'meta.json')
    const restarted = h.restart()
    const again = await restarted.addFiles(id, [h.pdf('a.pdf')])
    expect(again).toMatchObject({
      ok: true,
      added: 0,
      rejected: [{ name: 'a.pdf', reason: 'duplicate' }]
    })
  })

  it('re-learns a file whose analysis is corrupt', async () => {
    const id = await learnedStyle('a.pdf')
    const sourceId = (await get(h.service, id)).files[0].id
    damage(id, `sources/${sourceId}.analysis.json`)
    const before = h.stub.analysed.length
    const restarted = h.restart()
    expect((await get(restarted, id)).files[0].status).toBe('waiting')
    await restarted.resumePending()
    await restarted.whenIdle(id)
    expect((await get(restarted, id)).files[0].status).toBe('learned')
    expect(h.stub.analysed.length).toBe(before + 1)
  })

  it('ignores stray files and empty folders in the styles folder', async () => {
    const id = await learnedStyle('a.pdf')
    writeFileSync(join(h.dir, 'notes.txt'), 'hi')
    mkdirSync(join(h.dir, 'empty-folder'))
    expect((await h.restart().listSummaries()).map((s) => s.id)).toEqual([id])
  })

  it('leaves no temp files behind after normal use', async () => {
    const id = await learnedStyle('a.pdf', 'b.pdf')
    const leftovers = readdirSync(join(h.dir, id), { recursive: true }).filter((n) =>
      String(n).endsWith('.tmp')
    )
    expect(leftovers).toEqual([])
  })
})
