/**
 * What generation does with the teacher's assets AFTER Claude wrote a slide (agents/ASSETS.md §5.4, §2.4, §5.7 #8):
 * her placement rules are applied by code (the school logo on every slide when her decks show it that way, as an
 * ordinary unlocked picture), every picture is copied into the lesson under its library id, credit lines go into the
 * notes, a picture whose asset has vanished becomes a picture spot, and spots get suggested assets.
 */
import type { AssetCatalogue } from '@shared/ai/types'
import { appendCreditLine, creditLine } from '@shared/assets/credits'
import { anchoredBox } from '@shared/assets/fit'
import { isPictureSpot, spotInfo } from '@shared/assets/spots'
import type { Asset, PicturePlacementRule } from '@shared/assets/types'
import type { Element, ImageElement, Slide } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'
import { buildAssetCatalogue, habitsOf } from '../../ai/prompts/assets'
import { slideContextOf } from '../assets/usage'
import type { LessonAssetsPort } from '../lessons/assetsPort'
import type { LessonsService } from '../lessons/service'

const SUGGESTED = 3

/** The rule that applies to a slide of this kind for this asset (its own kind first, else "every slide"). */
export function ruleFor(
  rules: readonly PicturePlacementRule[],
  assetId: string,
  slideKind: Slide['kind']
): PicturePlacementRule | undefined {
  const own = rules.filter((r) => r.assetId === assetId)
  return own.find((r) => r.slideKind === slideKind) ?? own.find((r) => r.slideKind === 'every')
}

/** The same picture, frame set by a rule (the picture's own shape, `widthUnits` wide, in its corner). */
function framed(element: ImageElement, asset: Asset, rule: PicturePlacementRule): ImageElement {
  const box = anchoredBox(asset.file, rule.anchor, rule.widthUnits, rule.marginUnits)
  const { locked: _locked, ...open } = element
  return { ...open, x: box.x, y: box.y, w: box.w, h: box.h, fit: 'contain' }
}

/** A picture whose asset is gone: back to an empty spot that remembers what it was. */
function asSpot(element: ImageElement): ImageElement {
  const { assetId: _assetId, ...rest } = element
  const description = element.alt || element.name?.replace(/[_-]+/g, ' ') || 'A picture'
  return { ...rest, placeholder: element.placeholder ?? { description } }
}

export class GenerationAssets {
  /** What the writer is told: names, descriptions and placement rules. */
  readonly catalogue: AssetCatalogue | undefined
  private readonly rules: readonly PicturePlacementRule[]

  constructor(
    private readonly deps: {
      assets: LessonAssetsPort
      lessons: LessonsService
      style: StyleProfile | null
    }
  ) {
    const library = deps.assets.list()
    const habits = habitsOf(deps.style)
    this.rules = habits?.placements ?? []
    this.catalogue = library.length > 0 ? buildAssetCatalogue(library, habits) : undefined
  }

  /** The slide as it will be committed. Never throws: a picture that cannot be used becomes a spot. */
  async adopt(lessonId: string, slide: Slide): Promise<Slide> {
    const withRules = this.applyRules(slide)
    const elements: Element[] = []
    let notes = withRules.notes
    for (const element of withRules.elements) {
      if (element.type !== 'image') {
        elements.push(element)
      } else if (element.assetId) {
        const placed = await this.useAsset(lessonId, element)
        elements.push(placed.element)
        if (placed.credit) notes = appendCreditLine(notes, placed.credit)
      } else if (isPictureSpot(element)) {
        elements.push(this.withSuggestions(element, withRules))
      } else {
        elements.push(element)
      }
    }
    return { ...withRules, elements, ...(notes ? { notes } : {}) }
  }

  /** Snaps a placed asset to her rule, and adds the assets whose rule says "every slide" when Claude left one out. */
  private applyRules(slide: Slide): Slide {
    const { assets } = this.deps
    const elements = slide.elements.map((element) => {
      const asset =
        element.type === 'image' && element.assetId ? assets.get(element.assetId) : undefined
      const rule = asset ? ruleFor(this.rules, asset.id, slide.kind) : undefined
      return asset && rule && element.type === 'image' ? framed(element, asset, rule) : element
    })
    const present = new Set(
      elements.flatMap((e) => (e.type === 'image' && e.assetId ? [e.assetId] : []))
    )
    let added = 0
    for (const rule of this.rules) {
      const asset = assets.get(rule.assetId)
      if (rule.slideKind !== 'every' || !asset || present.has(asset.id)) continue
      present.add(asset.id)
      const picture: ImageElement = {
        id: `${slide.id}-a${++added}`,
        type: 'image',
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        name: asset.name,
        assetId: asset.id,
        fit: 'contain',
        alt: asset.title
      }
      elements.push(framed(picture, asset, rule))
    }
    return { ...slide, elements }
  }

  /** Copy-on-use for one picture; its credit line (if the licence asks for one) comes back for the notes. */
  private async useAsset(
    lessonId: string,
    element: ImageElement
  ): Promise<{ element: ImageElement; credit: string | null }> {
    const { assets, lessons } = this.deps
    const asset = element.assetId ? assets.get(element.assetId) : undefined
    const bytes = asset ? await assets.readOriginal(asset.id) : undefined
    if (!asset || !bytes) return { element: asSpot(element), credit: null }
    const copied = await lessons.files.copyLibraryPicture(lessonId, {
      id: asset.id,
      ext: asset.file.ext,
      title: asset.title,
      bytes
    })
    if (!copied.ok) return { element: asSpot(element), credit: null }
    await assets.markUsed(asset.id)
    return { element, credit: creditLine(asset) }
  }

  /** Spots get the best three local matches ("Suggested for this spot" first in A13). */
  private withSuggestions(element: ImageElement, slide: Slide): ImageElement {
    const info = spotInfo(element)
    if (info.suggestedAssets?.length) return element
    const context = slideContextOf(slide)
    const focus = `${info.description} ${info.query ?? ''} ${info.kind ?? ''}`
    const best = this.deps.assets.suggest({ text: context.text, focus }, SUGGESTED)
    if (best.length === 0) return element
    return { ...element, placeholder: { ...info, suggestedAssets: best.map((a) => a.id) } }
  }
}
