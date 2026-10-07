/**
 * `groupFindings`: from every picture occurrence to the review list of screen A2 ("Found 12 · keeping 9").
 * One asset per distinct picture (exact copies and re-saved copies merged, a repeated logo is ONE asset found on
 * n pages), tiny decorative bits and page scans dropped, near-duplicates marked as older versions, and everything
 * the teacher should look at twice (possible pupils, blurry, low resolution) left unticked with a reason.
 */
import { colorDistance, hammingHex } from './analysis'
import { sameBitmap, samePlaceAndLook } from './identity'
import type {
  ExtractedImage,
  Findings,
  FoundAsset,
  FoundIn,
  IgnoredCounts,
  KindHint,
  LeftOutReason
} from './types'

export interface GroupOptions {
  /** Max differing bits (of 64) for two pictures to count as versions of each other. Default 8. */
  nearBits?: number
  /** Max differing bits (of 256) of the finer hash. Default 40. */
  nearDetailBits?: number
  /** Max mean colour difference (0..255) of the 3x3 colour signatures. Default 28. */
  nearColor?: number
}

const pixelsOf = (image: ExtractedImage): number => image.width * image.height

/** One asset: the same bitmap, or the repeated element that every slide stores in its own encoding. */
function sameLook(a: ExtractedImage, b: ExtractedImage): boolean {
  return sameBitmap(a, b) || (a.repeatedOn.length >= 3 && samePlaceAndLook(a, b))
}

function nearVersion(
  a: ExtractedImage,
  b: ExtractedImage,
  options: Required<GroupOptions>
): boolean {
  if (!a.perceptualHash || !b.perceptualHash) return false
  const ratioA = a.width / Math.max(1, a.height)
  const ratioB = b.width / Math.max(1, b.height)
  if (Math.abs(ratioA - ratioB) > 0.06 * Math.max(ratioA, ratioB)) return false
  return (
    hammingHex(a.perceptualHash, b.perceptualHash) <= options.nearBits &&
    hammingHex(a.detailHash, b.detailHash) <= options.nearDetailBits &&
    colorDistance(a.colorSignature, b.colorSignature) <= options.nearColor
  )
}

