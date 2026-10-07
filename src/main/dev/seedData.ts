/**
 * Pure builders for the dev seeds: the lesson list of design/images/03-home.png, the two styles and the
 * decks, all derived from the two design fixtures. No I/O, no Electron.
 */
import type { Deck, Slide, TextElement } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'

/** One lesson card of the Home design. */
export interface SeedLesson {
  /** Folder name; stable so screenshots and tests can open it with `{ lessonId }`. */
  id: string
  title: string
  yearGroup: string
  subject: string
  slideCount: number
  /** Last edited this many days before the seed ran. */
  daysAgo: number
  style: 'science' | 'form'
}

export const PHOTOSYNTHESIS_ID = 'les_seed_photosynthesis'
export const GENERATING_ID = 'les_seed_water_cycle'

/** The eight cards of 03-home.png, newest first. The first one is the full fixture deck. */
export const SEED_LESSONS: readonly SeedLesson[] = [
  {
    id: PHOTOSYNTHESIS_ID,
    title: 'Y8 Science — Photosynthesis',
    yearGroup: 'Year 8',
    subject: 'Science',
    slideCount: 8,
    daysAgo: 0,
    style: 'science'
  },
  {
    id: 'les_seed_cells',
    title: 'Cells and organelles',
    yearGroup: 'Year 7',
    subject: 'Science',
    slideCount: 10,
    daysAgo: 1,
    style: 'science'
  },
  {
    id: 'les_seed_particles',
    title: 'The particle model',
    yearGroup: 'Year 7',
    subject: 'Science',
    slideCount: 9,
    daysAgo: 3,
    style: 'science'
  },
  {
    id: 'les_seed_forces',
    title: 'Forces and motion',
    yearGroup: 'Year 9',
    subject: 'Science',
    slideCount: 12,
    daysAgo: 8,
    style: 'science'
  },
  {
    id: 'les_seed_periodic',
    title: 'The periodic table',
    yearGroup: 'Year 8',
    subject: 'Science',
    slideCount: 11,
    daysAgo: 10,
    style: 'science'
  },
  {
    id: 'les_seed_online',
    title: 'Staying safe online',
    yearGroup: 'Form time',
    subject: 'Form time',
    slideCount: 6,
    daysAgo: 14,
    style: 'form'
  },
  {
    id: 'les_seed_acids',
    title: 'Acids and alkalis',
    yearGroup: 'Year 8',
    subject: 'Science',
    slideCount: 9,
    daysAgo: 21,
    style: 'science'
  },
  {
    id: 'les_seed_energy',
    title: 'Energy stores',
    yearGroup: 'Year 7',
    subject: 'Science',
    slideCount: 8,
    daysAgo: 35,
    style: 'science'
  }
]

/** The lesson of the "generating" seed: a plan exists, no slide yet. */
export const GENERATING_LESSON: SeedLesson = {
  id: GENERATING_ID,
  title: 'Y8 Science — The water cycle',
  yearGroup: 'Year 8',
  subject: 'Science',
  slideCount: 0,
  daysAgo: 0,
  style: 'science'
}

export const SCIENCE_STYLE_ID = 'sty_science_ks3'
export const FORM_STYLE_ID = 'sty_form_time'

/** Decks the Home design shows decks learned from. */
export const SCIENCE_DECKS = 24
export const FORM_DECKS = 6

/** The `deck` fixture's slides with fresh ids, cycled to `count`, the first one retitled. */
export function slidesFor(base: Deck, lesson: SeedLesson): Slide[] {
  const slides: Slide[] = []
  for (let i = 0; i < lesson.slideCount; i++) {
    const source = i === 0 ? base.slides[0] : base.slides[1 + ((i - 1) % (base.slides.length - 1))]
    const id =
      i === 0 && lesson.id === PHOTOSYNTHESIS_ID ? source.id : `${lesson.id.slice(4)}-${i + 1}`
    const clone = renumber(structuredClone(source), id)
    slides.push(i === 0 && lesson.id !== PHOTOSYNTHESIS_ID ? retitle(clone, lesson) : clone)
  }
  return slides
}

