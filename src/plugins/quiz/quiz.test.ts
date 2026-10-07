import JSZip from 'jszip'
import mammoth from 'mammoth'
import { describe, expect, it } from 'vitest'
import { slideSchema } from '@shared/deck/schema'
import { fixtureDeck, fixtureStyle } from '@shared/deck/testing'
import { defaultInputs, validateInputs } from '@shared/plugins/inputs'
import { validateManifest } from '@shared/plugins/manifest'
import { ChatService } from '@main/services/chat/service'
import { makePluginRig } from '@main/services/plugins/testing'
import manifest from './manifest'
import {
  NO_QUESTIONS,
  quizPrompt,
  usableQuestions,
  type Question,
  type QuizOptions
} from './questions'
import { buildQuizSlides } from './slides'
import { buildQuizDocx } from './word'

const mcq = (n: number): Question => ({
  type: 'mcq',
  question: `Which part of the cell does job ${n}?`,
  options: ['Nucleus', 'Chloroplast', 'Vacuole', 'Cell wall'],
  answer: 'Chloroplast',
  explanation: `Chloroplasts absorb light (${n}).`
})
const tf = (n: number): Question => ({
  type: 'tf',
  question: `Statement ${n} is true.`,
  options: [],
  answer: 'False',
  explanation: ''
})
const gap = (n: number): Question => ({
  type: 'gap',
  question: `Plants make ____ using light (${n}).`,
  options: [],
  answer: 'glucose',
  explanation: ''
})
const short = (n: number): Question => ({
  type: 'short',
  question: `Explain point ${n}.`,
  options: [],
  answer: 'Because light energy is needed.',
  explanation: ''
})

const OPTIONS: QuizOptions = {
  slides: 'all',
  count: 10,
  types: ['mcq', 'tf'],
  difficulty: 'mixed',
  destination: 'slides'
}

describe('the manifest', () => {
  it('follows the design rules and the sheet spec', () => {
    expect(validateManifest(manifest)).toBeNull()
    expect(manifest).toMatchObject({
      id: 'quiz',
      name: 'Quiz',
      title: 'Quiz from slides',
      description: 'Quick-check questions in your format',
      tint: 'peach',
      action: 'Make quiz',
      estimate: 'About 20 seconds',
      needsSlides: true
    })
    expect(manifest.inputs.map((i) => i.id)).toEqual([
      'slides',
      'count',
      'types',
      'difficulty',
      'destination'
    ])
  })

  it('has the spec defaults: 10 questions, multiple choice and true/false, mixed, slides', () => {
    expect(defaultInputs(manifest)).toEqual({
      slides: 'all',
      count: 10,
      types: ['mcq', 'tf'],
      difficulty: 'mixed',
      destination: 'slides'
    })
  })

  it('rejects an empty type list and an unknown destination', () => {
    const base = defaultInputs(manifest)
    expect(validateInputs(manifest, { ...base, types: [] })).toMatchObject({
      ok: false,
      message: 'Question types: choose at least 1'
    })
    expect(validateInputs(manifest, { ...base, destination: 'pdf' })).toMatchObject({ ok: false })
    expect(validateInputs(manifest, { ...base, count: 99 })).toMatchObject({
      ok: true,
      inputs: { count: 30 }
    })
  })
})

