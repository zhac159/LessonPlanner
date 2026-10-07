import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Slide } from '@shared/deck/types'
import { SlideThumb } from './SlideThumb'

const slide: Slide = {
  id: 's3',
  kind: 'content',
  elements: [
    {
      id: 't',
      type: 'text',
      role: 'title',
      x: 0,
      y: 0,
      w: 800,
      h: 100,
      paragraphs: [{ runs: [{ text: 'What do plants need?' }] }]
    }
  ]
}

describe('SlideThumb (filmstrip)', () => {
  it('is a button named after its number and title, with a visible number badge', () => {
    render(<SlideThumb slide={slide} styleProfile={null} number={3} />)
    const button = screen.getByRole('button', { name: 'Slide 3: What do plants need?' })
    expect(button).toHaveTextContent('3')
    expect(button).not.toHaveAttribute('aria-current')
    expect(button).toHaveAttribute('data-slide-id', 's3')
  })

  it('marks the selected slide with aria-current', () => {
    render(<SlideThumb slide={slide} styleProfile={null} number={3} selected />)
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-current', 'true')
    expect(button).toHaveAttribute('data-selected')
  })

  it('reflects the dragging and reveal states as attributes', () => {
    render(<SlideThumb slide={slide} styleProfile={null} dragging reveal />)
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('data-dragging')
    expect(button).toHaveAttribute('data-reveal')
  })

  it('calls onSelect on click, Enter and Space', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<SlideThumb slide={slide} styleProfile={null} onSelect={onSelect} />)
    await user.click(screen.getByRole('button'))
    screen.getByRole('button').focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(onSelect).toHaveBeenCalledTimes(3)
  })

  it('also forwards its own onClick', async () => {
    const onClick = vi.fn()
    render(<SlideThumb slide={slide} styleProfile={null} onClick={onClick} />)
    await userEvent.setup().click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('opens the menu at the pointer on right-click and suppresses the browser menu', () => {
    const onMenu = vi.fn()
    render(<SlideThumb slide={slide} styleProfile={null} onMenu={onMenu} />)
    const notPrevented = fireEvent.contextMenu(screen.getByRole('button'), {
      clientX: 50,
      clientY: 60
    })
    expect(notPrevented).toBe(false)
    expect(onMenu).toHaveBeenCalledWith({ x: 50, y: 60 })
  })

  it('opens the menu from the keyboard with the menu key and Shift+F10', () => {
    const onMenu = vi.fn()
    render(<SlideThumb slide={slide} styleProfile={null} onMenu={onMenu} />)
    const button = screen.getByRole('button')
    fireEvent.keyDown(button, { key: 'ContextMenu' })
    fireEvent.keyDown(button, { key: 'F10', shiftKey: true })
    fireEvent.keyDown(button, { key: 'F10' })
    expect(onMenu).toHaveBeenCalledTimes(2)
  })

  it('leaves the browser menu alone when no onMenu is given', () => {
    render(<SlideThumb slide={slide} styleProfile={null} />)
    expect(fireEvent.contextMenu(screen.getByRole('button'))).toBe(true)
  })

  it('lets a parent keydown handler claim the event before the menu key', () => {
    const onMenu = vi.fn()
    render(
      <SlideThumb
        slide={slide}
        styleProfile={null}
        onMenu={onMenu}
        onKeyDown={(event) => event.preventDefault()}
      />
    )
    fireEvent.keyDown(screen.getByRole('button'), { key: 'ContextMenu' })
    expect(onMenu).not.toHaveBeenCalled()
  })
})

describe('SlideThumb (other variants)', () => {
  it('card draws the slide with no button and no badge', () => {
    const { container } = render(
      <SlideThumb slide={slide} styleProfile={null} variant="card" number={9} />
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(container.querySelector('.slide-view')).toBeInTheDocument()
    expect(container).not.toHaveTextContent('9')
  })

  it.each([['placeholder'], ['generating']] as const)(
    '%s is a hidden empty slot without a slide',
    (variant) => {
      const { container } = render(<SlideThumb styleProfile={null} variant={variant} />)
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
      const slot = container.firstElementChild!
      expect(slot).toHaveAttribute('aria-hidden', 'true')
      expect(slot).toHaveAttribute('data-variant', variant)
      expect(container.querySelector('.slide-view')).not.toBeInTheDocument()
    }
  )

  it('falls back to a placeholder when the filmstrip variant has no slide', () => {
    const { container } = render(<SlideThumb styleProfile={null} />)
    expect(container.firstElementChild).toHaveAttribute('data-variant', 'placeholder')
  })
})
