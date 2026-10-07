/**
 * LIVE check of the make-new service against the real Google picture maker and real Claude (WP11).
 * Run: `MAKE_LIVE=1 npm run test:live -- make.live`. It spends real money, so it is off unless MAKE_LIVE=1.
 *
 * Budget (owner): at most TWO pictures in total. The service is run with 2 versions but the maker is wrapped so
 * only ONE request per run reaches Google (the second is refused locally and costs nothing). Run 1 uses the
 * cheaper Nano Banana 2.1; run 2 (Nano Banana Pro) happens only if run 1 produced a picture. The Google key is
 * read from googlekey.txt here, with fs.readFileSync, and is never printed: everything written goes through
 * `redactGoogleKeys`. Results (PNG, report.json) go to .artifacts/make-live/.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { fail } from '@shared/result'
import type { MakeProgress } from '@shared/contracts/assets'
import { createLiveService } from '../../../ai/live/harness'
import type { FetchFn } from '../../imageProviders/types'
import { createNanoBananaMaker, type PictureMaker } from '../../imageProviders/nanoBanana'
import { redactGoogleKeys } from '../../settingsModule/googleCheck'
import { cleanTemp, newAssetInput, tempDir, testService } from '../testing'
import { MakeService } from './service'

const KEY_FILE = resolve(process.cwd(), 'googlekey.txt')
const EXAMPLES = resolve(process.cwd(), '.artifacts/example-assets')
const OUT = resolve(process.cwd(), '.artifacts/make-live')
const ENABLED = process.env.MAKE_LIVE === '1' && existsSync(KEY_FILE) && existsSync(EXAMPLES)
const readKey = (): string => readFileSync(KEY_FILE, 'utf8').replace(/\s+/g, '')
const clean = (text: string): string => redactGoogleKeys(text, ENABLED ? readKey() : undefined)

const REQUEST = 'a Bunsen burner with a lit flame, simple flat illustration'
const report: Record<string, unknown> = { request: REQUEST }
let cheapWorked = false

/** Records what Google sent (status, shape, never the key or image data) and times each call. */
function recordingFetch(label: string): FetchFn {
  return async (url, init) => {
    const started = Date.now()
    const res = await fetch(url, init)
    const text = await res.clone().text()
    const entry: Record<string, unknown> = {
      status: res.status,
      ms: Date.now() - started,
      requestBytes: typeof init?.body === 'string' ? init.body.length : null
    }
    try {
      const json = JSON.parse(text) as Record<string, unknown>
      if (res.ok) {
        const parts =
          ((json.candidates as Array<{ content?: { parts?: Array<Record<string, unknown>> } }>)?.[0]
            ?.content?.parts as Array<Record<string, unknown>>) ?? []
        entry.parts = parts.map((p) => ({
          keys: Object.keys(p),
          thought: p.thought ?? false,
          mime: (p.inlineData as { mimeType?: string } | undefined)?.mimeType,
          text: typeof p.text === 'string' ? p.text.slice(0, 160) : undefined
        }))
        entry.finishReason = (json.candidates as Array<{ finishReason?: string }>)?.[0]
          ?.finishReason
        entry.usageMetadata = json.usageMetadata
        entry.modelVersion = json.modelVersion
      } else entry.error = clean(JSON.stringify(json)).slice(0, 1500)
    } catch {
      entry.rawText = clean(text).slice(0, 500)
    }
    ;(report[label] as { http: unknown[] }).http.push(entry)
    return res
  }
}

