import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Gallery } from './Gallery'
import type { GalleryGroup } from './galleryModel'

const groups: GalleryGroup[] = [
  {
    title: 'Atoms',
    sections: [
      { name: 'Button', render: () => <button type="button">Specimen</button> },
      { name: 'Card', render: () => <p>A card</p> }
    ]
  },
  { title: 'Overlays', sections: [{ name: 'Dialog', render: () => <p>A dialog</p> }] }
]

describe('Gallery', () => {
  it('shows every group and section with its specimen', () => {
    render(<Gallery groups={groups} />)
    expect(screen.getByRole('heading', { level: 1, name: 'UI gallery' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Atoms' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Overlays' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Button' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Specimen' })).toBeInTheDocument()
    expect(screen.getByText('A dialog')).toBeInTheDocument()
  })

  it('offers a jump button per group that scrolls to it', async () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    render(<Gallery groups={groups} />)
    const nav = screen.getByRole('navigation', { name: 'Gallery areas' })
    await userEvent.click(within(nav).getByRole('button', { name: 'Overlays' }))
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByRole('region', { name: 'Overlays' }))
  })

  it('says so when there are no galleries', () => {
    render(<Gallery groups={[]} />)
    expect(screen.getByText('No galleries found.')).toBeInTheDocument()
  })

  it('reports galleries that failed to load', () => {
    render(<Gallery groups={groups} skipped={['../broken/gallery.tsx']} />)
    expect(screen.getByRole('alert')).toHaveTextContent('../broken/gallery.tsx')
  })
})
