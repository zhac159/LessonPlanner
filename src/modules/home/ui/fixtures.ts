/** Pure fixtures for Home's tests: lessons, styles and Claude connection states. */
import type { LessonSummary } from '@shared/contracts/deck-builder'
import type { AiStatus } from '@shared/contracts/settings'
import type { StyleSummary } from '@shared/contracts/style-library'

/** A lesson card's data; `over` wins. */
export function lesson(over: Partial<LessonSummary> = {}): LessonSummary {
  return {
    id: 'l1',
    title: 'Photosynthesis',
    yearGroup: 'Year 8',
    yearShort: 'Year 8',
    slideCount: 8,
    updatedAt: '2026-10-06T08:00:00.000Z',
    styleId: 's1',
    thumbDataUrl: null,
    status: 'ready',
    ...over
  }
}

/** A style card's data; `over` wins. */
export function style(over: Partial<StyleSummary> = {}): StyleSummary {
  return {
    id: 's1',
    name: 'Science KS3',
    isDefault: true,
    status: 'ready',
    swatches: ['#0E7C7B', '#12263A', '#FFE36E', '#E3F2F1'],
    titleFont: 'Lexend',
    deckCount: 24,
    learning: null,
    primaryHex: '#0E7C7B',
    tintHex: '#D6F0EE',
    updatedAt: '2026-10-01T08:00:00.000Z',
    ...over
  }
}

export const CONNECTED: AiStatus = {
  hasKey: true,
  keyLast4: 'WXYZ',
  model: 'opus-5.5',
  lastTest: { result: 'connected', at: '2026-10-05T08:00:00.000Z' },
  encryptionAvailable: true
}
export const NOT_CONNECTED: AiStatus = {
  hasKey: false,
  keyLast4: null,
  model: 'opus-5.5',
  lastTest: null,
  encryptionAvailable: true
}
