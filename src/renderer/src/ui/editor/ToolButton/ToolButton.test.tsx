import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Lasso } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { ToolButton } from './ToolButton'

describe('ToolButton', () => {
  it('is a button named by its label with a decorative icon', () => {
    render(<ToolButton label="Circle to edit" icon={Lasso} />)
    const button = screen.getByRole('button', { name: 'Circle to edit' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('reports pressed state only when it is a tool', () => {
    const { rerender } = render(<ToolButton label="Circle" icon={Lasso} pressed />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
    rerender(<ToolButton label="Circle" icon={Lasso} pressed={false} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
    rerender(<ToolButton label="Circle" icon={Lasso} />)
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-pressed')
  })

  it('calls onClick', async () => {
    const onClick = vi.fn()
    render(<ToolButton label="Circle" icon={Lasso} onClick={onClick} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('stays focusable but inert while disabled', async () => {
    const onClick = vi.fn()
    render(<ToolButton label="Undo" icon={Lasso} disabled onClick={onClick} />)
    const button = screen.getByRole('button', { name: 'Undo' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    button.focus()
    expect(button).toHaveFocus()
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('shows its tooltip on keyboard focus', async () => {
    render(<ToolButton label="Circle to edit" tooltip="Circle to edit (C)" icon={Lasso} />)
    await userEvent.tab()
    expect(screen.getByRole('tooltip')).toHaveTextContent('Circle to edit (C)')
  })
})
