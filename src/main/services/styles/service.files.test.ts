import { existsSync, rmSync, truncateSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fail } from '@shared/result'
import { makeAnalysis } from '@shared/style/testing'
import { makePdf, makePptx } from '../../import/testing'
import { MAX_FILE_BYTES } from '../../import/validate'
import { StyleStore } from './store'
import { createHarness, type Harness } from './testing'

let h: Harness
beforeEach(() => {
  h = createHarness()
})
afterEach(() => h.cleanup())

const view = async (id: string) => {
  const result = await h.service.get(id)
  if (!result.ok) throw new Error('missing style')
  return result.style
}
const newStyle = async () => (await h.service.create()).styleId
const fileId = async (id: string, name: string) =>
  (await view(id)).files.find((f) => f.name === name)!.id

describe('addFiles', () => {
  it('copies files into the style so the originals can move, and queues them', async () => {
    const id = await newStyle()
    const original = await h.pptx('a.pptx')
    const result = await h.service.addFiles(id, [original])
    expect(result).toEqual({ ok: true, added: 1, rejected: [] })
    rmSync(original) // the teacher tidies her Downloads folder
    await h.service.whenIdle(id)
    const style = await view(id)
    expect(style.files[0]).toMatchObject({
      name: 'a.pptx',
      kind: 'pptx',
      status: 'learned',
      units: 1
    })
    expect(existsSync(join(h.dir, id, 'sources', `${style.files[0].id}.pptx`))).toBe(true)
    expect(existsSync(join(h.dir, id, 'sources', `${style.files[0].id}.analysis.json`))).toBe(true)
  })

  it('queues a batch sorted by name (numeric), and later batches after it', async () => {
    h.stub.hold('Lesson 1.pdf') // keep everything in the queue while we look
    const id = await newStyle()
    await h.service.addFiles(id, [
      h.pdf('Lesson 10.pdf'),
      h.pdf('Lesson 2.pdf'),
      h.pdf('Lesson 1.pdf')
    ])
    await h.service.addFiles(id, [h.pdf('Another.pdf')])
    expect((await view(id)).files.map((f) => f.name)).toEqual([
      'Lesson 1.pdf',
      'Lesson 2.pdf',
      'Lesson 10.pdf',
      'Another.pdf'
    ])
  })

  it('rejects other types, old .ppt files and duplicates with the contract reasons', async () => {
    const id = await newStyle()
    const first = await h.pptx('a.pptx')
    await h.service.addFiles(id, [first])
    const result = await h.service.addFiles(id, [
      h.raw('notes.docx', 'x'),
      h.raw('old.ppt', 'x'),
      h.raw('copy-of-a.pptx', await (await import('node:fs/promises')).readFile(first))
    ])
    expect(result).toEqual({
      ok: true,
      added: 0,
      rejected: [
        { name: 'copy-of-a.pptx', reason: 'duplicate' },
        { name: 'notes.docx', reason: 'type' },
        { name: 'old.ppt', reason: 'old-ppt' }
      ]
    })
    expect((await view(id)).files).toHaveLength(1)
  })

  it('rejects files over 50 MB', async () => {
    const id = await newStyle()
    const big = h.raw('big.pdf', '')
    truncateSync(big, MAX_FILE_BYTES + 1)
    expect(await h.service.addFiles(id, [big])).toMatchObject({
      added: 0,
      rejected: [{ name: 'big.pdf', reason: 'too-large' }]
    })
  })

  it('stops at the per-style file limit (50 in the app, 4 here)', async () => {
    h = createHarness({ limits: { maxFiles: 4 } })
    const id = await newStyle()
    const paths = Array.from({ length: 6 }, (_, i) => h.raw(`f${i}.pptx`, `junk ${i}`))
    const result = await h.service.addFiles(id, paths)
    expect(result).toMatchObject({ ok: true, added: 4 })
    expect(result.ok && result.rejected).toEqual([
      { name: 'f4.pptx', reason: 'limit' },
      { name: 'f5.pptx', reason: 'limit' }
    ])
    await h.service.whenIdle(id)
  })

  it('flags files whose text may contain pupil names or contact details', async () => {
    const id = await newStyle()
    await h.service.addFiles(id, [
      h.raw(
        'contacts.pptx',
        await makePptx([{ title: 'Contact', body: 'mrs.smith@school.org.uk' }])
      ),
      h.raw('register.pdf', makePdf(['Email mr.jones@school.org.uk for the class register'])),
      await h.pptx('clean.pptx')
    ])
    await h.service.whenIdle(id)
    const flags = Object.fromEntries((await view(id)).files.map((f) => [f.name, f.mayContainNames]))
    expect(flags).toEqual({ 'contacts.pptx': true, 'register.pdf': true, 'clean.pptx': false })
  })

  it('reports unknown styles', async () => {
    expect(await h.service.addFiles('nope', [])).toMatchObject({ ok: false, code: 'not-found' })
  })
})

