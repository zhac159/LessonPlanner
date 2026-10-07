import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { ImageElement, Slide } from '@shared/deck/types'
import { fixtureDeck, makeSlide, makeText } from '@shared/deck/testing'
import { cleanTemp, tempDir } from './testing'
import {
  createLessonsPortFromDisk,
  slideContextOf,
  usageOf,
  usedInMap,
  type LessonAssetUse
} from './usage'

afterEach(cleanTemp)

const picture = (id: string, assetId?: string, description?: string): ImageElement => ({
  id,
  type: 'image',
  x: 0,
  y: 0,
  w: 100,
  h: 100,
  fit: 'contain',
  alt: 'alt',
  assetId,
  placeholder: description ? { description, query: 'sunny leaf' } : undefined
})

async function writeLesson(root: string, id: string, title: string, slides: Slide[]) {
  const deck = { ...fixtureDeck(), id, title, slides }
  await mkdir(join(root, 'lessons', id), { recursive: true })
  await writeFile(join(root, 'lessons', id, 'deck.json'), JSON.stringify(deck))
}

const LESSONS: LessonAssetUse[] = [
  {
    lessonId: 'les_a',
    title: 'Photosynthesis',
    slides: [
      { slideId: 's1', number: 1, assetIds: ['ast_logo'] },
      { slideId: 's2', number: 2, assetIds: ['ast_leaf', 'ast_logo'] }
    ]
  },
  {
    lessonId: 'les_b',
    title: 'Cells',
    slides: [{ slideId: 's1', number: 1, assetIds: ['ast_logo'] }]
  }
]

describe('usage maths', () => {
  it('lists each lesson once per asset', () => {
    const map = usedInMap(LESSONS)
    expect(map.get('ast_logo')).toEqual(['les_a', 'les_b'])
    expect(map.get('ast_leaf')).toEqual(['les_a'])
  })

  it('gives titles and slide numbers for the "Used in" list', () => {
    expect(usageOf('ast_logo', LESSONS)).toEqual([
      { lessonId: 'les_a', title: 'Photosynthesis', slideNumbers: [1, 2] },
      { lessonId: 'les_b', title: 'Cells', slideNumbers: [1] }
    ])
    expect(usageOf('ast_none', LESSONS)).toEqual([])
  })

  it('reads a slide: text apart from picture spots, which carry their query', () => {
    const slide = makeSlide('s1', {
      elements: [
        makeText('t', 'How leaves make food'),
        picture('p', undefined, 'A leaf in sunlight')
      ]
    })
    const context = slideContextOf(slide)
    expect(context.text).toContain('How leaves make food')
    expect(context.spotWords).toContain('A leaf in sunlight')
    expect(context.spotWords).toContain('sunny leaf')
  })
})

describe('the lesson folders port', () => {
  it('scans lessons for library pictures and returns slide words', async () => {
    const root = await tempDir()
    await writeLesson(root, 'les_one', 'Photosynthesis', [
      makeSlide('sld_1', { elements: [picture('p1', 'ast_logo'), makeText('t1', 'Title')] }),
      makeSlide('sld_2', { elements: [picture('p2', undefined, 'A leaf in sunlight')] })
    ])
    await writeLesson(root, 'les_two', 'Cells', [makeSlide('sld_1', { elements: [] })])
    await mkdir(join(root, 'lessons', 'les_broken'), { recursive: true })
    await writeFile(join(root, 'lessons', 'les_broken', 'deck.json'), '{ nope')

    const port = createLessonsPortFromDisk(root)
    const scanned = (await port.lessonsUsingAssets()).sort((a, b) =>
      a.lessonId.localeCompare(b.lessonId)
    )
    expect(scanned.map((l) => l.lessonId)).toEqual(['les_one', 'les_two'])
    expect(scanned[0]!.slides).toEqual([
      { slideId: 'sld_1', number: 1, assetIds: ['ast_logo'] },
      { slideId: 'sld_2', number: 2, assetIds: [] }
    ])
    expect((await port.slideContext('les_one', 'sld_2'))?.spotWords).toContain('A leaf in sunlight')
    expect(await port.slideContext('les_one', 'sld_missing')).toBeUndefined()
    expect(await port.slideContext('les_missing', 'sld_1')).toBeUndefined()
  })

  it('finds nothing when there is no lessons folder yet', async () => {
    expect(await createLessonsPortFromDisk(await tempDir()).lessonsUsingAssets()).toEqual([])
  })
})
