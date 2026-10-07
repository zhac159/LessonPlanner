/** Test-only harness for the styles service: stub AI, temp folders, real files, event capture. */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AiService, FileAnalysis, StyleFileInput } from '@shared/ai/types'
import type { StyleLibraryEvents } from '@shared/contracts/style-library'
import type { Slide } from '@shared/deck/types'
import { fail, ok, type Result } from '@shared/result'
import { createDraftProfile } from '@shared/style/draft'
import { makeAnalysis } from '@shared/style/testing'
import type { StyleProfile } from '@shared/style/types'
import { makePdf, makePptx } from '../../import/testing'
import { NO_PORTS } from './habits'
import { StylesService } from './service'
import type { StylesServiceDeps } from './types'

type AnalyseResult = Result<{ analysis: FileAnalysis }>

/** Programmable stand-in for the style methods of AiService; everything else reports "not used". */
export class StubAi {
  analysed: string[] = []
  synthCalls: Array<{ name: string; files: number; existing: boolean }> = []
  /** The analyses each synthesis call was given (after cleaning). */
  synthAnalyses: FileAnalysis[][] = []
  correctCalls: string[] = []
  inFlight = 0
  maxInFlight = 0
  /** Per file name: override the result. */
  results = new Map<string, AnalyseResult>()
  /** Per file name: wait until released (or aborted). */
  private gates = new Map<string, Promise<void>>()
  private releases = new Map<string, () => void>()
  synthResult: (() => Result<{ profile: StyleProfile; testSlide: Slide }>) | null = null
  correctResult:
    ((profile: StyleProfile) => Result<{ profile: StyleProfile; message: string }>) | null = null

  /** Lets every held file through from now on. */
  clearHolds(): void {
    for (const release of this.releases.values()) release()
    this.gates.clear()
  }

  /** Makes analysis of `fileName` wait; call the returned function to let it finish. */
  hold(fileName: string): () => void {
    const gate = new Promise<void>((resolve) => this.releases.set(fileName, resolve))
    this.gates.set(fileName, gate)
    return () => this.releases.get(fileName)?.()
  }

  readonly service: Pick<
    AiService,
    'analyseStyleFile' | 'synthesiseProfile' | 'applyStyleCorrection'
  > = {
    analyseStyleFile: async (input: StyleFileInput, opts) => {
      this.analysed.push(input.fileName)
      this.maxInFlight = Math.max(this.maxInFlight, ++this.inFlight)
      try {
        const gate = this.gates.get(input.fileName)
        if (gate) {
          await new Promise<void>((resolve) => {
            void gate.then(resolve)
            if (opts?.signal?.aborted) resolve()
            else opts?.signal?.addEventListener('abort', () => resolve())
          })
        }
        if (opts?.signal?.aborted) return fail('cancelled', 'Cancelled')
        return this.results.get(input.fileName) ?? ok({ analysis: makeAnalysis() })
      } finally {
        this.inFlight--
      }
    },
    synthesiseProfile: async (input) => {
      this.synthCalls.push({
        name: input.name,
        files: input.analyses.length,
        existing: Boolean(input.existing)
      })
      this.synthAnalyses.push(input.analyses)
      if (this.synthResult) return this.synthResult()
      const profile = createDraftProfile('model-chose-this', 'Science KS3', '2026-10-06T00:00:00Z')
      profile.status = 'ready'
      profile.habits = ['Synthesised habit']
      profile.layouts = [
        { id: 'title', name: 'Title', usedFor: ['title'], regions: [], decorations: [] }
      ]
      return ok({ profile, testSlide: { id: 'sld_test', kind: 'content', elements: [] } })
    },
    applyStyleCorrection: async ({ profile, correction }) => {
      this.correctCalls.push(correction)
      if (this.correctResult) return this.correctResult(profile)
      return ok({
        profile: {
          ...structuredClone(profile),
          habits: [...profile.habits, `Correction: ${correction}`]
        },
        message: 'Got it'
      })
    }
  }

  get ai(): AiService {
    const unused = async () => fail('unknown', 'not used in these tests')
    return {
      ...this.service,
      testConnection: unused,
      extractObjectives: unused,
      planLesson: unused,
      writeSlide: unused,
      chatTurn: unused
    } as unknown as AiService
  }
}

export type CapturedEvent = {
  [K in keyof StyleLibraryEvents]: { name: K; payload: StyleLibraryEvents[K] }
}[keyof StyleLibraryEvents]

export interface Harness {
  service: StylesService
  stub: StubAi
  /** The folder the service stores styles in. */
  dir: string
  events: CapturedEvent[]
  progress(): Array<StyleLibraryEvents['progress']>
  /** Writes a real .pptx (title = name, so every call has unique content) and returns its path. */
  pptx(name: string, slides?: number): Promise<string>
  /** Writes a real PDF with readable text. */
  pdf(name: string, text?: string): string
  /** Writes arbitrary bytes under `name`. */
  raw(name: string, bytes: Uint8Array | string): string
  setNow(iso: string): void
  /** Builds another service over the same folder (simulates an app restart). */
  restart(over?: Partial<StylesServiceDeps>): StylesService
  cleanup(): Promise<void>
}

export function createHarness(over: Partial<StylesServiceDeps> = {}): Harness {
  const root = mkdtempSync(join(tmpdir(), 'styles-'))
  const dir = join(root, 'styles')
  const inbox = join(root, 'inbox')
  const stub = new StubAi()
  const events: CapturedEvent[] = []
  let now = Date.parse('2026-10-06T10:00:00Z')
  let counter = 0
  const make = (extra: Partial<StylesServiceDeps> = {}) =>
    new StylesService({
      dir,
      ai: stub.ai,
      emit: (name, payload) => events.push({ name, payload } as CapturedEvent),
      clock: () => new Date((now += 1000)),
      ids: (prefix) => `${prefix}_${++counter}`,
      resynthesiseDelayMs: 5,
      // deterministic: no Windows registry, and no review queue or library unless a test brings its own
      installedFonts: async () => undefined,
      ports: () => NO_PORTS,
      ...over,
      ...extra
    })
  const services = [make()]
  const raw = (name: string, bytes: Uint8Array | string) => {
    mkdirSync(inbox, { recursive: true })
    const path = join(inbox, name)
    writeFileSync(path, bytes)
    return path
  }
  return {
    service: services[0],
    stub,
    dir,
    events,
    progress: () =>
      events.flatMap((e) =>
        e.name === 'progress' ? [e.payload as StyleLibraryEvents['progress']] : []
      ),
    pptx: async (name, slides = 1) =>
      raw(
        name,
        await makePptx(Array.from({ length: slides }, (_, i) => ({ title: `${name} ${i}` })))
      ),
    pdf: (name, text = `Readable text for ${name}`) =>
      raw(name, makePdf([text, `${text} page two`])),
    raw,
    setNow: (iso) => (now = Date.parse(iso)),
    restart: (extra) => {
      const next = make(extra)
      services.push(next)
      return next
    },
    cleanup: async () => {
      await Promise.all(services.map((s) => s.dispose()))
      rmSync(root, { recursive: true, force: true })
    }
  }
}
