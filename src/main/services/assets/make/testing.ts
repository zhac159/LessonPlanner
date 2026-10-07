/** Test-only helpers for the make-new service: a ready harness with fake Claude, fake picture maker and a real library. */
import { vi } from 'vitest'
import type { Asset, AssetKind } from '@shared/assets/types'
import type { MakeProgress } from '@shared/contracts/assets'
import { fail, ok, type Failure, type Result } from '@shared/result'
import type {
  MakeImagesRequest,
  MakeImagesResult,
  PictureMaker
} from '../../imageProviders/nanoBanana'
import { cleanTemp, newAssetInput, photoPng, tempDir, testService } from '../testing'
import { fakePicture } from './fakeMaker'
import { MakeService } from './service'
import type { MakeServiceDeps, PictureMakerSettings } from './types'

export { cleanTemp }

export interface FakeMakerOptions {
  /** The result of the n-th call (0-based); default: a picture. */
  answer?: (index: number) => Failure | undefined
  /** Waits before answering (to hold requests in flight). */
  gate?: () => Promise<void>
}

export function fakeMaker(options: FakeMakerOptions = {}): PictureMaker & {
  requests: MakeImagesRequest[]
  maxInFlight: () => number
  /** Resolves once no request is in flight (and one more turn has passed). */
  idle: () => Promise<void>
} {
  const requests: MakeImagesRequest[] = []
  let inFlight = 0
  let peak = 0
  return {
    id: 'test',
    model: 'gemini-3-pro-image',
    requests,
    maxInFlight: () => peak,
    idle: async () => {
      while (inFlight > 0) await Promise.resolve()
      await Promise.resolve()
    },
    async makeImages(request): Promise<MakeImagesResult> {
      const index = requests.push(request) - 1
      inFlight++
      peak = Math.max(peak, inFlight)
      try {
        await options.gate?.()
        const failure = options.answer?.(index)
        return failure ?? ok({ images: [fakePicture(index)], failed: 0 })
      } finally {
        inFlight--
      }
    }
  }
}

export interface HarnessOptions {
  googleKey?: boolean
  lastTest?: string | null
  claudeKey?: boolean
  model?: string
  maker?: PictureMaker
  describe?: () => Result<{ description: string }>
}

export async function harness(options: HarnessOptions = {}) {
  const dir = await tempDir()
  const assets = testService(dir)
  await assets.init()
  const events: MakeProgress[] = []
  const waiters: Array<() => void> = []
  const maker = (options.maker ?? fakeMaker()) as ReturnType<typeof fakeMaker>
  const ai = {
    describeStyleOfAssets: vi.fn(
      async (_input: { images: Uint8Array[]; kinds: AssetKind[] }) =>
        options.describe?.() ?? ok({ description: 'Flat navy outlines, teal fills.' })
    ),
    drawSvg: vi.fn(async (input: { versions: number }) =>
      ok({
        svgs: Array.from(
          { length: input.versions },
          (_, i) =>
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="${20 + i}"/></svg>`
        )
      })
    )
  }
  const settings: PictureMakerSettings = {
    hasKey: async () => options.googleKey ?? true,
    getKey: async () => 'AIza-test',
    model: async () => options.model ?? 'gemini-3-pro-image',
    lastTest: async () => (options.lastTest === undefined ? 'connected' : options.lastTest)
  }
  const costs: Array<{ model: string; usd: number | null; count: number }> = []
  const deps: MakeServiceDeps = {
    assets,
    ai,
    settingsDir: dir,
    settings,
    hasClaudeKey: async () => options.claudeKey ?? true,
    createMaker: () => maker,
    emit: (p) => {
      events.push(p)
      waiters.splice(0).forEach((w) => w())
    },
    recordCost: (c) => costs.push(c),
    now: () => new Date('2026-10-07T10:00:00.000Z')
  }
  const service = new MakeService(deps)

  /** Resolves once an event satisfies `test` (already seen ones count). */
  async function until(test: (p: MakeProgress) => boolean): Promise<MakeProgress> {
    for (;;) {
      const hit = events.find(test)
      if (hit) return hit
      await new Promise<void>((resolve) => waiters.push(resolve))
    }
  }
  const finished = (jobId: string): Promise<MakeProgress> =>
    until((p) => p.jobId === jobId && (p.stage === 'done' || p.stage === 'error'))

  async function addAsset(name: string, kind: AssetKind, seed = 1): Promise<Asset> {
    return assets.add(newAssetInput(name, { kind, bytes: photoPng(seed) }))
  }
  return { assets, service, ai, maker, events, costs, until, finished, addAsset, deps, dir }
}

export { fail }
