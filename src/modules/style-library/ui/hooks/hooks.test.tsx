import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ClientsProvider } from '@renderer/core/ClientsContext'
import { createFakeClients } from '@test/render'
import { fakeStyles } from '../testClients'
import { makeFile, makeView } from '../testSupport'
import { useLearnedAnnouncement } from './useLearnedAnnouncement'
import { STACK_QUERY, useMediaQuery } from './useNarrow'
import { useStyleIdentity } from './useStyleIdentity'

describe('useMediaQuery', () => {
  it('follows the media query and stops listening on unmount', () => {
    let listener: () => void = () => {}
    const list = {
      matches: false,
      addEventListener: vi.fn((_: string, fn: () => void) => (listener = fn)),
      removeEventListener: vi.fn()
    }
    window.matchMedia = vi.fn(() => list) as unknown as typeof window.matchMedia
    const { result, unmount } = renderHook(() => useMediaQuery(STACK_QUERY))
    expect(result.current).toBe(false)
    list.matches = true
    act(() => listener())
    expect(result.current).toBe(true)
    unmount()
    expect(list.removeEventListener).toHaveBeenCalled()
  })

  it('is false where matchMedia does not exist', () => {
    window.matchMedia = undefined as unknown as typeof window.matchMedia
    const { result } = renderHook(() => useMediaQuery(STACK_QUERY))
    expect(result.current).toBe(false)
  })
})

describe('useLearnedAnnouncement', () => {
  it('says nothing for files that arrive already learned', () => {
    const { result } = renderHook(() => useLearnedAnnouncement([makeFile()]))
    expect(result.current).toBe('')
  })

  it('names the file that was just learned', () => {
    const reading = [makeFile({ id: 'a', name: 'Forces.pptx', status: 'reading' })]
    const { result, rerender } = renderHook(({ files }) => useLearnedAnnouncement(files), {
      initialProps: { files: reading }
    })
    expect(result.current).toBe('')
    rerender({ files: [{ ...reading[0], status: 'learned' }] })
    expect(result.current).toBe('Learned from Forces.pptx')
  })

  it('does not announce a file that failed', () => {
    const reading = [makeFile({ id: 'a', status: 'reading' })]
    const { result, rerender } = renderHook(({ files }) => useLearnedAnnouncement(files), {
      initialProps: { files: reading }
    })
    rerender({ files: [{ ...reading[0], status: 'failed' }] })
    expect(result.current).toBe('')
  })
})

describe('useStyleIdentity', () => {
  const view = makeView([makeFile()], { name: 'Science KS3' })
  const options = {
    styleId: 'sty_1',
    view,
    adopt: vi.fn(),
    initialName: 'My style',
    initialDefault: false
  }
  const setup = (props: Partial<typeof options> = {}) => {
    const styles = fakeStyles(view)
    const clients = createFakeClients({ 'style-library': styles })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ClientsProvider clients={clients}>{children}</ClientsProvider>
    )
    const hook = renderHook((p: typeof options) => useStyleIdentity(p), {
      wrapper,
      initialProps: { ...options, ...props }
    })
    return { styles, ...hook }
  }

  it('saves a name that is still waiting when the screen is left', () => {
    const { styles, result, unmount } = setup()
    act(() => result.current.setName('Physics'))
    expect(styles.update).not.toHaveBeenCalled()
    unmount()
    expect(styles.update).toHaveBeenCalledWith({ styleId: 'sty_1', name: 'Physics' })
  })

  it('follows the saved name until she types her own', () => {
    const { result, rerender } = setup()
    expect(result.current.name).toBe('Science KS3')
    rerender({ ...options, view: { ...view, name: 'Suggested' } })
    expect(result.current.name).toBe('Suggested')
    act(() => result.current.setName('Mine'))
    rerender({ ...options, view: { ...view, name: 'Another suggestion' } })
    expect(result.current.name).toBe('Mine')
  })

  it('refuses to flush an empty name and says why', async () => {
    const { styles, result } = setup()
    act(() => result.current.setName('   '))
    let flushed = true
    await act(async () => {
      flushed = await result.current.flush()
    })
    expect(flushed).toBe(false)
    expect(result.current.nameError).toBe('Give this style a name.')
    expect(styles.update).not.toHaveBeenCalled()
  })

  it('flushes a pending name at once', async () => {
    const { styles, result } = setup()
    act(() => result.current.setName('Chemistry'))
    await act(async () => {
      expect(await result.current.flush()).toBe(true)
    })
    expect(styles.update).toHaveBeenCalledTimes(1)
  })

  it('reports whether the name or default changed since it was opened', () => {
    const { result } = setup()
    expect(result.current.changed).toBe(false)
    act(() => result.current.setName('Different'))
    expect(result.current.changed).toBe(true)
  })
})
