import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fixtureDeck } from '@shared/deck/testing'
import type { ImageElement } from '@shared/deck/types'
import { fail, ok } from '@shared/result'
import { createFakeClients } from '@test/render'
import { hookWrapper } from '../../editor/testing'
import { fakeAssets, fakeSettings, LIBRARY, onlineResult } from '../testing'
import { useAssetLibrary } from './useAssetLibrary'
import { useAssetNames } from './useAssetNames'
import { useAssetPictures } from './useAssetPictures'
import { NEW_PILL_USES, useAssetsMenu } from './useAssetsMenu'
import { ONLINE_CACHE_MS, clearOnlineCache, useOnlineSearch } from './useOnlineSearch'

beforeEach(() => clearOnlineCache())
afterEach(() => vi.restoreAllMocks())

const clientsWith = (assets = fakeAssets(), settings = fakeSettings()) =>
  createFakeClients({ assets, settings })

describe('useAssetLibrary', () => {
  it('reads the library newest-used first and refreshes when it changes', async () => {
    const assets = fakeAssets()
    const clients = clientsWith(assets)
    const { result } = renderHook(() => useAssetLibrary(''), { wrapper: hookWrapper(clients) })
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.assets).toHaveLength(LIBRARY.length)
    expect(assets.list).toHaveBeenCalledWith({ search: undefined, sort: 'recent', limit: 60 })
    act(() => clients.emit('assets', 'changed', { libraryCount: 7 }))
    await waitFor(() => expect(assets.list).toHaveBeenCalledTimes(2))
  })

  it('does not ask until it is switched on, and treats a failure as an empty library', async () => {
    const assets = fakeAssets(LIBRARY, { list: () => Promise.reject(new Error('down')) as never })
    const wrapper = hookWrapper(clientsWith(assets))
    const off = renderHook(() => useAssetLibrary('', false), { wrapper })
    expect(assets.list).not.toHaveBeenCalled()
    off.unmount()
    const on = renderHook(() => useAssetLibrary('owl'), { wrapper })
    await waitFor(() => expect(on.result.current.loaded).toBe(true))
    expect(on.result.current).toMatchObject({ assets: [], failed: true })
  })
})

describe('useAssetNames', () => {
  it('turns known names into chips and refs, leaves the rest unknown, in lower case', async () => {
    const wrapper = hookWrapper(clientsWith())
    const { result } = renderHook(() => useAssetNames('Put {{School_Logo}} and {{ghost}}'), {
      wrapper
    })
    await waitFor(() => expect(result.current.settled).toBe(true))
    expect([...result.current.chips.keys()]).toEqual(['school_logo'])
    expect(result.current.lookup('SCHOOL_LOGO')).toEqual({
      assetId: 'ast_school_logo',
      name: 'school_logo'
    })
    expect(result.current.lookup('ghost')).toBeUndefined()
  })

  it('is settled at once when the text names nothing', () => {
    const { result } = renderHook(() => useAssetNames('Hello'), {
      wrapper: hookWrapper(clientsWith())
    })
    expect(result.current.settled).toBe(true)
    expect(result.current.chips.size).toBe(0)
  })
})

describe('useAssetsMenu', () => {
  it('shows the New pill until the third use and saves each use', async () => {
    const settings = fakeSettings(NEW_PILL_USES - 1)
    const { result } = renderHook(() => useAssetsMenu(), {
      wrapper: hookWrapper(clientsWith(fakeAssets(), settings))
    })
    await waitFor(() => expect(settings.getPreferences).toHaveBeenCalled())
    expect(result.current.showNew).toBe(true)
    act(() => result.current.recordUse())
    expect(result.current.showNew).toBe(false)
    expect(settings.setPreferences).toHaveBeenCalledWith({ assetsMenuUses: NEW_PILL_USES })
  })

  it('still works when settings cannot be read', () => {
    const clients = createFakeClients({ assets: fakeAssets() })
    const { result } = renderHook(() => useAssetsMenu(), { wrapper: hookWrapper(clients) })
    expect(result.current.showNew).toBe(true)
  })
})

