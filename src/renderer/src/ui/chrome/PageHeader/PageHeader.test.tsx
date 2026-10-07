import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PageHeader } from './PageHeader'

describe('PageHeader', () => {
  it('greeting: shows an h1 with a subtitle and the actions', () => {
    render(
      <PageHeader
        variant="greeting"
        title="Good morning, Alice!"
        subtitle="What are we teaching today?"
        actions={<button type="button">New lesson</button>}
      />
    )
    expect(
      screen.getByRole('heading', { level: 1, name: 'Good morning, Alice!' })
    ).toBeInTheDocument()
    expect(screen.getByText('What are we teaching today?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New lesson' })).toBeInTheDocument()
  })

  it('bar: shows a back pill, the title, a status and actions in order', async () => {
    const onBack = vi.fn()
    render(
      <PageHeader
        variant="bar"
        title="Create a style"
        back={{ label: 'Home', onClick: onBack }}
        status={<span>Learning · 6 of 8 files</span>}
        actions={<button type="button">Save style</button>}
      />
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Create a style' })).toBeInTheDocument()
    expect(screen.getByText('Learning · 6 of 8 files')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Home' }))
    expect(onBack).toHaveBeenCalledTimes(1)
    const order = screen.getAllByRole('button').map((b) => b.textContent)
    expect(order).toEqual(['Home', 'Save style'])
  })

  it('editor: shows the back pill, centred content and actions without an h1', () => {
    render(
      <PageHeader
        variant="editor"
        back={{ label: 'My lessons', onClick: () => {} }}
        center="Y8 Science — Photosynthesis"
        actions={<button type="button">Present</button>}
      />
    )
    expect(screen.getByText('Y8 Science — Photosynthesis')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'My lessons' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })

  it('steps: renders only its actions slot', () => {
    render(<PageHeader variant="steps" actions={<span>pills</span>} />)
    expect(screen.getByText('pills')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('exposes its variant for styling', () => {
    const { container } = render(<PageHeader variant="bar" title="x" />)
    expect(container.firstElementChild).toHaveAttribute('data-variant', 'bar')
  })
})
