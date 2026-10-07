/**
 * Turns a search result she picked into something the library can save: downloads the picture (safe download
 * rules), proposes a name, kind, description and tags, and carries the licence and credit. `name` is what she
 * typed (kept exactly, checked before anything is downloaded); without one the describe port (Claude) may
 * propose it, else the picture's own title is used.
 */
import { createHash } from 'node:crypto'
import { checkAssetName, uniqueAssetName } from '@shared/assets/names'
import type { AssetFileExt, AssetKind } from '@shared/assets/types'
import { fail, ok, type Result } from '@shared/result'
import { downloadImage } from '../../imageProviders/download'
import { toFailure } from '../../imageProviders/errors'
import type { FetchFn } from '../../imageProviders/types'
import { cleanDescription } from '../library'
import type { NewAsset } from '../store'
import {
  assetKindOf,
  cleanOnlineTitle,
  creditOf,
  licenceOf,
  onlineProviderOf,
  tagsFromQuery
} from './mapping'
import type { ResultRecord } from './results'
import type { OnlineDescribePort } from './types'

export interface PrepareDeps {
  fetchFn: FetchFn
  userAgent?: string
  takenNames(): string[]
  describe?: OnlineDescribePort | null
  now?: () => number
}

/** A picture that was downloaded and is ready to be saved. */
export interface Prepared {
  input: NewAsset
  sha256: string
}

export async function prepareResult(
  deps: PrepareDeps,
  record: ResultRecord,
  name: string | undefined,
  signal?: AbortSignal
): Promise<Result<{ prepared: Prepared }>> {
  const { item } = record
  const provider = onlineProviderOf(item.providerId)
  if (!provider) return fail('invalid-input', 'That picture library is not known.')
  const typed = name?.trim()
  if (typed) {
    const checked = checkAssetName(typed, deps.takenNames())
    if (!checked.ok) return fail('invalid-input', checked.message)
  }
  let image
  try {
    image = await downloadImage(item.fullUrl, {
      fetchFn: deps.fetchFn,
      userAgent: deps.userAgent,
      signal
    })
  } catch (error) {
    return toFailure(error)
  }
  const ext = `.${image.extension}` as AssetFileExt
  const title = cleanOnlineTitle(item.title)
  let kind: AssetKind = assetKindOf(record.filter, provider, image.extension)
  let assetName = typed || uniqueAssetName(title, deps.takenNames())
  let assetTitle = title
  let description = `${title}. Found online while searching for “${record.query}”.`
  let tags = tagsFromQuery(record.query)
  if (!typed && deps.describe) {
    const described = await deps.describe
      .describe({ bytes: image.bytes, ext, title, query: record.query })
      .catch(() => null)
    if (described) {
      assetName = described.name || assetName
      assetTitle = described.title || assetTitle
      kind = described.kind
      description = described.description || description
      tags = described.tags.length ? described.tags : tags
    }
  }
  return ok({
    prepared: {
      sha256: createHash('sha256').update(image.bytes).digest('hex'),
      input: {
        bytes: image.bytes,
        ext,
        name: assetName,
        title: assetTitle,
        kind,
        description: cleanDescription(description),
        tags,
        source: {
          kind: 'online',
          provider,
          at: new Date(deps.now?.() ?? Date.now()).toISOString()
        },
        licence: licenceOf(item.licence),
        credit: creditOf(item, provider),
        autoName: !typed
      }
    }
  })
}
