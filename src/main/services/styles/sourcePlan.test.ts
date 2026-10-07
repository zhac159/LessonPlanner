import { describe, expect, it } from 'vitest'
import { makeAnalysis } from '@shared/style/testing'
import { cleanFileAnalysis, sourcePlanPages } from './sourcePlan'

/** What the model said about page 1 of both example decks. */
const exampleAnalysis = () =>
  makeAnalysis({
    slideKinds: [
      {
        page: 1,
        kind: 'custom',
        title: 'Writing Root session plan (source reference sheet, not her own slide)'
      },
      { page: 2, kind: 'objectives', title: 'Monday 5th October 2026 - LO: To infer meaning' },
      { page: 3, kind: 'do-now', title: 'Starter/Do Now' }
    ],
    layouts: [
      { name: 'Header band', description: 'on Monday 5 October', regions: [], pages: [1, 2, 3] }
    ],
    exemplarCandidates: [
      { page: 1, why: 'The plan' },
      { page: 2, why: 'Her objectives slide, 5th October 2026' }
    ],
    habits: ['Date is written in full as the title', 'Wednesday 7th October 2026'],
    problems: ['Page 1 is a Writing Root published session plan, not one of her own slides.']
  })

describe('sourcePlanPages', () => {
  it('finds a plan page from its custom kind and title, and from the model’s own problem note', () => {
    expect(sourcePlanPages(exampleAnalysis())).toEqual([1])
    const onlyProblem = makeAnalysis({
      slideKinds: [{ page: 1, kind: 'custom', title: 'Overview' }],
      problems: ['Page 1 is a scanned planning page from the scheme, not one of her own slides']
    })
    expect(sourcePlanPages(onlyProblem)).toEqual([1])
  })

  it('never calls a real custom slide a plan', () => {
    const real = makeAnalysis({ slideKinds: [{ page: 4, kind: 'custom', title: 'Class poem' }] })
    expect(sourcePlanPages(real)).toEqual([])
  })
})

describe('cleanFileAnalysis', () => {
  it('removes the plan page from kinds, exemplars and layouts, and strips every date', () => {
    const { analysis, planPages } = cleanFileAnalysis(exampleAnalysis())
    expect(planPages).toEqual([1])
    expect(analysis.slideKinds.map((k) => k.page)).toEqual([2, 3])
    expect(analysis.slideKinds[0].title).toBe('LO: To infer meaning')
    expect(analysis.exemplarCandidates).toEqual([{ page: 2, why: 'Her objectives slide' }])
    expect(analysis.layouts[0].pages).toEqual([2, 3])
    expect(analysis.habits).toEqual(['Date is written in full as the title'])
  })

  it('is idempotent and honours plan pages it already knew', () => {
    const once = cleanFileAnalysis(exampleAnalysis())
    const twice = cleanFileAnalysis(once.analysis, once.planPages)
    expect(twice.analysis).toEqual(once.analysis)
    expect(twice.planPages).toEqual([1])
  })
})
