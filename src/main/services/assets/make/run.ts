/**
 * Runs one make job (agents/ASSETS.md §5.6): describe the look, then draw the versions, telling the sheet after
 * every step. Picture-maker mode makes one picture per request with two in flight; vector mode asks Claude for
 * all the drawings in one call. A version that fails is shown as failed and the rest still arrive.
 */
import { aspectRatioFor, composeMakePrompt } from '@shared/assets/pictureMaker'
import type { Asset, AssetKind } from '@shared/assets/types'
import type { MakeProgress } from '@shared/contracts/assets'
import type { Failure } from '@shared/result'
import { estimatePictureCost, type PictureMaker } from '../../imageProviders/nanoBanana'
import { toDataUrl } from '../thumbs'
import { STOPS_JOB, errorOf } from './copy'
import { loadStyleInputs } from './references'
import type { MakeAssetsPort, MakeJob, MakeServiceDeps } from './types'

export const MADE_THUMB_SIDE = 256
const CONCURRENCY = 2
const EXT_OF_MIME = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' } as const

type Ext = '.png' | '.jpg' | '.webp' | '.svg'
type Send = (stage: MakeProgress['stage'], error?: Failure) => void

export interface RunEnv {
  port: MakeAssetsPort
  ai: MakeServiceDeps['ai']
  deps: MakeServiceDeps
  /** Undefined in vector mode. */
  maker?: PictureMaker
  picked: Asset[]
  /** The kind the picture maker is told to make ('photo' when the words ask for one). */
  promptKind: AssetKind
}

export function progressOf(
  job: MakeJob,
  stage: MakeProgress['stage'],
  error?: Failure
): MakeProgress {
  return {
    jobId: job.id,
    stage,
    versions: job.versions.map((v, i) => ({
      index: i + 1,
      state: v.state,
      thumbDataUrl: v.thumbDataUrl
    })),
    ...(job.styleDescription ? { styleDescription: job.styleDescription } : {}),
    ...(error ? { error: errorOf(error) } : {})
  }
}

export async function runJob(job: MakeJob, env: RunEnv): Promise<void> {
  const { signal } = job.controller
  const send: Send = (stage, error) => {
    if (signal.aborted) return
    try {
      env.deps.emit(progressOf(job, stage, error))
    } catch (e) {
      env.deps.log?.warn(`Make: could not report progress: ${String(e)}`)
    }
  }
  const vector = !env.maker
  send('describing')

  const inputs = await loadStyleInputs(env.port, env.picked, !vector)
  if (signal.aborted) return
  if (inputs.thumbnails.length > 0) {
    const described = await env.ai.describeStyleOfAssets(
      { images: inputs.thumbnails, kinds: inputs.kinds },
      { signal }
    )
    if (signal.aborted) return
    if (described.ok) job.styleDescription = described.description
    else if (vector || inputs.references.length === 0) {
      // Without a description or references the pictures would not match her style: stop before any billing.
      return finish(job, [described], send)
    } else env.deps.log?.warn(`Make: no style description (${described.code}); using references.`)
  }
  send('drawing')
  job.redraw = (index) => redrawVersion(job, env, inputs.references, index, send)

  const failures: Failure[] = []
  if (env.maker) await drawWithMaker(job, env, env.maker, inputs.references, failures, send)
  else await drawVector(job, env, failures, send)
  if (!signal.aborted) finish(job, failures, send)
}

function finish(job: MakeJob, failures: Failure[], send: Send): void {
  for (const v of job.versions) if (v.state === 'waiting') v.state = 'failed'
  job.finished = true
  // The most useful failure first: one that stops the job (no billing, bad key) beats a one-off.
  const why = failures.find((f) => STOPS_JOB.includes(f.code)) ?? failures[0]
  send(job.versions.some((v) => v.state === 'ready') ? 'done' : 'error', why)
}

async function thumbOf(env: RunEnv, bytes: Uint8Array, ext: Ext): Promise<string | null> {
  const scaled = await env.port.tools.scale(bytes, ext, MADE_THUMB_SIDE).catch(() => null)
  return scaled ? toDataUrl(scaled.png) : null
}

