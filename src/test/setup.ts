// Setup for the `component` Vitest project (happy-dom).
import '@testing-library/jest-dom/vitest'
import { act, cleanup, configure, getConfig } from '@testing-library/react'
import { afterEach } from 'vitest'

// findBy*/waitFor default to 1 s: too tight under load.
configure({ asyncUtilTimeout: 5000 })

// A `findBy*`/`waitFor`/`user.*` call resolves as soon as the DOM is right, which can be BEFORE React has run the
// passive effects of that commit (they are scheduled on a macrotask, and Testing Library only drains with a
// `setTimeout(0)`, which under load can fire first). Effects are where components subscribe to events, so a test that
// emits an event right after `await screen.findBy...` lost it, and a test that typed into a field right after
// mounting could have its input overwritten by a late "sync state from props" effect. Flushing the effects before
// the call returns makes the order the same as in the app, where effects have always run before the next user action.
const { asyncWrapper } = getConfig()
configure({
  asyncWrapper: async (callback) => {
    const result = await asyncWrapper(callback)
    await act(async () => {})
    return result
  }
})

afterEach(() => {
  cleanup()
})

// happy-dom has no layout engine: give components that measure themselves something sane.
if (typeof window !== 'undefined' && !('ResizeObserver' in window)) {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  Object.assign(window, { ResizeObserver: ResizeObserverStub })
}