describe('useOnlineSearch', () => {
  it('searches free-to-use pictures and keeps the answer for ten minutes', async () => {
    const assets = fakeAssets()
    const wrapper = hookWrapper(clientsWith(assets))
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    const { result } = renderHook(() => useOnlineSearch(true), { wrapper })
    await act(() => result.current.search('  leaf in sunlight  '))
    expect(result.current.state.status).toBe('done')
    expect(result.current.state.results).toHaveLength(6)
    expect(assets['online:search']).toHaveBeenCalledWith({
      query: 'leaf in sunlight',
      kind: 'any',
      freeToUse: true,
      page: 1
    })
    now.mockReturnValue(1_000_000 + ONLINE_CACHE_MS - 1)
    await act(() => result.current.search('Leaf in sunlight'))
    expect(assets['online:search']).toHaveBeenCalledTimes(1)
    now.mockReturnValue(1_000_000 + ONLINE_CACHE_MS + 1)
    await act(() => result.current.search('leaf in sunlight'))
    expect(assets['online:search']).toHaveBeenCalledTimes(2)
  })

  it('keeps free-to-use and everything separate, and ignores an empty query', async () => {
    const assets = fakeAssets()
    const wrapper = hookWrapper(clientsWith(assets))
    const free = renderHook(() => useOnlineSearch(true), { wrapper })
    const any = renderHook(() => useOnlineSearch(false), { wrapper })
    await act(() => free.result.current.search('leaf'))
    await act(() => any.result.current.search('leaf'))
    await act(() => any.result.current.search('   '))
    expect(assets['online:search']).toHaveBeenCalledTimes(2)
  })

  it('says what went wrong and shows no results', async () => {
    const assets = fakeAssets(LIBRARY, { 'online:search': () => fail('network', 'No internet') })
    const { result } = renderHook(() => useOnlineSearch(true), {
      wrapper: hookWrapper(clientsWith(assets))
    })
    await act(() => result.current.search('leaf'))
    expect(result.current.state).toMatchObject({
      status: 'error',
      message: 'No internet',
      results: []
    })
  })

  it('does not cache a failure', async () => {
    let calls = 0
    const assets = fakeAssets(LIBRARY, {
      'online:search': () => {
        calls += 1
        return calls === 1
          ? fail('network', 'No internet')
          : ok({ results: [onlineResult(1)], total: 1, page: 1, hasMore: false, providers: [] })
      }
    })
    const { result } = renderHook(() => useOnlineSearch(true), {
      wrapper: hookWrapper(clientsWith(assets))
    })
    await act(() => result.current.search('leaf'))
    await act(() => result.current.search('leaf'))
    expect(result.current.state.status).toBe('done')
  })
})

describe('useAssetPictures', () => {
  const picture = (id: string, assetId: string): ImageElement => ({
    id,
    type: 'image',
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    fit: 'cover',
    alt: 'x',
    assetId,
    name: 'school_logo'
  })

  it('finds the library copy of every picture in the deck, bigger ones for the slide on the stage', async () => {
    const deck = fixtureDeck()
    deck.slides[0]!.elements.push(picture('p1', 'ast_school_logo'))
    deck.slides[1]!.elements.push(picture('p2', 'ast_owl_mascot'))
    const assets = fakeAssets()
    const { result } = renderHook(() => useAssetPictures(deck, deck.slides[0]!.id), {
      wrapper: hookWrapper(clientsWith(assets))
    })
    await waitFor(() => expect(result.current('ast_owl_mascot')).toBeDefined())
    expect(result.current('ast_school_logo')).toBeDefined()
    expect(result.current('ast_unknown')).toBeUndefined()
    expect(assets.get).toHaveBeenCalledTimes(1)
    expect(assets.get).toHaveBeenCalledWith({ assetId: 'ast_school_logo' })
  })

  it('asks nothing for a deck without pictures', () => {
    const assets = fakeAssets()
    renderHook(() => useAssetPictures({ slides: [] }, null), {
      wrapper: hookWrapper(clientsWith(assets))
    })
    expect(assets.chips).not.toHaveBeenCalled()
  })
})
