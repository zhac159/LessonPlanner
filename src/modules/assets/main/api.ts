/**
 * The assets module's implementation of its contract, built from injected parts so tests need no Electron:
 * the assets service (library), the online service, a file dialog, and the handlers of the review queue (`./review`)
 * and the make-new service.
 * Everything that arrives from the renderer is checked here before it reaches a service.
 */
import { ASSET_KINDS } from '@shared/assets/types'
import type { ContractImpl } from '@shared/contract'
import type { AssetEdit, AssetFrom, AssetListQuery, OnlineQuery } from '@shared/contracts/assets'
import { fail } from '@shared/result'
import type { AssetsService } from '@main/services/assets/service'
import { failureOf } from '@main/services/assets/service'
import type { OnlineService } from '@main/services/assets/online'
import type { AssetsFullApi } from '../shared'
import type { MakeApiPart } from '@main/services/assets/make'
import type { ReviewApiPart } from './review'

/** The part of AssetsService this module calls. */
export type AssetsPort = Pick<
  AssetsService,
  | 'list'
  | 'get'
  | 'chips'
  | 'resolveNames'
  | 'checkName'
  | 'rename'
  | 'update'
  | 'replaceFile'
  | 'remove'
  | 'restore'
  | 'usage'
  | 'suggest'
  | 'takeLoadReport'
>

export type OnlinePort = Pick<OnlineService, 'search' | 'add'>

/** The native "choose the new picture" dialog (reads the file too). */
export interface ReplaceDialogPort {
  /** The chosen picture, or undefined when she cancelled. Throws when the file cannot be read. */
  pickPicture(): Promise<{ bytes: Uint8Array; name: string } | undefined>
}

export interface AssetsApiDeps {
  assets: AssetsPort
  online: OnlinePort
  dialog: ReplaceDialogPort
  /** `add:*` and `review:*` (./review). */
  review: ContractImpl<ReviewApiPart>
  /** `make:*` (src/main/services/assets/make). */
  make: ContractImpl<MakeApiPart>
  warn?(message: string): void
}

const BAD_REQUEST = fail('invalid-input', 'That request was not understood.')

const isRec = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 120
const isText = (value: unknown, max = 5000): value is string =>
  typeof value === 'string' && value.length <= max

const FROM_PATTERN = /^(anywhere|uploaded|online|made|style:[A-Za-z0-9_-]{1,80})$/
const SORTS = ['recent', 'name', 'most-used'] as const

/** A list query with only values of the right shape; anything else falls back to the defaults. */
export function cleanListQuery(raw: unknown): AssetListQuery {
  if (!isRec(raw)) return {}
  const query: AssetListQuery = {}
  if (isText(raw.search, 200)) query.search = raw.search
  if (typeof raw.filter === 'string') query.filter = raw.filter as AssetListQuery['filter']
  if (typeof raw.from === 'string' && FROM_PATTERN.test(raw.from))
    query.from = raw.from as AssetFrom
  if (SORTS.includes(raw.sort as (typeof SORTS)[number]))
    query.sort = raw.sort as AssetListQuery['sort']
  if (typeof raw.limit === 'number' && Number.isFinite(raw.limit)) query.limit = raw.limit
  if (typeof raw.cursor === 'string') query.cursor = raw.cursor
  return query
}

function cleanEdit(raw: unknown): AssetEdit | null {
  if (!isRec(raw) || !isId(raw.assetId)) return null
  const edit: AssetEdit = { assetId: raw.assetId }
  if (raw.title !== undefined) {
    if (!isText(raw.title, 500)) return null
    edit.title = raw.title
  }
  if (raw.description !== undefined) {
    if (!isText(raw.description)) return null
    edit.description = raw.description
  }
  if (raw.kind !== undefined) {
    if (!ASSET_KINDS.includes(raw.kind as (typeof ASSET_KINDS)[number])) return null
    edit.kind = raw.kind as AssetEdit['kind']
  }
  if (raw.tags !== undefined) {
    if (
      !Array.isArray(raw.tags) ||
      raw.tags.length > 50 ||
      !raw.tags.every((t) => isText(t, 200))
    ) {
      return null
    }
    edit.tags = raw.tags as string[]
  }
  return edit
}

