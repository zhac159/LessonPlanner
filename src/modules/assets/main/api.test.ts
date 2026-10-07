import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ASSETS_METHODS } from '@shared/contracts/assets'
import { serveContract } from '@main/sdk'
import { createAppOnlineService } from '@main/services/assets/online'
import { AssetError } from '@main/services/assets/store'
import {
  addPicture,
  cleanTemp,
  photoPng,
  tempDir,
  testService
} from '@main/services/assets/testing'
import { createPureImageTools } from '@main/services/assets/thumbs'
import type { AssetsFullApi } from '../shared'
import type { ContractImpl } from '@shared/contract'
import type { MakeApiPart } from '@main/services/assets/make'
import { cleanListQuery, createAssetsApi, type ReplaceDialogPort } from './api'
import type { ReviewApiPart } from './review'

afterEach(cleanTemp)

const review: ContractImpl<ReviewApiPart> = {
  'add:pick': vi.fn(),
  'add:paths': vi.fn(),
  'review:get': () => ({
    batches: [],
    candidates: [],
    found: 3,
    keeping: 2,
    leftOut: 1,
    stillReading: 0
  }),
  'review:edit': vi.fn(),
  'review:accept': vi.fn(),
  'review:dismiss': vi.fn(),
  'review:retry': vi.fn()
}
const make: ContractImpl<MakeApiPart> = {
  'make:mode': () => ({ mode: 'unavailable', modelLabel: null, perPictureUsd: null }),
  'make:start': vi.fn(),
  'make:keep': vi.fn(),
  'make:cancel': vi.fn(),
  'make:retry': vi.fn()
}

async function setup(dialog: ReplaceDialogPort = { pickPicture: async () => undefined }) {
  const dir = await tempDir()
  const assets = testService(join(dir, 'assets'))
  await assets.init()
  const online = createAppOnlineService({
    assets,
    tools: createPureImageTools(),
    dir: join(dir, 'online'),
    fake: true
  })
  const api = createAssetsApi({ assets, online, dialog, review, make })
  return { assets, api }
}

describe('the served contract', () => {
  it('serves every method of the contract plus the tidy report', async () => {
    const { api } = await setup()
    const served: string[] = []
    serveContract<AssetsFullApi>({ handle: (channel) => served.push(channel) }, api)
    expect(served.sort()).toEqual([...ASSETS_METHODS, 'library:tidied'].sort())
  })
})