/** Gives a slide a new id and its elements ids that start with it (`s2-title` becomes `<id>-title`). */
function renumber(slide: Slide, id: string): Slide {
  const old = slide.id
  slide.id = id
  for (const element of slide.elements) element.id = element.id.replace(old, id)
  return slide
}

/** A title slide for `lesson`: the title with its last word in the accent colour, and a matching kicker. */
function retitle(slide: Slide, lesson: SeedLesson): Slide {
  const words = lesson.title.split(' ')
  const last = words.pop() ?? ''
  const text = (role: string) =>
    slide.elements.find((e): e is TextElement => e.type === 'text' && e.role === role)
  const title = text('title')
  if (title)
    title.paragraphs = [
      {
        runs: [
          { text: words.length ? `${words.join(' ')} ` : '' },
          { text: last, color: 'token:accent' }
        ]
      }
    ]
  const kicker = text('kicker')
  if (kicker)
    kicker.paragraphs = [
      {
        runs: [
          {
            text:
              lesson.subject === lesson.yearGroup
                ? lesson.subject
                : `${lesson.yearGroup} ${lesson.subject}`
          }
        ]
      }
    ]
  return slide
}

/** The deck of a seed lesson: the fixture's title, meta and slides (retitled for the other lessons). */
export function deckFor(base: Deck, lesson: SeedLesson): Pick<Deck, 'meta' | 'slides'> {
  const meta = { ...base.meta, subject: lesson.subject, yearGroup: lesson.yearGroup }
  return { meta, slides: slidesFor(base, lesson) }
}

/** Where the dates come from: `daysAgo` before `now`. */
export const editedAt = (now: Date, lesson: SeedLesson): Date =>
  new Date(now.getTime() - lesson.daysAgo * 86_400_000)

/** "Science KS3" from the fixture, learned from 24 decks, the default style. */
export function scienceStyle(base: StyleProfile, now: Date): StyleProfile {
  return withSources(
    { ...structuredClone(base), isDefault: true, status: 'ready' },
    SCIENCE_DECKS,
    now
  )
}

/** "Form time": Nunito, purple and yellow, learned from 6 decks (03-home.png). */
export function formStyle(base: StyleProfile, now: Date): StyleProfile {
  const style = structuredClone(base)
  const { colors, fonts } = style.tokens
  const set = (key: string, hex: string, label: string): void => {
    colors[key] = { ...colors[key], hex, label }
  }
  set('accent', '#7B3FA0', 'Purple')
  set('text', '#2A2340', 'Ink')
  set('highlight', '#F2B632', 'Gold')
  set('chipBg', '#EFE4F7', 'Lilac')
  set('chipText', '#5A2D7A', 'Deep purple')
  set('placeholder', '#EEE8F2', 'Pale lilac')
  set('muted', '#5C5670', 'Grey')
  for (const font of [fonts.title, fonts.body]) {
    font.family = 'Nunito'
    font.fallbackStack = "'Nunito', 'Segoe UI', sans-serif"
  }
  return withSources(
    {
      ...style,
      id: FORM_STYLE_ID,
      name: 'Form time',
      isDefault: false,
      version: 1,
      status: 'ready'
    },
    FORM_DECKS,
    now
  )
}

/** `count` learned PowerPoint sources, so the style card says "learned from N decks". */
function withSources(style: StyleProfile, count: number, now: Date): StyleProfile {
  const stamp = now.toISOString()
  style.sources = Array.from({ length: count }, (_, i) => ({
    id: `src_${style.id.slice(4)}_${String(i + 1).padStart(2, '0')}`,
    fileName: `${style.name} deck ${i + 1}.pptx`,
    kind: 'pptx' as const,
    pages: 12,
    status: 'learned' as const,
    addedAt: stamp
  }))
  style.createdAt = stamp
  style.updatedAt = stamp
  return style
}
