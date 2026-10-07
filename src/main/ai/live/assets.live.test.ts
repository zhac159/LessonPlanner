/**
 * LIVE check: writeSlide with the teacher's assets (agents/ASSETS.md §5.4). One title slide and one content slide are
 * written with a small library (school_logo, a symbol card, a leaf photo described) and a profile whose picture habits
 * put the logo top-right on title slides. Claude must place school_logo BY NAME on the title slide and, on the content
 * slide where no asset fits, leave a picture spot (a described empty image) instead of inventing a picture.
 * Budget for this file: $0.40. Run: npm run test:live -- assets
 */
import { describe, expect, it } from 'vitest'
import type { LessonBrief, LessonPlan } from '@shared/ai/types'
import type { Asset, PictureHabits } from '@shared/assets/types'
import { isPictureSpot } from '@shared/assets/spots'
import { slideSchema } from '@shared/deck/schema'
import { elementText } from '@shared/deck/text'
import type { ImageElement } from '@shared/deck/types'
import { loadFixtureStyle } from '../../export/testkit'
import { fakeAsset } from '../../services/assets/testing'
import { buildAssetCatalogue } from '../prompts/assets'
import { createLiveService, hasKey, saveArtifact, SKIP_MESSAGE, unwrap, usageSeen } from './harness'

const BUDGET_USD = 0.4

const logo: Asset = fakeAsset('school_logo', {
  kind: 'logo',
  title: 'School logo',
  description:
    'Navy school crest with a gold star and the school name in white capitals. Sits in the top-right corner of title slides.',
  tags: ['school', 'crest', 'title slides'],
  file: {
    ext: '.png',
    width: 480,
    height: 480,
    bytes: 24_000,
    sha256: 'a'.repeat(64),
    phash: null,
    vector: false
  }
})
const card: Asset = fakeAsset('happy_symbol_card', {
  kind: 'symbol-card',
  title: 'Happy symbol card',
  description:
    'A vocabulary card: the word "happy" under a smiling cartoon face, in a blue rounded border.',
  tags: ['vocabulary', 'feelings', 'symbol card']
})
const leaf: Asset = fakeAsset('leaf_photo', {
  kind: 'photo',
  title: 'Leaf in sunlight',
  description: 'Close-up photograph of a single green leaf in bright sunlight, veins visible.',
  tags: ['leaf', 'plant', 'sunlight'],
  file: {
    ext: '.jpg',
    width: 1600,
    height: 1067,
    bytes: 300_000,
    sha256: 'b'.repeat(64),
    phash: null,
    vector: false
  }
})
const LIBRARY = [logo, card, leaf]

const HABITS: PictureHabits = {
  lines: [
    'Content slides usually carry one picture on the right, about a third of the slide wide.'
  ],
  slideKinds: [
    { kind: 'title', pictures: 'always', typicalBox: null },
    { kind: 'content', pictures: 'usually', typicalBox: { x: 1100, y: 280, w: 680, h: 520 } },
    { kind: 'objectives', pictures: 'never', typicalBox: null }
  ],
  placements: [
    {
      assetId: logo.id,
      slideKind: 'title',
      anchor: 'top-right',
      widthUnits: 240,
      marginUnits: 48,
      decks: 8
    }
  ]
}

const BRIEF: LessonBrief = {
  title: 'Photosynthesis',
  subject: 'Science (Biology)',
  yearGroup: 'Y8',
  durationMin: 50,
  targetSlideCount: 2,
  objectives: ['Explain how water travels up a plant from the roots to the leaves.']
}

const PLAN: LessonPlan = {
  title: 'Y8 Science: Photosynthesis',
  summary: 'Two slides.',
  slides: [
    {
      kind: 'title',
      layoutId: 'title',
      purpose: 'Open the lesson with its title.',
      keyContent: ['How do plants move water?'],
      objectiveRefs: [0]
    },
    {
      kind: 'content',
      layoutId: 'content-text-left-image-right',
      purpose: 'Show how water is drawn up from root hair cells through the xylem to the leaves.',
      keyContent: [
        'Root hair cells take in water',
        'Water moves up the xylem',
        'Water leaves through the leaves'
      ],
      objectiveRefs: [0]
    }
  ]
}

