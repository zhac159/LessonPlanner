/**
 * Shared helpers for the LIVE tests (`*.live.test.ts`, run with `npm run test:live`; never part of `npm run check`).
 *
 * These tests call the real Claude API and cost real money, so:
 *  - the key is read from keyt.txt (git-ignored) ONLY here, with fs.readFileSync, and handed to the SDK through
 *    `getApiKey`; it is never logged, written, or put in a test name or message. Everything that is printed or
 *    stored goes through `redact`.
 *  - every response is costed with the price table (src/shared/ai/prices.ts) into a running total persisted in
 *    .artifacts/live-spend.json (git-ignored). At `SPEND_STOP_USD` the key provider returns "no key", so no
 *    further request can be made until the file is deleted.
 *  - tests default to the cheaper model.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { costOf } from '@shared/ai/prices'
import type { AiService, ModelChoice, Usage } from '@shared/ai/types'
import type { Failure, Result } from '@shared/result'
import { createSdkClient } from '../client'
import { createAiService } from '../index'
import type { ClaudeClient } from '../sdk'

const ROOT = resolve(process.cwd())
const KEY_FILE = join(ROOT, 'keyt.txt')
const OUT_DIR = join(ROOT, '.artifacts', 'live')
const SPEND_FILE = join(ROOT, '.artifacts', 'live-spend.json')

/** The owner's cap for the validation run: stop at this running total. */
export const SPEND_STOP_USD = 2.5

export const LIVE_MODEL: ModelChoice = 'claude-sonnet-5-5'

export const hasKey = (): boolean => existsSync(KEY_FILE)

export const SKIP_MESSAGE =
  'live tests skipped: keyt.txt not found (see src/main/ai/live/harness.ts)'

function readKey(): string | null {
  try {
    const key = readFileSync(KEY_FILE, 'utf8').replace(/\s+/g, '')
    return key.length > 0 ? key : null
  } catch {
    return null
  }
}

/** Removes anything that looks like (or is) the API key from text. */
export function redact(text: string): string {
  let out = text.replace(/sk-ant-[A-Za-z0-9_-]+/g, '[key]')
  const key = readKey()
  if (key) out = out.split(key).join('[key]')
  return out
}

// ---- spend

interface SpendState {
  totalUsd: number
  calls: number
  byTask: Record<string, { usd: number; calls: number }>
}

function loadSpend(): SpendState {
  try {
    return JSON.parse(readFileSync(SPEND_FILE, 'utf8')) as SpendState
  } catch {
    return { totalUsd: 0, calls: 0, byTask: {} }
  }
}

export const totalSpendUsd = (): number => loadSpend().totalUsd

function addSpend(task: string, usd: number): SpendState {
  const state = loadSpend()
  state.totalUsd += usd
  state.calls += 1
  const entry = (state.byTask[task] ??= { usd: 0, calls: 0 })
  entry.usd += usd
  entry.calls += 1
  mkdirSync(join(ROOT, '.artifacts'), { recursive: true })
  writeFileSync(SPEND_FILE, JSON.stringify(state, null, 2))
  return state
}

/** Usage recorded per response in this process (for assertions such as "cache read tokens on the 2nd call"). */
export const usageSeen: Array<{ task: string; model: string; usage: Usage; usd: number }> = []

// ---- error capture (the AI layer maps every failure to a friendly code; the live tests want the real body)

export let lastApiError = ''

function describeError(error: unknown): string {
  const e = error as { status?: number; error?: unknown; message?: string }
  let body = ''
  try {
    body = JSON.stringify(e.error ?? e.message ?? String(error))
  } catch {
    body = String(e.message ?? error)
  }
  return redact(`HTTP ${e.status ?? '?'} ${body}`).slice(0, 2000)
}

function wrapClient(real: ClaudeClient): ClaudeClient {
  return {
    beta: {
      messages: {
        create: (params, options) => {
          const promise = Promise.resolve(real.beta.messages.create(params, options))
          promise.catch((error) => {
            lastApiError = describeError(error)
          })
          return promise
        },
        stream: (params, options) => {
          const stream = real.beta.messages.stream(params, options)
          return {
            on: (event, listener) => stream.on(event, listener),
            finalMessage: () => {
              const promise = stream.finalMessage()
              promise.catch((error) => {
                lastApiError = describeError(error)
              })
              return promise
            }
          }
        }
      }
    }
  }
}

/** Real `AiService` on the key from keyt.txt, costing every response and refusing to go past the cap. */
export function createLiveService(
  opts: { model?: ModelChoice; apiKey?: string; unlimited?: boolean } = {}
): AiService {
  const model = opts.model ?? LIVE_MODEL
  return createAiService({
    getModel: () => model,
    getApiKey: () => {
      if (opts.apiKey) return opts.apiKey
      if (!opts.unlimited && totalSpendUsd() >= SPEND_STOP_USD) {
        console.error(`[live] spend cap reached ($${totalSpendUsd().toFixed(3)}): refusing to call`)
        return null
      }
      return readKey()
    },
    createClient: (key) => wrapClient(createSdkClient(key)),
    usage: {
      record: ({ model: usedModel, task, usage }) => {
        const usd = costOf(usedModel, usage)
        const state = addSpend(task, usd)
        usageSeen.push({ task, model: usedModel, usage, usd })
        console.log(
          `[live] ${task}: in ${usage.inputTokens} out ${usage.outputTokens} cacheR ${usage.cacheReadTokens} cacheW ${usage.cacheWriteTokens} = $${usd.toFixed(4)} | running total $${state.totalUsd.toFixed(3)}`
        )
      }
    }
  })
}

/** Unwraps a `Result`, failing with a redacted explanation that includes the real API error body. */
export function unwrap<T extends object>(result: Result<T>, what: string): T {
  if (result.ok) return result as unknown as T
  const failure = result as Failure
  throw new Error(
    redact(`${what} failed: ${failure.code} "${failure.message}" | api: ${lastApiError || 'n/a'}`)
  )
}

/** Writes a JSON artifact of a result for later inspection (no key can be in it: only model output). */
export function saveArtifact(name: string, value: unknown): string {
  mkdirSync(OUT_DIR, { recursive: true })
  const file = join(OUT_DIR, name)
  writeFileSync(file, redact(JSON.stringify(value, null, 2)))
  return file
}

export const readArtifact = <T>(name: string): T | undefined => {
  try {
    return JSON.parse(readFileSync(join(OUT_DIR, name), 'utf8')) as T
  } catch {
    return undefined
  }
}

export const artifactDir = (): string => {
  mkdirSync(OUT_DIR, { recursive: true })
  return OUT_DIR
}

/**
 * Sends a tiny request with `schema` as the structured-output format and returns 'ok' or the (redacted) API error.
 * The grammar is compiled before anything is generated, so a rejected schema costs nothing and an accepted one
 * costs a few tokens (max_tokens 24, no thinking).
 */
export async function probeSchema(schema: import('zod').ZodType): Promise<string> {
  const { outputFormat } = await import('../request')
  const key = readKey()
  if (!key) return 'no key'
  const client = createSdkClient(key)
  try {
    const message = await client.beta.messages.create({
      model: LIVE_MODEL,
      max_tokens: 24,
      output_config: { format: outputFormat(schema) },
      messages: [{ role: 'user', content: 'Reply with a minimal example.' }]
    } as never)
    const usd = costOf(LIVE_MODEL, {
      inputTokens: message.usage.input_tokens ?? 0,
      outputTokens: message.usage.output_tokens ?? 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0
    })
    addSpend('probe', usd)
    return 'ok'
  } catch (error) {
    return describeError(error)
  }
}
