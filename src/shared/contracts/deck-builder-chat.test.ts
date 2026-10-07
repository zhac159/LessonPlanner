import { describe, expect, it } from 'vitest'
import { fail, ok } from '../result'
import { invalidChannels } from './channelPattern.test'
import {
  CHAT_EVENTS,
  CHAT_METHODS,
  type ChatApi,
  type ChatEvents,
  type ChatItem,
  type ChatSendArgs,
  type RegionDraft
} from './deck-builder-chat'

describe('deck-builder chat area', () => {
  it('uses valid, unique channel and event names', () => {
    expect(invalidChannels(CHAT_METHODS)).toEqual([])
    expect(invalidChannels(CHAT_EVENTS)).toEqual([])
  })

  it('describes a circle-to-edit message', () => {
    const region = {
      id: 'r1',
      n: 1,
      slideId: 'sld_1',
      path: [
        [10, 10],
        [200, 10],
        [200, 120]
      ],
      bbox: { x: 10, y: 10, w: 190, h: 110 },
      targetElementIds: ['el_1']
    } satisfies RegionDraft
    const args = {
      lessonId: 'dck_1',
      text: 'Make this bigger',
      attachmentIds: [],
      regions: [region],
      markup: [{ slideId: 'sld_1', strokes: [region.path] }],
      selectedSlideId: 'sld_1',
      assetRefs: []
    } satisfies ChatSendArgs
    expect(args.regions[0]?.n).toBe(1)
  })

  it('pins the assets a message names to ids, and can ask for the picture-spots card', () => {
    const user = {
      id: 'm1',
      role: 'user',
      at: '2026-10-07T09:00:00Z',
      text: 'Put {{school_logo}} top right',
      assets: [{ assetId: 'ast_1', name: 'school_logo' }]
    } satisfies ChatItem
    const assistant = {
      id: 'm2',
      role: 'assistant',
      at: '2026-10-07T09:00:01Z',
      text: 'Done! I left a picture spot.',
      showSpots: true
    } satisfies ChatItem
    expect(user.assets[0].assetId).toBe('ast_1')
    expect(assistant.showSpots).toBe(true)
  })

  it('describes assistant items with a result chip, a file or an error action', () => {
    const items = [
      {
        id: 'm1',
        role: 'assistant',
        at: '2026-10-06T09:00:00Z',
        text: 'Done',
        result: {
          changeSetId: 'chg_1',
          label: 'Resized the photo',
          slideIds: ['sld_1'],
          undone: false
        }
      },
      {
        id: 'm2',
        role: 'assistant',
        at: '2026-10-06T09:01:00Z',
        text: '',
        error: { code: 'rate-limited', message: 'Busy', action: 'retry' }
      }
    ] satisfies ChatItem[]
    expect(items.map((i) => i.id)).toEqual(['m1', 'm2'])
  })

  it('types events by name so listeners get the right payload', () => {
    const delta = {
      lessonId: 'dck_1',
      messageId: 'm1',
      text: 'Hi'
    } satisfies ChatEvents['chat:delta']
    const error = {
      scope: 'plugin',
      code: 'overloaded',
      message: 'Try again',
      retryable: true
    } satisfies ChatEvents['ai:error']
    expect([delta.text, error.scope]).toEqual(['Hi', 'plugin'])
  })

  it('returns job handles or tells failures apart', () => {
    const sent: ReturnType<ChatApi['chat:send']>[] = [
      ok({ jobId: 'j1', messageId: 'm1' }),
      fail('no-key', 'Connect Claude first')
    ]
    expect(sent.map((r) => (r.ok ? r.jobId : r.code))).toEqual(['j1', 'no-key'])
  })
})
