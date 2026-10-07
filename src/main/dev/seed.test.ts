import { existsSync, mkdtempSync, readdirSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { ok } from '@shared/result'
import { createFakeAiService } from '../ai/fake'
import { ChatService } from '../services/chat/service'
import { ChatStore } from '../services/chat/store'
import { LessonsService } from '../services/lessons/service'
import { FakeDialogs, FakeRenderer, tempDir } from '../services/lessons/testing'
import { testService } from '../services/assets/testing'
import { createSettingsStore } from '../services/settingsStore'
import { StylesService } from '../services/styles/service'
import {
  applySeed,
  isSeedName,
  loadSeedFixtures,
  PLACEHOLDER_KEY,
  requestedSeed,
  SEED_NAMES,
  type SeedDeps,
  type SeedFixtures,
  type SeedName
} from './seed'
import { assetsDir } from './seedAssets'
import { GENERATING_ID, PHOTOSYNTHESIS_ID, SEED_LESSONS } from './seedData'
import { deckBuilderDir } from './seedLessons'
import { styleLibraryDir } from './seedStyles'

// Every seeding is some hundred sequential file operations (milliseconds when the machine is quiet, tens of seconds when
// it is starved), hence the room.
const SEEDING_TIMEOUT = 60_000

const NOW = new Date('2026-10-06T10:30:00.000Z')
let fixtures: SeedFixtures | undefined

async function rig(over: Partial<SeedDeps> = {}) {
  fixtures ??= await loadSeedFixtures()
  const dataRoot = over.dataRoot ?? tempDir()
  const renderer = new FakeRenderer()
  const setKey = vi.fn(async () => ok({ lastFour: 'mode' }))
  const settings = createSettingsStore(join(dataRoot, 'modules', 'settings'))
  const deps: SeedDeps = {
    dataRoot,
    settings,
    keyStore: { set: setKey },
    fakeAi: true,
    renderer,
    fixtures,
    now: NOW,
    ...over
  }
  const apply = (name: SeedName) => applySeed(name, deps)
  const lessons = () =>
    new LessonsService({
      dir: deckBuilderDir(dataRoot),
      styles: { getProfile: async () => undefined },
      dialogs: new FakeDialogs()
    })
  const styles = () =>
    new StylesService({ dir: styleLibraryDir(dataRoot), ai: createFakeAiService() })
  return { dataRoot, settings, setKey, renderer, apply, lessons, styles }
}

describe('seed names', () => {
  it('knows the six documented seeds', () => {
    expect([...SEED_NAMES]).toEqual([
      'first-run',
      'empty',
      'home',
      'editor',
      'generating',
      'assets'
    ])
    expect(isSeedName('home')).toBe(true)
    expect(isSeedName('two-lessons')).toBe(false)
    expect(isSeedName(undefined)).toBe(false)
  })

  it('SLIDE_PLANNER_SEED is read only when set, known and the app is not packaged', () => {
    const unknown = vi.fn()
    expect(requestedSeed({ SLIDE_PLANNER_SEED: ' home ' }, false)).toBe('home')
    expect(requestedSeed({}, false)).toBeNull()
    expect(requestedSeed({ SLIDE_PLANNER_SEED: 'home' }, true)).toBeNull()
    expect(requestedSeed({ SLIDE_PLANNER_SEED: 'nope' }, false, unknown)).toBeNull()
    expect(unknown).toHaveBeenCalledWith('nope')
  })
})

describe('first-run and empty', () => {
  it('first-run leaves the data folder untouched', async () => {
    const r = await rig()
    expect(await r.apply('first-run')).toBe('nothing-to-do')
    expect(readdirSync(r.dataRoot)).toEqual([])
    expect((await r.settings.get()).onboarding.completedAt).toBeNull()
  })

  it('empty finishes onboarding as Alice, connected in fake-AI mode, with no styles or lessons', async () => {
    const r = await rig()
    expect(await r.apply('empty')).toBe('applied')
    const saved = await r.settings.get()
    expect(saved).toMatchObject({
      name: 'Alice',
      onboarding: { step: 'done', skippedAi: false, completedAt: NOW.toISOString() },
      lastTest: { result: 'connected' }
    })
    expect(r.setKey).toHaveBeenCalledWith(PLACEHOLDER_KEY)
    expect(PLACEHOLDER_KEY).not.toMatch(/^sk-ant-api/)
    expect(await r.lessons().list()).toEqual([])
    expect(await r.styles().listSummaries()).toEqual([])
  })

  it('without fake AI no key is stored and the connection is not claimed', async () => {
    const r = await rig({ fakeAi: false })
    await r.apply('empty')
    expect(r.setKey).not.toHaveBeenCalled()
    expect(await r.settings.get()).toMatchObject({
      onboarding: { step: 'done', skippedAi: true },
      lastTest: null
    })
  })

  it('is idempotent per data folder, and refuses to mix with another seed', async () => {
    const r = await rig()
    expect(await r.apply('empty')).toBe('applied')
    expect(await r.apply('empty')).toBe('already-applied')
    expect(await r.apply('home')).toBe('other-seed-present')
    expect(r.setKey).toHaveBeenCalledTimes(1)
    expect(await r.lessons().list()).toEqual([])
  })
})

describe('home', () => {
  // One seeding shared by the tests that only read it: every seeding is some hundred small file operations, and on a
  // busy machine each one waits for a time slice, so seven of them in a row used to outlast the test timeout.
  let home: Awaited<ReturnType<typeof rig>>
  // Not `tempDir()`: that one is removed after every test.
  const homeRoot = mkdtempSync(join(tmpdir(), 'slide-planner-seed-home-'))
  beforeAll(async () => {
    home = await rig({ dataRoot: homeRoot })
    await home.apply('home')
  }, SEEDING_TIMEOUT)
  afterAll(async () => {
    await rm(homeRoot, { recursive: true, force: true, maxRetries: 8, retryDelay: 50 })
  })

  it('writes the two styles the way the styles service reads them', async () => {
    const r = home
    const styles = await r.styles().listSummaries()
    expect(styles.map((s) => [s.name, s.isDefault, s.deckCount, s.titleFont, s.status])).toEqual([
      ['Science KS3', true, 24, 'Lexend', 'ready'],
      ['Form time', false, 6, 'Nunito', 'ready']
    ])
    expect(styles[1].swatches[0]).toBe('#7B3FA0')
  })

  it('writes the eight lessons of the Home design, newest first, with thumbnails', async () => {
    const r = home
    const list = await r.lessons().list()
    expect(list.map((l) => l.title)).toEqual(SEED_LESSONS.map((l) => l.title))
    expect(list.map((l) => l.slideCount)).toEqual([8, 10, 9, 12, 11, 6, 9, 8])
    expect(list.map((l) => l.yearShort)).toEqual([
      'Year 8',
      'Year 7',
      'Year 7',
      'Year 9',
      'Year 8',
      'Form',
      'Year 8',
      'Year 7'
    ])
    expect(list.every((l) => l.status === 'ready' && !l.damaged)).toBe(true)
    expect(list.every((l) => l.thumbDataUrl?.startsWith('data:image/png;base64,'))).toBe(true)
    expect(list[0].updatedAt).toBe(NOW.toISOString())
    const daysAgo = list.map((l) =>
      Math.round((NOW.getTime() - Date.parse(l.updatedAt)) / 86_400_000)
    )
    expect(daysAgo).toEqual([0, 1, 3, 8, 10, 14, 21, 35])
  })

  it('draws each thumbnail with the lesson style: Form time for "Staying safe online"', async () => {
    const r = home
    const forms = r.renderer.calls.filter((c) => c.style?.id === 'sty_form_time')
    expect(forms.length).toBeGreaterThan(0)
    expect(r.renderer.calls.every((c) => c.slide.id.length > 0)).toBe(true)
  })

  it(
    'can hand the thumbnail work back instead of waiting for it',
    async () => {
      let release: () => void = () => undefined
      const gate = new Promise<void>((resolve) => (release = resolve))
      let pending: Promise<void> | undefined
      const r = await rig({
        renderer: { renderSlidePng: async () => gate.then(() => new Uint8Array([1])) },
        onThumbnails: (done) => (pending = done)
      })
      // Resolves although the renderer is still blocked.
      expect(await r.apply('home')).toBe('applied')
      expect(pending).toBeDefined()
      release()
      await pending
      const first = await r.lessons().list()
      expect(first.length).toBe(SEED_LESSONS.length)
    },
    SEEDING_TIMEOUT
  )

  it('every seeded lesson opens: valid deck, unique ids, no undo history', async () => {
    const r = home
    const service = r.lessons()
    for (const lesson of SEED_LESSONS) {
      const opened = await service.open(lesson.id)
      if (!opened.ok) throw new Error(`${lesson.id}: ${opened.message}`)
      expect(opened.deck.slides).toHaveLength(lesson.slideCount)
      const ids = opened.deck.slides.flatMap((s) => [s.id, ...s.elements.map((e) => e.id)])
      expect(new Set(ids).size).toBe(ids.length)
      expect(opened.history.canUndo).toBe(false)
      expect(opened.deck.meta.yearGroup).toBe(lesson.yearGroup)
    }
  })

  it('the photosynthesis lesson is the design fixture deck under its own title', async () => {
    const r = home
    const opened = await r.lessons().open(PHOTOSYNTHESIS_ID)
    if (!opened.ok) throw new Error(opened.message)
    expect(opened.deck.title).toBe('Y8 Science — Photosynthesis')
    expect(opened.deck.slides[0].id).toBe('s1')
    expect(opened.deck.meta.objectives).toHaveLength(3)
    expect(
      existsSync(join(deckBuilderDir(r.dataRoot), 'lessons', PHOTOSYNTHESIS_ID, 'thumb.png'))
    ).toBe(true)
  })

  it('has no chat history and no generating lesson', async () => {
    const r = home
    const service = r.lessons()
    const chat = new ChatService({
      lessons: service,
      ai: createFakeAiService(),
      store: new ChatStore((id) => service.chatPath(id)),
      emit: () => undefined
    })
    expect(await chat.history(PHOTOSYNTHESIS_ID)).toEqual([])
    expect((await service.list()).some((l) => l.id === GENERATING_ID)).toBe(false)
  })
})

describe('editor', { timeout: SEEDING_TIMEOUT }, () => {
  it('adds a conversation ending with a ResultChip that can be undone', async () => {
    const r = await rig()
    await r.apply('editor')
    const service = r.lessons()
    const chat = new ChatService({
      lessons: service,
      ai: createFakeAiService(),
      store: new ChatStore((id) => service.chatPath(id)),
      emit: () => undefined
    })
    const history = await chat.history(PHOTOSYNTHESIS_ID)
    expect(history.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant'])
    expect(history[3].result).toMatchObject({
      label: expect.any(String),
      undone: false,
      slideIds: [expect.any(String)]
    })
    const opened = await service.open(PHOTOSYNTHESIS_ID)
    if (!opened.ok) throw new Error(opened.message)
    expect(opened.history.canUndo).toBe(true)
    const undone = await service.undo(PHOTOSYNTHESIS_ID)
    expect(undone.ok && undone.history.canUndo).toBe(false)
  })
})

describe('generating', { timeout: SEEDING_TIMEOUT }, () => {
  it('adds a lesson with a plan and no slides yet, plus the teacher’s request', async () => {
    const r = await rig()
    await r.apply('generating')
    const service = r.lessons()
    const list = await service.list()
    expect(list).toHaveLength(SEED_LESSONS.length + 1)
    expect(list.find((l) => l.id === GENERATING_ID)).toMatchObject({
      title: 'Y8 Science — The water cycle',
      slideCount: 0,
      yearShort: 'Year 8'
    })
    const chat = await new ChatStore((id) => service.chatPath(id)).read(GENERATING_ID)
    expect(chat.map((c) => c.role)).toEqual(['user'])
  })
})

describe('assets', { timeout: SEEDING_TIMEOUT }, () => {
  it('is the home seed plus the twelve assets of design A1, newest first like the mock-up', async () => {
    const r = await rig()
    expect(await r.apply('assets')).toBe('applied')
    expect(await r.lessons().list()).toHaveLength(SEED_LESSONS.length)
    const library = testService(assetsDir(r.dataRoot))
    expect((await library.init()).recovered).toBe(0)
    const page = await library.list()
    expect(page.libraryCount).toBe(12)
    expect(page.items[0]).toMatchObject({ name: 'school_logo', kind: 'logo', title: 'School logo' })
    expect(page.items[0]?.thumbDataUrl).toMatch(/^data:image\/png/)
    expect(page.counts).toMatchObject({
      logos: 1,
      icons: 6,
      diagrams: 2,
      banners: 1,
      characters: 1
    })
    expect(page.froms.map((f) => f.key)).toEqual([
      'anywhere',
      'style:sty_science_ks3',
      'uploaded',
      'online',
      'made'
    ])
    expect(await r.apply('assets')).toBe('already-applied')
  })
})
