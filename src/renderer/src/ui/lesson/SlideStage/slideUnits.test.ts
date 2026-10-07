import { describe, expect, it } from 'vitest'
import { clientToSlide } from './slideUnits'

const rect = { left: 100, top: 50, width: 960, height: 540 }

describe('clientToSlide', () => {
  it('maps the corners of the stage to the corners of the slide', () => {
    expect(clientToSlide({ x: 100, y: 50 }, rect)).toEqual({ x: 0, y: 0 })
    expect(clientToSlide({ x: 1060, y: 590 }, rect)).toEqual({ x: 1920, y: 1080 })
  })

  it('scales the middle', () => {
    expect(clientToSlide({ x: 580, y: 320 }, rect)).toEqual({ x: 960, y: 540 })
  })

  it('does not clamp positions outside the stage', () => {
    expect(clientToSlide({ x: 0, y: 590 + 54 }, rect)).toEqual({ x: -200, y: 1188 })
  })

  it('returns the origin for a stage that has no size yet', () => {
    expect(clientToSlide({ x: 10, y: 10 }, { left: 0, top: 0, width: 0, height: 0 })).toEqual({
      x: 0,
      y: 0
    })
  })
})
