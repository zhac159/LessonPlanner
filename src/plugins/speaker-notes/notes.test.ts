import { describe, expect, it } from 'vitest'
import { defaultInputs, validateInputs } from '@shared/plugins/inputs'
import { validateManifest } from '@shared/plugins/manifest'
import { ChatService } from '@main/services/chat/service'
import { makePluginRig } from '@main/services/plugins/testing'
import manifest from './manifest'
import { NO_NOTES, notesPrompt, usableNotes, type NotesOptions } from './notes'

const OPTIONS: NotesOptions = { slides: 'all', length: 'short', timings: true }

describe('the manifest', () => {
  it('follows the design rules', () => {
    expect(validateManifest(manifest)).toBeNull()
    expect(manifest).toMatchObject({
      id: 'speaker-notes',
      name: 'Speaker notes',
      tint: 'butter',
      action: 'Add notes',
      needsSlides: true,
      output: ['slides']
    })
  })

  it('has defaults and validates its options', () => {
    expect(defaultInputs(manifest)).toEqual({ slides: 'all', length: 'short', timings: true })
    expect(validateInputs(manifest, { length: 'epic' })).toMatchObject({
      ok: false,
      message: 'How long?: choose one of the options'
    })
    expect(validateInputs(manifest, { timings: 'yes' })).toMatchObject({ ok: false })
    expect(validateInputs(manifest, { length: 'full', timings: false })).toMatchObject({
      ok: true,
      inputs: { slides: 'all', length: 'full', timings: false }
    })
  })
})

describe('notesPrompt', () => {
  it('asks for timings and the length chosen', () => {
    const prompt = notesPrompt(
      { ...OPTIONS, length: 'full' },
      { title: 'Photosynthesis', yearGroup: 'Year 8', durationMin: 50 },
      'Slide 1 …'
    )
    expect(prompt).toContain('Lesson: Photosynthesis')
    expect(prompt).toContain('Lesson length: 50 minutes')
    expect(prompt).toContain('two to four sentences')
    expect(prompt).toContain('how long to spend')
    expect(prompt.endsWith('Slides:\nSlide 1 …')).toBe(true)
  })

  it('can leave timings out', () => {
    const prompt = notesPrompt({ ...OPTIONS, timings: false }, { title: 'T' }, 's')
    expect(prompt).toContain('Do not mention timings.')
    expect(prompt).not.toContain('Year group')
  })
})

describe('usableNotes', () => {
  it('keeps notes for the wanted slides, tidied, first one per slide', () => {
    const result = usableNotes(
      [
        { slideId: 's1', text: '  Welcome   them in.\n\n\n\nAsk Q.  ' },
        { slideId: 's1', text: 'duplicate' },
        { slideId: 's9', text: 'not asked for' },
        { slideId: 's2', text: '   ' }
      ],
      ['s1', 's2']
    )
    expect(result.ok && [...result.notes]).toEqual([['s1', 'Welcome them in.\n\nAsk Q.']])
  })

  it('fails when nothing is usable', () => {
    expect(usableNotes([{ slideId: 'x', text: 'y' }], ['s1'])).toMatchObject({
      ok: false,
      code: 'unknown',
      message: NO_NOTES
    })
    expect(usableNotes([], ['s1']).ok).toBe(false)
  })
})

