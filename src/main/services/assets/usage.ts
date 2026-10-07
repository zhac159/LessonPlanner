/**
 * Where assets are used (agents/ASSETS.md §2.4): `Asset.usedIn` is a cache rebuilt by scanning the lessons for
 * image elements whose `assetId` is a library asset. The scan comes through the small `LessonsPort`, which the
 * deck-builder main may replace (`AssetsService.setLessonsPort`); the default reads the lesson folders directly.
 */
import { join } from 'node:path'
import { elementText } from '@shared/deck/text'
import type { Deck, Slide } from '@shared/deck/types'
import type { AssetUsage } from '@shared/contracts/assets'
import { LessonPaths } from '../lessons/paths'
import { LessonStore } from '../lessons/store'

/** One lesson, its title and what its slides hold. */
export interface LessonAssetUse {
  lessonId: string
  title: string
  slides: Array<{ slideId: string; number: number; assetIds: string[] }>
}

/** The words of a slide, for "Suggested for this slide". */
export interface SlideContext {
  /** Titles, text and alt texts of the slide. */
  text: string
  /** Descriptions and queries of the picture spots on it (these count double). */
  spotWords: string
}

export interface LessonsPort {
  /** Every lesson with the library-asset ids on each slide. */
  lessonsUsingAssets(): Promise<LessonAssetUse[]>
  /** The slide's words; undefined when the lesson or slide does not exist. */
  slideContext(lessonId: string, slideId: string): Promise<SlideContext | undefined>
}

/** `usedIn` per asset id: the lesson ids, in the order the lessons were scanned. */
export function usedInMap(lessons: readonly LessonAssetUse[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const lesson of lessons) {
    for (const id of new Set(lesson.slides.flatMap((s) => s.assetIds))) {
      map.set(id, [...(map.get(id) ?? []), lesson.lessonId])
    }
  }
  return map
}

/** The "Used in 14 lessons" list for one asset (titles and slide numbers). */
export function usageOf(
  assetId: string,
  lessons: readonly LessonAssetUse[]
): AssetUsage['lessons'] {
  const out: AssetUsage['lessons'] = []
  for (const lesson of lessons) {
    const slideNumbers = lesson.slides
      .filter((s) => s.assetIds.includes(assetId))
      .map((s) => s.number)
    if (slideNumbers.length)
      out.push({ lessonId: lesson.lessonId, title: lesson.title, slideNumbers })
  }
  return out
}

export function slideContextOf(slide: Slide): SlideContext {
  const text: string[] = []
  const spots: string[] = []
  for (const element of slide.elements) {
    if (element.type === 'image' && !element.assetId && element.placeholder) {
      const { description, query } = element.placeholder
      spots.push(description, query ?? '')
    } else {
      text.push(elementText(element))
    }
  }
  return { text: text.join(' '), spotWords: spots.join(' ') }
}

const assetIdsOf = (slide: Slide): string[] =>
  slide.elements.flatMap((e) => (e.type === 'image' && e.assetId ? [e.assetId] : []))

/** Reads the lesson folders of the deck-builder module (`<dataRoot>/modules/deck-builder/lessons/*`). */
export function createLessonsPortFromDisk(deckBuilderDir: string): LessonsPort {
  const store = new LessonStore(new LessonPaths(join(deckBuilderDir)))
  const deckOf = async (lessonId: string): Promise<Deck | undefined> => {
    const read = await store.readDeck(lessonId)
    return read.ok ? read.deck : undefined
  }
  return {
    async lessonsUsingAssets() {
      const out: LessonAssetUse[] = []
      for (const lessonId of await store.listIds()) {
        const deck = await deckOf(lessonId)
        if (!deck) continue
        out.push({
          lessonId,
          title: deck.title,
          slides: deck.slides.map((slide, at) => ({
            slideId: slide.id,
            number: at + 1,
            assetIds: assetIdsOf(slide)
          }))
        })
      }
      return out
    },
    async slideContext(lessonId, slideId) {
      const slide = (await deckOf(lessonId))?.slides.find((s) => s.id === slideId)
      return slide ? slideContextOf(slide) : undefined
    }
  }
}
