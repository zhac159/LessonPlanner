import { describe, expect, it } from 'vitest'
import { isNeutralGrey, isNeutralTint, neutraliseColours } from './colours'

const colour = (hex: string, label = 'x', usage = '') => ({ hex, label, usage })

/** The palette the model returned for the teacher's example decks. */
const example = () => ({
  background: colour('#F8FFAE', 'Pale yellow'),
  text: colour('#000000', 'Black'),
  accent: colour('#CC0000', 'Red'),
  muted: colour('#00A651', 'Green', 'Occasional label colour'),
  placeholder: colour('#FFB800', 'Yellow-orange card', 'Verb symbol cards on one slide')
})

describe('neutraliseColours', () => {
  it('turns a green `muted` into a grey and keeps the green as a named extra', () => {
    const out = neutraliseColours(example())
    expect(isNeutralGrey(out.muted.hex)).toBe(true)
    expect(out.extra_green).toMatchObject({ hex: '#00A651', label: 'Green' })
    expect(out.extra_green.usage).toMatch(/one-off/)
  })

  it('turns an orange `placeholder` into a pale neutral tint of the background', () => {
    const out = neutraliseColours(example())
    expect(isNeutralTint(out.placeholder.hex)).toBe(true)
    expect(out.placeholder.hex).not.toBe('#FFB800')
    expect(out.extra_yellow_orange_card.hex).toBe('#FFB800')
  })

  it('leaves a grey `muted` and a pale grey `placeholder` exactly as they are', () => {
    const fine = {
      ...example(),
      muted: colour('#6B7280', 'Grey'),
      placeholder: colour('#F1F1F1', 'Pale grey')
    }
    expect(neutraliseColours(fine)).toEqual(fine)
  })

  it('drops a wrong colour that another token already has, and invents a grey when `muted` is missing', () => {
    const colours: Record<string, ReturnType<typeof colour>> = example()
    colours.muted = colour('#CC0000', 'Red again') // same hex as accent
    delete colours.placeholder
    const out = neutraliseColours(colours)
    expect(Object.keys(out).filter((k) => k.startsWith('extra_'))).toEqual([])
    expect(isNeutralGrey(out.muted.hex)).toBe(true)
    expect(isNeutralTint(out.placeholder.hex)).toBe(true)
  })

  it('keeps a tint that suits a dark background light enough to read as a tint', () => {
    const out = neutraliseColours({
      background: colour('#101820'),
      text: colour('#FFFFFF'),
      placeholder: colour('#FF0000')
    })
    expect(isNeutralTint(out.placeholder.hex)).toBe(true)
  })

  it('numbers extras that would collide', () => {
    const out = neutraliseColours({
      ...example(),
      extra_green: colour('#123456'),
      muted: colour('#00A651', 'Green')
    })
    expect(out.extra_green_2?.hex).toBe('#00A651')
  })
})
