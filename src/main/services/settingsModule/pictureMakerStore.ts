/**
 * What is remembered about the optional picture maker besides the key itself (A7): which model, the latest key
 * check and whether the first-run step was skipped. `<dataDir>/picture-maker.json`. The Google key is NOT here:
 * it lives encrypted in `secrets/google.key` (`KeyStore` with `name: 'google'`).
 *
 * The make-new service (agents/ASSETS.md WP 11) reads `model` from this store and the key from the same
 * `KeyStore`; nothing else about the picture maker is stored.
 */
import { join } from 'node:path'
import { z } from 'zod'
import type { PictureMakerModel } from '@shared/contracts/settings'
import { createJsonStore, type JsonStore } from '../settingsStore'

/** The choices the A7 select offers, best quality first. The first one is the default. */
export const PICTURE_MAKER_MODELS: readonly PictureMakerModel[] = [
  'gemini-3-pro-image',
  'gemini-nano-banana-2.1'
]

export const DEFAULT_PICTURE_MODEL: PictureMakerModel = 'gemini-3-pro-image'

export const isPictureMakerModel = (value: unknown): value is PictureMakerModel =>
  typeof value === 'string' && (PICTURE_MAKER_MODELS as readonly string[]).includes(value)

const schema = z.object({
  model: z.enum(['gemini-3-pro-image', 'gemini-nano-banana-2.1']),
  lastTest: z.object({ result: z.string(), at: z.string() }).nullable(),
  skipped: z.boolean()
})

export type PictureMakerSettings = z.infer<typeof schema>
export type PictureMakerStore = JsonStore<PictureMakerSettings>

export function createPictureMakerStore(dataDir: string): PictureMakerStore {
  return createJsonStore({
    file: join(dataDir, 'picture-maker.json'),
    schema,
    defaults: { model: DEFAULT_PICTURE_MODEL, lastTest: null, skipped: false }
  })
}
