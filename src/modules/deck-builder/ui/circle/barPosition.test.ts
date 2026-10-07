import { describe, expect, it } from 'vitest'
import { BAR_HEIGHT, BAR_WIDTH, barPosition } from './barPosition'

const stage = { width: 900, height: 506 }

describe('barPosition', () => {
  it('sits below the loop, its right edge at the loop’s right edge', () => {
    const at = barPosition({ x: 700, y: 300, w: 500, h: 400 }, 0.46875, stage)
    expect(at.left).toBeCloseTo(1200 * 0.46875)
    expect(at.top).toBeCloseTo(700 * 0.46875 + 8)
  })
  it('flips above the loop near the bottom edge', () => {
    const at = barPosition({ x: 700, y: 700, w: 400, h: 350 }, 0.46875, stage)
    expect(at.top).toBeLessThan(700 * 0.46875)
    expect(at.top + BAR_HEIGHT).toBeLessThanOrEqual(700 * 0.46875)
  })
  it('never leaves the stage sideways', () => {
    const farLeft = barPosition({ x: 0, y: 100, w: 100, h: 100 }, 0.46875, stage)
    expect(farLeft.left).toBe(BAR_WIDTH)
    const farRight = barPosition({ x: 1800, y: 100, w: 400, h: 100 }, 0.46875, stage)
    expect(farRight.left).toBe(stage.width)
  })
})
