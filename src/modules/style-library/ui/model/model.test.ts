import { describe, expect, it } from 'vitest'
import { applyProgress, needsReload } from './applyProgress'
import { describePause, rejectionMessages, savedMessage } from './messages'
import { previewStyle, provisionalTestSlide, slideFor } from './previewSlide'
import {
  allFailed,
  describeEta,
  describeFailures,
  describeHeaderPill,
  pendingFiles
} from './progressText'
import { makeFile, makeProfileView, makeView, progressOf } from '../testSupport'

describe('applyProgress', () => {
  it('updates one file and the progress, keeping the rest', () => {
    const view = makeView([makeFile({ id: 'a', status: 'reading' }), makeFile({ id: 'b' })])
    const learned = makeFile({ id: 'a', status: 'learned' })
    const next = applyProgress(view, {
      styleId: 'sty_1',
      file: learned,
      progress: progressOf([learned, view.files[1]])
    })
    expect(next.files.map((f) => f.status)).toEqual(['learned', 'learned'])
    expect(next.progress.learned).toBe(2)
  })

  it('appends a file it has not seen', () => {
    const view = makeView([makeFile({ id: 'a' })])
    const added = makeFile({ id: 'b', status: 'waiting' })
    const next = applyProgress(view, {
      styleId: 'sty_1',
      file: added,
      progress: progressOf([view.files[0], added])
    })
    expect(next.files.map((f) => f.id)).toEqual(['a', 'b'])
    expect(needsReload(next)).toBe(false)
  })

  it('takes the partial profile, and clears the profile when nothing is learned', () => {
    const view = makeView([makeFile()])
    const partial = makeProfileView({ version: 5 })
    expect(
      applyProgress(view, { styleId: 'sty_1', progress: view.progress, partialProfile: partial })
        .profile?.version
    ).toBe(5)
    const empty = progressOf([])
    expect(applyProgress(view, { styleId: 'sty_1', progress: empty }).profile).toBeNull()
  })

  it('keeps the old profile when an event carries none and files are learned', () => {
    const view = makeView([makeFile()])
    expect(applyProgress(view, { styleId: 'sty_1', progress: view.progress }).profile).toBe(
      view.profile
    )
  })

  it('takes a suggested name only while the name is automatic', () => {
    const auto = makeView([makeFile()], { nameSource: 'auto', name: 'My style' })
    const typed = makeView([makeFile()], { nameSource: 'user', name: 'Mine' })
    const event = { styleId: 'sty_1', progress: auto.progress, name: 'Science KS3' }
    expect(applyProgress(auto, event).name).toBe('Science KS3')
    expect(applyProgress(typed, event).name).toBe('Mine')
  })

  it('ignores events for another style', () => {
    const view = makeView()
    expect(applyProgress(view, { styleId: 'other', progress: progressOf([]) })).toBe(view)
  })

  it('asks for a reload when the counts disagree', () => {
    const view = makeView([makeFile({ id: 'a' }), makeFile({ id: 'b' })])
    const removed = { ...view, progress: { ...view.progress, total: 1 } }
    expect(needsReload(removed)).toBe(true)
  })
})

describe('describeEta', () => {
  const reading = (etaSeconds: number | null) =>
    progressOf([makeFile({ status: 'waiting' })], { etaSeconds })

  it.each([
    [10, 'Less than a minute left'],
    [60, 'About a minute left'],
    [240, 'About 4 minutes left']
  ])('%d seconds reads %s', (seconds, text) => {
    expect(describeEta(reading(seconds))).toBe(text)
  })

  it('says nothing without an estimate, when done or when paused', () => {
    expect(describeEta(reading(null))).toBeUndefined()
    expect(describeEta(progressOf([makeFile()]))).toBeUndefined()
    expect(describeEta({ ...reading(60), stage: 'paused' })).toBeUndefined()
  })

  it('shows the synthesis line', () => {
    expect(describeEta({ ...reading(60), stage: 'synthesising' })).toBe('Putting it all together…')
    expect(describeEta({ ...reading(60), stage: 'pictures' })).toBe('Looking at your pictures…')
  })
})