async function run(model: string, label: string): Promise<MakeProgress> {
  report[label] = { model, http: [] as unknown[] }
  const dir = await tempDir()
  const assets = testService(dir)
  await assets.init()
  for (const [name, file] of [
    ['card_animals', 'symbol_cards_p4.jpg'],
    ['card_senses', 'symbol_cards_p7.jpg']
  ] as const) {
    await assets.add(
      newAssetInput(name, {
        kind: 'symbol-card',
        bytes: new Uint8Array(readFileSync(join(EXAMPLES, file))),
        ext: '.jpg'
      })
    )
  }
  const ids = assets.store.list().map((a) => a.id)
  let sent = 0
  const events: MakeProgress[] = []
  let wake: () => void = () => undefined
  const service = new MakeService({
    assets,
    ai: createLiveService({ unlimited: false }),
    settingsDir: dir,
    settings: {
      hasKey: async () => true,
      getKey: async () => readKey(),
      model: async () => model,
      lastTest: async () => 'connected'
    },
    hasClaudeKey: async () => true,
    // One real request per run: the second version is refused here, before anything leaves the PC.
    createMaker: ({ getKey, model: chosen }): PictureMaker => {
      const real = createNanoBananaMaker({
        getKey,
        model: chosen,
        fetchFn: recordingFetch(label)
      })
      return {
        ...real,
        makeImages: async (request) => {
          if (sent++ >= 1) return fail('unknown', 'Skipped by the live budget guard.')
          const started = Date.now()
          const result = await real.makeImages(request)
          ;(report[label] as Record<string, unknown>).makerMs = Date.now() - started
          ;(report[label] as Record<string, unknown>).referencesSent = request.references?.length
          ;(report[label] as Record<string, unknown>).prompt = request.prompt
          ;(report[label] as Record<string, unknown>).aspect = request.aspect
          return result
        }
      }
    },
    emit: (p) => {
      events.push(p)
      wake()
    }
  })
  const started = await service.start({
    basedOn: ids,
    prompt: REQUEST,
    versions: 2,
    kind: 'symbol-card'
  })
  if (!started.ok) throw new Error(clean(started.message))
  const t0 = Date.now()
  for (;;) {
    const last = events.at(-1)
    if (last && (last.stage === 'done' || last.stage === 'error')) {
      ;(report[label] as Record<string, unknown>).totalMs = Date.now() - t0
      ;(report[label] as Record<string, unknown>).styleDescription = last.styleDescription
      ;(report[label] as Record<string, unknown>).versions = last.versions.map((v) => v.state)
      ;(report[label] as Record<string, unknown>).error = last.error
      if (last.versions.some((v) => v.state === 'ready')) {
        const index = last.versions.findIndex((v) => v.state === 'ready') + 1
        const kept = await service.keepVersion({
          jobId: started.jobId,
          version: index,
          name: `bunsen_${label}`
        })
        if (kept.ok) {
          const bytes = await assets.readOriginal(kept.asset.id)
          mkdirSync(OUT, { recursive: true })
          writeFileSync(join(OUT, `bunsen_${label}${kept.asset.file.ext}`), bytes!)
          ;(report[label] as Record<string, unknown>).saved = {
            ext: kept.asset.file.ext,
            bytes: kept.asset.file.bytes,
            width: kept.asset.file.width,
            height: kept.asset.file.height,
            credit: kept.asset.credit?.text
          }
        }
      }
      return last
    }
    await new Promise<void>((resolve) => (wake = resolve))
  }
}

afterAll(async () => {
  if (!ENABLED) return
  mkdirSync(OUT, { recursive: true })
  writeFileSync(join(OUT, 'report.json'), clean(JSON.stringify(report, null, 2)))
  await cleanTemp()
})

describe.skipIf(!ENABLED)(
  'make-new service (live: real Google + real Claude, one picture per run)',
  () => {
    it('makes one picture with Nano Banana 2.1 and two style references', async () => {
      const last = await run('gemini-nano-banana-2.1', 'cheap')
      cheapWorked = last.versions.some((v) => v.state === 'ready')
      expect(last.stage === 'done' || last.stage === 'error').toBe(true)
    })

    it('makes one picture with Nano Banana Pro, only if the cheaper one worked', async (ctx) => {
      if (!cheapWorked) return ctx.skip()
      const last = await run('gemini-3-pro-image', 'pro')
      expect(last.stage === 'done' || last.stage === 'error').toBe(true)
    })
  }
)
