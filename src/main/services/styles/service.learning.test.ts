import { afterEach, describe, expect, it } from 'vitest'
import { fail } from '@shared/result'
import { makePdf } from '../../import/testing'
import { createHarness, type Harness } from './testing'

let h: Harness
afterEach(() => h?.cleanup())

/** Distinct consecutive statuses a file went through, from the progress events. */
const statuses = (fileName: string) =>
  h
    .progress()
    .flatMap((p) => (p.file?.name === fileName ? [p.file.status] : []))
    .filter((s, i, all) => i === 0 || s !== all[i - 1])

async function draftWith(...paths: Array<string | Promise<string>>) {
  const { styleId } = await h.service.create()
  const resolved = await Promise.all(paths)
  await h.service.addFiles(styleId, resolved)
  return styleId
}

const view = async (id: string) => {
  const result = await h.service.get(id)
  if (!result.ok) throw new Error('missing style')
  return result.style
}

describe('learning job: the happy path', () => {
  it('moves each file waiting → reading → learned, mixing pdf and pptx', async () => {
    h = createHarness()
    const id = await draftWith(h.pptx('a.pptx'), h.pdf('b.pdf'), h.pptx('c.pptx'))
    await h.service.whenIdle(id)
    for (const name of ['a.pptx', 'b.pdf', 'c.pptx']) {
      expect(statuses(name)).toEqual(['waiting', 'reading', 'learned'])
    }
    const style = await view(id)
    expect(style.files.map((f) => f.status)).toEqual(['learned', 'learned', 'learned'])
    expect(style.files.map((f) => f.units)).toEqual([1, 2, 1])
    expect(style.progress).toMatchObject({
      learned: 3,
      failed: 0,
      total: 3,
      stage: 'done',
      etaSeconds: null
    })
  })

  it('reads at most two files at once and keeps the rest waiting, in order', async () => {
    h = createHarness()
    const names = ['a.pdf', 'b.pdf', 'c.pdf', 'd.pdf']
    const releases = names.map((n) => h.stub.hold(n))
    const id = await draftWith(...names.map((n) => h.pdf(n)))
    await expect.poll(() => h.stub.inFlight).toBe(2)
    expect((await view(id)).files.map((f) => f.status)).toEqual([
      'reading',
      'reading',
      'waiting',
      'waiting'
    ])
    releases.forEach((release) => release())
    await h.service.whenIdle(id)
    expect(h.stub.maxInFlight).toBe(2)
    expect((await view(id)).progress.learned).toBe(4)
  })

  it('fills the panel from the local merge before the last file has finished', async () => {
    h = createHarness()
    const releaseSlow = h.stub.hold('slow.pdf')
    const id = await draftWith(h.pdf('fast.pdf'), h.pdf('slow.pdf'))
    await expect.poll(async () => (await view(id)).profile !== null).toBe(true)
    const style = await view(id)
    expect(style.files.find((f) => f.name === 'slow.pdf')?.status).toBe('reading')
    expect(style.profile?.colours.find((c) => c.token === 'accent')?.hex).toBe('#0E7C7B')
    expect(style.profile?.fonts[0].family).toBe('Lexend')
    expect(style.profile?.testSlide).toBeNull() // provisional until synthesis
    // The event is emitted right after the view updates: wait for it instead of racing it.
    await expect
      .poll(() => h.progress().filter((p) => p.partialProfile).length)
      .toBeGreaterThanOrEqual(1)
    expect(h.stub.synthCalls).toEqual([])
    releaseSlow()
    await h.service.whenIdle(id)
  })

  it('synthesises once at the end and folds the result in without losing identity', async () => {
    h = createHarness()
    const id = await draftWith(h.pdf('a.pdf'), h.pdf('b.pdf'), h.pdf('c.pdf'))
    await h.service.whenIdle(id)
    expect(h.stub.synthCalls).toEqual([{ name: 'My style', files: 3, existing: false }])
    const profile = (await h.service.getProfile(id))!
    expect(profile).toMatchObject({ id, version: 2, habits: ['Synthesised habit'] })
    expect(profile.sources).toHaveLength(3)
    const style = await view(id)
    expect(style.profile?.testSlide?.id).toBe('sld_test')
    const stages = h.progress().map((p) => p.progress.stage)
    expect(stages).toContain('synthesising')
    expect(stages.at(-1)).toBe('done')
    expect(stages.lastIndexOf('reading')).toBeLessThan(stages.indexOf('synthesising'))
  })

  it('takes the suggested name only while the name is automatic', async () => {
    h = createHarness()
    const auto = await draftWith(h.pdf('a.pdf'))
    await h.service.whenIdle(auto)
    expect((await view(auto)).name).toBe('Science KS3')
    expect(h.progress().some((p) => p.name === 'Science KS3')).toBe(true)

    const mine = await h.service.create('My own name')
    await h.service.update(mine.styleId, { name: 'Form time' })
    await h.service.addFiles(mine.styleId, [h.pdf('z.pdf')])
    await h.service.whenIdle(mine.styleId)
    expect((await view(mine.styleId)).name).toBe('Form time')
  })

  it('re-synthesises with the existing profile when more files are added later', async () => {
    h = createHarness()
    const id = await draftWith(h.pdf('a.pdf'))
    await h.service.whenIdle(id)
    await h.service.addFiles(id, [h.pdf('b.pdf')])
    await h.service.whenIdle(id)
    expect(h.stub.synthCalls.map((c) => [c.files, c.existing])).toEqual([
      [1, false],
      [2, true]
    ])
    expect((await h.service.getProfile(id))?.version).toBe(3)
    // history keeps every version
    const { readdirSync } = await import('node:fs')
    expect(readdirSync(`${h.dir}/${id}/history`).sort()).toEqual([
      'profile.v2.json',
      'profile.v3.json'
    ])
  })

  it('picks up files added while the job is running', async () => {
    h = createHarness()
    const release = h.stub.hold('a.pdf')
    const id = await draftWith(h.pdf('a.pdf'))
    await expect.poll(() => h.stub.inFlight).toBe(1)
    await h.service.addFiles(id, [h.pdf('b.pdf')])
    release()
    await h.service.whenIdle(id)
    expect((await view(id)).progress).toMatchObject({ learned: 2, total: 2 })
    expect(h.stub.synthCalls).toHaveLength(1)
  })

  it('reports nothing to do when everything is already learned and synthesised', async () => {
    h = createHarness()
    const id = await draftWith(h.pdf('a.pdf'))
    await h.service.whenIdle(id)
    const started = await h.service.startLearning(id)
    expect(started.ok && (await started.job.done)).toBe('nothing-to-do')
  })

  it('estimates the time left from a moving average and hides it when finished', async () => {
    h = createHarness()
    const releases = [h.stub.hold('a.pdf'), h.stub.hold('b.pdf')]
    const id = await draftWith(h.pdf('a.pdf'), h.pdf('b.pdf'), h.pdf('c.pdf'))
    await expect.poll(() => h.stub.inFlight).toBe(2)
    const first = h.progress().find((p) => p.progress.stage === 'reading')!
    expect(first.progress.etaSeconds).toBe(90) // 3 files × the 30 s starting guess
    releases.forEach((release) => release())
    await h.service.whenIdle(id)
    expect(h.progress().at(-1)?.progress.etaSeconds).toBeNull()
  })
})

