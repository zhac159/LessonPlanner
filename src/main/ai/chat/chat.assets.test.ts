/** The chat's asset tools against the scripted SDK stub: offered only with a library, catalogue in the prompt, results. */
import { describe, expect, it, vi } from 'vitest'
import type { AssetFact, ChatAssets, ChatSink, PlaceToolArgs } from '@shared/ai/types'
import type { ChangeSet } from '@shared/deck/types'
import { defaultDeps, type CallDeps } from '../calls/deps'
import { fixtureProfile } from '../fake/fixtures'
import { buildAssetCatalogue } from '../prompts/assets'
import { createRig, textMessage, toolUse, toolUseMessage, type StubReply } from '../testing'
import { chatTurn } from './loop'
import { toolsFor } from './tools'

type Input = Parameters<typeof chatTurn>[1]

const LOGO: AssetFact = {
  id: 'ast_logo',
  name: 'school_logo',
  title: 'School logo',
  kind: 'logo',
  description: 'Navy crest',
  tags: ['school'],
  width: 400,
  height: 400,
  vector: false
}

const changeSet: ChangeSet = {
  id: 'cs_9',
  by: 'ai',
  summary: 'Added school_logo to slide 1',
  ops: [],
  at: '2026-10-07T10:00:00Z'
}

function setup(script: StubReply[], assets?: Partial<ChatAssets>) {
  const rig = createRig(script)
  const deps: CallDeps = { ...defaultDeps(rig.runner), now: () => new Date('2026-10-07T10:00:00Z') }
  const events: string[] = []
  const sink: ChatSink = {
    delta: () => undefined,
    status: (s, state) => events.push(`${s}:${state}`),
    changes: (c) => events.push(`changes:${c.id}`)
  }
  const place = vi.fn(async (_args: PlaceToolArgs) => ({
    ok: true as const,
    changeSet,
    elementId: 'el_7',
    placed: { x: 1632, y: 48, w: 240, h: 240 }
  }))
  const list = vi.fn((_q: { query: string; kind: string }) => [LOGO])
  const library: ChatAssets = {
    catalogue: buildAssetCatalogue([]),
    list,
    place,
    ...assets
  }
  const input: Input = {
    lessonId: 'l1',
    messageId: 'm1',
    text: 'Put {{school_logo}} top right',
    profile: fixtureProfile(),
    deckOutline: {},
    history: [],
    applyOps: vi.fn(async () => ({ ok: true as const, changeSetId: 'x' })),
    readSlides: vi.fn(() => []),
    viewSlide: vi.fn(async () => new Uint8Array([1])),
    assets: library
  }
  return { rig, deps, sink, events, input, place, list }
}

const placeCall = (over: Record<string, unknown> = {}) =>
  toolUseMessage([
    toolUse('tu_1', 'place_asset', {
      asset: 'school_logo',
      slideId: 's1',
      anchor: 'top-right',
      boxX: 0,
      boxY: 0,
      boxW: 0,
      boxH: 0,
      region: 0,
      spot: '',
      widthUnits: 0,
      fit: 'fit',
      replaceUnder: false,
      ...over
    })
  ])