describe('usableQuestions', () => {
  it('keeps good questions and cuts to the number asked for', () => {
    const raw = [mcq(1), tf(2), mcq(3), tf(4)]
    const result = usableQuestions(raw, { types: ['mcq', 'tf'], count: 3 })
    expect(result.ok && result.questions.map((q) => q.question)).toEqual([
      mcq(1).question,
      tf(2).question,
      mcq(3).question
    ])
    expect(result.ok && result.dropped).toBe(0)
  })

  it('reports how many fewer than asked for', () => {
    const result = usableQuestions([mcq(1)], { types: ['mcq'], count: 5 })
    expect(result.ok && result.dropped).toBe(4)
  })

  it('drops questions of a type that was not asked for', () => {
    const result = usableQuestions([mcq(1), short(2)], { types: ['short'], count: 5 })
    expect(result.ok && result.questions.map((q) => q.type)).toEqual(['short'])
  })

  it('checks multiple choice: the answer must be one of 3-5 distinct options (case-insensitive)', () => {
    const fixed = usableQuestions([{ ...mcq(1), answer: ' chloroplast ' }], {
      types: ['mcq'],
      count: 1
    })
    expect(fixed.ok && fixed.questions[0].answer).toBe('Chloroplast')
    for (const bad of [
      { ...mcq(1), answer: 'Mitochondria' },
      { ...mcq(1), options: ['A', 'B'], answer: 'A' },
      { ...mcq(1), options: ['A', 'A', 'A', 'A'], answer: 'A' }
    ])
      expect(usableQuestions([bad], { types: ['mcq'], count: 1 })).toMatchObject({
        ok: false,
        message: NO_QUESTIONS
      })
  })

  it('normalises true/false answers and rejects anything else', () => {
    const ok = usableQuestions([{ ...tf(1), answer: ' TRUE ' }], { types: ['tf'], count: 1 })
    expect(ok.ok && ok.questions[0].answer).toBe('True')
    expect(usableQuestions([{ ...tf(1), answer: 'Maybe' }], { types: ['tf'], count: 1 }).ok).toBe(
      false
    )
  })

  it('needs a blank in fill-the-gap questions and an answer in short ones', () => {
    expect(
      usableQuestions([{ ...gap(1), question: 'No blank here' }], { types: ['gap'], count: 1 }).ok
    ).toBe(false)
    expect(usableQuestions([{ ...short(1), answer: ' ' }], { types: ['short'], count: 1 }).ok).toBe(
      false
    )
    expect(usableQuestions([gap(1), short(2)], { types: ['gap', 'short'], count: 2 }).ok).toBe(true)
  })

  it('removes repeats and empty questions', () => {
    const result = usableQuestions(
      [
        mcq(1),
        { ...mcq(1), question: '  WHICH part of the cell does job 1? ' },
        { ...tf(2), question: ' ' }
      ],
      {
        types: ['mcq', 'tf'],
        count: 5
      }
    )
    expect(result.ok && result.questions).toHaveLength(1)
  })

  it('fails with a friendly message when nothing is usable', () => {
    expect(usableQuestions([], { types: ['mcq'], count: 3 })).toMatchObject({
      ok: false,
      code: 'unknown',
      message: 'Claude didn’t write any questions I could use. Try again.'
    })
  })
})

describe('quizPrompt', () => {
  it('states the count, types, difficulty and the lesson, and leaves out what is unknown', () => {
    const prompt = quizPrompt(
      { ...OPTIONS, count: 6, types: ['gap', 'short'], difficulty: 'stretch' },
      { title: 'Photosynthesis', yearGroup: 'Year 8' },
      'Slide 1 …'
    )
    expect(prompt).toContain('Lesson: Photosynthesis')
    expect(prompt).toContain('Year group: Year 8')
    expect(prompt).not.toContain('Ability')
    expect(prompt).toContain('Write 6 questions. Types to use: fill the gap, short answer.')
    expect(prompt).toContain('harder questions')
    expect(prompt.endsWith('Slides:\nSlide 1 …')).toBe(true)
  })
})

describe('buildQuizSlides', () => {
  const questions = [1, 2, 3, 4].flatMap((n) => [mcq(n), tf(n), gap(n)]).slice(0, 10)
  const make = () => {
    let n = 0
    return buildQuizSlides({
      questions,
      style: fixtureStyle(),
      deck: fixtureDeck(),
      newId: (prefix) => `${prefix}_${++n}`,
      pluginId: 'quiz'
    })
  }

  it('makes 3 questions per slide plus answer slides of up to 8', () => {
    const slides = make()
    expect(slides.map((s) => s.kind)).toEqual([
      'quiz',
      'quiz',
      'quiz',
      'quiz',
      'answers',
      'answers'
    ])
    expect(new Set(slides.map((s) => s.id)).size).toBe(6)
    expect(slides.every((s) => slideSchema.safeParse(s).success)).toBe(true)
    expect(slides.every((s) => s.source?.by === 'plugin' && s.source.pluginId === 'quiz')).toBe(
      true
    )
  })

  it('numbers questions continuously and shows multiple-choice options on one line', () => {
    const [first, second] = make()
    const body = (s: typeof first) =>
      s.elements.flatMap((e) => (e.type === 'text' && e.role === 'body' ? e.paragraphs : []))
    const lines = body(first).map((p) => p.runs.map((r) => r.text).join(''))
    expect(lines[0]).toBe('1. Which part of the cell does job 1?')
    expect(lines[1]).toBe('A  Nucleus     B  Chloroplast     C  Vacuole     D  Cell wall')
    expect(lines[2]).toBe('2. Statement 1 is true.')
    expect(lines[3]).toBe('True  /  False')
    expect(body(second).map((p) => p.runs[0].text)[0]).toMatch(/^4\. /)
  })

  it('writes answers (with the letter for multiple choice) and keeps explanations in the notes', () => {
    const slides = make()
    const answers = slides.filter((s) => s.kind === 'answers')
    const text = (s: (typeof slides)[number]) =>
      s.elements.flatMap((e) =>
        e.type === 'text' && e.role === 'body' ? e.paragraphs.map((p) => p.runs[0].text) : []
      )
    expect(text(answers[0]).slice(0, 3)).toEqual(['1. B  Chloroplast', '2. False', '3. glucose'])
    expect(text(answers[0])).toHaveLength(8)
    expect(text(answers[1])).toHaveLength(2)
    expect(answers[0].notes).toContain('1. Chloroplasts absorb light (1).')
    const kickers = answers.map((s) =>
      s.elements.find((e) => e.type === 'text' && e.role === 'kicker')
    )
    expect(kickers.map((k) => k?.type === 'text' && k.paragraphs[0].runs[0].text)).toEqual([
      'Quiz · Answers 1–8',
      'Quiz · Answers 9–10'
    ])
  })

  it('sits on the style’s layout and copies its decorations from slides that use it', () => {
    const [slide] = make()
    expect(slide.layoutId).toBe('content-text-left-image-right')
    expect(slide.elements.filter((e) => e.locked).map((e) => e.type)).toEqual(['shape'])
    expect(slide.elements.find((e) => e.locked)?.id).toMatch(/-deco1$/)
  })

  it('works without a style (plain title and body)', () => {
    const slides = buildQuizSlides({
      questions: [mcq(1)],
      style: null,
      deck: { slides: [] },
      newId: (p) => `${p}_x${Math.random()}`,
      pluginId: 'quiz'
    })
    expect(slides).toHaveLength(2)
    expect(slides[0].layoutId).toBeUndefined()
    expect(slides.every((s) => slideSchema.safeParse(s).success)).toBe(true)
  })
})

