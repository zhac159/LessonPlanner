import { describe, expect, it } from 'vitest'
import type { ChangeSet, Deck, Slide } from '../deck/types'
import { fail, ok } from '../result'
import { invalidChannels } from './channelPattern.test'
import {
  DECK_BUILDER,
  DECK_BUILDER_EVENTS,
  DECK_BUILDER_METHODS,
  DECK_BUILDER_OWN_EVENTS,
  EDITOR_METHODS,
  LESSONS_METHODS,
  type CreateLessonRequest,
  type DeckBuilderApi,
  type ExportResult,
  type GenProgress,
  type HistoryState,
  type LessonSummary,
  type LessonView
} from './deck-builder'
import { CHAT_METHODS } from './deck-builder-chat'
import { PLUGINS_METHODS } from './deck-builder-plugins'

const slide: Slide = { id: 'sld_1', kind: 'title', elements: [] }
const deck: Deck = {
  schemaVersion: 1,
  id: 'dck_1',
  title: 'Y8 Science — Photosynthesis',
  meta: { objectives: ['Describe photosynthesis'] },
  styleId: null,
  styleVersion: null,
  size: { width: 1920, height: 1080 },
  slides: [slide],
  createdAt: '2026-10-06T09:00:00Z',
  updatedAt: '2026-10-06T09:00:00Z'
}
const history = {
  canUndo: true,
  canRedo: false,
  undoChangeSetId: 'chg_1',
  redoChangeSetId: null,
  undoSummary: 'Added a slide'
} satisfies HistoryState

describe('deck-builder contract', () => {
  it('serves the module id the bus routes on', () => {
    expect(DECK_BUILDER).toBe('deck-builder')
  })

  it('uses valid, unique channel and event names across all areas', () => {
    expect(invalidChannels(DECK_BUILDER_METHODS)).toEqual([])
    expect(invalidChannels(DECK_BUILDER_EVENTS)).toEqual([])
  })

  it('serves placeAsset with the editor and answers an export with an ask about empty picture spots', () => {
    expect(EDITOR_METHODS).toContain('placeAsset')
    const asked = { status: 'spots', count: 3, slides: [3, 5, 6] } satisfies ExportResult
    expect(asked.slides).toHaveLength(asked.count)
    const args = { lessonId: 'les_1', ignoreSpots: true } satisfies Parameters<
      DeckBuilderApi['exportPptx']
    >[0]
    expect(args.ignoreSpots).toBe(true)
  })

  it('keeps the area prefixes of the spec (chat:, plugins:) and plain lesson names', () => {
    expect(CHAT_METHODS.every((m) => m.startsWith('chat:'))).toBe(true)
    expect(PLUGINS_METHODS.every((m) => m.startsWith('plugins:'))).toBe(true)
    expect([...LESSONS_METHODS, ...EDITOR_METHODS].some((m) => m.includes(':'))).toBe(false)
    expect(DECK_BUILDER_OWN_EVENTS).toContain('gen-progress')
  })

  it('lists every method of the composed Api exactly once', () => {
    expect(DECK_BUILDER_METHODS).toHaveLength(
      LESSONS_METHODS.length + EDITOR_METHODS.length + CHAT_METHODS.length + PLUGINS_METHODS.length
    )
  })

  it('describes a lesson card, a create request and the editor payload', () => {
    const summary = {
      id: 'dck_1',
      title: deck.title,
      yearGroup: 'Year 8',
      yearShort: 'Year 8',
      slideCount: 1,
      updatedAt: deck.updatedAt,
      styleId: null,
      thumbDataUrl: null,
      status: 'generating'
    } satisfies LessonSummary
    const request = {
      objectivesText: 'Describe photosynthesis',
      documentIds: [],
      styleId: null,
      title: null,
      meta: { durationMin: 50 },
      startGeneration: true
    } satisfies CreateLessonRequest
    const view = {
      deck,
      titleSource: 'auto',
      style: null,
      history,
      chat: [],
      runningJob: { jobId: 'job_1', kind: 'generation', messageId: 'msg_1' },
      stickyNotes: [{ id: 'n1', slideId: slide.id, x: 100, y: 80, text: 'Ask Sam' }]
    } satisfies LessonView
    expect([summary.status, request.startGeneration, view.runningJob.kind]).toEqual([
      'generating',
      true,
      'generation'
    ])
  })

  it('narrows export outcomes by status', () => {
    const outcomes: ExportResult[] = [
      {
        status: 'saved',
        path: 'C:\\Users\\Sam\\x.pptx',
        fileName: 'x.pptx',
        missingFonts: ['Lexend']
      },
      { status: 'cancelled' },
      { status: 'error', code: 'file-locked', message: 'Close PowerPoint first' }
    ]
    const labels = outcomes.map((o) => (o.status === 'error' ? o.code : o.status))
    expect(labels).toEqual(['saved', 'cancelled', 'file-locked'])
  })

  it('carries a committed ChangeSet through undo results', () => {
    const changeSet: ChangeSet = {
      id: 'chg_1',
      by: 'user',
      summary: 'Renamed the lesson',
      ops: [{ op: 'setMeta', title: 'New title' }],
      at: deck.updatedAt
    }
    const results: ReturnType<DeckBuilderApi['applyOps']>[] = [
      ok({ changeSet, history }),
      fail('not-found', 'No such lesson')
    ]
    expect(results.map((r) => (r.ok ? r.changeSet.id : r.code))).toEqual(['chg_1', 'not-found'])
  })

  it('types generation progress', () => {
    const progress = {
      lessonId: 'dck_1',
      stage: 'writing',
      done: 3,
      total: 8
    } satisfies GenProgress
    expect(progress.done / progress.total).toBeLessThan(1)
  })
})
