import { describe, expect, it } from 'vitest'
import { bubblePathData, resolveTail, speechBubbleShape } from './speechBubble'

describe('speechBubbleShape', () => {
  const W = 660
  const H = 290

  it('puts the tail outside the body on the hinted edge', () => {
    const edges = {
      'bottom-left': (b: ReturnType<typeof speechBubbleShape>['bounds']) => b.maxY > H,
      'bottom-right': (b: ReturnType<typeof speechBubbleShape>['bounds']) => b.maxY > H,
      'top-left': (b: ReturnType<typeof speechBubbleShape>['bounds']) => b.minY < 0,
      'top-right': (b: ReturnType<typeof speechBubbleShape>['bounds']) => b.minY < 0,
      left: (b: ReturnType<typeof speechBubbleShape>['bounds']) => b.minX < 0,
      right: (b: ReturnType<typeof speechBubbleShape>['bounds']) => b.maxX > W
    } as const
    for (const [tail, outside] of Object.entries(edges)) {
      const { bounds } = speechBubbleShape(W, H, 28, tail as keyof typeof edges)
      expect(outside(bounds), tail).toBe(true)
    }
  })

  it('has no tail for "none": bounds are the body and the path is a closed rounded box', () => {
    const { bounds, path } = speechBubbleShape(W, H, 28, 'none')
    expect(bounds).toEqual({ minX: 0, minY: 0, maxX: W, maxY: H })
    expect(path.at(-1)).toEqual({ op: 'Z' })
    expect(path.filter((s) => s.op === 'Q')).toHaveLength(4)
  })

  it('stays well-formed for a tiny box and a huge radius', () => {
    const { path } = speechBubbleShape(40, 30, 500, 'bottom-left')
    expect(bubblePathData(path)).toMatch(/^M[\d.\- ]+ L/)
    for (const seg of path) {
      if (seg.op === 'Z') continue
      expect(Number.isFinite(seg.x) && Number.isFinite(seg.y)).toBe(true)
    }
  })

  it('writes SVG path data and shifts it by an offset', () => {
    const { path } = speechBubbleShape(W, H, 28, 'none')
    expect(bubblePathData(path)).toMatch(/^M28 0 L632 0 Q660 0 660 28/)
    expect(bubblePathData(path, 10, 20)).toMatch(/^M38 20 /)
  })
})

describe('resolveTail', () => {
  it('uses the hint, else bottom-left, else left when a bottom tail would leave the slide', () => {
    expect(resolveTail({ y: 100, h: 200, tail: 'top-right' })).toBe('top-right')
    expect(resolveTail({ y: 100, h: 200 })).toBe('bottom-left')
    expect(resolveTail({ y: 715, h: 290 })).toBe('left')
  })
})
