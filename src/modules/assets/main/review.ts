/**
 * The `add:*` and `review:*` handlers of the assets module: everything that arrives from the renderer is checked here,
 * then handed to the review queue (`src/main/services/assets/review`). Built from injected parts so tests need no Electron.
 */
import { ASSET_KINDS } from '@shared/assets/types'
import type { ContractImpl } from '@shared/contract'
import type { ReviewEdit } from '@shared/contracts/assets'
import type { AssetsApi } from '@shared/contracts/assets'
import { fail, ok } from '@shared/result'
import type { ReviewService } from '@main/services/assets/review'

/** The native "Add files" dialog: the paths she chose, or undefined when she cancelled. */
export interface AddPickerPort {
  pickPaths(): Promise<string[] | undefined>
}

/** The six `add:*` and `review:*` methods of the contract. */
export type ReviewApiPart = Pick<
  AssetsApi,
  | 'add:pick'
  | 'add:paths'
  | 'review:get'
  | 'review:edit'
  | 'review:accept'
  | 'review:dismiss'
  | 'review:retry'
>

export type ReviewPort = Pick<
  ReviewService,
  'view' | 'addPaths' | 'edit' | 'accept' | 'dismiss' | 'retryFile'
>

const BAD_REQUEST = fail('invalid-input', 'That request was not understood.')
const MAX_PATHS = 500

const isRec = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 120

/** An edit with only fields of the right type; null when the request is not one. */
export function cleanReviewEdit(raw: unknown): ReviewEdit | null {
  if (!isRec(raw) || !isId(raw.candidateId)) return null
  const edit: ReviewEdit = { candidateId: raw.candidateId }
  for (const key of ['name', 'title', 'description'] as const) {
    if (raw[key] === undefined) continue
    if (typeof raw[key] !== 'string' || (raw[key] as string).length > 5000) return null
    edit[key] = raw[key] as string
  }
  if (raw.kind !== undefined) {
    if (!ASSET_KINDS.includes(raw.kind as (typeof ASSET_KINDS)[number])) return null
    edit.kind = raw.kind as ReviewEdit['kind']
  }
  if (raw.keep !== undefined) {
    if (typeof raw.keep !== 'boolean') return null
    edit.keep = raw.keep
  }
  return edit
}

export function createReviewApi(
  review: ReviewPort,
  picker: AddPickerPort
): ContractImpl<ReviewApiPart> {
  const add = (paths: unknown) =>
    Array.isArray(paths) &&
    paths.length > 0 &&
    paths.length <= MAX_PATHS &&
    paths.every((p) => typeof p === 'string' && p.length > 0 && p.length < 1000)
      ? review.addPaths(paths as string[])
      : BAD_REQUEST
  return {
    'add:pick': async () => {
      const paths = await picker.pickPaths()
      return paths && paths.length > 0 ? add(paths) : ok({ cancelled: true as const })
    },
    'add:paths': (args) => add(isRec(args) ? args.paths : undefined),
    'review:get': () => review.view(),
    'review:edit': (args) => {
      const edit = cleanReviewEdit(args)
      return edit ? review.edit(edit) : BAD_REQUEST
    },
    'review:accept': (args) => {
      const batchId = isRec(args) ? args.batchId : undefined
      if (batchId !== undefined && !isId(batchId)) return BAD_REQUEST
      return review.accept(batchId)
    },
    'review:dismiss': (args) =>
      isRec(args) && isId(args.batchId) ? review.dismiss(args.batchId) : BAD_REQUEST,
    'review:retry': (args) =>
      isRec(args) && isId(args.batchId) && isId(args.fileId)
        ? review.retryFile(args.batchId, args.fileId)
        : BAD_REQUEST
  }
}