describe.skipIf(!hasKey())('live: writeSlide with the teacher’s assets', () => {
  if (!hasKey()) console.log(SKIP_MESSAGE)

  it('places school_logo by name on the title slide and leaves a spot, not an invented picture, on the content slide', async () => {
    const ai = createLiveService()
    const profile = loadFixtureStyle()
    ;(profile as unknown as { pictures: PictureHabits }).pictures = HABITS
    const assets = buildAssetCatalogue(LIBRARY, HABITS)
    const spentBefore = usageSeen.reduce((sum, u) => sum + u.usd, 0)

    const title = unwrap(
      await ai.writeSlide({ profile, brief: BRIEF, plan: PLAN, index: 0, assets }),
      'writeSlide (title)'
    ).slide
    const content = unwrap(
      await ai.writeSlide({ profile, brief: BRIEF, plan: PLAN, index: 1, assets }),
      'writeSlide (content)'
    ).slide
    const spent = usageSeen.reduce((sum, u) => sum + u.usd, 0) - spentBefore

    const images = (slide: typeof title): ImageElement[] =>
      slide.elements.filter((e): e is ImageElement => e.type === 'image')
    const summary = {
      spentUsd: Number(spent.toFixed(4)),
      title: images(title).map(({ id, name, assetId, x, y, w, h, fit, locked, placeholder }) => ({
        id,
        name,
        assetId,
        x,
        y,
        w,
        h,
        fit,
        locked,
        placeholder
      })),
      content: images(content).map(({ id, name, assetId, x, y, w, h, fit, alt, placeholder }) => ({
        id,
        name,
        assetId,
        x,
        y,
        w,
        h,
        fit,
        alt,
        placeholder
      })),
      contentText: content.elements.map((e) => elementText(e)).filter(Boolean)
    }
    saveArtifact('assets-writeSlide.json', { catalogue: assets.text, title, content, summary })
    console.log('[live] assets:', JSON.stringify(summary))

    // Both are valid slides the app itself would accept.
    expect(slideSchema.safeParse(title).success).toBe(true)
    expect(slideSchema.safeParse(content).success).toBe(true)

    // Title slide: school_logo, by name, resolved to the library id, an ordinary unlocked picture.
    const placed = images(title).filter((e) => e.assetId === logo.id)
    expect(placed.length).toBeGreaterThanOrEqual(1)
    expect(placed[0]).toMatchObject({ name: 'school_logo', alt: 'School logo' })
    expect(placed[0].locked).toBeUndefined()
    expect(placed[0].x + placed[0].w / 2).toBeGreaterThan(1920 / 2)
    expect(placed[0].y + placed[0].h / 2).toBeLessThan(1080 / 2)
    expect(placed[0].w / placed[0].h).toBeCloseTo(1, 1)

    // No picture on either slide points at an asset the library does not have.
    const known = new Set(LIBRARY.map((a) => a.id))
    for (const image of [...images(title), ...images(content)]) {
      if (image.assetId) expect(known.has(image.assetId)).toBe(true)
    }

    // Content slide: nothing in the library fits root hair cells, so she gets a picture spot with a real description.
    const spots = images(content).filter(isPictureSpot)
    expect(spots.length).toBeGreaterThanOrEqual(1)
    expect(spots.length).toBeLessThanOrEqual(2)
    const description = spots[0].placeholder?.description ?? ''
    expect(description.split(/\s+/).length).toBeGreaterThanOrEqual(3)
    expect(description.split(/\s+/).length).toBeLessThanOrEqual(16)
    // The description is a hint for the editor, never text printed on the slide.
    const printed = content.elements
      .filter((e) => e.type !== 'image')
      .map((e) => elementText(e).toLowerCase())
      .join(' ')
    expect(printed).not.toContain(description.toLowerCase())

    expect(spent).toBeLessThan(BUDGET_USD)
  })
})
