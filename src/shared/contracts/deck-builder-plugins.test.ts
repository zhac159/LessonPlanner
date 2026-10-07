import { describe, expect, it } from 'vitest'
import { ok } from '../result'
import { invalidChannels } from './channelPattern.test'
import {
  PLUGINS_EVENTS,
  PLUGINS_METHODS,
  type PluginInput,
  type PluginManifestView,
  type PluginsApi,
  type PluginSummary
} from './deck-builder-plugins'

const inputs = [
  { id: 'slides', type: 'slideRange', label: 'Which slides?', default: 'all' },
  {
    id: 'count',
    type: 'number',
    label: 'How many questions?',
    min: 3,
    max: 30,
    step: 1,
    default: 10,
    decrementLabel: 'Fewer questions',
    incrementLabel: 'More questions'
  },
  {
    id: 'types',
    type: 'multi',
    label: 'Question types',
    options: [{ value: 'mcq', label: 'Multiple choice' }],
    default: ['mcq'],
    minSelected: 1
  },
  {
    id: 'difficulty',
    type: 'choice',
    label: 'Difficulty',
    options: [{ value: 'mixed', label: 'Mixed', description: 'A bit of everything' }],
    default: 'mixed'
  },
  { id: 'topic', type: 'text', label: 'Topic', multiline: true, maxLength: 200 },
  { id: 'answers', type: 'boolean', label: 'Include answers', default: true }
] satisfies PluginInput[]

describe('deck-builder plugins area', () => {
  it('uses valid, unique channel and event names', () => {
    expect(invalidChannels(PLUGINS_METHODS)).toEqual([])
    expect(invalidChannels(PLUGINS_EVENTS)).toEqual([])
  })

  it('covers every input type of the plugin sheet', () => {
    expect(inputs.map((input) => input.type).sort()).toEqual(
      ['boolean', 'choice', 'multi', 'number', 'slideRange', 'text'].sort()
    )
  })

  it('describes a registry row and a manifest', () => {
    const summary = {
      id: 'quiz',
      name: 'Quiz',
      description: 'Make a quiz from your slides',
      icon: 'list-checks',
      tint: 'sky',
      scope: 'slides',
      hasInputs: true,
      needsSlides: true,
      order: 1
    } satisfies PluginSummary
    const manifest = {
      id: summary.id,
      name: summary.name,
      title: 'Make a quiz',
      description: summary.description,
      icon: summary.icon,
      tint: summary.tint,
      scope: summary.scope,
      inputs,
      output: ['slides', 'file'],
      action: 'Make quiz',
      needsSlides: true
    } satisfies PluginManifestView
    expect(manifest.inputs).toHaveLength(6)
  })

  it('returns last-used inputs with the manifest', () => {
    const result: ReturnType<PluginsApi['plugins:getManifest']> = ok({
      manifest: {
        id: 'quiz',
        name: 'Quiz',
        title: 'Make a quiz',
        description: '',
        icon: 'x',
        tint: 'mint',
        scope: 'lesson',
        inputs: [],
        output: ['message'],
        action: 'Go',
        needsSlides: false
      },
      lastInputs: null
    })
    expect(result.ok && result.lastInputs).toBeNull()
  })
})
