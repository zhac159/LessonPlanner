/** Request shape and result mapping for the single-shot calls, against a scripted SDK stub (no network). */
import Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { fixtureProfile } from '../fake/fixtures'
import { sampleSlideWire, sampleStyleDraft } from '../sampleDrafts'
import { FALLBACK_BETA } from '../request'
import { createRig, jsonMessage, textMessage } from '../testing'
import { testConnection } from './connection'
import { defaultDeps, type CallDeps } from './deps'
import { extractObjectives } from './objectives'
import { analyseStyleFile } from './styleFile'
import { applyStyleCorrection, synthesiseProfile } from './styleProfile'
import { structured } from './structured'

const depsFor = (script: Parameters<typeof createRig>[0]) => {
  const rig = createRig(script)
  const deps: CallDeps = {
    ...defaultDeps(rig.runner),
    now: () => new Date('2026-10-06T10:00:00Z'),
    newId: (p) => `${p}_x`
  }
  return { rig, deps }
}

const emptyAnalysis = {
  colors: [{ hex: '#0E9AA7', role: 'accent', evidence: 'p1', frequency: 'most' }],
  fonts: [],
  layouts: [],
  decorations: [],
  slideKinds: [],
  voice: { rules: [], phrases: [], spelling: 'en-GB' },
  habits: [],
  exemplarCandidates: [],
  problems: []
}

describe('testConnection', () => {
  it('sends a tiny, cheap, non-retrying request and reports the model and latency', async () => {
    const rig = createRig([textMessage('ok')])
    const result = await testConnection(rig.runner, { model: 'claude-sonnet-5-5' })
    expect(result).toMatchObject({ model: 'claude-sonnet-5-5' })
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    const [request] = rig.stub.requests
    expect(request).toMatchObject({
      model: 'claude-sonnet-5-5',
      max_tokens: 16,
      output_config: { effort: 'low' }
    })
    expect(request.fallbacks).toBeUndefined()
    expect(rig.stub.options[0].timeout).toBe(15_000)
    expect(rig.usage[0].task).toBe('testConnection')
  })

  it('does not retry or enlarge: a cut-off one-word answer still proves the connection', async () => {
    const rig = createRig([textMessage('o', { stop: 'max_tokens' })])
    await expect(testConnection(rig.runner)).resolves.toMatchObject({ model: 'claude-opus-5-5' })
    expect(rig.stub.requests).toHaveLength(1)
  })

  it('fails fast on a rate limit (no waiting while the teacher watches a spinner)', async () => {
    const rig = createRig([Anthropic.APIError.generate(429, {}, 'slow', new Headers())])
    await expect(testConnection(rig.runner)).rejects.toBeInstanceOf(Anthropic.RateLimitError)
    expect(rig.waits).toEqual([])
  })
})

describe('analyseStyleFile', () => {
  it('sends a PDF as a base64 document block before the instructions, structured, medium effort', async () => {
    const { rig, deps } = depsFor([jsonMessage(emptyAnalysis)])
    const result = await analyseStyleFile(deps, {
      kind: 'pdf',
      fileName: 'Y8.pdf',
      pdf: new Uint8Array([37, 80, 68, 70])
    })
    expect(result.analysis.colors).toHaveLength(1)
    const [request] = rig.stub.requests
    const content = request.messages[0].content as Array<{
      type: string
      source?: { data: string; media_type: string }
      text?: string
    }>
    expect(content[0]).toMatchObject({
      type: 'document',
      source: { media_type: 'application/pdf', data: 'JVBERg==' }
    })
    expect(content[1].text).toContain('Y8.pdf')
    expect(request.output_config).toMatchObject({
      effort: 'medium',
      format: { type: 'json_schema' }
    })
    expect(request.betas).toEqual([FALLBACK_BETA])
    expect(rig.stub.streamed).toEqual([false])
  })

  it('sends a pptx digest as stable JSON text', async () => {
    const { rig, deps } = depsFor([jsonMessage(emptyAnalysis)])
    await analyseStyleFile(deps, { kind: 'pptx', fileName: 'a.pptx', digest: { z: 1, a: 2 } })
    const content = rig.stub.requests[0].messages[0].content as Array<{ text: string }>
    expect(content[0].text).toContain('{"a":2,"z":1}')
  })

  it('refuses oversized PDFs without calling the API', async () => {
    const { rig, deps } = depsFor([])
    await expect(
      analyseStyleFile(deps, {
        kind: 'pdf',
        fileName: 'big.pdf',
        pdf: new Uint8Array(25 * 1024 * 1024)
      })
    ).rejects.toMatchObject({ failure: { code: 'too-large' } })
    expect(rig.stub.requests).toHaveLength(0)
  })
})

