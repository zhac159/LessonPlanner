import { describe, expect, it } from 'vitest'
import { makeChangeSet, makeSlide } from '@shared/deck/testing'
import { changedSlideIds } from './changedSlides'
import { renderStyleOf } from './renderStyle'

describe('changedSlideIds', () => {
  it('lists inserted and replaced slides once each', () => {
    const changes = makeChangeSet([
      { op: 'insertSlides', afterSlideId: null, slides: [makeSlide('a'), makeSlide('b')] },
      { op: 'replaceSlide', slide: makeSlide('b') },
      { op: 'moveSlide', slideId: 'c', afterSlideId: null },
      { op: 'deleteSlides', slideIds: ['d'] }
    ])
    expect(changedSlideIds(changes)).toEqual(['a', 'b'])
  })

  it('is empty when nothing was added or replaced', () => {
    expect(changedSlideIds(makeChangeSet([{ op: 'deleteSlides', slideIds: ['x'] }]))).toEqual([])
  })
})

describe('renderStyleOf', () => {
  it('is null for the plain style', () => {
    expect(renderStyleOf(null)).toBeNull()
  })

  it('carries the tokens and components SlideView reads', () => {
    const view = {
      version: 3,
      tokens: { colors: {} },
      components: { chip: {} },
      habits: []
    } as unknown as Parameters<typeof renderStyleOf>[0]
    const profile = renderStyleOf(view)
    expect(profile).toMatchObject({ version: 3, tokens: view?.tokens, layouts: [], sources: [] })
    expect(profile?.components).toBe(view?.components)
  })
})
