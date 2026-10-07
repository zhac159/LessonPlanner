import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { OnlineFilters } from './OnlineFilters'
import { OnlineSearchBar } from './OnlineSearchBar'

describe('OnlineSearchBar', () => {
  it('is a search form with the field and the Search button', () => {
    render(<OnlineSearchBar value="volcano diagram" onChange={() => {}} onSearch={() => {}} />)
    expect(screen.getByRole('search', { name: 'Find images online' })).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search free image libraries' })).toHaveValue(
      'volcano diagram'
    )
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument()
  })

  it('reports typing', async () => {
    const onChange = vi.fn()
    render(<OnlineSearchBar value="" onChange={onChange} onSearch={() => {}} />)
    await userEvent.type(screen.getByRole('searchbox'), 'a')
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('searches on Enter and on the button', async () => {
    const onSearch = vi.fn()
    render(<OnlineSearchBar value="volcano" onChange={() => {}} onSearch={onSearch} />)
    await userEvent.click(screen.getByRole('searchbox'))
    await userEvent.keyboard('{Enter}')
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(onSearch).toHaveBeenCalledTimes(2)
  })

  it('does not search an empty box', async () => {
    const onSearch = vi.fn()
    render(<OnlineSearchBar value="  " onChange={() => {}} onSearch={onSearch} />)
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(onSearch).not.toHaveBeenCalled()
  })

  it('shows a busy button and does not search again meanwhile', async () => {
    const onSearch = vi.fn()
    render(<OnlineSearchBar value="volcano" onChange={() => {}} onSearch={onSearch} busy />)
    const button = screen.getByRole('button', { name: /Searching/ })
    expect(button).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(button)
    expect(onSearch).not.toHaveBeenCalled()
  })

  it('can use the smaller size in a sheet', () => {
    render(<OnlineSearchBar value="" onChange={() => {}} onSearch={() => {}} size="md" />)
    expect(screen.getByRole('button', { name: 'Search' })).toHaveAttribute('data-size', 'md')
  })
})

describe('OnlineFilters', () => {
  const props = {
    freeToUse: true,
    onFreeToUseChange: () => {},
    kind: 'any' as const,
    onKindChange: () => {}
  }

  it('shows "Free to use in lessons" pressed, the four kinds and the count', () => {
    render(<OnlineFilters {...props} total={48} />)
    expect(screen.getByRole('button', { name: 'Free to use in lessons' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getAllByRole('radio').map((r) => (r as HTMLInputElement).value)).toEqual([
      'any',
      'photo',
      'drawing',
      'diagram'
    ])
    expect(screen.getByRole('radio', { name: 'Any' })).toBeChecked()
    expect(screen.getByRole('status')).toHaveTextContent('48 results from free image libraries')
  })

  it('has no count before the first search and a singular for one', () => {
    const { rerender } = render(<OnlineFilters {...props} />)
    expect(screen.queryByRole('status')).toBeNull()
    rerender(<OnlineFilters {...props} total={1} />)
    expect(screen.getByRole('status')).toHaveTextContent('1 result from free image libraries')
  })

  it('reports the free toggle and the kind', async () => {
    const onFreeToUseChange = vi.fn()
    const onKindChange = vi.fn()
    render(
      <OnlineFilters {...props} onFreeToUseChange={onFreeToUseChange} onKindChange={onKindChange} />
    )
    await userEvent.click(screen.getByRole('button', { name: 'Free to use in lessons' }))
    expect(onFreeToUseChange).toHaveBeenCalledWith(false)
    await userEvent.click(screen.getByRole('radio', { name: 'Diagrams' }))
    expect(onKindChange).toHaveBeenCalledWith('diagram')
  })

  it('shows the toggle unpressed when the filter is off', () => {
    render(<OnlineFilters {...props} freeToUse={false} />)
    expect(screen.getByRole('button', { name: 'Free to use in lessons' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('A13 hides the kind pills', () => {
    render(<OnlineFilters {...props} hideKind />)
    expect(screen.queryByRole('radio')).toBeNull()
    expect(screen.getByRole('button', { name: 'Free to use in lessons' })).toBeInTheDocument()
  })
})
