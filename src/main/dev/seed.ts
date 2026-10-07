/**
 * Dev seeds: fill the data folder with demo data so screens, screenshots and e2e flows start from a known state.
 *
 *   SLIDE_PLANNER_SEED=<name>   (ignored when the app is packaged)
 *
 *   first-run   nothing: the Welcome flow (onboarding not done)
 *   empty       onboarding done, name "Alice", no styles, no lessons
 *   home        empty + styles "Science KS3" (default, 24 decks) and "Form time" (6 decks) + the 8 lessons of
 *               design/images/03-home.png (ids `les_seed_*`, newest `les_seed_photosynthesis`, 8 slides, thumbnails)
 *   editor      home + a short chat on `les_seed_photosynthesis` ending with a ResultChip (Undo works)
 *   generating  home + `les_seed_water_cycle`, a lesson whose generation is running (no slides yet)
 *   assets      home + the twelve assets of design A1 in the assets module (seedAssets.ts)
 *
 * With SLIDE_PLANNER_FAKE_AI=1 (every non-first-run seed) Claude also shows as connected: a placeholder key is
 * stored encrypted and the last connection test is "connected". A real key is never written.
 *
 * Applied once per data folder (`<dataRoot>/seed.json` remembers it), BEFORE the modules load, using the real
 * services' file formats. `generating` has a second step once the modules are live (see seedLive.ts).
 * Everything here is development tooling: nothing in the app depends on it.
 */
import { join } from 'node:path'
import type { Deck } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'
import { atomicWriteJson, readJsonSafe } from '../services/fsx'
import type { KeyStore } from '../services/keyStore'
import { silentLogger, type Logger, type SlideRendererPort } from '../services/lessons/types'
import type { SettingsStore } from '../services/settingsStore'
import { writeSeedAssets } from './seedAssets'
import { writeSeedLessons } from './seedLessons'
import { writeSeedStyles } from './seedStyles'

export const SEED_NAMES = ['first-run', 'empty', 'home', 'editor', 'generating', 'assets'] as const
export type SeedName = (typeof SEED_NAMES)[number]

export const isSeedName = (value: unknown): value is SeedName =>
  typeof value === 'string' && (SEED_NAMES as readonly string[]).includes(value)

/**
 * The seed asked for by SLIDE_PLANNER_SEED, or null: nothing asked, the app is packaged, or the name is unknown
 * (`onUnknown` hears about that one).
 */
export function requestedSeed(
  env: Readonly<Record<string, string | undefined>>,
  isPackaged: boolean,
  onUnknown?: (name: string) => void
): SeedName | null {
  const wanted = env.SLIDE_PLANNER_SEED?.trim()
  if (!wanted || isPackaged) return null
  if (isSeedName(wanted)) return wanted
  onUnknown?.(wanted)
  return null
}

/** The design fixtures the seeds are made from. */
export interface SeedFixtures {
  deck: Deck
  style: StyleProfile
}

export interface SeedDeps {
  dataRoot: string
  settings: SettingsStore
  keyStore: Pick<KeyStore, 'set'>
  /** SLIDE_PLANNER_FAKE_AI=1: then the seed also marks Claude as connected. */
  fakeAi: boolean
  /** Draws the lesson thumbnails; without one the lessons have none. */
  renderer?: SlideRendererPort
  /** Hears about the pending thumbnail drawing instead of waiting for it (see SeedLessonsOptions). */
  onThumbnails?: (done: Promise<void>) => void
  fixtures: SeedFixtures
  now?: Date
  log?: Logger
}

export type SeedOutcome = 'applied' | 'already-applied' | 'other-seed-present' | 'nothing-to-do'

/** Not a real key: it only makes Settings and the sidebar say "Claude connected" in fake-AI mode. */
export const PLACEHOLDER_KEY = 'sk-ant-placeholder-for-fake-ai-mode'

interface Marker {
  name: SeedName
  version: 1
  at: string
}

const markerPath = (dataRoot: string): string => join(dataRoot, 'seed.json')

const isMarker = (raw: unknown): Marker => {
  const marker = raw as Partial<Marker>
  if (!isSeedName(marker?.name)) throw new Error('not a seed marker')
  return marker as Marker
}

async function seedSettings(deps: SeedDeps, now: Date): Promise<void> {
  const at = now.toISOString()
  await deps.settings.update({
    name: 'Alice',
    subject: 'Science',
    onboarding: { step: 'done', skippedAi: !deps.fakeAi, completedAt: at },
    lastTest: deps.fakeAi ? { result: 'connected', at } : null
  })
  if (deps.fakeAi) await deps.keyStore.set(PLACEHOLDER_KEY)
}

/** Applies a seed to the data folder. Idempotent: the same seed twice does nothing the second time. */
export async function applySeed(name: SeedName, deps: SeedDeps): Promise<SeedOutcome> {
  if (name === 'first-run') return 'nothing-to-do'
  const present = await readJsonSafe(markerPath(deps.dataRoot), isMarker)
  if (present) return present.name === name ? 'already-applied' : 'other-seed-present'

  const now = deps.now ?? new Date()
  await seedSettings(deps, now)
  if (name !== 'empty') {
    const styles = await writeSeedStyles(deps.dataRoot, deps.fixtures.style, now)
    await writeSeedLessons({
      dataRoot: deps.dataRoot,
      baseDeck: deps.fixtures.deck,
      styles: new Map(styles.map((s) => [s.id, s])),
      renderer: deps.renderer,
      onThumbnails: deps.onThumbnails,
      now,
      chat: name === 'editor',
      generating: name === 'generating',
      log: deps.log ?? silentLogger
    })
  }
  if (name === 'assets') await writeSeedAssets(deps.dataRoot, now)
  const marker: Marker = { name, version: 1, at: now.toISOString() }
  await atomicWriteJson(markerPath(deps.dataRoot), marker)
  return 'applied'
}

/** The design fixtures, loaded on demand so they stay out of the way of everything that is not a seed. */
export async function loadSeedFixtures(): Promise<SeedFixtures> {
  const [deck, style] = await Promise.all([
    import('../../../design/fixtures/deck.photosynthesis.json'),
    import('../../../design/fixtures/style-profile.science-ks3.json')
  ])
  return {
    deck: structuredClone(deck.default) as unknown as Deck,
    style: structuredClone(style.default) as unknown as StyleProfile
  }
}
