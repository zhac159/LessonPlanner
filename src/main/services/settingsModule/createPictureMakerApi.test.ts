import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContractClient } from '@shared/contract'
import type { PictureMakerStatus, SettingsApi } from '@shared/contracts/settings'
import { KeyStore, type Encryptor } from '../keyStore'
import { GEMINI_BAD_KEY, fakeFetch, json } from '../imageProviders/testing'
import {
  NOT_A_GOOGLE_KEY,
  createPictureMakerApi,
  type PictureMakerApiDeps
} from './createPictureMakerApi'
import { createPictureMakerStore } from './pictureMakerStore'

const KEY = 'AIzaSyD-SECRETSECRETSECRETSECRET0123456'
const NOW = new Date('2026-10-07T09:00:00.000Z')
const PRO = 'gemini-3-pro-image'

const encryptor = (available = true): Encryptor => ({
  available: () => available,
  encrypt: (plain) => Uint8Array.from(Buffer.from([...plain].reverse().join(''))),
  decrypt: (data) => [...Buffer.from(data).toString()].reverse().join('')
})

const listing = (...names: string[]) =>
  json({ models: names.map((n) => ({ name: `models/${n}` })) })

let dir: string
let events: PictureMakerStatus[]

type Client = Pick<
  ContractClient<SettingsApi>,
  | 'getPictureMakerStatus'
  | 'setPictureMakerKey'
  | 'testPictureMaker'
  | 'setPictureMakerModel'
  | 'removePictureMakerKey'
  | 'skipPictureMaker'
>

function build(over: Partial<PictureMakerApiDeps> = {}, available = true): Client {
  return createPictureMakerApi({
    store: createPictureMakerStore(dir),
    keyStore: new KeyStore({ dataDir: dir, encryptor: encryptor(available), name: 'google' }),
    fetchFn: fakeFetch(() => listing(PRO, 'gemini-nano-banana-2.1')).fetchFn,
    emit: (status) => events.push(status),
    now: () => NOW,
    ...over
  }) as unknown as Client
}

async function filesText(): Promise<string> {
  const names = await readdir(dir, { recursive: true })
  const texts = await Promise.all(
    names.map((name) => readFile(join(dir, name), 'utf8').catch(() => ''))
  )
  return texts.join('\n')
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'picture-maker-'))
  events = []
})
afterEach(() => rm(dir, { recursive: true, force: true }))

describe('picture maker status', () => {
  it('starts with no key, the best model, not skipped', async () => {
    expect(await build().getPictureMakerStatus()).toEqual({
      hasKey: false,
      keyLast4: null,
      model: PRO,
      lastTest: null,
      skipped: false,
      encryptionAvailable: true
    })
  })

  it('says when this computer cannot encrypt', async () => {
    expect((await build({}, false).getPictureMakerStatus()).encryptionAvailable).toBe(false)
  })
})

describe('setPictureMakerKey', () => {
  it('stores the key encrypted, returns and emits only the last four', async () => {
    const api = build()
    const saved = await api.setPictureMakerKey(` ${KEY.slice(0, 12)}\n${KEY.slice(12)} `)
    expect(saved).toEqual({ ok: true, keyLast4: '3456' })
    expect(await api.getPictureMakerStatus()).toMatchObject({ hasKey: true, keyLast4: '3456' })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ hasKey: true, keyLast4: '3456' })
    expect(JSON.stringify(events)).not.toContain('SECRETSECRET')
    expect(await filesText()).not.toContain('SECRETSECRET')
    expect(await readFile(join(dir, 'secrets', 'google.key'), 'utf8')).toMatch(/"last4": "3456"/)
  })

  it('accepts the newer AQ. auth keys that AI Studio creates now', async () => {
    const api = build()
    const newKey = 'AQ.Ab8RN6SECRETSECRETSECRETSECRETSECRET_abcdefg-123'
    expect(await api.setPictureMakerKey(newKey)).toEqual({ ok: true, keyLast4: '-123' })
    expect(await filesText()).not.toContain('SECRETSECRET')
  })

  it('refuses text that is not shaped like a Google key (Claude keys included)', async () => {
    const api = build()
    for (const bad of ['', 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz', 'AIzaShort', 12 as never]) {
      expect(await api.setPictureMakerKey(bad)).toEqual({
        ok: false,
        code: 'invalid-input',
        message: NOT_A_GOOGLE_KEY
      })
    }
    expect((await api.getPictureMakerStatus()).hasKey).toBe(false)
    expect(events).toHaveLength(0)
  })

  it('fails with io and writes nothing when encryption is unavailable', async () => {
    const api = build({}, false)
    const result = await api.setPictureMakerKey(KEY)
    expect(result).toMatchObject({ ok: false, code: 'io' })
    expect(JSON.stringify(result)).not.toContain('SECRETSECRET')
    expect((await api.getPictureMakerStatus()).hasKey).toBe(false)
  })

  it('forgets an earlier test and the skipped flag when a key is added', async () => {
    const api = build()
    await api.skipPictureMaker()
    await api.setPictureMakerKey(KEY)
    await api.testPictureMaker()
    await api.setPictureMakerKey(KEY.replace('3456', '9999'))
    expect(await api.getPictureMakerStatus()).toMatchObject({
      keyLast4: '9999',
      lastTest: null,
      skipped: false
    })
  })
})

