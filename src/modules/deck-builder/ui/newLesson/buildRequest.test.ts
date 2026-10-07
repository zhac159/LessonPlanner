import { describe, expect, it } from 'vitest'
import {
  LONG_TEXT_CHARS,
  NEEDS_OBJECTIVES,
  buildCreateRequest,
  buildMeta,
  hasObjectives,
  isLongText,
  validateDraft,
  type DraftDocument,
  type LessonDraft
} from './buildRequest'
import { initialSetup } from './setup'

const doc = (id: string, status: DraftDocument['status'] = 'ready'): DraftDocument => ({
  id,
  name: `${id}.pdf`,
  kind: 'pdf',
  sizeBytes: 10,
  status
})

const draft = (patch: Partial<LessonDraft> = {}): LessonDraft => ({
  text: 'LO1: Describe photosynthesis',
  title: '',
  documents: [],
  styleId: 'sty_1',
  setup: { ...initialSetup().values, yearGroup: 'Year 8' },
  ...patch
})

describe('buildMeta', () => {
  it('sends the set-up chips as lesson meta', () => {
    expect(
      buildMeta({ yearGroup: 'Year 8', durationMin: 50, ability: 'Mixed ability', slideCount: 8 })
    ).toEqual({
      yearGroup: 'Year 8',
      durationMin: 50,
      ability: 'Mixed ability',
      targetSlideCount: 8
    })
  })

  it('leaves the year out until one is chosen', () => {
    expect(buildMeta(initialSetup().values)).not.toHaveProperty('yearGroup')
  })
})

describe('buildCreateRequest', () => {
  it('builds the Make my slides request', () => {
    const request = buildCreateRequest(
      draft({ text: '  LO1: x \n', documents: [doc('a')] }),
      'generate'
    )
    expect(request).toEqual({
      objectivesText: 'LO1: x',
      documentIds: ['a'],
      styleId: 'sty_1',
      title: null,
      meta: { yearGroup: 'Year 8', durationMin: 50, ability: 'Mixed ability', targetSlideCount: 8 },
      startGeneration: true
    })
  })

  it('builds the Blank slide request without generation or text', () => {
    const request = buildCreateRequest(draft(), 'blank')
    expect(request).toMatchObject({ objectivesText: '', startGeneration: false, blankSlide: true })
  })

  it('sends the title only when she typed one, trimmed and capped at 80 characters', () => {
    expect(buildCreateRequest(draft({ title: '  Y8 Light  ' }), 'generate').title).toBe('Y8 Light')
    expect(buildCreateRequest(draft({ title: 'x'.repeat(120) }), 'generate').title).toHaveLength(80)
    expect(buildCreateRequest(draft({ title: '   ' }), 'generate').title).toBeNull()
  })

  it('keeps documents that could not be read out of the request', () => {
    const request = buildCreateRequest(
      draft({ documents: [doc('a'), doc('b', 'error'), doc('c', 'reading')] }),
      'generate'
    )
    expect(request.documentIds).toEqual(['a', 'c'])
  })

  it('passes the plain style as null', () => {
    expect(buildCreateRequest(draft({ styleId: null }), 'generate').styleId).toBeNull()
  })
})

describe('validateDraft', () => {
  it('needs text or a readable document', () => {
    expect(validateDraft(draft({ text: '   ' }))).toBe(NEEDS_OBJECTIVES)
    expect(validateDraft(draft({ text: '', documents: [doc('a', 'error')] }))).toBe(
      NEEDS_OBJECTIVES
    )
    expect(validateDraft(draft({ text: '', documents: [doc('a')] }))).toBeNull()
    expect(validateDraft(draft())).toBeNull()
  })

  it('treats a document still being read as usable', () => {
    expect(hasObjectives(draft({ text: '', documents: [doc('a', 'reading')] }))).toBe(true)
  })
})

describe('isLongText', () => {
  it('flags more than 20,000 characters', () => {
    expect(isLongText('a'.repeat(LONG_TEXT_CHARS))).toBe(false)
    expect(isLongText('a'.repeat(LONG_TEXT_CHARS + 1))).toBe(true)
  })
})