describe('buildQuizDocx', () => {
  it('makes an A4 Word file with the questions and a separate answer key', async () => {
    const bytes = await buildQuizDocx({
      lessonTitle: 'Y8 Science — Photosynthesis',
      questions: [mcq(1), tf(2), gap(3), short(4)],
      style: fixtureStyle()
    })
    const zip = await JSZip.loadAsync(bytes)
    const xml = await zip.file('word/document.xml')!.async('string')
    expect(xml).toContain('w:w="11906"')
    expect(xml).toContain('w:h="16838"')
    expect((xml.match(/<w:sectPr/g) ?? []).length).toBe(2)
    const styles = await zip.file('word/styles.xml')!.async('string')
    expect(styles).toContain('Lexend')

    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) })
    expect(value).toContain('Y8 Science — Photosynthesis quiz')
    expect(value).toContain('Name:')
    expect(value).toContain('/ 4')
    expect(value).toContain('1. Which part of the cell does job 1?')
    expect(value).toContain('B   Chloroplast')
    expect(value).toContain('True  /  False')
    expect(value.indexOf('answer key')).toBeGreaterThan(value.indexOf('4. Explain point 4.'))
    expect(value).toContain('1. B  Chloroplast')
    expect(value).toContain('Chloroplasts absorb light (1).')
  })

  it('uses Calibri without a style', async () => {
    const bytes = await buildQuizDocx({ lessonTitle: 'T', questions: [tf(1)], style: null })
    const styles = await (await JSZip.loadAsync(bytes)).file('word/styles.xml')!.async('string')
    expect(styles).toContain('Calibri')
  })
})

/** A structured answer with `n` mixed questions. */
const reply = (n: number) => ({
  questions: Array.from({ length: n }, (_, i) => [mcq(i), tf(i), gap(i)][i % 3])
})