describe('describeHeaderPill', () => {
  const files = (...statuses: Array<'learned' | 'reading' | 'waiting' | 'failed'>) =>
    statuses.map((status, i) => makeFile({ id: `f${i}`, status }))

  it('is hidden with no files', () => {
    expect(describeHeaderPill(progressOf([]))).toBeNull()
  })

  it('counts learned files while reading', () => {
    expect(describeHeaderPill(progressOf(files('learned', 'reading', 'waiting')))).toEqual({
      text: 'Learning · 1 of 3 files',
      tone: 'working',
      check: false
    })
  })

  it('reads "Learned from n files" when done, with a check', () => {
    expect(describeHeaderPill(progressOf(files('learned', 'learned', 'failed')))).toEqual({
      text: 'Learned from 2 files',
      tone: 'done',
      check: true
    })
  })

  it('says Paused and Finishing up…', () => {
    const base = progressOf(files('learned', 'waiting'))
    expect(describeHeaderPill({ ...base, stage: 'paused' })?.text).toBe('Paused')
    expect(describeHeaderPill({ ...base, stage: 'synthesising' })?.text).toBe('Finishing up…')
    expect(describeHeaderPill({ ...base, stage: 'pictures' })?.text).toBe('Finishing up…')
  })

  it('is hidden when every file failed', () => {
    expect(describeHeaderPill(progressOf(files('failed', 'failed')))).toBeNull()
  })
})

describe('failures', () => {
  it('describes failed files once everything is processed', () => {
    const done = progressOf([makeFile(), makeFile({ id: 'b', status: 'failed' })])
    expect(describeFailures(done)).toBe('1 file couldn’t be read')
    const two = progressOf([
      makeFile(),
      ...[1, 2].map((i) => makeFile({ id: `x${i}`, status: 'failed' }))
    ])
    expect(describeFailures(two)).toBe('2 files couldn’t be read')
    expect(
      describeFailures(
        progressOf([makeFile({ status: 'failed' }), makeFile({ status: 'waiting' })])
      )
    ).toBeUndefined()
  })

  it('knows when all files failed', () => {
    expect(allFailed(progressOf([makeFile({ status: 'failed' })]))).toBe(true)
    expect(allFailed(progressOf([makeFile()]))).toBe(false)
    expect(allFailed(progressOf([]))).toBe(false)
  })

  it('counts pending files', () => {
    expect(pendingFiles(progressOf([makeFile({ status: 'waiting' }), makeFile()]))).toBe(1)
  })
})

describe('messages', () => {
  it('maps pauses to their copy and action', () => {
    expect(describePause('no-credit')).toEqual({
      message: 'Your Claude account is out of credit.',
      action: 'console'
    })
    expect(describePause('no-key').action).toBe('connect')
    expect(describePause('invalid-key').action).toBe('settings')
    expect(describePause('network').action).toBe('none')
    expect(describePause(undefined).message).toContain('Something went wrong')
  })

  it('writes one toast per kind of rejection', () => {
    expect(
      rejectionMessages([
        { name: 'a.docx', reason: 'type' },
        { name: 'b.ppt', reason: 'old-ppt' },
        { name: 'c.pdf', reason: 'duplicate' },
        { name: 'd.pdf', reason: 'too-large' },
        { name: 'e.pdf', reason: 'limit' },
        { name: 'f.pdf', reason: 'limit' }
      ])
    ).toEqual([
      'Skipped 2 files that aren’t PDF or PowerPoint.',
      'Skipped 1 file over 50 MB.',
      'c.pdf is already in this style.',
      'Only 50 files per style. I skipped 2.'
    ])
  })

  it('uses the singular and plural forms', () => {
    expect(rejectionMessages([{ name: 'a.txt', reason: 'type' }])).toEqual([
      'Skipped 1 file that isn’t PDF or PowerPoint.'
    ])
    expect(
      rejectionMessages([
        { name: 'a.pdf', reason: 'duplicate' },
        { name: 'b.pdf', reason: 'duplicate' }
      ])
    ).toEqual(['2 of those files are already in this style.'])
    expect(rejectionMessages([])).toEqual([])
  })

  it('words the saved toast', () => {
    expect(savedMessage('Science KS3', 0)).toBe('Saved “Science KS3”')
    expect(savedMessage('Science KS3', 3)).toBe(
      'Saved “Science KS3”. I’ll keep learning from the other 3 files.'
    )
  })
})

describe('preview slide', () => {
  it('builds the provisional Key words slide from the spec', () => {
    const slide = provisionalTestSlide('Cells')
    const texts = JSON.stringify(slide)
    expect(texts).toContain('Lesson 1 · Cells')
    expect(texts).toContain('nucleus')
    expect(texts).toContain('Mini-whiteboards:')
    expect(slide.kind).toBe('key-words')
  })

  it('draws with the learned tokens, never with app colours', () => {
    const view = makeProfileView({ version: 3 })
    const style = previewStyle(view, 'Science KS3')
    expect(style?.tokens).toBe(view.tokens)
    expect(style?.version).toBe(3)
    expect(previewStyle(null, 'x')).toBeNull()
  })

  it('prefers Claude’s test slide over the provisional one', () => {
    const own = { ...provisionalTestSlide(), id: 'claude' }
    expect(slideFor(makeProfileView({ testSlide: own })).id).toBe('claude')
    expect(slideFor(makeProfileView()).id).toBe('provisional-test-slide')
  })
})
