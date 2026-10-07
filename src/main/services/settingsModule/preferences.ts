/** Remembered choices (Home sort, New lesson defaults): `<dataDir>/preferences.json`. */
import { join } from 'node:path'
import { z } from 'zod'
import type { Preferences } from '@shared/contracts/settings'
import { createJsonStore, type JsonStore } from '../settingsStore'

export const preferencesSchema = z.object({
  homeSort: z.enum(['edited', 'title', 'year']),
  lastLengthMin: z.number().int().positive().nullable(),
  lastYearGroup: z.string().max(60).nullable(),
  lastAbility: z.string().max(60).nullable(),
  assetsMenuUses: z.number().int().min(0).max(1_000_000)
})

export const DEFAULT_PREFERENCES: Preferences = {
  homeSort: 'edited',
  lastLengthMin: null,
  lastYearGroup: null,
  lastAbility: null,
  assetsMenuUses: 0
}

export type PreferencesStore = JsonStore<Preferences>

/** The preferences file inside `dataDir`. */
export function createPreferencesStore(dataDir: string): PreferencesStore {
  return createJsonStore({
    file: join(dataDir, 'preferences.json'),
    schema: preferencesSchema,
    defaults: DEFAULT_PREFERENCES
  })
}
