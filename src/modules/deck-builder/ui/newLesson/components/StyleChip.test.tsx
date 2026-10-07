import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { style } from '../testing'
import { StyleChip, styleOptions } from './StyleChip'

const styles = [style(), style({ id: 'sty_art', name: 'Art', isDefault: false })]

function setup(props: Partial<Parameters<typeof StyleChip>[0]> = {}) {
  const onChange = vi.fn()
  const onCreateStyle = vi.fn()
  render(
    <StyleChip
      styles={styles}
      styleId="sty_science"
      onChange={onChange}
      onCreateStyle={onCreateStyle}
      {...props}
    />
  )
  return { onChange, onCreateStyle, user: userEvent.setup() }
}

describe('styleOptions', () => {
  it('lists her styles then “Create a new style…”', () => {
    expect(styleOptions(styles).map((o) => o.label)).toEqual([
      'Science KS3',
      'Art',
      'Create a new style…'
    ])
  })

  it('offers “Plain style” only when she has no styles', () => {
    expect(styleOptions([]).map((o) => o.label)).toEqual(['Plain style', 'Create a new style…'])
  })
})

describe('StyleChip', () => {
  it('is named by the chosen style', () => {
    setup()
    expect(
      screen.getByRole('button', { name: 'Your style: Science KS3. Change your style' })
    ).toBeInTheDocument()
  })

  it('reads “Plain style” when no style is chosen', () => {
    setup({ styles: [], styleId: null })
    expect(screen.getByRole('button', { name: /^Your style: Plain style/ })).toBeInTheDocument()
  })

  it('reports the style she chooses', async () => {
    const { user, onChange } = setup()
    await user.click(screen.getByRole('button', { name: /^Your style/ }))
    await user.click(screen.getByRole('option', { name: 'Art' }))
    expect(onChange).toHaveBeenCalledWith('sty_art')
  })

  it('does not change the style for “Create a new style…”', async () => {
    const { user, onChange, onCreateStyle } = setup()
    await user.click(screen.getByRole('button', { name: /^Your style/ }))
    await user.click(screen.getByRole('option', { name: 'Create a new style…' }))
    expect(onCreateStyle).toHaveBeenCalledTimes(1)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('can be locked', () => {
    setup({ disabled: true })
    expect(screen.getByRole('button', { name: /^Your style/ })).toBeDisabled()
  })
})
