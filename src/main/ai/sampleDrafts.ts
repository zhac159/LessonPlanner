/** Test data: a valid model-written style draft and slide (wire shapes), derived from the design fixtures. */
import { fixtureProfile } from './fake/fixtures'
import type { SlideWire } from './schemas/slide'
import type { StyleDraft } from './schemas/styleDraft'

type ElementWire = SlideWire['elements'][number]

/** A flat wire element with every field "empty"; override what the element type needs. */
export function wireElement(over: Partial<ElementWire> & Pick<ElementWire, 'type'>): ElementWire {
  return {
    name: 'x',
    x: 100,
    y: 100,
    w: 800,
    h: 200,
    locked: false,
    styleRef: '',
    role: 'none',
    paragraphs: [],
    align: 'left',
    valign: 'top',
    fontSizePt: 0,
    items: [],
    variant: '',
    label: '',
    description: '',
    alt: '',
    fit: 'cover',
    radius: 0,
    svg: '',
    shape: 'rect',
    fill: '',
    strokeColor: '',
    strokeWidth: 0,
    rows: [],
    headerRow: false,
    ...over
  }
}

export function sampleSlideWire(): SlideWire {
  return {
    kind: 'content',
    layoutId: 'content-text-left-image-right',
    background: '',
    notes: 'Five minutes. Take two answers.',
    elements: [
      wireElement({
        type: 'text',
        name: 'title',
        role: 'title',
        paragraphs: [
          {
            list: 'none',
            level: 0,
            runs: [
              { text: 'Where does ', bold: false, italic: false, color: '' },
              { text: 'photosynthesis', bold: true, italic: false, color: 'token:accent' }
            ]
          }
        ]
      }),
      wireElement({ type: 'image', name: 'photo', description: 'A leaf in sunlight' })
    ]
  }
}

export function sampleStyleDraft(): StyleDraft {
  const p = fixtureProfile()
  const font = (f: typeof p.tokens.fonts.title) => ({
    family: f.family,
    weight: f.weight,
    sizePt: f.sizePt,
    sizeMinPt: f.sizeRangePt?.[0] ?? 0,
    sizeMaxPt: f.sizeRangePt?.[1] ?? 0,
    fallbackStack: f.fallbackStack
  })
  return {
    colors: Object.entries(p.tokens.colors).map(([token, c]) => ({ token, ...c })),
    fonts: {
      title: font(p.tokens.fonts.title),
      body: font(p.tokens.fonts.body),
      accent: { ...font(p.tokens.fonts.body), family: '' }
    },
    components: Object.entries(p.components).map(([key, c]) => ({
      key,
      description: c.description,
      font: c.font ?? 'none',
      sizePt: c.sizePt ?? 0,
      bold: c.bold ?? false,
      color: c.color ?? '',
      fill: c.fill ?? '',
      radius: c.radius ?? 0,
      uppercase: c.uppercase ?? false,
      letterSpacingEm: c.letterSpacingEm ?? 0,
      rules: c.rules ?? []
    })),
    layouts: p.layouts.map((l) => ({
      ...l,
      regions: l.regions.map((r) => ({
        ...r,
        styleRef: r.styleRef ?? '',
        optional: r.optional ?? false
      }))
    })),
    slideTypes: p.slideTypes.map((s) => ({
      ...s,
      typicalPosition: s.typicalPosition ?? 'none',
      exampleText: s.exampleText ?? ''
    })),
    lessonFlow: p.lessonFlow,
    voice: {
      spelling: p.voice.spelling,
      readingAge: p.voice.readingAge ?? '',
      rules: p.voice.rules,
      phrases: p.voice.phrases,
      questionStyle: p.voice.questionStyle ?? ''
    },
    habits: p.habits,
    confidence: p.confidence,
    testSlide: sampleSlideWire()
  }
}
