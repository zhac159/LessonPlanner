import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FitControl } from './FitControl'

describe('FitControl', () => {
  it('asks "How should it fit?" with the circle wording and the chosen pill checked', () => {
    render(<FitControl value="fit" onChange={() => {}} />)
    expect(screen.getByRole('group', { name: 'How should it fit?' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Fit inside the circle' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Fill the circle' })).not.toBeChecked()
  })

  it('uses the spot wording on A13', () => {
    render(<FitControl value="fill" onChange={() => {}} target="spot" />)
    expect(screen.getByRole('radio', { name: 'Fit inside the spot' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Fill the spot' })).toBeChecked()
  })

  it('lets the labels be overridden', () => {
    render(
      <FitControl value="fit" onChange={() => {}} fitLabel="Whole picture" fillLabel="Cover it" />
    )
    expect(screen.getByRole('radio', { name: 'Whole picture' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Cover it' })).toBeInTheDocument()
  })

  it('reports the new choice', async () => {
    const onChange = vi.fn()
    render(<FitControl value="fit" onChange={onChange} />)
    await userEvent.click(screen.getByRole('radio', { name: 'Fill the circle' }))
    expect(onChange).toHaveBeenCalledWith('fill')
  })

  it('has no checkbox unless something is underneath', () => {
    render(<FitControl value="fit" onChange={() => {}} />)
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('shows the replace checkbox and reports it', async () => {
    const onChange = vi.fn()
    render(
      <FitControl
        value="fit"
        onChange={() => {}}
        replace={{
          label: 'Replace what’s underneath (Photo: leaf in sunlight)',
          checked: true,
          onChange
        }}
      />
    )
    const box = screen.getByRole('checkbox', {
      name: 'Replace what’s underneath (Photo: leaf in sunlight)'
    })
    expect(box).toBeChecked()
    await userEvent.click(box)
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('warns when the picture is small', () => {
    render(<FitControl value="fit" onChange={() => {}} lowResolution />)
    expect(screen.getByRole('status')).toHaveTextContent(
      'This picture is small, so it may look blurry at this size.'
    )
  })

  it('does not warn otherwise', () => {
    render(<FitControl value="fit" onChange={() => {}} />)
    expect(screen.queryByRole('status')).toBeNull()
  })
})
