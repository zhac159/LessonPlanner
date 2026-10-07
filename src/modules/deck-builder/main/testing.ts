/** Test-only rig for the deck-builder module's main side: real services on a temp folder, fake ports. */
import type { DeckBuilderEvents } from '@shared/contracts/deck-builder'
import { fixtureDeck, fixtureStyle } from '@shared/deck/testing'
import { createFakeAiService, type FakeAiOptions } from '@main/ai/fake'
import type { FullScreenPort, OpenerPort } from '@main/services/deckBuilder/ports'
import {
  createDeckBuilderServices,
  type DeckBuilderServices
} from '@main/services/deckBuilder/services'
import { fakeStyleLookup } from '@main/services/deckBuilder/testing'
import type { LessonAssetsPort } from '@main/services/lessons/assetsPort'
import {
  FakeDialogs,
  FakeRenderer,
  FakeTrash,
  sequentialIds,
  steppingClock,
  tempDir
} from '@main/services/lessons/testing'
import { createDeckBuilderApi } from './api'

export interface Recorded {
  name: keyof DeckBuilderEvents
  payload: unknown
}

export class FakeOpener implements OpenerPort {
  opened: string[] = []
  shown: string[] = []
  /** What `openPath` answers: '' = success. */
  answer = ''
  async openPath(path: string): Promise<string> {
    this.opened.push(path)
    return this.answer
  }
  showItemInFolder(path: string): void {
    this.shown.push(path)
  }
}

export class FakeFullScreen implements FullScreenPort {
  calls: boolean[] = []
  setFullScreen(on: boolean): void {
    this.calls.push(on)
  }
}

/** The whole `DeckBuilderApi` over real services on a temp folder (fake AI, renderer, dialogs, trash). */
export async function makeApiRig(
  options: { fake?: FakeAiOptions; assets?: LessonAssetsPort } = {}
) {
  const dir = tempDir()
  const style = fixtureStyle()
  const renderer = new FakeRenderer()
  const dialogs = new FakeDialogs()
  const trash = new FakeTrash()
  const opener = new FakeOpener()
  const fullScreen = new FakeFullScreen()
  const events: Recorded[] = []
  const services: DeckBuilderServices = await createDeckBuilderServices({
    dir,
    ai: createFakeAiService(options.fake),
    styles: fakeStyleLookup(style),
    dialogs,
    assets: options.assets,
    renderer,
    trash,
    emit: (name, payload) => events.push({ name, payload }),
    clock: steppingClock(),
    ids: sequentialIds(),
    undoWindowMs: 60_000
  })
  const api = createDeckBuilderApi({ services, dir, opener, fullScreen })
  return { api, services, dir, style, renderer, dialogs, trash, opener, fullScreen, events }
}

export type ApiRig = Awaited<ReturnType<typeof makeApiRig>>

/** Creates a lesson holding the 3-slide photosynthesis fixture; returns its id. */
export async function seedFixtureLesson(rig: ApiRig): Promise<string> {
  const deck = fixtureDeck()
  const created = await rig.services.lessons.create({
    styleId: rig.style.id,
    meta: deck.meta,
    title: deck.title
  })
  if (!created.ok) throw new Error(created.message)
  const slides = await rig.services.lessons.apply(created.lessonId, {
    by: 'user',
    summary: 'Seed slides',
    ops: [{ op: 'insertSlides', afterSlideId: null, slides: deck.slides }]
  })
  if (!slides.ok) throw new Error(slides.message)
  return created.lessonId
}
