/**
 * `AssetPlacer`: puts a picture from "Your assets" on a slide as ONE ChangeSet (agents/ASSETS.md §2.4, §4.2, §5.5).
 * Used by the editor's `placeAsset` (the teacher's own sheet: no Claude call, free) and by the chat tool
 * `place_asset`. The steps: resolve the source to a library asset (saving an online result first), copy the file into
 * the lesson under the library id (copy-on-use), work out the frame from the deck AS IT IS inside the lesson's lock,
 * apply one ChangeSet (update the spot or picture in place, or add an element; the credit line goes into the notes in
 * the same change), then mark the asset used.
 */
import type { Asset } from '@shared/assets/types'
import { creditLine } from '@shared/assets/credits'
import type { FitMode } from '@shared/assets/fit'
import {
  resolvePlacement,
  buildPlaceOps,
  type PlaceAssetArgs,
  type PlaceTarget
} from '@shared/assets/place'
import type { HistoryState, PlaceAssetResult } from '@shared/contracts/deck-builder'
import type { ChangeSet, Deck } from '@shared/deck/types'
import { newId } from '@shared/ids'
import { fail, ok, type Result } from '@shared/result'
import type { LessonAssetsPort } from '../lessons/assetsPort'
import type { LessonsService } from '../lessons/service'
import { toChatItem } from './items'
import { checkPlaceArgs } from './placeArgs'
import type { ChatRecord } from './records'
import type { ChatStore } from './store'

export const ASSET_GONE = 'That picture isn’t in your library any more.'
const NO_SLIDE = 'That slide can’t be found.'
const FILE_MISSING = 'That picture’s file is missing from your library. Add it again.'
const NO_MADE = 'Making pictures is not ready yet.'

export interface PlacerDeps {
  lessons: LessonsService
  assets: LessonAssetsPort
  store: ChatStore
  clock?: () => Date
  ids?: (prefix: string) => string
}

/** What one placement did. */
export interface Placed {
  /** The lesson after the change. */
  deck: Deck
  changeSet: ChangeSet
  history: HistoryState
  elementId: string
  placed: PlaceAssetResult['placed']
  asset: Asset
  /** The slide's 1-based number. */
  slideNumber: number
  /** True when a picture that was already there (not an empty spot) was swapped. */
  replacedPicture: boolean
}

export interface PlaceRequest {
  lessonId: string
  slideId: string
  asset: Asset
  target: PlaceTarget
  fit: FitMode
  by: 'user' | 'ai'
}

export class AssetPlacer {
  private readonly ids: (prefix: string) => string
  private readonly clock: () => Date

  constructor(private readonly deps: PlacerDeps) {
    this.ids = deps.ids ?? newId
    this.clock = deps.clock ?? (() => new Date())
  }

  /** The library asset a source means. An online result or a kept picture is saved into the library first. */
  async resolveSource(source: PlaceAssetArgs['source']): Promise<Result<{ asset: Asset }>> {
    const { assets } = this.deps
    switch (source.kind) {
      case 'library': {
        const asset = assets.get(source.assetId)
        return asset ? ok({ asset }) : fail('not-found', ASSET_GONE)
      }
      case 'online':
        return assets.saveOnline(source.resultId, source.name)
      case 'made':
        return assets.keepMade
          ? assets.keepMade(source.jobId, source.version, source.name)
          : fail('not-found', NO_MADE)
    }
  }