describe('testPictureMaker', () => {
  it('needs a saved key', async () => {
    expect(await build().testPictureMaker()).toMatchObject({ ok: false, code: 'no-key' })
  })

  it('makes one FREE list-models request with the stored key and records connected', async () => {
    const { fetchFn, calls } = fakeFetch(() => listing(PRO))
    const api = build({ fetchFn })
    await api.setPictureMakerKey(KEY)
    const result = await api.testPictureMaker()
    expect(result).toMatchObject({ ok: true, model: PRO })
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toMatch(/\/v1beta\/models\?/)
    expect(calls[0].url).not.toContain(':generateContent')
    expect(calls[0].headers['x-goog-api-key']).toBe(KEY)
    const status = await api.getPictureMakerStatus()
    expect(status.lastTest).toEqual({ result: 'connected', at: NOW.toISOString() })
    expect(events.at(-1)).toEqual(status)
    expect(JSON.stringify([result, events])).not.toContain('SECRETSECRET')
  })

  it('maps a bad key and keeps the failure code in the status', async () => {
    const api = build({ fetchFn: fakeFetch(() => json(GEMINI_BAD_KEY, 400)).fetchFn })
    await api.setPictureMakerKey(KEY)
    const result = await api.testPictureMaker()
    expect(result).toMatchObject({ ok: false, code: 'invalid-key' })
    expect((await api.getPictureMakerStatus()).lastTest).toEqual({
      result: 'invalid-key',
      at: NOW.toISOString()
    })
  })

  it('tests the chosen model: faster-and-cheaper missing means model-unavailable', async () => {
    const api = build({ fetchFn: fakeFetch(() => listing(PRO)).fetchFn })
    await api.setPictureMakerKey(KEY)
    await api.setPictureMakerModel('gemini-nano-banana-2.1')
    expect(await api.testPictureMaker()).toMatchObject({ ok: false, code: 'model-unavailable' })
  })

  it('never lets the key out through a failing network call', async () => {
    const fetchFn = vi.fn(async (): Promise<Response> => {
      throw new Error(`socket hang up ${KEY}`)
    })
    const api = build({ fetchFn })
    await api.setPictureMakerKey(KEY)
    const result = await api.testPictureMaker()
    expect(result).toMatchObject({ ok: false, code: 'network' })
    expect(JSON.stringify([result, events])).not.toContain('SECRETSECRET')
  })
})

describe('model, skip and remove', () => {
  it('saves the model, rejects unknown ones and forgets the old test', async () => {
    const api = build()
    await api.setPictureMakerKey(KEY)
    await api.testPictureMaker()
    await api.setPictureMakerModel('gemini-nano-banana-2.1')
    expect(await api.getPictureMakerStatus()).toMatchObject({
      model: 'gemini-nano-banana-2.1',
      lastTest: null
    })
    await expect(api.setPictureMakerModel('gpt-image' as never)).rejects.toThrow()
  })

  it('records skip and emits', async () => {
    const api = build()
    await api.skipPictureMaker()
    expect((await api.getPictureMakerStatus()).skipped).toBe(true)
    expect(events.at(-1)?.skipped).toBe(true)
  })

  it('removes the key and its test result, keeping the model', async () => {
    const api = build()
    await api.setPictureMakerKey(KEY)
    await api.setPictureMakerModel('gemini-nano-banana-2.1')
    await api.removePictureMakerKey()
    expect(await api.getPictureMakerStatus()).toMatchObject({
      hasKey: false,
      keyLast4: null,
      lastTest: null,
      model: 'gemini-nano-banana-2.1'
    })
    await expect(readFile(join(dir, 'secrets', 'google.key'))).rejects.toThrow()
  })

  it('survives a restart: a new api over the same folder sees the same status', async () => {
    const first = build()
    await first.setPictureMakerKey(KEY)
    await first.testPictureMaker()
    expect(await build().getPictureMakerStatus()).toMatchObject({
      hasKey: true,
      keyLast4: '3456',
      lastTest: { result: 'connected' }
    })
  })
})
