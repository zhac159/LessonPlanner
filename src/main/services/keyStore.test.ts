import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { redactApiKeys } from '@shared/ai/keyFormat'
import { CANNOT_ENCRYPT, KeyStore, NO_GOOGLE_KEY, UNREADABLE_KEY, type Encryptor } from './keyStore'

const KEY = 'sk-ant-api03-SUPERSECRETVALUE-WXYZ'

/** Reversible fake: not real crypto, but the plaintext never appears in its output. */
const fakeEncryptor = (available = true): Encryptor => ({
  available: () => available,
  encrypt: (plain) =>
    Uint8Array.from(Buffer.from([...plain].reverse().join('')).map((b) => b ^ 0x5a)),
  decrypt: (data) =>
    [...Buffer.from(Uint8Array.from(data).map((b) => b ^ 0x5a)).toString()].reverse().join('')
})

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'keystore-'))
})
afterEach(async () => {
  vi.restoreAllMocks()
  await rm(dir, { recursive: true, force: true })
})

const keyFile = () => join(dir, 'secrets', 'anthropic.key')

describe('KeyStore', () => {
  it('starts empty', async () => {
    const store = new KeyStore({ dataDir: dir, encryptor: fakeEncryptor() })
    expect(await store.hasKey()).toBe(false)
    expect(await store.lastFour()).toBeNull()
    expect(await store.get()).toMatchObject({ ok: false, code: 'no-key' })
  })

  it('round-trips a key and exposes only the last four', async () => {
    const store = new KeyStore({ dataDir: dir, encryptor: fakeEncryptor() })
    expect(await store.set(KEY)).toEqual({ ok: true, lastFour: 'WXYZ' })
    expect(await store.hasKey()).toBe(true)
    expect(await store.lastFour()).toBe('WXYZ')
    expect(await store.get()).toEqual({ ok: true, key: KEY })
  })

  it('survives a new instance (data lives on disk) and never stores the plaintext', async () => {
    await new KeyStore({ dataDir: dir, encryptor: fakeEncryptor() }).set(KEY)
    const raw = await readFile(keyFile(), 'utf8')
    expect(raw).not.toContain('SUPERSECRET')
    expect(await new KeyStore({ dataDir: dir, encryptor: fakeEncryptor() }).get()).toEqual({
      ok: true,
      key: KEY
    })
  })

  it('replaces a key and clears it', async () => {
    const store = new KeyStore({ dataDir: dir, encryptor: fakeEncryptor() })
    await store.set(KEY)
    await store.set('sk-ant-api03-another-1234')
    expect(await store.lastFour()).toBe('1234')
    await store.clear()
    expect(await store.hasKey()).toBe(false)
    await expect(store.clear()).resolves.toBeUndefined()
  })

  it('refuses to save when encryption is unavailable (no plaintext fallback)', async () => {
    const store = new KeyStore({ dataDir: dir, encryptor: fakeEncryptor(false) })
    expect(store.encryptionAvailable()).toBe(false)
    expect(await store.set(KEY)).toEqual({ ok: false, code: 'io', message: CANNOT_ENCRYPT })
    expect(await store.hasKey()).toBe(false)
    await expect(readFile(keyFile(), 'utf8')).rejects.toThrow()
  })

  it('treats a throwing encryptor as unavailable and fails with io', async () => {
    const broken: Encryptor = {
      available: () => {
        throw new Error('no dpapi')
      },
      encrypt: () => new Uint8Array(),
      decrypt: () => ''
    }
    const store = new KeyStore({ dataDir: dir, encryptor: broken })
    expect(store.encryptionAvailable()).toBe(false)
    expect(await store.set(KEY)).toMatchObject({ ok: false, code: 'io' })
  })

  it('reports io (not no-key) for a corrupt file, and a decrypt failure', async () => {
    await mkdir(join(dir, 'secrets'), { recursive: true })
    await writeFile(keyFile(), '{not json', 'utf8')
    const store = new KeyStore({ dataDir: dir, encryptor: fakeEncryptor() })
    expect(await store.hasKey()).toBe(false)
    expect(await store.get()).toEqual({ ok: false, code: 'io', message: UNREADABLE_KEY })

    await store.set(KEY)
    const failing: Encryptor = {
      ...fakeEncryptor(),
      decrypt: () => {
        throw new Error('bad blob')
      }
    }
    expect(await new KeyStore({ dataDir: dir, encryptor: failing }).get()).toMatchObject({
      ok: false,
      code: 'io'
    })
  })

  it('never logs or leaks the key, in any outcome', async () => {
    const spies = [
      vi.spyOn(console, 'log').mockImplementation(() => {}),
      vi.spyOn(console, 'info').mockImplementation(() => {}),
      vi.spyOn(console, 'warn').mockImplementation(() => {}),
      vi.spyOn(console, 'error').mockImplementation(() => {})
    ]
    const leaky: Encryptor = {
      ...fakeEncryptor(),
      decrypt: () => {
        throw new Error(`cannot decrypt ${KEY}`)
      }
    }
    const results = [
      await new KeyStore({ dataDir: dir, encryptor: fakeEncryptor() }).set(KEY),
      await new KeyStore({ dataDir: dir, encryptor: leaky }).get(),
      await new KeyStore({ dataDir: dir, encryptor: fakeEncryptor(false) }).set(KEY)
    ]
    for (const spy of spies) expect(spy).not.toHaveBeenCalled()
    expect(JSON.stringify(results)).not.toContain('SUPERSECRET')
  })

  it('redaction helper hides a key that sneaks into text', () => {
    expect(redactApiKeys(`oops ${KEY}`)).not.toContain('SUPERSECRET')
  })
  it('holds a second named secret in its own file without touching the first', async () => {
    const claude = new KeyStore({ dataDir: dir, encryptor: fakeEncryptor() })
    const google = new KeyStore({ dataDir: dir, encryptor: fakeEncryptor(), name: 'google' })
    expect(await google.get()).toEqual({ ok: false, code: 'no-key', message: NO_GOOGLE_KEY })
    await claude.set(KEY)
    await google.set('AIzaSyGoogleSecretValue0123456789abcdef')
    expect(await google.lastFour()).toBe('cdef')
    expect(await claude.lastFour()).toBe('WXYZ')
    const raw = await readFile(join(dir, 'secrets', 'google.key'), 'utf8')
    expect(raw).not.toContain('GoogleSecret')
    await google.clear()
    expect(await google.hasKey()).toBe(false)
    expect(await claude.hasKey()).toBe(true)
  })

  it('reads a file written before named secrets existed (same format, anthropic.key)', async () => {
    await mkdir(join(dir, 'secrets'), { recursive: true })
    const cipher = Buffer.from(fakeEncryptor().encrypt(KEY)).toString('base64')
    await writeFile(keyFile(), JSON.stringify({ version: 1, last4: 'WXYZ', cipher }), 'utf8')
    expect(await new KeyStore({ dataDir: dir, encryptor: fakeEncryptor() }).get()).toEqual({
      ok: true,
      key: KEY
    })
  })
})