describe('running the plugin on the photosynthesis fixture', () => {
  const run = async (
    inputs: Record<string, unknown>,
    fake: Parameters<typeof makePluginRig>[0] = {},
    context = { currentSlideId: 's3', selectedSlideIds: ['s3'] }
  ) => {
    const rig = await makePluginRig({
      ...fake,
      fake: { structuredReply: () => reply(5), ...fake.fake }
    })
    const started = await rig.runner.run({
      pluginId: 'quiz',
      lessonId: rig.lessonId,
      inputs,
      context
    })
    if (!started.ok) throw new Error(started.message)
    await rig.runner.whenDone(started.jobId)
    return { rig, started }
  }

  it('slides: adds quiz and answer slides at the end as ONE undo step with a "quiz slides added" chip', async () => {
    const { rig } = await run({ count: 5, types: ['mcq', 'tf', 'gap'] })
    const opened = await rig.service.open(rig.lessonId)
    if (!opened.ok) throw new Error(opened.message)
    expect(opened.deck.slides.map((s) => s.kind)).toEqual([
      'title',
      'do-now',
      'objectives',
      'quiz',
      'quiz',
      'answers'
    ])
    expect(opened.history.undoSummary).toBe('Added a 5-question quiz')
    expect(rig.of('chat:changes')).toHaveLength(1)
    expect(rig.of('plugins:file')).toEqual([])

    const items = await new ChatService({
      lessons: rig.service,
      ai: rig.ai,
      store: rig.store,
      emit: rig.emit
    }).history(rig.lessonId)
    expect(items.at(-1)).toMatchObject({
      pluginId: 'quiz',
      result: { label: '3 quiz slides added', undone: false }
    })
    expect(items.at(-1)?.text).toBe(
      'I wrote 5 questions. 3 quiz slides added at the end of the lesson.'
    )

    const undone = await rig.service.undo(rig.lessonId)
    expect(undone.ok && undone.deck.slides).toHaveLength(3)
    expect(undone.ok && undone.history.undoSummary).toBe('Seed slides')
  })

  it('shows the progress steps of the sheet spec', async () => {
    const { rig } = await run({ count: 5 })
    const steps = (rig.of('chat:status') as Array<{ step: string; state: string }>)
      .filter((s) => s.state === 'running')
      .map((s) => s.step)
    expect(steps).toEqual([
      'Reading 3 slides…',
      'Writing 5 questions…',
      'Making the quiz slides…',
      'Making the answer slide…'
    ])
  })

  it('docx: saves a Word file named after the lesson, adds no slides and shows the file card', async () => {
    const { rig } = await run({ count: 5, destination: 'docx' })
    const opened = await rig.service.open(rig.lessonId)
    expect(opened.ok && opened.deck.slides).toHaveLength(3)
    const [event] = rig.of('plugins:file') as Array<{
      file: { name: string; path: string; kind: string }
    }>
    expect(event.file).toMatchObject({
      name: 'Y8 Science — Photosynthesis quiz.docx',
      kind: 'docx'
    })
    const { value } = await mammoth.extractRawText({ path: event.file.path })
    expect(value).toContain('Y8 Science — Photosynthesis quiz')
    const steps = (rig.of('chat:status') as Array<{ step: string; state: string }>)
      .filter((s) => s.state === 'running')
      .map((s) => s.step)
    expect(steps.at(-1)).toBe('Writing the Word file…')
    const [record] = await rig.store.read(rig.lessonId)
    expect(record.ui.file?.name).toBe(event.file.name)
    expect(record.ui.changeSetIds).toBeUndefined()
  })

  it('both: slides and the Word file', async () => {
    const { rig } = await run({ count: 5, destination: 'both' })
    expect(rig.of('chat:changes')).toHaveLength(1)
    expect(rig.of('plugins:file')).toHaveLength(1)
  })

  it('reads only the chosen slides', async () => {
    const prompts: string[] = []
    const { rig } = await run(
      { count: 5, slides: 'current' },
      { fake: { structuredReply: (r: { prompt: string }) => (prompts.push(r.prompt), reply(5)) } }
    )
    expect(prompts[0]).toContain('Slide 3 (id s3, kind: objectives)')
    expect(prompts[0]).not.toContain('(id s1,')
    expect(prompts[0]).toContain('Lesson: Y8 Science — Photosynthesis')
    expect(prompts[0]).toContain('Year group: Year 8')
    expect(rig.names()).toContain('chat:done')
  })

  it('tells the teacher when Claude wrote fewer usable questions than asked for', async () => {
    const { rig } = await run(
      { count: 10, types: ['mcq', 'tf', 'gap'] },
      { fake: { structuredReply: () => reply(4) } }
    )
    const [delta] = rig.of('chat:delta') as Array<{ text: string }>
    expect(delta.text).toContain('Only 4 of the 10 questions were usable.')
  })

  it('fails clearly, changing nothing, when no question is usable', async () => {
    const { rig } = await run(
      { count: 5 },
      { fake: { structuredReply: () => ({ questions: [] }) } }
    )
    expect(rig.of('ai:error')).toEqual([
      expect.objectContaining({ scope: 'plugin', message: NO_QUESTIONS })
    ])
    const opened = await rig.service.open(rig.lessonId)
    expect(opened.ok && opened.deck.slides).toHaveLength(3)
  })

  it('passes a Claude failure through (no key)', async () => {
    const { rig } = await run({ count: 5 }, { fake: { failWith: 'no-key' } })
    expect(rig.of('ai:error')).toEqual([
      expect.objectContaining({ code: 'no-key', scope: 'plugin' })
    ])
  })
})