describe('the asset tools', () => {
  it('are offered after apply_changes only when the turn has a library, before the plugin tools', () => {
    expect(toolsFor(false).map((t) => t.name)).toEqual([
      'read_slides',
      'view_slide',
      'apply_changes'
    ])
    expect(toolsFor(true, true).map((t) => t.name)).toEqual([
      'read_slides',
      'view_slide',
      'apply_changes',
      'list_assets',
      'place_asset',
      'run_plugin',
      'list_plugins'
    ])
    const place = toolsFor(false, true).find((t) => t.name === 'place_asset') as unknown as {
      strict: boolean
      input_schema: { required: string[]; properties: object; additionalProperties: boolean }
    }
    expect(place.strict).toBe(true)
    expect(place.input_schema.additionalProperties).toBe(false)
    // Strict schemas need every property listed as required.
    expect(place.input_schema.required.sort()).toEqual(
      Object.keys(place.input_schema.properties).sort()
    )
  })

  it('put the catalogue in its own cached system part, after the profile', async () => {
    const catalogue = buildAssetCatalogue([
      {
        id: 'ast_logo',
        name: 'school_logo',
        title: 'School logo',
        kind: 'logo',
        description: 'Navy crest',
        tags: ['school'],
        source: { kind: 'uploaded', fileName: 'a.png', at: '2026-10-07T09:00:00.000Z' },
        licence: { id: 'own', label: 'Yours', requiresCredit: false },
        credit: null,
        file: {
          ext: '.png',
          width: 400,
          height: 400,
          bytes: 1,
          sha256: 'a',
          phash: null,
          vector: false
        },
        foundIn: [],
        usedIn: [],
        lastUsedAt: null,
        createdAt: '2026-10-07T09:00:00.000Z',
        updatedAt: '2026-10-07T09:00:00.000Z'
      }
    ])
    const { rig, deps, sink, input } = setup([textMessage('ok')], { catalogue })
    await chatTurn(deps, input, sink)
    const request = rig.stub.requests[0]
    const system = request.system as Array<{ text: string; cache_control?: unknown }>
    expect(system).toHaveLength(3)
    expect(system[1].text).toContain('Style profile')
    expect(system[2].text).toContain('school_logo · logo · School logo · Navy crest')
    expect(system[2].cache_control).toEqual({ type: 'ephemeral' })
    expect(system[0].text).toContain('"{{name}}" in her message is one of her assets')
    expect((request.tools as Array<{ name: string }>).map((t) => t.name)).toContain('place_asset')
  })

  it('place_asset applies ONE change through the host and tells Claude where the picture went', async () => {
    const { rig, deps, sink, input, place, events } = setup([placeCall(), textMessage('Done')])
    await chatTurn(deps, input, sink)
    expect(place).toHaveBeenCalledTimes(1)
    expect(place.mock.calls[0][0]).toMatchObject({
      asset: 'school_logo',
      anchor: 'top-right',
      region: 0
    })
    expect(events).toContain('changes:cs_9')
    expect(events).toContain('Placing the picture:done')
    const result = JSON.stringify(rig.stub.requests[1].messages.at(-1))
    expect(result).toContain('el_7')
    expect(result).toContain('cs_9')
  })

  it('gives a refusal back as an error result Claude can act on, not as a thrown failure', async () => {
    const { rig, deps, sink, input, events } = setup(
      [placeCall({ asset: 'owl' }), textMessage('Sorry')],
      {
        place: async () => ({ ok: false, error: 'No asset called owl.' })
      }
    )
    await expect(chatTurn(deps, input, sink)).resolves.toMatchObject({ usage: expect.anything() })
    const last = rig.stub.requests[1].messages.at(-1)?.content as Array<{
      content: string
      is_error?: boolean
    }>
    expect(last[0]).toMatchObject({ content: 'No asset called owl.', is_error: true })
    expect(events).toContain('Placing the picture:error')
    expect(events.some((e) => e.startsWith('changes:'))).toBe(false)
  })

  it('rejects a place_asset call with the wrong shape without calling the host', async () => {
    const { rig, deps, sink, input, place } = setup([
      placeCall({ anchor: 'middle' }),
      textMessage('ok')
    ])
    await chatTurn(deps, input, sink)
    expect(place).not.toHaveBeenCalled()
    const last = rig.stub.requests[1].messages.at(-1)?.content as Array<{ content: string }>
    expect(last[0].content).toContain('Invalid input: anchor')
  })

  it('list_assets answers names, kinds, titles, descriptions and tags only', async () => {
    const { rig, deps, sink, input, list } = setup([
      toolUseMessage([toolUse('tu_2', 'list_assets', { query: 'logo', kind: 'any' })]),
      textMessage('Found it')
    ])
    await chatTurn(deps, input, sink)
    expect(list).toHaveBeenCalledWith({ query: 'logo', kind: 'any' })
    const last = rig.stub.requests[1].messages.at(-1)?.content as Array<{ content: string }>
    expect(JSON.parse(last[0].content)).toEqual({
      assets: [
        {
          name: 'school_logo',
          kind: 'logo',
          title: 'School logo',
          description: 'Navy crest',
          tags: ['school']
        }
      ]
    })
  })

  it('without a library the asset tools do not exist and a stray call is an unknown tool', async () => {
    const { rig, deps, sink, input } = setup([placeCall(), textMessage('ok')])
    delete input.assets
    await chatTurn(deps, input, sink)
    const last = rig.stub.requests[1].messages.at(-1)?.content as Array<{ content: string }>
    expect(last[0].content).toBe('Unknown tool: place_asset')
  })
})
