import { afterEach, describe, expect, it } from 'vitest'
import type { RenderBridge } from '@shared/annotate/renderJob'
import { getRenderBridge } from './bridge'

afterEach(() => {
  delete window.slideRender
})

describe('getRenderBridge', () => {
  it('returns the bridge the render preload exposes', () => {
    const bridge: RenderBridge = {
      onJob: () => () => undefined,
      listening: () => undefined,
      report: () => undefined
    }
    window.slideRender = bridge
    expect(getRenderBridge()).toBe(bridge)
  })

  it('explains the problem when the page is opened outside the render window', () => {
    expect(() => getRenderBridge()).toThrow(/render window/)
  })
})
