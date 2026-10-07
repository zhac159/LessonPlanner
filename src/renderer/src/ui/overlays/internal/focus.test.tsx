import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { focusableIn, useEscape, useFocusScope } from './focus'

function Scope({ trap, onEscape }: { trap: boolean; onEscape?: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useFocusScope(ref, open, { trap })
  useEscape(open, () => onEscape?.())
  return (
    <>
      <button onClick={() => setOpen(true)}>open</button>
      <button>outside</button>
      {open && (
        <div ref={ref} tabIndex={-1} data-testid="scope">
          <button>first</button>
          <button data-autofocus>second</button>
          <button disabled>disabled</button>
          <button onClick={() => setOpen(false)}>last</button>
        </div>
      )}
    </>
  )
}

describe('focusableIn', () => {
  it('lists tabbable elements and skips disabled and hidden ones', () => {
    const root = document.createElement('div')
    root.innerHTML =
      '<button>a</button><button disabled>b</button><button hidden>c</button><a href="#x">d</a><div tabindex="-1">e</div>'
    expect(focusableIn(root).map((el) => el.textContent)).toEqual(['a', 'd'])
  })
})

describe('useFocusScope', () => {
  it('focuses [data-autofocus] first and restores focus to the opener on close', async () => {
    const user = userEvent.setup()
    render(<Scope trap />)
    await user.click(screen.getByText('open'))
    expect(screen.getByText('second')).toHaveFocus()
    await user.click(screen.getByText('last'))
    expect(screen.getByText('open')).toHaveFocus()
  })

  it('keeps Tab and Shift+Tab inside when trapping', async () => {
    const user = userEvent.setup()
    render(<Scope trap />)
    await user.click(screen.getByText('open'))
    await user.tab()
    expect(screen.getByText('last')).toHaveFocus()
    await user.tab()
    expect(screen.getByText('first')).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByText('last')).toHaveFocus()
  })

  it('lets Tab leave when not trapping', async () => {
    const user = userEvent.setup()
    render(<Scope trap={false} />)
    await user.click(screen.getByText('open'))
    await user.tab()
    await user.tab()
    expect(screen.getByTestId('scope').contains(document.activeElement)).toBe(false)
  })
})

describe('useEscape', () => {
  it('fires on Escape while active, but not when the key was already handled', async () => {
    const onEscape = vi.fn()
    const user = userEvent.setup()
    render(<Scope trap onEscape={onEscape} />)
    await user.keyboard('{Escape}')
    expect(onEscape).not.toHaveBeenCalled()
    await user.click(screen.getByText('open'))
    await user.keyboard('{Escape}')
    expect(onEscape).toHaveBeenCalledTimes(1)
    const handled = (event: KeyboardEvent): void => event.preventDefault()
    document.addEventListener('keydown', handled, true)
    await user.keyboard('{Escape}')
    document.removeEventListener('keydown', handled, true)
    expect(onEscape).toHaveBeenCalledTimes(1)
  })
})