describe('extractObjectives', () => {
  const reply = {
    title: 'Y8 Science',
    subject: 'Science',
    yearGroup: '',
    objectives: ['Describe it'],
    context: ''
  }

  it('reads pasted text at low effort and maps empty strings away', async () => {
    const { rig, deps } = depsFor([jsonMessage(reply)])
    const { extracted } = await extractObjectives(deps, { text: 'LO1 Describe it' })
    expect(extracted).toEqual({
      title: 'Y8 Science',
      subject: 'Science',
      objectives: ['Describe it']
    })
    expect(rig.stub.requests[0].output_config?.effort).toBe('low')
  })

  it('puts a PDF first, then digest, text and the instructions', async () => {
    const { rig, deps } = depsFor([jsonMessage(reply)])
    await extractObjectives(deps, { text: 'notes', pdf: new Uint8Array([1]), pptxDigest: { a: 1 } })
    const types = (rig.stub.requests[0].messages[0].content as Array<{ type: string }>).map(
      (b) => b.type
    )
    expect(types).toEqual(['document', 'text', 'text', 'text'])
  })

  it('rejects empty input before calling the API', async () => {
    const { rig, deps } = depsFor([])
    await expect(extractObjectives(deps, { text: '   ' })).rejects.toMatchObject({
      failure: { code: 'invalid-input' }
    })
    expect(rig.stub.requests).toHaveLength(0)
  })
})

/** The two replies of synthesiseProfile: the core (everything but layouts), then the layouts and the test slide. */
function styleReplies(): ReturnType<typeof textMessage>[] {
  const { layouts, testSlide, ...core } = sampleStyleDraft()
  return [textMessage(JSON.stringify(core)), textMessage(JSON.stringify({ layouts, testSlide }))]
}

describe('synthesiseProfile', () => {
  it('streams at high effort, builds a valid profile and a test slide, and reports partials', async () => {
    const { rig, deps } = depsFor(styleReplies())
    const partials: Array<Record<string, unknown>> = []
    const { profile, testSlide } = await synthesiseProfile(
      deps,
      { name: 'Science KS3', analyses: [] },
      { onPartial: (p) => partials.push(p) }
    )
    expect(rig.stub.streamed).toEqual([true, true])
    expect(rig.stub.requests[0].output_config?.effort).toBe('high')
    // step 2 sees the step-1 profile and asks only for layouts + test slide
    expect(JSON.stringify(rig.stub.requests[1].messages)).toContain('STEP 2 of 2')
    expect(JSON.stringify(rig.stub.requests[1].output_config?.format)).toContain('testSlide')
    expect(JSON.stringify(rig.stub.requests[0].output_config?.format)).not.toContain('testSlide')
    expect(profile).toMatchObject({
      id: 'sty_x',
      name: 'Science KS3',
      version: 1,
      status: 'ready',
      createdAt: '2026-10-06T10:00:00.000Z'
    })
    expect(testSlide.id).toBe('sld_x')
    expect(testSlide.elements.length).toBeGreaterThan(0)
    expect(partials.length).toBeGreaterThan(0)
    expect(Object.keys(partials.at(-1) ?? {})).toContain('tokens')
  })

  it('works without an onPartial listener and refines an existing profile', async () => {
    const existing = fixtureProfile()
    const { rig, deps } = depsFor(styleReplies())
    const { profile } = await synthesiseProfile(deps, { name: 'Renamed', analyses: [], existing })
    expect(profile).toMatchObject({
      id: existing.id,
      version: existing.version + 1,
      name: 'Renamed'
    })
    const sent = JSON.stringify(rig.stub.requests[0].messages)
    expect(sent).toContain('already has this profile')
  })
})

