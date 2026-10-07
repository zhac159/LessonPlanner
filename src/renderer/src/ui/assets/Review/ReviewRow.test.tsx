import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { LeftOutReason } from '@shared/contracts/assets'
import { ReviewRow, type ReviewRowProps } from './ReviewRow'

function setup(extra: Partial<ReviewRowProps> = {}) {
  const h = { onKeepChange: vi.fn(), onNameCommit: vi.fn(), onKindChange: vi.fn() }
  render(<ReviewRow name="school_logo" kind="logo" decks={24} keep {...h} {...extra} />)
  return h
}

describe('ReviewRow', () => {
  it('shows a ticked Keep box, the name, the kind and "In 24 decks"', () => {
    setup()
    expect(screen.getByRole('checkbox', { name: /Keep/ })).toBeChecked()
    expect(screen.getByRole('textbox', { name: 'Name of school_logo' })).toHaveValue('school_logo')
    expect(screen.getByRole('combobox', { name: 'Kind of school_logo' })).toHaveValue('logo')
    expect(screen.getByText('In 24 decks')).toBeInTheDocument()
  })

  it('names itself after the picture', () => {
    setup()
    expect(screen.getByRole('article', { name: 'school_logo' })).toBeInTheDocument()
  })

  it('toggles Keep and reports it', async () => {
    const h = setup({ keep: false })
    await userEvent.click(screen.getByRole('checkbox'))
    expect(h.onKeepChange).toHaveBeenCalledWith(true)
  })

  it('commits an edited name on Enter and on blur, not when unchanged', async () => {
    const h = setup()
    const field = screen.getByRole('textbox')
    await userEvent.click(field)
    await userEvent.tab()
    expect(h.onNameCommit).not.toHaveBeenCalled()
    await userEvent.type(field, '2{Enter}')
    expect(h.onNameCommit).toHaveBeenLastCalledWith('school_logo2')
    await userEvent.type(field, '3')
    await userEvent.tab()
    expect(h.onNameCommit).toHaveBeenLastCalledWith('school_logo23')
  })

  it('shows a name problem in red, tied to the field', () => {
    setup({ nameError: 'You already have an asset called owl_mascot.' })
    const field = screen.getByRole('textbox')
    const message = screen.getByText('You already have an asset called owl_mascot.')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAttribute('aria-describedby', message.id)
  })

  it('changes the kind from the pill', async () => {
    const h = setup()
    await userEvent.selectOptions(screen.getByRole('combobox'), 'banner')
    expect(h.onKindChange).toHaveBeenCalledWith('banner')
  })

  it('shows a plain kind pill when the kind cannot be changed', () => {
    setup({ onKindChange: undefined })
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.getByText('Logo')).toBeInTheDocument()
  })

  it.each([
    ['pupils', undefined, 'May show pupils · left out'],
    ['blurry', undefined, 'Blurry · left out'],
    ['older-version', 'school_logo', 'Older version of school_logo'],
    ['low-resolution', undefined, 'Small picture · left out'],
    ['background', undefined, 'Looks like a slide background · left out'],
    ['unreadable', undefined, "Can't read this picture · left out"],
    ['duplicate', undefined, 'Already in Your assets']
  ] as Array<[LeftOutReason, string | undefined, string]>)(
    'left out for %s shows "%s" instead of the kind, dashed and unticked',
    (reason, ofName, text) => {
      setup({ keep: false, leftOut: { reason, ofName } })
      expect(screen.getByText(text)).toBeInTheDocument()
      expect(screen.queryByRole('combobox')).toBeNull()
      expect(screen.getByRole('article')).toHaveAttribute('data-left-out', 'true')
      expect(screen.getByRole('checkbox')).not.toBeChecked()
    }
  )

  it('keeps the reason pill when she ticks a left-out picture anyway', async () => {
    const h = setup({ keep: true, leftOut: { reason: 'pupils' } })
    expect(screen.getByText('May show pupils · left out')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeChecked()
    await userEvent.click(screen.getByRole('checkbox'))
    expect(h.onKeepChange).toHaveBeenCalledWith(false)
  })

  it('draws the picture with empty alt text', () => {
    const { container } = render(
      <ReviewRow
        name="a_b"
        kind="icon"
        decks={1}
        keep
        thumbSrc="data:image/png;base64,AA"
        onKeepChange={() => {}}
        onNameCommit={() => {}}
      />
    )
    expect(container.querySelector('img')).toHaveAttribute('alt', '')
    expect(screen.getByText('In 1 deck')).toBeInTheDocument()
  })
})