describe('createDraft', () => {
  it('creates a style from dropped files and starts learning them', async () => {
    const result = await h.service.createDraft([await h.pptx('a.pptx'), h.raw('x.docx', 'x')])
    if (!result.ok) throw new Error(result.message)
    expect(result).toMatchObject({ added: 1, rejected: [{ name: 'x.docx', reason: 'type' }] })
    await h.service.whenIdle(result.styleId)
    expect((await view(result.styleId)).progress.learned).toBe(1)
  })

  it('creates nothing when no file can be added', async () => {
    const result = await h.service.createDraft([h.raw('x.docx', 'x')])
    expect(result).toMatchObject({ ok: false, code: 'invalid-input' })
    expect(await h.service.listSummaries()).toEqual([])
    expect(existsSync(h.dir) ? (await import('node:fs')).readdirSync(h.dir) : []).toEqual([])
  })
})

describe('removeFile', () => {
  it('drops a waiting file from the queue before it is ever read', async () => {
    h.stub.hold('a.pdf')
    h.stub.hold('b.pdf')
    const id = await newStyle()
    await h.service.addFiles(id, [h.pdf('a.pdf'), h.pdf('b.pdf'), h.pdf('c.pdf')])
    await expect.poll(() => h.stub.inFlight).toBe(2)
    const removed = await h.service.removeFile(id, await fileId(id, 'c.pdf'))
    expect(removed.ok).toBe(true)
    h.stub.clearHolds()
    await h.service.whenIdle(id)
    expect(h.stub.analysed).not.toContain('c.pdf')
    expect((await view(id)).files.map((f) => f.name)).toEqual(['a.pdf', 'b.pdf'])
  })

  it('cancels the request of a file being read and never counts it', async () => {
    h.stub.hold('a.pdf')
    const id = await newStyle()
    await h.service.addFiles(id, [h.pdf('a.pdf'), h.pdf('b.pdf')])
    await expect.poll(() => h.stub.inFlight).toBe(2 - 1)
    await h.service.removeFile(id, await fileId(id, 'a.pdf'))
    await h.service.whenIdle(id)
    const style = await view(id)
    expect(style.files.map((f) => [f.name, f.status])).toEqual([['b.pdf', 'learned']])
    expect(h.stub.synthCalls).toEqual([{ name: 'My style', files: 1, existing: false }])
  })

  it('recomputes the panel from the remaining files when a learned file is removed', async () => {
    h.stub.results.set('red.pdf', {
      ok: true,
      analysis: makeAnalysis({
        colors: [{ hex: '#FF0000', role: 'accent', evidence: '', frequency: 'most' }]
      })
    })
    const id = await newStyle()
    await h.service.addFiles(id, [h.pdf('red.pdf')])
    await h.service.whenIdle(id)
    // a second file with teal; synthesised profile now holds the red file's colours
    await h.service.addFiles(id, [h.pdf('teal.pdf')])
    await h.service.whenIdle(id)
    const before = await view(id)
    expect(before.progress.learned).toBe(2)

    await h.service.removeFile(id, await fileId(id, 'red.pdf'))
    const after = await view(id)
    expect(after.files.map((f) => f.name)).toEqual(['teal.pdf'])
    expect(after.progress).toMatchObject({ learned: 1, total: 1 })
    expect(after.profile).not.toBeNull()
  })

  it('re-synthesises once, 10 s (here 5 ms) after the last removal', async () => {
    const id = await newStyle()
    await h.service.addFiles(id, [h.pdf('a.pdf'), h.pdf('b.pdf'), h.pdf('c.pdf')])
    await h.service.whenIdle(id)
    expect(h.stub.synthCalls).toHaveLength(1)
    await h.service.removeFile(id, await fileId(id, 'a.pdf'))
    await h.service.removeFile(id, await fileId(id, 'b.pdf'))
    await expect.poll(() => h.stub.synthCalls.length).toBe(2)
    await h.service.whenIdle(id)
    expect(h.stub.synthCalls[1]).toEqual({ name: 'Science KS3', files: 1, existing: true })
    expect(h.stub.synthCalls).toHaveLength(2)
  })

  it('removes a failed file without a fuss, and reports unknown ids', async () => {
    h.stub.results.set('a.pdf', fail('overloaded', 'busy'))
    const id = await newStyle()
    await h.service.addFiles(id, [h.pdf('a.pdf')])
    await h.service.whenIdle(id)
    expect(await h.service.removeFile(id, await fileId(id, 'a.pdf'))).toMatchObject({ ok: true })
    expect((await view(id)).files).toEqual([])
    expect(await h.service.removeFile(id, 'nope')).toMatchObject({ ok: false, code: 'not-found' })
  })

  it('leaves no learned files: Save is impossible again and the panel is empty', async () => {
    const id = await newStyle()
    await h.service.addFiles(id, [h.pdf('a.pdf')])
    await h.service.whenIdle(id)
    await h.service.removeFile(id, await fileId(id, 'a.pdf'))
    expect((await view(id)).profile).toBeNull()
    expect(await h.service.save(id)).toMatchObject({ ok: false })
  })
})

