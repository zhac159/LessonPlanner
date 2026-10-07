/**
 * The calls `src/main/index.ts` makes for dev seeds (see seed.ts for the seed names):
 *
 *   await seedBeforeModules()   // fills the data folder; the modules then load it like any other data
 *   await seedAfterModules()    // "generating" only: starts the running job on the live services
 *   await seedAfterWindow()     // after the main window exists: draws the lesson thumbnails, refreshes Home
 *
 * Thumbnails wait for the main window because drawing opens a hidden render window, and automation (Playwright)
 * treats the first window that opens as the app.
 *
 * Both do nothing unless SLIDE_PLANNER_SEED is set and the app is not packaged, and neither ever throws:
 * a failed seed is logged and the app starts normally.
 */
import { app } from 'electron'
import { createLogger } from '../logger'
import { createSlideRendererPort, getSlideRenderer } from '../render'
import { getContainer } from '../services/container'
import type { SlideRendererPort } from '../services/lessons/types'
import { getCurrentDeckBuilder } from '../services/deckBuilder/current'
import { dataRoot } from '../services/paths'
import { applySeed, loadSeedFixtures, requestedSeed, SEED_NAMES, type SeedName } from './seed'
import { startSeedGeneration } from './seedLive'

const log = createLogger('seed')

let windowReady: () => void = () => undefined
const windowIsReady = new Promise<void>((resolve) => (windowReady = resolve))
let pendingThumbnails: Promise<void> | null = null

/** The real renderer, but only once the main window exists. */
const afterWindow = (renderer: SlideRendererPort): SlideRendererPort => ({
  renderSlidePng: async (request) => {
    await windowIsReady
    return renderer.renderSlidePng(request)
  }
})

const seedRequest = (): SeedName | null =>
  requestedSeed(process.env, app.isPackaged, (name) =>
    log.warn(`Unknown seed "${name}". Known seeds: ${SEED_NAMES.join(', ')}`)
  )

export async function seedBeforeModules(): Promise<void> {
  const name = seedRequest()
  if (!name) return
  try {
    const container = getContainer()
    const outcome = await applySeed(name, {
      dataRoot: dataRoot(),
      settings: container.settings,
      keyStore: container.keyStore,
      fakeAi: process.env.SLIDE_PLANNER_FAKE_AI === '1',
      renderer: afterWindow(createSlideRendererPort(getSlideRenderer())),
      onThumbnails: (done) => (pendingThumbnails = done),
      fixtures: await loadSeedFixtures(),
      log
    })
    log.info(`Seed "${name}": ${outcome}`)
  } catch (error) {
    log.error(`Seed "${name}" failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function seedAfterModules(): Promise<void> {
  if (seedRequest() !== 'generating') return
  const current = getCurrentDeckBuilder()
  if (!current || !startSeedGeneration(current))
    log.warn('The generating seed could not start its job')
}

export async function seedAfterWindow(): Promise<void> {
  windowReady()
  if (!pendingThumbnails) return
  try {
    await pendingThumbnails
    await getCurrentDeckBuilder()?.services.lessons.notifyChanged()
  } catch (error) {
    log.warn(`Seed thumbnails failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}
