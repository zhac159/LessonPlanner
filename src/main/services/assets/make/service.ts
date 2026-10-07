/**
 * The make-new service (agents/ASSETS.md §3.8, §5.6): which maker is available, jobs that make 2 or 4 versions
 * in the style of picked assets, and "keep" that saves one version as an asset. Jobs live in memory only.
 */
import { VECTOR_MODEL, MAKE_VERSION_OPTIONS } from '@shared/assets/pictureMaker'
import { LICENCES } from '@shared/assets/credits'
import { ASSET_KINDS, type Asset, type AssetKind } from '@shared/assets/types'
import type { MakeMode } from '@shared/contracts/assets'
import { fail, ok, type Failure, type Result } from '@shared/result'
import { newId } from '@shared/ids'
import {
  PICTURE_PRICES_USD,
  createNanoBananaMaker,
  type PictureMaker
} from '../../imageProviders/nanoBanana'
import { failureOf } from '../service'
import {
  GONE,
  NEED_A_REQUEST,
  NOT_FAILED,
  STILL_DRAWING,
  NOTHING_CONNECTED,
  PHOTO_NEEDS_MAKER,
  errorOf
} from './copy'
import { createFakeMaker } from './fakeMaker'
import { madeCredit, modelLabelOf } from './models'
import { asksForPhoto, mostCommonKind, pickedAssets } from './references'
import { progressOf, runJob } from './run'
import { claudeKeyFrom, pictureMakerSettingsFrom } from './settings'
import type { MakeApiImpl, MakeJob, MakeServiceDeps, PictureMakerSettings } from './types'

const MAX_JOBS = 8
const MAX_REQUEST = 800
/** A last test that says the key itself is no good: Make falls back to vector drawing. */
const HARD_FAILURES: readonly string[] = [
  'invalid-key',
  'permission',
  'model-unavailable',
  'no-key'
]

export interface ModeInfo {
  mode: MakeMode
  modelLabel: string | null
  perPictureUsd: number | null
}

export interface KeepArgs {
  jobId: string
  version: number
  name: string
  title?: string
  kind?: AssetKind
}

export class MakeService {
  private readonly jobs = new Map<string, MakeJob>()
  private readonly settings: PictureMakerSettings
  private readonly hasClaudeKey: () => Promise<boolean>

  constructor(private readonly deps: MakeServiceDeps) {
    this.settings = deps.settings ?? pictureMakerSettingsFrom(deps.settingsDir)
    this.hasClaudeKey =
      deps.hasClaudeKey ?? (deps.fake ? async () => true : claudeKeyFrom(deps.settingsDir))
  }

  /** What can be made right now (A7, A8, A13). */
  async mode(): Promise<ModeInfo> {
    if (await this.pictureMakerReady()) {
      const model = await this.settings.model()
      return {
        mode: 'picture-maker',
        modelLabel: modelLabelOf(model),
        perPictureUsd: PICTURE_PRICES_USD[model]?.['2K'] ?? null
      }
    }
    const mode = (await this.hasClaudeKey()) ? 'vector' : 'unavailable'
    return { mode, modelLabel: null, perPictureUsd: null }
  }

  private async pictureMakerReady(): Promise<boolean> {
    if (!(await this.settings.hasKey())) return false
    const last = await this.settings.lastTest()
    return !(last && HARD_FAILURES.includes(last))
  }

  /** Starts a job and returns at once; versions arrive as `make:progress` events. */
  async start(raw: unknown): Promise<Result<{ jobId: string }>> {
    const input = readRequest(raw)
    if (!input.ok) return input
    const { request, versions } = input
    const info = await this.mode()
    if (info.mode === 'unavailable') return fail('no-key', NOTHING_CONNECTED)
    const picked = pickedAssets(this.deps.assets, input.basedOn)
    const kind = input.kind ?? mostCommonKind(picked) ?? 'picture'
    const wantsPhoto = kind === 'photo' || (input.kind === undefined && asksForPhoto(request))
    if (info.mode === 'vector' && wantsPhoto) return fail('refused', PHOTO_NEEDS_MAKER)

    const vector = info.mode === 'vector'
    const model = vector ? VECTOR_MODEL : await this.settings.model()
    const job: MakeJob = {
      id: (this.deps.newId ?? (() => newId('make')))(),
      request,
      kind,
      basedOn: picked.map((a) => a.id),
      basedOnNames: picked.map((a) => a.name),
      model,
      controller: new AbortController(),
      versions: Array.from({ length: versions }, () => ({ state: 'waiting', thumbDataUrl: null })),
      styleDescription: '',
      finished: false
    }
    this.remember(job)
    const env = {
      port: this.deps.assets,
      ai: this.deps.ai,
      deps: this.deps,
      maker: vector ? undefined : this.makerFor(model),
      picked,
      promptKind: wantsPhoto ? ('photo' as const) : kind
    }
    void runJob(job, env).catch((error: unknown) => {
      this.deps.log?.warn(`Make: job failed: ${String(error)}`)
      for (const v of job.versions) if (v.state === 'waiting') v.state = 'failed'
      job.finished = true
      if (!job.controller.signal.aborted) {
        const failure: Failure = fail('unknown', 'Something went wrong while making the pictures.')
        this.deps.emit({ ...progressOf(job, 'error'), error: errorOf(failure) })
      }
    })
    return ok({ jobId: job.id })
  }