describe('learning job: failures', () => {
  it('fails unreadable files with the spec’s reasons and learns the rest', async () => {
    h = createHarness()
    const id = await draftWith(
      h.pdf('good.pdf'),
      h.raw('scanned.pdf', makePdf(['', ''])),
      h.raw('locked.pdf', makePdf(['Secret text for the lock'], { encrypted: true })),
      h.raw('broken.pptx', 'not a zip at all')
    )
    await h.service.whenIdle(id)
    const style = await view(id)
    const byName = Object.fromEntries(style.files.map((f) => [f.name, f]))
    expect(byName['good.pdf'].status).toBe('learned')
    expect(byName['scanned.pdf']).toMatchObject({
      status: 'failed',
      error: { code: 'scanned', message: 'This PDF is scanned images only', retryable: false }
    })
    expect(byName['locked.pdf'].error).toMatchObject({
      code: 'password',
      message: 'Password protected'
    })
    expect(byName['broken.pptx'].error).toMatchObject({
      code: 'corrupt',
      message: 'This file is damaged'
    })
    expect(style.progress).toMatchObject({ learned: 1, failed: 3, total: 4, stage: 'done' })
    expect(h.stub.analysed).toEqual(['good.pdf']) // nothing unreadable is ever sent to Claude
    expect(h.stub.synthCalls).toHaveLength(1)
  })

  it('isolates a Claude failure to its file and marks busy/offline errors retryable', async () => {
    h = createHarness()
    h.stub.results.set('busy.pdf', fail('overloaded', 'x'))
    h.stub.results.set('big.pdf', fail('too-large', 'x'))
    const id = await draftWith(h.pdf('ok.pdf'), h.pdf('busy.pdf'), h.pdf('big.pdf'))
    await h.service.whenIdle(id)
    const files = Object.fromEntries((await view(id)).files.map((f) => [f.name, f]))
    expect(files['ok.pdf'].status).toBe('learned')
    expect(files['busy.pdf']).toMatchObject({
      status: 'failed',
      error: { message: 'Claude was busy', retryable: true }
    })
    expect(files['big.pdf'].error?.retryable).toBe(false)
  })

  it('does not synthesise or let her save when every file failed', async () => {
    h = createHarness()
    const id = await draftWith(h.raw('a.pptx', 'junk'), h.raw('b.pptx', 'junk too'))
    await h.service.whenIdle(id)
    expect(h.stub.synthCalls).toEqual([])
    const style = await view(id)
    expect(style.profile).toBeNull()
    expect(style.progress).toMatchObject({ learned: 0, failed: 2, total: 2 })
    expect(await h.service.save(id)).toMatchObject({ ok: false })
  })

  it('retries a failed file', async () => {
    h = createHarness()
    h.stub.results.set('a.pdf', fail('overloaded', 'busy'))
    const id = await draftWith(h.pdf('a.pdf'))
    await h.service.whenIdle(id)
    const fileId = (await view(id)).files[0].id
    h.stub.results.delete('a.pdf')
    expect(await h.service.retryFile(id, fileId)).toMatchObject({ ok: true })
    await h.service.whenIdle(id)
    expect((await view(id)).files[0]).toMatchObject({ status: 'learned' })
    expect((await view(id)).files[0].error).toBeUndefined()
    expect(await h.service.retryFile(id, fileId)).toMatchObject({ ok: false, code: 'not-found' })
  })

  it('keeps the usable local profile when synthesis fails, and tries again next time', async () => {
    h = createHarness()
    h.stub.synthResult = () => fail('overloaded', 'busy')
    const id = await draftWith(h.pdf('a.pdf'))
    await h.service.whenIdle(id)
    let style = await view(id)
    expect(style.profile?.version).toBe(1)
    expect(style.profile?.colours.find((c) => c.token === 'accent')?.hex).toBe('#0E7C7B')
    expect(style.progress.stage).toBe('done')
    h.stub.synthResult = null
    await h.service.startLearning(id)
    await h.service.whenIdle(id)
    style = await view(id)
    expect(style.profile?.version).toBe(2)
    expect(h.stub.synthCalls).toHaveLength(2)
  })

  it('ignores a synthesised profile that does not validate', async () => {
    h = createHarness()
    h.stub.synthResult = () => ({
      ok: true,
      testSlide: { id: 's', kind: 'content', elements: [] },
      profile: { nonsense: true } as never
    })
    const id = await draftWith(h.pdf('a.pdf'))
    await h.service.whenIdle(id)
    const style = await view(id)
    expect(style.profile?.version).toBe(1)
    expect(style.profile?.testSlide).toBeNull()
  })
})