describe('library calls', () => {
  it('lists, gets and edits through the contract', async () => {
    const { api, assets } = await setup()
    const asset = await addPicture(assets, 'owl_mascot', { kind: 'character' })
    const page = await api.list({ search: 'owl', sort: 'name', from: 'anywhere' })
    expect(page.items.map((i) => i.name)).toEqual(['owl_mascot'])
    expect(await api.get({ assetId: asset.id })).toMatchObject({ ok: true })
    expect(await api.rename({ assetId: asset.id, name: 'Wise Owl' })).toMatchObject({
      ok: true,
      asset: { name: 'wise_owl' }
    })
    expect(await api.update({ assetId: asset.id, tags: ['bird'] })).toMatchObject({
      ok: true,
      asset: { tags: ['bird'] }
    })
    expect(await api.checkName({ name: 'wise owl', assetId: asset.id })).toEqual({
      ok: true,
      name: 'wise_owl'
    })
    expect((await api.chips({ refs: [{ assetId: asset.id, name: 'x' }] }))[0]?.name).toBe(
      'wise_owl'
    )
    expect(await api.resolveNames({ names: ['wise_owl'] })).toHaveLength(1)
    expect(await api.remove({ assetId: asset.id })).toEqual({ ok: true })
    expect(await api.restore({ assetId: asset.id })).toEqual({ ok: true })
    expect(await api.usage({ assetId: asset.id })).toMatchObject({ ok: true })
    expect(await api.suggest({ lessonId: 'l', slideId: 's', words: 'owl' })).toMatchObject({
      ok: true
    })
  })

  it('refuses requests that are not shaped right instead of throwing', async () => {
    const { api } = await setup()
    const bad = { ok: false, code: 'invalid-input', message: 'That request was not understood.' }
    expect(await api.get(null as never)).toEqual(bad)
    expect(await api.get({ assetId: 7 } as never)).toEqual(bad)
    expect(await api.rename({ assetId: 'a' } as never)).toEqual(bad)
    expect(await api.update({ assetId: 'a', kind: 'weird' } as never)).toEqual(bad)
    expect(await api.update({ assetId: 'a', tags: 'x' } as never)).toEqual(bad)
    expect(await api.remove({} as never)).toEqual(bad)
    expect(await api.restore(undefined as never)).toEqual(bad)
    expect(await api.usage({ assetId: '' } as never)).toEqual(bad)
    expect(await api.suggest({ lessonId: 'a' } as never)).toEqual(bad)
    expect(await api['online:search']({ query: 5 } as never)).toEqual(bad)
    expect(await api['online:add']({ items: [{ id: 3 }], mode: 'direct' } as never)).toEqual(bad)
    expect(await api['online:add']({ items: [], mode: 'later' } as never)).toEqual(bad)
    expect(api.checkName(undefined as never)).toMatchObject({ ok: false, problem: 'too-short' })
    expect(await api.chips(undefined as never)).toEqual([])
  })

  it('keeps only list-query values of the right shape', () => {
    expect(cleanListQuery(undefined)).toEqual({})
    expect(
      cleanListQuery({
        search: 'x',
        from: 'style:sty_1',
        sort: 'bogus',
        limit: 'many',
        cursor: 4,
        filter: 'logos'
      })
    ).toEqual({ search: 'x', from: 'style:sty_1', filter: 'logos' })
    expect(cleanListQuery({ from: 'somewhere else' })).toEqual({})
  })

  it('tells the page once what loading repaired', async () => {
    const { api } = await setup()
    expect(api['library:tidied']()).toBeNull()
  })
})

describe('Replace file', () => {
  it('does nothing when the dialog is dismissed', async () => {
    const { api, assets } = await setup()
    const asset = await addPicture(assets, 'banner_one')
    expect(await api.replaceFile({ assetId: asset.id })).toEqual({ ok: true, cancelled: true })
  })

  it('replaces the file with the picked picture', async () => {
    const pick = vi.fn(async () => ({ bytes: photoPng(40, 120, 90), name: 'new.png' }))
    const { api, assets } = await setup({ pickPicture: pick })
    const asset = await addPicture(assets, 'banner_one')
    const done = await api.replaceFile({ assetId: asset.id })
    expect(done).toMatchObject({ ok: true, asset: { id: asset.id, width: 120 } })
  })

  it('reports a file that is too big or cannot be read, without throwing', async () => {
    const big = await setup({
      pickPicture: async () =>
        Promise.reject(new AssetError('too-large', 'That picture is too big.'))
    })
    const asset = await addPicture(big.assets, 'banner_one')
    expect(await big.api.replaceFile({ assetId: asset.id })).toEqual({
      ok: false,
      code: 'too-large',
      message: 'That picture is too big.'
    })
    const locked = await setup({ pickPicture: async () => Promise.reject(new Error('EBUSY')) })
    expect(await locked.api.replaceFile({ assetId: 'ast_x' })).toMatchObject({
      ok: false,
      code: 'io'
    })
  })
})

describe('Find online through the contract', () => {
  it('searches and saves one result', async () => {
    const { api, assets } = await setup()
    const found = await api['online:search']({
      query: 'leaf',
      kind: 'any',
      freeToUse: true,
      page: 1
    })
    expect(found.ok && found.results).toHaveLength(24)
    const first = found.ok ? found.results[0]!.id : ''
    const saved = await api['online:add']({ items: [{ id: first }], mode: 'direct' })
    expect(saved.ok && 'added' in saved && saved.added[0]?.sourceKind).toBe('online')
    expect(assets.libraryCount).toBe(1)
  })
})

describe('the parts other services serve', () => {
  it('serves the review and make handlers it is given next to its own', async () => {
    const { api } = await setup()
    expect(api['review:get']()).toMatchObject({ found: 3 })
    expect(api['make:mode']()).toMatchObject({ mode: 'unavailable' })
  })
})
