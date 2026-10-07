import { describe, expect, it } from 'vitest'
import { routeForIntent } from './route'

describe('routeForIntent', () => {
  it('opens the editor for open-lesson', () => {
    expect(routeForIntent({ kind: 'open-lesson', lessonId: 'les_1' })).toEqual({
      screen: 'editor',
      lessonId: 'les_1'
    })
  })

  it('carries composerText for the chat box', () => {
    expect(
      routeForIntent({ kind: 'open-lesson', lessonId: 'l', composerText: '{{owl}} ' })
    ).toEqual({
      screen: 'editor',
      lessonId: 'l',
      composerText: '{{owl}} '
    })
    expect(routeForIntent({ kind: 'new-lesson', composerText: '{{owl}} ' })).toEqual({
      screen: 'new-lesson',
      prefill: { title: undefined, text: '{{owl}} ' }
    })
    expect(routeForIntent({ kind: 'new-lesson', text: 'Cells', composerText: 'x' })).toMatchObject({
      prefill: { text: 'Cells x' }
    })
  })

  it('ignores open-lesson without a lesson id', () => {
    expect(routeForIntent({ kind: 'open-lesson' })).toBeNull()
    expect(routeForIntent({ kind: 'open-lesson', lessonId: '  ' })).toBeNull()
    expect(routeForIntent({ kind: 'open-lesson', lessonId: 7 })).toBeNull()
  })

  it('shows the New lesson screen, pre-filled from either shape', () => {
    expect(routeForIntent({ kind: 'new-lesson' })).toEqual({ screen: 'new-lesson' })
    expect(routeForIntent({ kind: 'new-lesson', title: 'Cells', text: 'Know cells' })).toEqual({
      screen: 'new-lesson',
      prefill: { title: 'Cells', text: 'Know cells' }
    })
    expect(routeForIntent({ kind: 'new-lesson', prefill: { text: 'Know cells' } })).toMatchObject({
      prefill: { text: 'Know cells' }
    })
  })

  it('creates a lesson from a request object, always starting generation', () => {
    const route = routeForIntent({
      kind: 'create-lesson',
      request: {
        objectivesText: 'Know the Cold War',
        documentIds: ['doc_1', 5, 'doc_2'],
        styleId: 'sty_1',
        title: 'Cold War',
        meta: { year: 'Year 9' },
        startGeneration: false
      }
    })
    expect(route).toEqual({
      screen: 'create-lesson',
      request: {
        objectivesText: 'Know the Cold War',
        documentIds: ['doc_1', 'doc_2'],
        styleId: 'sty_1',
        title: 'Cold War',
        meta: { year: 'Year 9' },
        startGeneration: true
      }
    })
  })

  it('creates a lesson from flat fields with safe defaults', () => {
    expect(routeForIntent({ kind: 'create-lesson' })).toEqual({
      screen: 'create-lesson',
      request: {
        objectivesText: '',
        documentIds: [],
        styleId: null,
        title: null,
        meta: {},
        startGeneration: true
      }
    })
  })

  it('does not know other intents', () => {
    expect(routeForIntent({ kind: 'ai' })).toBeNull()
  })
})
