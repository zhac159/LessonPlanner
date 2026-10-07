/**
 * Stores an API key encrypted on this PC (design/claude-access.md, screens/02-connect-claude.md §6). There are
 * two named secrets: `anthropic` (the Claude key, the default) and `google` (the optional picture maker, A7).
 * Rules: a key is only ever decrypted in the main process, never returned over IPC, never logged, and there is
 * no plaintext fallback: when encryption is unavailable `set` fails and nothing is written.
 *
 * File: `<dataDir>/secrets/<name>.key` (a small JSON wrapper: base64 ciphertext + the last four characters,
 * which are not secret and let the UI show "Saved key ending in ABCD" without decrypting). The format is the
 * same for every name, so files written before the second secret existed stay readable.
 */
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { NOT_CONNECTED } from '@shared/ai/errors'
import { lastFourOf } from '@shared/ai/keyFormat'
import { fail, ok, type Result } from '@shared/result'
import { atomicWriteJson } from './fsx'

/** Encrypts/decrypts one string. Injected so unit tests never touch Electron. */
export interface Encryptor {
  encrypt(plain: string): Uint8Array
  decrypt(data: Uint8Array): string
  available(): boolean
}

/** Default encryptor over Electron `safeStorage` (Windows DPAPI). Electron is required lazily. */
export function createSafeStorageEncryptor(): Encryptor {
  const safe = (): Electron.SafeStorage =>
    (require('electron') as typeof import('electron')).safeStorage
  return {
    available: () => safe().isEncryptionAvailable(),
    encrypt: (plain) => safe().encryptString(plain),
    decrypt: (data) => safe().decryptString(Buffer.from(data))
  }
}

export const CANNOT_ENCRYPT = 'This computer can’t store the key securely, so it wasn’t saved.'
/** The secrets this store can hold; each lives in its own file. */
export type SecretName = 'anthropic' | 'google'

export const NO_GOOGLE_KEY = 'Add a Google picture-maker key in Settings first.'
export const UNREADABLE_KEY = 'The saved key couldn’t be read. Add your API key again in Settings.'

const fileSchema = z.object({ version: z.literal(1), last4: z.string(), cipher: z.string().min(1) })

export interface KeyStoreOptions {
  dataDir: string
  encryptor: Encryptor
  /** Which secret this store holds (default `anthropic`). */
  name?: SecretName
}

export class KeyStore {
  private readonly file: string
  private readonly encryptor: Encryptor
  private readonly missing: string

  constructor({ dataDir, encryptor, name = 'anthropic' }: KeyStoreOptions) {
    this.file = join(dataDir, 'secrets', `${name}.key`)
    this.encryptor = encryptor
    this.missing = name === 'google' ? NO_GOOGLE_KEY : NOT_CONNECTED
  }

  /** Can this PC encrypt secrets? (false => the Connect screen disables the key field). */
  encryptionAvailable(): boolean {
    try {
      return this.encryptor.available()
    } catch {
      return false
    }
  }

  async hasKey(): Promise<boolean> {
    return (await this.read()).state === 'ok'
  }

  /** The last four characters of the saved key, or null. The only part that may reach the UI. */
  async lastFour(): Promise<string | null> {
    const read = await this.read()
    return read.state === 'ok' ? read.meta.last4 : null
  }

  /** The decrypted key, for the AI client only. `no-key` when none is saved, `io` when it can't be read. */
  async get(): Promise<Result<{ key: string }>> {
    const read = await this.read()
    if (read.state === 'missing') return fail('no-key', this.missing)
    if (read.state === 'corrupt') return fail('io', UNREADABLE_KEY)
    try {
      return ok({ key: this.encryptor.decrypt(Buffer.from(read.meta.cipher, 'base64')) })
    } catch {
      return fail('io', UNREADABLE_KEY)
    }
  }

  /** Encrypts and saves `key` (already validated by the caller). Replaces any previous key. */
  async set(key: string): Promise<Result<{ lastFour: string }>> {
    if (!this.encryptionAvailable()) return fail('io', CANNOT_ENCRYPT)
    try {
      const cipher = Buffer.from(this.encryptor.encrypt(key)).toString('base64')
      const last4 = lastFourOf(key)
      await atomicWriteJson(this.file, { version: 1, last4, cipher })
      return ok({ lastFour: last4 })
    } catch {
      return fail('io', CANNOT_ENCRYPT)
    }
  }

  /** Removes the saved key (no error when there is none). */
  async clear(): Promise<void> {
    await rm(this.file, { force: true })
  }

  private async read(): Promise<
    { state: 'missing' } | { state: 'corrupt' } | { state: 'ok'; meta: z.infer<typeof fileSchema> }
  > {
    let text: string
    try {
      text = await readFile(this.file, 'utf8')
    } catch {
      return { state: 'missing' }
    }
    const parsed = fileSchema.safeParse(safeJson(text))
    return parsed.success ? { state: 'ok', meta: parsed.data } : { state: 'corrupt' }
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