const cleanOnlineQuery = (raw: unknown): OnlineQuery | null =>
  isRec(raw) && isText(raw.query, 400)
    ? {
        query: raw.query,
        kind: raw.kind as OnlineQuery['kind'],
        freeToUse: raw.freeToUse !== false,
        page: Number(raw.page) || 1
      }
    : null

/** Builds the served API. */
export function createAssetsApi({
  assets,
  online,
  dialog,
  review,
  make,
  warn
}: AssetsApiDeps): ContractImpl<AssetsFullApi> {
  return {
    list: (query) => assets.list(cleanListQuery(query)),
    get: (args) => (isRec(args) && isId(args.assetId) ? assets.get(args.assetId) : BAD_REQUEST),
    chips: (args) => {
      const refs = isRec(args) && Array.isArray(args.refs) ? args.refs.slice(0, 200) : []
      return assets.chips(
        refs
          .filter(isRec)
          .flatMap((r) =>
            isId(r.assetId) ? [{ assetId: r.assetId, name: String(r.name ?? '') }] : []
          )
      )
    },
    resolveNames: (args) => {
      const names = isRec(args) && Array.isArray(args.names) ? args.names.slice(0, 200) : []
      return assets.resolveNames(names.filter((n): n is string => isText(n, 100)))
    },
    checkName: (args) =>
      assets.checkName(
        isRec(args) && isText(args.name, 200) ? args.name : '',
        isRec(args) && isId(args.assetId) ? args.assetId : undefined
      ),
    rename: (args) =>
      isRec(args) && isId(args.assetId) && isText(args.name, 200)
        ? assets.rename(args.assetId, args.name)
        : BAD_REQUEST,
    update: (args) => {
      const edit = cleanEdit(args)
      return edit ? assets.update(edit) : BAD_REQUEST
    },
    async replaceFile(args) {
      if (!isRec(args) || !isId(args.assetId)) return BAD_REQUEST
      try {
        const picked = await dialog.pickPicture()
        return picked
          ? await assets.replaceFile(args.assetId, picked.bytes)
          : { ok: true, cancelled: true }
      } catch (error) {
        return failureOf(error, warn)
      }
    },
    remove: (args) =>
      isRec(args) && isId(args.assetId) ? assets.remove(args.assetId) : BAD_REQUEST,
    restore: (args) =>
      isRec(args) && isId(args.assetId) ? assets.restore(args.assetId) : BAD_REQUEST,
    usage: (args) => (isRec(args) && isId(args.assetId) ? assets.usage(args.assetId) : BAD_REQUEST),
    suggest: (args) =>
      isRec(args) && isId(args.lessonId) && isId(args.slideId)
        ? assets.suggest({
            lessonId: args.lessonId,
            slideId: args.slideId,
            words: isText(args.words, 500) ? args.words : undefined,
            limit: typeof args.limit === 'number' ? args.limit : undefined
          })
        : BAD_REQUEST,

    ...review,

    'online:search': (query) => {
      const clean = cleanOnlineQuery(query)
      return clean ? online.search(clean) : BAD_REQUEST
    },
    'online:add': (args) => {
      if (
        !isRec(args) ||
        !Array.isArray(args.items) ||
        (args.mode !== 'direct' && args.mode !== 'review')
      ) {
        return BAD_REQUEST
      }
      const items = args.items
        .filter(isRec)
        .flatMap((i) =>
          isId(i.id) ? [{ id: i.id, name: isText(i.name, 200) ? i.name : undefined }] : []
        )
      return items.length === args.items.length ? online.add(items, args.mode) : BAD_REQUEST
    },

    ...make,

    'library:tidied': () => assets.takeLoadReport()
  }
}
