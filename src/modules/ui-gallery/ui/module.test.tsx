import { render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import { describe, expect, it } from 'vitest'
import module from '../ui'

describe('ui-gallery module', () => {
  it('is hidden from the sidebar and keeps the sidebar chrome', () => {
    expect(module.id).toBe('ui-gallery')
    expect(module.nav).toBe('hidden')
    expect(module.chrome).toBe('sidebar')
    expect(module.title).toBe('UI gallery')
  })

  it('renders the gallery with the foundation areas', { timeout: 30_000 }, async () => {
    const View = module.component
    render(
      <Suspense fallback={null}>
        <View api={{ invoke: async () => undefined as never, on: () => () => {} }} active />
      </Suspense>
    )
    // The lazy import pulls in every area's specimens, which is slow on a cold cache.
    expect(await screen.findByTestId('ui-gallery', {}, { timeout: 20_000 })).toBeInTheDocument()
    for (const area of ['Atoms', 'Chrome', 'Overlays']) {
      expect(screen.getByRole('region', { name: area })).toBeInTheDocument()
    }
    expect(screen.getByRole('heading', { level: 3, name: /Button · variants/ })).toBeInTheDocument()
  })
})
