/** The writer's slide shape: assets by name, picture spots with hints, the speech-bubble tail. */
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { describe, expect, it } from 'vitest'
import type { AssetFact } from '@shared/ai/types'
import type { CalloutElement, ImageElement } from '@shared/deck/types'
import { wireElement } from '../sampleDrafts'
import { checkedSlide, slideWire, toSlide, writerSlideWire, type WriterSlideWire } from './slide'

const LOGO: AssetFact = {
  id: 'ast_logo',
  name: 'school_logo',
  title: 'School logo',
  kind: 'logo',
  description: 'Navy crest',
  tags: [],
  width: 400,
  height: 200,
  vector: false
}
const assets = { find: (name: string) => (name.toLowerCase() === 'school_logo' ? LOGO : undefined) }

const writerElement = (over: Record<string, unknown>) => ({
  ...wireElement({ type: 'image' }),
  assetName: '',
  spotKind: '',
  spotQuery: '',
  tail: '',
  ...over
})

const slideOf = (...elements: ReturnType<typeof writerElement>[]): WriterSlideWire => ({
  kind: 'title',
  layoutId: '',
  background: '',
  notes: '',
  elements: elements as WriterSlideWire['elements']
})

const first = (wire: WriterSlideWire, withAssets = true) =>
  toSlide(wire, 's1', withAssets ? assets : undefined).elements[0]

describe('image elements written by name', () => {
  it('place a known asset: its id, name and title, its own shape inside the box, never locked', () => {
    const wire = slideOf(
      writerElement({
        assetName: 'School_Logo',
        x: 1600,
        y: 40,
        w: 240,
        h: 240,
        locked: true,
        description: 'ignored',
        radius: 24,
        fit: 'cover'
      })
    )
    const element = first(wire) as ImageElement
    expect(element).toMatchObject({
      type: 'image',
      assetId: 'ast_logo',
      name: 'school_logo',
      alt: 'School logo',
      fit: 'contain'
    })
    expect(element.placeholder).toBeUndefined()
    expect(element.locked).toBeUndefined()
    // A 2:1 logo in a 240 x 240 box keeps its shape: wider than high, inside the box (no stretching).
    expect(element.w / element.h).toBeCloseTo(2)
    expect(element.x).toBeGreaterThanOrEqual(1600)
    expect(element.x + element.w).toBeLessThanOrEqual(1840)
    // A logo keeps its own frame: the corner radius is dropped.
    expect(element.radius).toBeUndefined()
  })

  it('turn an unknown name into a picture spot that carries the name as its description', () => {
    const element = first(slideOf(writerElement({ assetName: 'owl_mascot' }))) as ImageElement
    expect(element.assetId).toBeUndefined()
    expect(element.placeholder).toEqual({ description: 'owl mascot' })
    expect(element.alt).toBe('owl mascot')
  })

  it('without any library every name is a spot, never an invented asset id', () => {
    const element = first(
      slideOf(writerElement({ assetName: 'school_logo' })),
      false
    ) as ImageElement
    expect(element.assetId).toBeUndefined()
    expect(element.placeholder?.description).toBe('school logo')
  })
})

describe('picture spots', () => {
  it('keep the description, a valid kind and the search words, and drop what is empty', () => {
    const spot = first(
      slideOf(
        writerElement({
          description: 'A leaf in sunlight, close up',
          spotKind: 'Photo',
          spotQuery: ' leaf sunlight macro ',
          alt: 'A leaf',
          radius: 12
        })
      )
    ) as ImageElement
    expect(spot).toMatchObject({
      alt: 'A leaf',
      fit: 'cover',
      radius: 12,
      placeholder: {
        description: 'A leaf in sunlight, close up',
        kind: 'photo',
        query: 'leaf sunlight macro'
      }
    })
    const plain = first(slideOf(writerElement({ description: 'A beaker', spotKind: 'sticker' })))
    expect((plain as ImageElement).placeholder).toEqual({ description: 'A beaker' })
  })

  it('make a slide the app accepts, and the deck schema keeps the hints', () => {
    const slide = checkedSlide(
      slideOf(
        writerElement({
          description: 'Roots drinking water',
          spotKind: 'diagram',
          spotQuery: 'roots'
        })
      ),
      'sld_1',
      assets
    )
    expect((slide.elements[0] as ImageElement).placeholder).toEqual({
      description: 'Roots drinking water',
      kind: 'diagram',
      query: 'roots'
    })
  })
})

describe('speech-bubble tail', () => {
  const callout = (over: Record<string, unknown>) =>
    writerElement({ type: 'callout', variant: 'speech-bubble', paragraphs: [], ...over })

  it('is written for a speech bubble when it is one of the known edges', () => {
    const bubble = first(slideOf(callout({ tail: 'bottom-right' }))) as CalloutElement
    expect(bubble.tail).toBe('bottom-right')
    expect((first(slideOf(callout({ tail: 'none' }))) as CalloutElement).tail).toBe('none')
  })

  it('is left out when empty, unknown, or the callout is not a speech bubble', () => {
    expect((first(slideOf(callout({ tail: '' }))) as CalloutElement).tail).toBeUndefined()
    expect((first(slideOf(callout({ tail: 'upwards' }))) as CalloutElement).tail).toBeUndefined()
    expect(
      (first(slideOf(callout({ variant: 'warning', tail: 'left' }))) as CalloutElement).tail
    ).toBeUndefined()
  })
})

describe('the two wire shapes', () => {
  it('keep the four writer-only fields out of the style learner’s slide, so that grammar does not grow', () => {
    const keys = (schema: { shape: { elements: { element: { shape: object } } } }) =>
      Object.keys(schema.shape.elements.element.shape)
    const base = keys(slideWire as never)
    const writer = keys(writerSlideWire as never)
    expect(writer.filter((k) => !base.includes(k)).sort()).toEqual([
      'assetName',
      'spotKind',
      'spotQuery',
      'tail'
    ])
    expect(base).not.toContain('assetName')
  })

  it('stay flat: every writer field is required, and the JSON schema has no unions of objects', () => {
    const schema = zodOutputFormat(writerSlideWire).schema as unknown as {
      properties: {
        elements: { items: { required: string[]; properties: Record<string, unknown> } }
      }
    }
    const element = schema.properties.elements.items
    expect(element.required.sort()).toEqual(Object.keys(element.properties).sort())
    expect(JSON.stringify(schema)).not.toContain('anyOf')
    expect(JSON.stringify(schema)).not.toContain('oneOf')
  })
})