async function drawWithMaker(
  job: MakeJob,
  env: RunEnv,
  maker: PictureMaker,
  references: Uint8Array[],
  failures: Failure[],
  send: Send
): Promise<void> {
  const { signal } = job.controller
  let next = 0
  let stopped = false
  const worker = async (): Promise<void> => {
    while (!stopped && !signal.aborted && next < job.versions.length) {
      const failure = await drawOne(job, env, maker, job.versions[next++]!, references)
      if (signal.aborted) return
      if (failure) {
        failures.push(failure)
        if (STOPS_JOB.includes(failure.code)) stopped = true
      }
      send('drawing')
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
}

/** One request to the picture maker for one version. Returns why it failed, or undefined. */
async function drawOne(
  job: MakeJob,
  env: RunEnv,
  maker: PictureMaker,
  version: MakeJob['versions'][number],
  references: Uint8Array[]
): Promise<Failure | undefined> {
  const prompt = withReferenceNote(
    composeMakePrompt({
      request: job.request,
      kind: env.promptKind,
      styleDescription: job.styleDescription
    }),
    references.length
  )
  const result = await maker.makeImages({
    prompt,
    aspect: aspectRatioFor(env.promptKind),
    size: '2K',
    count: 1,
    references,
    signal: job.controller.signal
  })
  if (job.controller.signal.aborted) return undefined
  const image = result.ok ? result.images[0] : undefined
  if (image) {
    version.bytes = image.bytes
    version.ext = EXT_OF_MIME[image.mime]
    version.thumbDataUrl = await thumbOf(env, image.bytes, version.ext)
    version.state = 'ready'
    recordCost(env, maker.model)
    return undefined
  }
  version.state = 'failed'
  return result.ok ? { ok: false, code: 'unknown', message: 'No picture came back.' } : result
}

/**
 * "Try again" on one failed tile: only that version is drawn again (one picture is billed, or one SVG asked for).
 * Resolves to why it failed again, or undefined. The sheet follows it through `make:progress` like any other draw.
 */
async function redrawVersion(
  job: MakeJob,
  env: RunEnv,
  references: Uint8Array[],
  index: number,
  send: Send
): Promise<Failure | undefined> {
  const version = job.versions[index]!
  Object.assign(version, { state: 'waiting', thumbDataUrl: null, bytes: undefined, ext: undefined })
  job.finished = false
  send('drawing')
  const failures: Failure[] = []
  if (env.maker) {
    const failure = await drawOne(job, env, env.maker, version, references)
    if (failure) failures.push(failure)
  } else {
    await drawVector(job, env, failures, send, index)
  }
  if (job.controller.signal.aborted) return undefined
  finish(job, failures, send)
  return version.state === 'ready'
    ? undefined
    : (failures[0] ?? { ok: false, code: 'unknown', message: 'No picture came back.' })
}

/** Vector mode: one Claude call for every version, or (`only`) for that one version again. */
async function drawVector(
  job: MakeJob,
  env: RunEnv,
  failures: Failure[],
  send: Send,
  only?: number
): Promise<void> {
  const { signal } = job.controller
  const drawn = await env.ai.drawSvg(
    {
      prompt: job.request,
      styleDescription: job.styleDescription,
      kind: job.kind,
      versions: only === undefined ? job.versions.length : 1
    },
    { signal }
  )
  if (signal.aborted) return
  if (!drawn.ok) {
    failures.push(drawn)
    return
  }
  for (const [i, svg] of drawn.svgs
    .slice(0, only === undefined ? job.versions.length : 1)
    .entries()) {
    const version = job.versions[only ?? i]!
    version.bytes = new TextEncoder().encode(svg)
    version.ext = '.svg'
    version.thumbDataUrl = await thumbOf(env, version.bytes, '.svg')
    version.state = 'ready'
  }
  send('drawing')
}

const withReferenceNote = (prompt: string, references: number): string =>
  references > 0
    ? `${prompt}\nThe attached pictures show the look to match: the same lines, colours and feel, but a new subject.`
    : prompt

function recordCost(env: RunEnv, model: string): void {
  try {
    env.deps.recordCost?.({ model, usd: estimatePictureCost(model, '2K', 1), count: 1 })
  } catch {
    /* the usage log is best effort */
  }
}
