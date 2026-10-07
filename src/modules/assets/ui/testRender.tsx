/** Test-only: renders the Assets page with fake clients for assets and the editor's lesson list. */
import type { ContractImpl } from '@shared/contract'
import type { DeckBuilderApi, LessonSummary } from '@shared/contracts/deck-builder'
import { createFakeClients, fakeClient, renderWithApp } from '@test/render'
import type { ShellState } from '@renderer/core/types'
import type { AssetsFullApi } from '../shared'
import { AssetsView } from './AssetsView'
import { fakeAssets } from './testSupport'

export const LESSON = (id: string, title: string, updatedAt: string): LessonSummary => ({
  id,
  title,
  yearGroup: null,
  yearShort: null,
  slideCount: 12,
  updatedAt,
  styleId: null,
  thumbDataUrl: null,
  status: 'ready'
})

export interface RenderAssetsOptions {
  assets?: Partial<ContractImpl<AssetsFullApi>>
  lessons?: LessonSummary[]
  shell?: Partial<ShellState>
}

export function renderAssets({ assets = {}, lessons = [], shell }: RenderAssetsOptions = {}) {
  const client = fakeAssets(assets)
  const decks = fakeClient<DeckBuilderApi>({ listLessons: () => lessons })
  const clients = createFakeClients({ assets: client, 'deck-builder': decks })
  const rendered = renderWithApp(<AssetsView api={undefined as never} active />, {
    clients,
    shell: { activeId: 'assets', ...shell }
  })
  return { ...rendered, client, clients }
}
