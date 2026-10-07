/**
 * Pure translations between the image-provider layer and the assets contract: provider ids, licences, credits,
 * the A9 kind filter, and the first guesses for a picture's kind and tags. No network, no disk.
 */
import { LICENCES, licenceFromProviderCode } from '@shared/assets/credits'
import type { AssetCredit, AssetKind, AssetLicence, OnlineProvider } from '@shared/assets/types'
import type { OnlineKindFilter } from '@shared/contracts/assets'
import { attributionCredit } from '../../imageProviders/attribution'
import type { ImageKind, ImageSearchItem, LicenceInfo } from '../../imageProviders/types'

/** Provider ids of the provider layer to the ids stored with an asset (`commons` is Wikimedia Commons). */
export function onlineProviderOf(providerId: string): OnlineProvider | null {
  if (providerId === 'openverse') return 'openverse'
  if (providerId === 'commons' || providerId === 'wikimedia') return 'wikimedia'
  if (providerId === 'pexels' || providerId === 'unsplash') return providerId
  return null
}

/** Our licence for a provider's: the id from the code table, the label the provider printed ("CC BY-SA 4.0"). */
export function licenceOf(info: LicenceInfo): AssetLicence {
  const id = licenceFromProviderCode(info.code)
  const label = info.name.trim()
  return {
    id,
    label: id === 'other' || !label || label.length > 40 ? LICENCES[id].label : label,
    requiresCredit: info.requiresAttribution
  }
}

/** The credit stored with the asset: the ready line, whether notes must carry it, and where it came from. */
export function creditOf(item: ImageSearchItem, provider: OnlineProvider): AssetCredit {
  const text =
    item.attributionText.trim() ||
    attributionCredit({
      title: item.title,
      author: item.author,
      authorUrl: item.authorUrl,
      source: item.source,
      sourceUrl: item.sourceUrl,
      licence: item.licence
    })
  return {
    text,
    inNotes: item.licence.requiresAttribution && text.length > 0,
    provider,
    author: item.author.trim() || null,
    title: item.title.trim() || null,
    pageUrl: item.sourceUrl || null,
    licenceUrl: item.licence.url || null
  }
}

/** A9's "Any / Photos / Drawings / Diagrams" as the provider layer's kinds (undefined = anything). */
export function imageKindsOf(kind: OnlineKindFilter): ImageKind[] | undefined {
  if (kind === 'photo') return ['photo']
  if (kind === 'drawing') return ['illustration', 'icon']
  if (kind === 'diagram') return ['diagram']
  return undefined
}

/** What to call a saved result: what she asked for, else a guess from the library and the file type. */
export function assetKindOf(
  filter: OnlineKindFilter,
  provider: OnlineProvider,
  extension: string
): AssetKind {
  if (filter === 'photo') return 'photo'
  if (filter === 'diagram') return 'diagram'
  if (filter === 'drawing') return 'picture'
  if (provider === 'pexels' || provider === 'unsplash') return 'photo'
  return extension === 'jpg' ? 'photo' : 'picture'
}

const FILLER = new Set(['a', 'an', 'the', 'of', 'in', 'on', 'and', 'for', 'with', 'to', 'at'])

/** Up to five short tags from the search words ("leaf in sunlight" gives leaf, sunlight). */
export function tagsFromQuery(query: string): string[] {
  const words = query.toLowerCase().split(/[^a-z0-9]+/)
  return [...new Set(words.filter((w) => w.length >= 3 && !FILLER.has(w)))].slice(0, 5)
}

/** A card title: the picture's own title with file clutter removed ("File:Leaf 01.jpg" gives "Leaf 01"). */
export function cleanOnlineTitle(title: string): string {
  const text = title
    .replace(/^(file|image):/i, '')
    .replace(/\.(jpe?g|png|gif|webp|svg|tiff?)$/i, '')
    .replace(/[_\s]+/g, ' ')
    .trim()
  return text || 'Picture from the web'
}