describe('running the plugin on the photosynthesis fixture', () => {
  const notesFor = (ids: string[]) => ({
    notes: ids.map((slideId) => ({ slideId, text: `3 minutes. Notes for ${slideId}.` }))
  })

  const run = async (
    inputs: Record<string, unknown>,
    structuredReply: unknown,
    selected = ['s2']
  ) => {
    const rig = await makePluginRig({ fake: { structuredReply } })
    const started = await rig.runner.run({
      pluginId: 'speaker-notes',
      lessonId: rig.lessonId,
      inputs,
      context: { currentSlideId: selected[0], selectedSlideIds: selected }
    })
    if (!started.ok) throw new Error(started.message)
    await rig.runner.whenDone(started.jobId)
    return rig
  }

  it('writes notes on every slide with ONE ChangeSet, replacing the old notes', async () => {
    const rig = await run({}, notesFor(['s1', 's2', 's3']))
    const opened = await rig.service.open(rig.lessonId)
    if (!opened.ok) throw new Error(opened.message)
    expect(opened.deck.slides.map((s) => s.notes)).toEqual([
      '3 minutes. Notes for s1.',
      '3 minutes. Notes for s2.',
      '3 minutes. Notes for s3.'
    ])
    expect(opened.history.undoSummary).toBe('Added speaker notes to 3 slides')
    expect(rig.of('chat:changes')).toHaveLength(1)
    const [change] = rig.of('chat:changes') as Array<{
      changeSet: { by: string; pluginId: string; ops: unknown[] }
    }>
    expect(change.changeSet).toMatchObject({ by: 'plugin', pluginId: 'speaker-notes' })
    expect(change.changeSet.ops).toHaveLength(3)

    const undone = await rig.service.undo(rig.lessonId)
    expect(undone.ok && undone.deck.slides[0].notes).toBe(
      'Welcome them in. Bags away, planners out. Lesson 3 of 6 on plants.'
    )
    expect(undone.ok && undone.history.undoSummary).toBe('Seed slides')
  })

  it('shows a ResultChip for the changed slides and a friendly reply', async () => {
    const rig = await run({}, notesFor(['s1', 's2', 's3']))
    const items = await new ChatService({
      lessons: rig.service,
      ai: rig.ai,
      store: rig.store,
      emit: rig.emit
    }).history(rig.lessonId)
    expect(items.at(-1)).toMatchObject({
      pluginId: 'speaker-notes',
      text: 'I wrote speaker notes for 3 slides.',
      result: { label: '3 slides changed', slideIds: ['s1', 's2', 's3'] }
    })
  })

  it('only touches the selected slides and says which could not be done', async () => {
    const rig = await run({ slides: 'selected' }, notesFor(['s2']), ['s2', 's3'])
    const opened = await rig.service.open(rig.lessonId)
    if (!opened.ok) throw new Error(opened.message)
    expect(opened.deck.slides[0].notes).toContain('Welcome them in')
    expect(opened.deck.slides[1].notes).toBe('3 minutes. Notes for s2.')
    expect(opened.deck.slides[2].notes).not.toContain('Notes for')
    const [delta] = rig.of('chat:delta') as Array<{ text: string }>
    expect(delta.text).toBe(
      'I wrote speaker notes for 1 slide. 1 slide could not be done: ask me to try those again.'
    )
  })

  it('ignores notes for slides that were not asked for', async () => {
    const rig = await run({ slides: 'current' }, notesFor(['s1', 's2', 's3']))
    const opened = await rig.service.open(rig.lessonId)
    expect(opened.ok && opened.deck.slides.map((s) => s.notes?.includes('Notes for'))).toEqual([
      false,
      true,
      false
    ])
  })

  it('reads the slides it is asked about and sends the options to Claude', async () => {
    const prompts: string[] = []
    await run(
      { length: 'full', timings: false },
      (request: { prompt: string }) => (prompts.push(request.prompt), notesFor(['s2']))
    )
    expect(prompts[0]).toContain('two to four sentences')
    expect(prompts[0]).toContain('Do not mention timings.')
    expect(prompts[0]).toContain('Slide 2 (id s2, kind: do-now)')
    expect(prompts[0]).toContain('Lesson length: 50 minutes')
  })

  it('shows its progress steps', async () => {
    const rig = await run({ slides: 'all' }, notesFor(['s1']))
    const steps = (rig.of('chat:status') as Array<{ step: string; state: string }>)
      .filter((s) => s.state === 'running')
      .map((s) => s.step)
    expect(steps).toEqual(['Reading 3 slides…', 'Writing speaker notes…'])
  })

  it('fails clearly without changing anything when Claude gives no usable notes', async () => {
    const rig = await run({}, { notes: [] })
    expect(rig.of('ai:error')).toEqual([
      expect.objectContaining({ scope: 'plugin', code: 'unknown', message: NO_NOTES })
    ])
    const opened = await rig.service.open(rig.lessonId)
    expect(opened.ok && opened.history.undoSummary).toBe('Seed slides')
  })

  it('passes a Claude failure through', async () => {
    const rig = await makePluginRig({ fake: { failWith: 'overloaded' } })
    const started = await rig.runner.run({
      pluginId: 'speaker-notes',
      lessonId: rig.lessonId,
      inputs: {},
      context: { currentSlideId: 's1', selectedSlideIds: ['s1'] }
    })
    if (!started.ok) throw new Error(started.message)
    await rig.runner.whenDone(started.jobId)
    expect(rig.of('ai:error')).toEqual([
      expect.objectContaining({ code: 'overloaded', retryable: true, scope: 'plugin' })
    ])
  })
})