describe('whenIdle', () => {
  it('also waits for the job’s closing save, so nothing deletes the folder under it', async () => {
    const id = await newStyle()
    await h.service.addFiles(id, [h.pdf('a.pdf')])
    await h.service.whenIdle(id)
    // A second job (retrying the file), with its closing save held back.
    const jobs = (h.service as unknown as { core: { jobs: Map<string, unknown> } }).core.jobs
    const realSave = StyleStore.prototype.save
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => (release = resolve))
    let closingSaveStarted = false
    let sawJob = false
    const spy = vi.spyOn(StyleStore.prototype, 'save').mockImplementation(async function (
      this: StyleStore,
      state
    ) {
      // The closing save is the first one made after the job has left the registry.
      if (jobs.has(id)) sawJob = true
      else if (sawJob) {
        closingSaveStarted = true
        await gate
      }
      return realSave.call(this, state)
    })
    try {
      await h.service.addFiles(id, [h.pdf('b.pdf')])
      await expect.poll(() => closingSaveStarted).toBe(true)
      let idle = false
      const waiting = h.service.whenIdle(id).then(() => (idle = true))
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(idle).toBe(false)
      release()
      await waiting
      expect(idle).toBe(true)
    } finally {
      release()
      spy.mockRestore()
    }
  })
})

describe('restoreFile (Undo)', () => {
  it('brings a learned file back from its cached analysis without calling Claude again', async () => {
    const id = await newStyle()
    await h.service.addFiles(id, [h.pdf('a.pdf'), h.pdf('b.pdf')])
    await h.service.whenIdle(id)
    const calls = h.stub.analysed.length
    const target = await fileId(id, 'a.pdf')
    const removed = await h.service.removeFile(id, target)
    if (!removed.ok) throw new Error('remove failed')
    expect(removed.undoToken).toBe(target)
    expect(await h.service.restoreFile(id, removed.undoToken)).toMatchObject({ ok: true })
    const style = await view(id)
    expect(style.files.map((f) => [f.name, f.status])).toEqual([
      ['b.pdf', 'learned'],
      ['a.pdf', 'learned']
    ])
    expect(h.stub.analysed).toHaveLength(calls)
  })

  it('queues a file again when it was removed before it had been learned', async () => {
    h.stub.hold('a.pdf')
    const id = await newStyle()
    await h.service.addFiles(id, [h.pdf('a.pdf')])
    await expect.poll(() => h.stub.inFlight).toBe(1)
    const target = await fileId(id, 'a.pdf')
    await h.service.removeFile(id, target)
    h.stub.clearHolds()
    await h.service.whenIdle(id)
    await h.service.restoreFile(id, target)
    await h.service.whenIdle(id)
    expect((await view(id)).files[0]).toMatchObject({ name: 'a.pdf', status: 'learned' })
  })

  it('cannot restore unknown ids or files whose undo window has passed', async () => {
    const id = await newStyle()
    await h.service.addFiles(id, [h.pdf('a.pdf')])
    await h.service.whenIdle(id)
    const target = await fileId(id, 'a.pdf')
    await h.service.removeFile(id, target)
    expect(await h.service.restoreFile(id, 'nope')).toMatchObject({ ok: false, code: 'not-found' })
    h.setNow('2026-10-06T12:00:00Z') // two hours later
    await h.service.addFiles(id, [h.pdf('b.pdf')]) // housekeeping drops expired removals
    expect(await h.service.restoreFile(id, target)).toMatchObject({ ok: false, code: 'not-found' })
    await h.service.whenIdle(id)
  })
})
