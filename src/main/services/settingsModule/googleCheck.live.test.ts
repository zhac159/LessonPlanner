/**
 * LIVE check of the FREE Google key test (`npm run test:live -- googleCheck`). It lists models only: no picture is
 * generated and nothing is billed. The key is read from googlekey.txt (git-ignored) with fs.readFileSync, only here,
 * and is never printed: assertions compare booleans and codes, and failures go through `redact`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { KeyStore, type Encryptor } from '../keyStore'
import { createPictureMakerStore } from './pictureMakerStore'
import { createPictureMakerApi } from './createPictureMakerApi'
import { checkGoogleKey, redactGoogleKeys } from './googleCheck'

const KEY_FILE = resolve(process.cwd(), 'googlekey.txt')
const has = existsSync(KEY_FILE)
const readKey = (): string => readFileSync(KEY_FILE, 'utf8').replace(/\s+/g, '')
const redact = (text: string): string => redactGoogleKeys(text, has ? readKey() : undefined)
const live = (url: string, init?: RequestInit): Promise<Response> => fetch(url, init)

const encryptor: Encryptor = {
  available: () => true,
  encrypt: (plain) => Uint8Array.from(Buffer.from([...plain].reverse().join(''))),
  decrypt: (data) => [...Buffer.from(data).toString()].reverse().join('')
}

describe.skipIf(!has)('Google key check (live, free: lists models only)', () => {
  let dir: string
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'google-live-'))
  })
  afterAll(() => rm(dir, { recursive: true, force: true }))

  it('accepts the real key and finds both picture models', async () => {
    for (const model of ['gemini-3-pro-image', 'gemini-nano-banana-2.1']) {
      const result = await checkGoogleKey({ key: readKey(), model, fetchFn: live })
      expect(result.ok, redact(JSON.stringify(result))).toBe(true)
    }
  })

  it('says model-unavailable for a model the key does not list', async () => {
    const result = await checkGoogleKey({
      key: readKey(),
      model: 'gemini-9-imaginary-image',
      fetchFn: live
    })
    expect(result).toMatchObject({ ok: false, code: 'model-unavailable' })
  })

  it('maps a wrong key to invalid-key (Google answers HTTP 400 API_KEY_INVALID)', async () => {
    const wrong = `AIza${'x'.repeat(35)}`
    const result = await checkGoogleKey({ key: wrong, model: 'gemini-3-pro-image', fetchFn: live })
    expect(result).toMatchObject({ ok: false, code: 'invalid-key' })
  })

  it('works end to end through the settings API with a stored, encrypted key', async () => {
    const events: unknown[] = []
    const api = createPictureMakerApi({
      store: createPictureMakerStore(dir),
      keyStore: new KeyStore({ dataDir: dir, encryptor, name: 'google' }),
      fetchFn: live,
      emit: (status) => events.push(status)
    })
    const saved = await api.setPictureMakerKey(readKey())
    expect(saved.ok).toBe(true)
    const tested = await api.testPictureMaker()
    expect(tested.ok, redact(JSON.stringify(tested))).toBe(true)
    const status = await api.getPictureMakerStatus()
    expect(status.lastTest?.result).toBe('connected')
    const everything = JSON.stringify([saved, tested, status, events])
    expect(everything.includes(readKey())).toBe(false)
  })
})