  private makerFor(model: string): PictureMaker {
    if (this.deps.fake) return createFakeMaker(model)
    const fetchFn = this.deps.fetchFn ?? ((url, init) => fetch(url, init))
    const getKey = (): Promise<string | undefined> => this.settings.getKey()
    return (this.deps.createMaker ?? createNanoBananaMaker)({ getKey, model, fetchFn })
  }

  private remember(job: MakeJob): void {
    this.jobs.set(job.id, job)
    while (this.jobs.size > MAX_JOBS) {
      const [oldest] = this.jobs.keys()
      this.cancel(oldest!)
    }
  }

  /** Stops a job and forgets it. Nothing is saved. */
  cancel(jobId: string): void {
    const job = this.jobs.get(jobId)
    job?.controller.abort()
    this.jobs.delete(jobId)
  }

  dispose(): void {
    for (const id of [...this.jobs.keys()]) this.cancel(id)
  }

  /** Saves one finished version as an asset (source `generated`, licence "Made for you", credit in the notes). */
  async keepVersion(args: KeepArgs): Promise<Result<{ asset: Asset }>> {
    const job = this.jobs.get(args.jobId)
    const version = job?.versions[Math.trunc(args.version) - 1]
    if (!job || !version || version.state !== 'ready' || !version.bytes || !version.ext)
      return fail('not-found', GONE)
    const checked = this.deps.assets.checkName(args.name)
    if (!checked.ok) return fail('invalid-input', checked.message)
    const kind = ASSET_KINDS.includes(args.kind as AssetKind) ? (args.kind as AssetKind) : job.kind
    const credit = madeCredit(job.model)
    try {
      const asset = await this.deps.assets.add({
        bytes: version.bytes,
        ext: version.ext,
        name: checked.name,
        title: args.title?.trim() ?? '',
        kind,
        description: describe(job),
        source: {
          kind: 'generated',
          model: job.model,
          prompt: job.request,
          basedOn: job.basedOn,
          at: (this.deps.now?.() ?? new Date()).toISOString()
        },
        licence: LICENCES.generated,
        credit: {
          text: credit,
          inNotes: true,
          provider: null,
          author: null,
          title: null,
          pageUrl: null,
          licenceUrl: null
        }
      })
      this.jobs.delete(job.id)
      void this.learn(asset)
      return ok({ asset })
    } catch (error) {
      return failureOf(error, this.deps.log?.warn)
    }
  }

  /** "Try again" on one failed version: draws just that one again. Answers when it is done. */
  async retryVersion(args: { jobId: string; version: number }): Promise<Result> {
    const job = this.jobs.get(args.jobId)
    if (!job?.redraw) return fail('not-found', GONE)
    const index = Math.trunc(args.version) - 1
    const version = job.versions[index]
    if (!version) return fail('not-found', GONE)
    if (!job.finished) return fail('refused', STILL_DRAWING)
    if (version.state !== 'failed') return fail('invalid-input', NOT_FAILED)
    const failure = await job.redraw(index)
    return failure ? fail(failure.code, errorOf(failure).message) : ok()
  }

  /** The describe cache learns the new picture from the request, so no Claude call is needed for it later. */
  private async learn(asset: Asset): Promise<void> {
    try {
      await this.deps.describeCache?.set(asset.file.sha256, {
        title: asset.title,
        name: asset.name,
        kind: asset.kind,
        description: asset.description,
        tags: asset.tags,
        maybePupils: false,
        blurry: false
      })
    } catch {
      /* the cache is an optimisation */
    }
  }

  /** The four `make:*` handlers for `serveContract`. */
  api(): MakeApiImpl {
    return {
      'make:mode': () => this.mode(),
      'make:start': (args) => this.start(args),
      'make:keep': async (args) => {
        const kept = await this.keepVersion(args)
        if (!kept.ok) return kept
        return ok({ asset: await this.deps.assets.summary(kept.asset) })
      },
      'make:cancel': (args) => this.cancel(String(args?.jobId ?? '')),
      'make:retry': (args) =>
        this.retryVersion({ jobId: String(args?.jobId ?? ''), version: Number(args?.version) })
    }
  }
}

const describe = (job: MakeJob): string => {
  const names = job.basedOnNames
  return names.length
    ? `${job.request.replace(/[.\s]+$/, '')}. Made in the style of ${names.join(', ')}.`
    : job.request
}

type Parsed = { ok: true; request: string; versions: 2 | 4; basedOn: string[]; kind?: AssetKind }

/** What arrives from the renderer is checked here, not trusted. */
function readRequest(raw: unknown): Parsed | Failure {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const request = typeof r.prompt === 'string' ? r.prompt.replace(/\s+/g, ' ').trim() : ''
  if (!request) return fail('invalid-input', NEED_A_REQUEST)
  const versions = MAKE_VERSION_OPTIONS.find((v) => v === r.versions)
  if (!versions) return fail('invalid-input', 'Choose 2 or 4 versions.')
  const basedOn = Array.isArray(r.basedOn) ? r.basedOn.filter((x) => typeof x === 'string') : []
  const kind = ASSET_KINDS.find((k) => k === r.kind)
  return { ok: true, request: request.slice(0, MAX_REQUEST), versions, basedOn, kind }
}