describe('applyStyleCorrection', () => {
  const profile = fixtureProfile()
  const reply = (patch: Array<{ op: string; path: string; valueJson: string }>) =>
    jsonMessage({ patch, message: 'Made the accent darker.' })

  it('applies the patch to a copy, bumps version and records the correction', async () => {
    const { deps } = depsFor([
      reply([{ op: 'replace', path: '/tokens/colors/accent/hex', valueJson: '"#0A6B73"' }])
    ])
    const result = await applyStyleCorrection(deps, { profile, correction: 'make the teal darker' })
    expect(result.message).toBe('Made the accent darker.')
    expect(result.profile.tokens.colors.accent.hex).toBe('#0A6B73')
    expect(result.profile.version).toBe(profile.version + 1)
    expect(result.profile.corrections.at(-1)).toMatchObject({
      text: 'make the teal darker',
      appliedInVersion: profile.version + 1
    })
    expect(profile.tokens.colors.accent.hex).not.toBe('#0A6B73')
  })

  it('refuses patches outside the editable sections', async () => {
    const { deps } = depsFor([reply([{ op: 'replace', path: '/id', valueJson: '"hacked"' }])])
    await expect(applyStyleCorrection(deps, { profile, correction: 'x' })).rejects.toMatchObject({
      failure: { code: 'invalid-input' }
    })
  })

  it('refuses patches that break the profile schema or do not apply', async () => {
    const broken = depsFor([
      reply([{ op: 'replace', path: '/tokens/colors/accent/hex', valueJson: '"not a colour"' }])
    ])
    await expect(
      applyStyleCorrection(broken.deps, { profile, correction: 'x' })
    ).rejects.toMatchObject({ failure: { code: 'invalid-input' } })
    const missing = depsFor([
      reply([{ op: 'replace', path: '/tokens/colors/nope/hex', valueJson: '"#000000"' }])
    ])
    await expect(
      applyStyleCorrection(missing.deps, { profile, correction: 'x' })
    ).rejects.toMatchObject({ failure: { code: 'invalid-input' } })
  })

  it('sends the profile and the correction, low effort', async () => {
    const { rig, deps } = depsFor([reply([])])
    await applyStyleCorrection(deps, { profile, correction: 'bigger titles' })
    const sent = JSON.stringify(rig.stub.requests[0].messages)
    expect(sent).toContain('bigger titles')
    expect(sent).toContain('Science KS3')
    expect(rig.stub.requests[0].output_config?.effort).toBe('low')
  })
})

describe('structured', () => {
  const schema = z.object({ questions: z.array(z.string()) })

  it('returns schema-checked data and usage, with the profile in the cached prefix', async () => {
    const { rig, deps } = depsFor([
      jsonMessage({ questions: ['Q1'] }, { usage: { input: 7, output: 3 } })
    ])
    const result = await structured(deps, {
      instructions: 'Write a quiz.',
      profile: fixtureProfile(),
      prompt: 'Slides: ...',
      schema,
      effort: 'low'
    })
    expect(result.data).toEqual({ questions: ['Q1'] })
    expect(result.usage).toMatchObject({ inputTokens: 7, outputTokens: 3 })
    const request = rig.stub.requests[0]
    expect(request.output_config?.effort).toBe('low')
    expect(rig.usage[0].task).toBe('plugin')
    const system = request.system as Array<{ text: string; cache_control?: unknown }>
    expect(system).toHaveLength(2)
    expect(system[0].text).toContain('Write a quiz.')
    expect(system[1].cache_control).toEqual({ type: 'ephemeral' })
  })

  it('sends images before the prompt and defaults to medium effort', async () => {
    const { rig, deps } = depsFor([jsonMessage({ questions: [] })])
    await structured(deps, {
      instructions: 'i',
      prompt: 'p',
      schema,
      images: [new Uint8Array([1, 2])]
    })
    const content = rig.stub.requests[0].messages[0].content as Array<{ type: string }>
    expect(content.map((b) => b.type)).toEqual(['image', 'text'])
    expect(rig.stub.requests[0].output_config?.effort).toBe('medium')
  })

  it('fails with unknown when the reply does not match the schema', async () => {
    const { deps } = depsFor([jsonMessage({ nope: true })])
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(
      structured(deps, { instructions: 'i', prompt: 'p', schema })
    ).rejects.toMatchObject({ failure: { code: 'unknown' } })
    spy.mockRestore()
  })
})

describe('slide wire sample', () => {
  it('is itself valid JSON for the slide schema (guards the fixtures used above)', () => {
    expect(sampleSlideWire().elements).toHaveLength(2)
  })
})
