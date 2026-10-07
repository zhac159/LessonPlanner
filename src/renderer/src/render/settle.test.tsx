import { waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextFrame, waitUntilSettled } from './settle'

/** A promise the test resolves by hand. */
function deferred<T = void>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

/** True once `promise` has settled (checked after a few turns of the event loop). */
async function settledAfter(promise: Promise<unknown>, ms = 60): Promise<boolean> {
  let done = false
  void promise.then(() => (done = true))
  await new Promise((resolve) => setTimeout(resolve, ms))
  return done
}

function rootWithImage(complete: boolean): { root: HTMLElement; image: HTMLImageElement } {
  const root = document.createElement('div')
  const image = document.createElement('img')
  Object.defineProperty(image, 'complete', { value: complete, configurable: true })
  image.decode = () => Promise.resolve()
  root.append(image)
  return { root, image }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  Reflect.deleteProperty(document, 'fonts')
})

describe('nextFrame', () => {
  it('resolves on the next animation frame', async () => {
    await expect(nextFrame()).resolves.toBeUndefined()
  })

  it('does not hang when frames are not delivered', async () => {
    vi.useFakeTimers()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0)
    const frame = nextFrame()
    await vi.advanceTimersByTimeAsync(100)
    await expect(frame).resolves.toBeUndefined()
  })
})

describe('waitUntilSettled', () => {
  it('waits for the fonts to load before settling', async () => {
    const fonts = deferred()
    const settled = waitUntilSettled(document.createElement('div'), {
      loadFonts: () => fonts.promise
    })
    expect(await settledAfter(settled)).toBe(false)
    fonts.resolve()
    await expect(settled).resolves.toBeUndefined()
  })

  it('carries on with the fallback fonts when loading fails', async () => {
    await expect(
      waitUntilSettled(document.createElement('div'), {
        loadFonts: () => Promise.reject(new Error('no such font'))
      })
    ).resolves.toBeUndefined()
  })

  it('waits for document.fonts.ready', async () => {
    const ready = deferred()
    Object.defineProperty(document, 'fonts', {
      value: { ready: ready.promise },
      configurable: true
    })
    const settled = waitUntilSettled(document.createElement('div'), {
      loadFonts: async () => undefined
    })
    expect(await settledAfter(settled)).toBe(false)
    ready.resolve()
    await expect(settled).resolves.toBeUndefined()
  })

  it('waits for pictures that are still loading', async () => {
    const { root, image } = rootWithImage(false)
    const listening = vi.spyOn(image, 'addEventListener')
    const settled = waitUntilSettled(root, { loadFonts: async () => undefined })
    await waitFor(() => expect(listening).toHaveBeenCalled())
    expect(await settledAfter(settled)).toBe(false)
    image.dispatchEvent(new Event('load'))
    await expect(settled).resolves.toBeUndefined()
  })

  it('treats a picture that fails to load as settled', async () => {
    const { root, image } = rootWithImage(false)
    const listening = vi.spyOn(image, 'addEventListener')
    const settled = waitUntilSettled(root, { loadFonts: async () => undefined })
    await waitFor(() => expect(listening).toHaveBeenCalled())
    image.dispatchEvent(new Event('error'))
    await expect(settled).resolves.toBeUndefined()
  })

  it('does not wait for pictures that are already complete, even if decoding fails', async () => {
    const { root, image } = rootWithImage(true)
    image.decode = () => Promise.reject(new Error('broken'))
    await expect(
      waitUntilSettled(root, { loadFonts: async () => undefined })
    ).resolves.toBeUndefined()
  })

  it('gives up on a picture that never loads after the image timeout', async () => {
    const { root } = rootWithImage(false)
    const started = Date.now()
    await waitUntilSettled(root, { loadFonts: async () => undefined, imageTimeoutMs: 40 })
    expect(Date.now() - started).toBeGreaterThanOrEqual(35)
  })

  it('copes with a browser that has no decode()', async () => {
    const { root, image } = rootWithImage(true)
    Reflect.deleteProperty(image, 'decode')
    await expect(
      waitUntilSettled(root, { loadFonts: async () => undefined })
    ).resolves.toBeUndefined()
  })
})
