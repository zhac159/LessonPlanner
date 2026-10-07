import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { DEFAULT_SETTINGS, createJsonStore, createSettingsStore } from './settingsStore'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'settings-'))
})
afterEach(() => rm(dir, { recursive: true, force: true }))

describe('createSettingsStore', () => {
  it('returns defaults when nothing is saved', async () => {
    expect(await createSettingsStore(dir).get()).toEqual(DEFAULT_SETTINGS)
  })

  it('persists updates across instances', async () => {
    await createSettingsStore(dir).update({ name: 'Ms Patel', subject: 'Science' })
    const again = await createSettingsStore(dir).get()
    expect(again).toMatchObject({ name: 'Ms Patel', subject: 'Science', model: 'claude-opus-5-5' })
    expect(JSON.parse(await readFile(join(dir, 'settings.json'), 'utf8')).name).toBe('Ms Patel')
  })

  it('supports function updates and nested onboarding changes', async () => {
    const store = createSettingsStore(dir)
    const next = await store.update((s) => ({
      ...s,
      onboarding: { ...s.onboarding, step: 'connect' }
    }))
    expect(next.onboarding.step).toBe('connect')
    expect(next.onboarding.skippedAi).toBe(false)
  })

  it('does not lose concurrent updates', async () => {
    const store = createSettingsStore(dir)
    await Promise.all([
      store.update({ name: 'A' }),
      store.update({ subject: 'B' }),
      store.update({ model: 'claude-sonnet-5-5' })
    ])
    expect(await createSettingsStore(dir).get()).toMatchObject({
      name: 'A',
      subject: 'B',
      model: 'claude-sonnet-5-5'
    })
  })

  it('falls back to defaults for a corrupt file and heals on the next write', async () => {
    await writeFile(join(dir, 'settings.json'), '{oops', 'utf8')
    const store = createSettingsStore(dir)
    expect(await store.get()).toEqual(DEFAULT_SETTINGS)
    await store.update({ name: 'Back' })
    expect((await createSettingsStore(dir).get()).name).toBe('Back')
  })

  it('fills fields missing from an older file and rejects values that fail the schema', async () => {
    await writeFile(join(dir, 'settings.json'), JSON.stringify({ name: 'Old' }), 'utf8')
    const store = createSettingsStore(dir)
    expect(await store.get()).toMatchObject({ name: 'Old', model: 'claude-opus-5-5' })
    await expect(store.update({ model: 'gpt-4' as never })).rejects.toThrow()
    expect((await store.get()).model).toBe('claude-opus-5-5')
  })

  it('keeps working after a rejected update', async () => {
    const store = createSettingsStore(dir)
    await expect(store.update({ name: 5 as never })).rejects.toThrow()
    expect((await store.update({ name: 'ok' })).name).toBe('ok')
  })

  it('resets to defaults', async () => {
    const store = createSettingsStore(dir)
    await store.update({ name: 'X' })
    expect(await store.reset()).toEqual(DEFAULT_SETTINGS)
  })
})

describe('createJsonStore (generic)', () => {
  it('works with any schema and defaults', async () => {
    const store = createJsonStore({
      file: join(dir, 'prefs.json'),
      schema: z.object({ count: z.number() }),
      defaults: { count: 0 }
    })
    expect(await store.update((c) => ({ count: c.count + 1 }))).toEqual({ count: 1 })
    expect(await store.get()).toEqual({ count: 1 })
  })
})