describe('learning job: cancel and pause', () => {
  it('cancelling keeps learned files and puts in-flight files back to waiting', async () => {
    h = createHarness({ concurrency: 1 })
    h.stub.hold('b-slow.pdf')
    const id = await draftWith(h.pdf('a-fast.pdf'), h.pdf('b-slow.pdf'), h.pdf('c-later.pdf'))
    await expect.poll(() => h.stub.inFlight).toBe(1)
    await expect.poll(async () => (await view(id)).progress.learned).toBe(1)
    const started = await h.service.startLearning(id)
    if (!started.ok) throw new Error('no job')
    started.job.cancel()
    expect(await started.job.done).toBe('cancelled')
    const style = await view(id)
    expect(style.files.map((f) => f.status)).toEqual(['learned', 'waiting', 'waiting'])
    expect(style.progress.stage).toBe('idle')
    expect(style.profile).not.toBeNull() // the learned file still fills the panel
    expect(h.stub.synthCalls).toEqual([])
  })

  it('pauses the whole queue for an account error without failing any file', async () => {
    h = createHarness()
    h.stub.results.set('a.pdf', fail('no-key', 'No key'))
    const id = await draftWith(h.pdf('a.pdf'), h.pdf('b.pdf'), h.pdf('c.pdf'))
    await h.service.whenIdle(id)
    const style = await view(id)
    expect(style.progress).toMatchObject({ stage: 'paused', pausedFor: 'no-key', failed: 0 })
    expect(style.files.find((f) => f.name === 'a.pdf')?.status).toBe('waiting')
    expect(style.files.some((f) => f.status === 'failed')).toBe(false)
    expect(h.stub.synthCalls).toEqual([])
    // the pause survives a restart and nothing restarts by itself
    const restarted = h.restart()
    await restarted.resumePending()
    expect(h.stub.analysed.filter((n) => n === 'a.pdf')).toHaveLength(1)
    // fixing the key and pressing "Carry on" finishes the job
    h.stub.results.clear()
    expect(await restarted.resume(id)).toMatchObject({ ok: true })
    await restarted.whenIdle(id)
    const done = await restarted.get(id)
    expect(done.ok && done.style.progress).toMatchObject({ learned: 3, stage: 'done' })
    expect(done.ok && done.style.progress.pausedFor).toBeUndefined()
  })

  it('pauses after two network failures in a row; "Carry on" retries those files', async () => {
    h = createHarness({ concurrency: 1 })
    for (const n of ['a.pdf', 'b.pdf']) h.stub.results.set(n, fail('network', 'offline'))
    const id = await draftWith(h.pdf('a.pdf'), h.pdf('b.pdf'), h.pdf('c.pdf'))
    await h.service.whenIdle(id)
    let style = await view(id)
    expect(style.progress).toMatchObject({ stage: 'paused', pausedFor: 'network', failed: 2 })
    expect(style.files.map((f) => f.status)).toEqual(['failed', 'failed', 'waiting'])
    expect(style.files[0].error).toMatchObject({
      message: 'Couldn’t reach Claude',
      retryable: true
    })
    h.stub.results.clear()
    await h.service.resume(id)
    await h.service.whenIdle(id)
    style = await view(id)
    expect(style.progress).toMatchObject({ learned: 3, failed: 0, stage: 'done' })
  })

  it('pauses when synthesis hits an account error and synthesises after "Carry on"', async () => {
    h = createHarness()
    h.stub.synthResult = () => fail('no-credit', 'No credit')
    const id = await draftWith(h.pdf('a.pdf'))
    await h.service.whenIdle(id)
    expect((await view(id)).progress).toMatchObject({
      stage: 'paused',
      pausedFor: 'no-credit',
      learned: 1
    })
    h.stub.synthResult = null
    await h.service.resume(id)
    await h.service.whenIdle(id)
    expect((await view(id)).progress).toMatchObject({ stage: 'done' })
    expect((await h.service.getProfile(id))?.version).toBe(2)
  })

  it('survives an app restart: in-flight files are queued again and pending work resumes', async () => {
    h = createHarness()
    h.stub.hold('a.pdf')
    const id = await draftWith(h.pdf('a.pdf'), h.pdf('b.pdf'))
    await expect.poll(() => h.stub.inFlight).toBeGreaterThan(0)
    await h.service.dispose() // "quit": cancels the job, files go back to waiting
    const restarted = h.restart()
    const mid = await restarted.get(id)
    expect(mid.ok && mid.style.files.filter((f) => f.status === 'reading')).toEqual([])
    h.stub.results.clear()
    h.stub.clearHolds()
    await restarted.resumePending()
    await restarted.whenIdle(id)
    const done = await restarted.get(id)
    expect(done.ok && done.style.progress).toMatchObject({ learned: 2, stage: 'done' })
  })
})