  /** The core: ONE ChangeSet, `by` 'user' (the sheet) or 'ai' (a chat tool). Never writes a chat message. */
  async place(request: PlaceRequest): Promise<Result<Placed>> {
    const { lessons, assets } = this.deps
    const { asset, lessonId } = request
    // The library may have lost it since it was picked.
    const current = assets.get(asset.id)
    if (!current) return fail('not-found', ASSET_GONE)
    const bytes = await assets.readOriginal(current.id)
    if (!bytes) return fail('not-found', FILE_MISSING)
    const copied = await lessons.files.copyLibraryPicture(lessonId, {
      id: current.id,
      ext: current.file.ext,
      title: current.title,
      bytes
    })
    if (!copied.ok) return copied

    let placed: Omit<Placed, 'deck' | 'changeSet' | 'history' | 'asset'> | undefined
    const edited = await lessons.applyFrom(lessonId, (deck) => {
      const slideIndex = deck.slides.findIndex((s) => s.id === request.slideId)
      const slide = deck.slides[slideIndex]
      if (!slide) return fail('not-found', NO_SLIDE)
      const { width, height, vector } = current.file
      const placement = resolvePlacement(
        slide,
        { width, height, vector },
        request.target,
        request.fit
      )
      if ('error' in placement) return fail('not-found', placement.error)
      const newElementId = this.ids('el')
      const ops = buildPlaceOps({
        slide,
        placement,
        assetId: current.id,
        alt: current.title,
        name: current.name,
        newElementId,
        creditLine: creditLine(current)
      })
      const before = placement.replaceElementId
        ? slide.elements.find((e) => e.id === placement.replaceElementId)
        : undefined
      const replacedPicture = before?.type === 'image' && Boolean(before.assetId)
      const { box } = placement
      placed = {
        elementId: placement.replaceElementId ?? newElementId,
        placed: {
          x: box.x,
          y: box.y,
          w: box.w,
          h: box.h,
          fit: box.fit,
          lowResolution: box.lowResolution
        },
        slideNumber: slideIndex + 1,
        replacedPicture
      }
      const number = slideIndex + 1
      return ok({
        input: {
          by: request.by,
          summary: replacedPicture
            ? `Replaced the photo on slide ${number} with ${current.name}`
            : `Added ${current.name} to slide ${number}`,
          ops
        }
      })
    })
    if (!edited.ok) return edited
    if (!placed) return fail('unknown', NO_SLIDE)
    await assets.markUsed(current.id)
    return ok({
      ...placed,
      deck: edited.deck,
      changeSet: edited.changeSet,
      history: edited.history,
      asset: current
    })
  }

  /** `deck-builder:placeAsset`: the sheet's "Place it". Stores the chat message that says what was done. */
  async placeAsset(raw: unknown): Promise<Result<PlaceAssetResult>> {
    const checked = checkPlaceArgs(raw)
    if (!checked.ok) return checked
    const { args } = checked
    const source = await this.resolveSource(args.source)
    if (!source.ok) return source
    const done = await this.place({
      lessonId: args.lessonId,
      slideId: args.slideId,
      asset: source.asset,
      target: args.target,
      fit: args.fit,
      by: 'user'
    })
    if (!done.ok) return done
    const chat = await this.say(args.lessonId, done)
    return ok({
      changeSet: done.changeSet,
      history: done.history,
      elementId: done.elementId,
      placed: done.placed,
      asset: await this.deps.assets.summary(done.asset),
      chat
    })
  }

  /** "Added {{name}} to slide 3." as a stored assistant message with its ResultChip (no Claude call). */
  private async say(lessonId: string, done: Placed): Promise<ReturnType<typeof toChatItem>> {
    const { asset, slideNumber, changeSet } = done
    const token = `{{${asset.name}}}`
    const record: ChatRecord = {
      id: this.ids('msg'),
      role: 'assistant',
      at: this.clock().toISOString(),
      ui: {
        text: done.replacedPicture
          ? `Replaced the photo on slide ${slideNumber} with ${token}.`
          : `Added ${token} to slide ${slideNumber}.`,
        assets: [{ assetId: asset.id, name: asset.name }],
        changeSetIds: [changeSet.id]
      },
      api: []
    }
    try {
      await this.deps.store.append(lessonId, record)
    } catch {
      // The picture is placed; a lost history line must not turn that into an error.
    }
    const context = await this.deps.lessons.context(lessonId)
    const slideIds = context.ok ? context.deck.slides.map((s) => s.id) : []
    const changes = new Map([[changeSet.id, { changeSet, undone: false }]])
    return toChatItem(record, changes, slideIds)
  }
}