const slug = (text: string, max = 24): string =>
  text
    .normalize('NFKD')
    .replace(/[^\x00-\x7f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, max)
    .replace(/_+$/, '')

const KIND_STEM: Record<KindHint, string> = {
  logo: 'logo',
  'symbol-card': 'symbol_cards',
  photo: 'photo',
  icon: 'icon',
  banner: 'banner',
  other: 'picture'
}

/** snake_case chat name proposal; the AI naming step and the teacher can change it. */
function proposeName(
  asset: { kind: KindHint; image: ExtractedImage; nearbyText: string },
  taken: Set<string>,
  firstLogo: boolean
): string {
  const { kind, image } = asset
  let base = ''
  if (image.altText) base = slug(image.altText)
  if (!base && kind === 'logo') base = firstLogo ? 'school_logo' : 'logo'
  if (!base && kind !== 'symbol-card' && asset.nearbyText) {
    // only a short label ("elk") makes a name; a sentence on the slide does not
    const first = asset.nearbyText.split('\n')[0].trim()
    if (first.split(/\s+/).length <= 3) base = slug(first)
  }
  if (!base) base = `${KIND_STEM[kind]}_p${image.pageOrSlide}`
  if (/^\d/.test(base)) base = `${KIND_STEM[kind]}_${base}`
  let name = base
  for (let n = 2; taken.has(name); n++) name = `${base}_${n}`
  taken.add(name)
  return name
}

interface Cluster {
  members: ExtractedImage[]
}

const mostCommonKind = (members: ExtractedImage[]): KindHint => {
  const counts = new Map<KindHint, number>()
  for (const m of members) counts.set(m.kindHint, (counts.get(m.kindHint) ?? 0) + 1)
  // a repeated logo is a logo even when one occurrence was too ambiguous to say so
  if (counts.has('logo')) return 'logo'
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

export function groupFindings(images: ExtractedImage[], opts: GroupOptions = {}): Findings {
  const options = { nearBits: 8, nearDetailBits: 40, nearColor: 28, ...opts }
  const ignored: IgnoredCounts = { tooSmall: 0, thin: 0, fullPage: 0 }
  const ignoredHashes = new Set<string>()
  const candidates: ExtractedImage[] = []
  for (const image of images) {
    const reason = image.quality.fullPage
      ? 'fullPage'
      : image.quality.thin
        ? 'thin'
        : image.quality.tooSmall
          ? 'tooSmall'
          : undefined
    if (!reason) {
      candidates.push(image)
      continue
    }
    if (!ignoredHashes.has(image.hash)) {
      ignoredHashes.add(image.hash)
      ignored[reason]++
    }
  }

  // 1. exact and re-saved copies -> one cluster
  const clusters: Cluster[] = []
  for (const image of candidates) {
    const home = clusters.find((c) => sameLook(c.members[0], image))
    if (home) home.members.push(image)
    else clusters.push({ members: [image] })
  }

  // 2. a cluster -> a found asset
  const assets: FoundAsset[] = clusters.map((cluster) => {
    const best = [...cluster.members].sort(
      (a, b) => pixelsOf(b) - pixelsOf(a) || a.pageOrSlide - b.pageOrSlide
    )[0]
    const byFile = new Map<string, Set<number>>()
    for (const m of cluster.members) {
      const set = byFile.get(m.fileName) ?? new Set<number>()
      set.add(m.pageOrSlide)
      for (const unit of m.repeatedOn) set.add(unit)
      byFile.set(m.fileName, set)
    }
    const foundIn: FoundIn[] = [...byFile].map(([fileName, units]) => ({
      fileName,
      units: [...units].sort((a, b) => a - b)
    }))
    const texts = [...new Set(cluster.members.map((m) => m.nearbyText).filter(Boolean))]
    const pupils = cluster.members.find((m) => m.maybePupils)
    return {
      id: best.hash.slice(0, 16),
      image: best,
      kind: mostCommonKind(cluster.members),
      suggestedName: '',
      foundOn: foundIn.reduce((sum, f) => sum + f.units.length, 0),
      foundIn,
      nearbyText: texts.join('\n').slice(0, 200),
      keep: true,
      needsReview: Boolean(pupils),
      reviewReasons: pupils ? pupils.pupilReasons : [],
      occurrenceIds: cluster.members.map((m) => m.id)
    }
  })

  // 3. near duplicates: the better-known, bigger picture stays, the others are older versions
  const ranked = [...assets].sort(
    (a, b) => b.foundOn - a.foundOn || pixelsOf(b.image) - pixelsOf(a.image)
  )
  const primaries: FoundAsset[] = []
  for (const asset of ranked) {
    const primary = primaries.find((p) => nearVersion(p.image, asset.image, options))
    if (primary) {
      asset.olderVersionOf = primary.id
    } else primaries.push(asset)
  }

  // 4. what is left unticked and why
  for (const asset of assets) {
    const q = asset.image.quality
    let reason: LeftOutReason | undefined
    if (q.unreadable) reason = 'unreadable'
    else if (asset.needsReview) reason = 'pupils'
    else if (q.blurry) reason = 'blurry'
    else if (asset.olderVersionOf) reason = 'older-version'
    else if (asset.image.origin === 'background') reason = 'background'
    else if (q.lowResolution && asset.kind === 'photo') reason = 'low-resolution'
    if (q.blurry && reason !== 'blurry') asset.reviewReasons.push('Looks blurry')
    if (reason) {
      asset.leftOut = reason
      asset.keep = false
    }
  }

  // 5. order (ticked first, most widespread first) and names
  const order = new Map(assets.map((a, i) => [a, i]))
  assets.sort(
    (a, b) =>
      Number(b.keep) - Number(a.keep) ||
      b.foundOn - a.foundOn ||
      (order.get(a) ?? 0) - (order.get(b) ?? 0)
  )
  const taken = new Set<string>()
  let logos = 0
  for (const asset of assets) {
    asset.suggestedName = proposeName(asset, taken, asset.kind === 'logo' && logos++ === 0)
  }
  for (const asset of assets) {
    if (asset.olderVersionOf) {
      const primary = assets.find((a) => a.id === asset.olderVersionOf)
      if (primary) asset.reviewReasons.push(`Older version of ${primary.suggestedName}`)
    }
  }
  return { assets, ignored, found: assets.length, keeping: assets.filter((a) => a.keep).length }
}
