import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { DeckBuilderApi } from '@shared/contracts/deck-builder'
import { createFakeClients, fakeClient, renderWithApp } from '@test/render'
import { AssetsView } from './AssetsView'
import { fakeAssets } from './testSupport'

describe('AssetsView while another page is open', () => {
  it('leaves an intent meant for the page being opened (it is kept mounted but hidden)', async () => {
    const clients = createFakeClients({
      assets: fakeAssets({}),
      'deck-builder': fakeClient<DeckBuilderApi>({ listLessons: () => [] })
    })
    const { shell } = renderWithApp(<AssetsView api={undefined as never} active={false} />, {
      clients,
      shell: { activeId: 'deck-builder', intent: { kind: 'open-lesson', lessonId: 'les_1' } }
    })
    expect(await screen.findByRole('heading', { name: 'Your assets' })).toBeInTheDocument()
    expect(shell.consumeIntent).not.toHaveBeenCalled()
  })
})
