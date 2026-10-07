import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ColourRole } from './ColourRole'

describe('ColourRole', () => {
  it('shows the bold name, a dot separator and the usage', () => {
    const { container } = render(
      <ColourRole hex="#0E7C7B" label="Teal" usage="titles, accents, left band" />
    )
    expect(container.textContent).toBe('Teal · titles, accents, left band')
    expect(screen.getByText('Teal').tagName).toBe('STRONG')
  })

  it('fills the swatch with the profile hex and names it for screen readers', () => {
    render(<ColourRole hex="#FFFFFF" label="White" usage="slide background" />)
    const swatch = screen.getByRole('img', { name: 'White swatch #FFFFFF' })
    expect(swatch).toHaveStyle({ background: '#FFFFFF' })
  })

  it('reveals the hex value in a tooltip on keyboard focus', async () => {
    const user = userEvent.setup()
    render(<ColourRole hex="#12263A" label="Navy" usage="body text" />)
    await user.tab()
    expect(screen.getByRole('tooltip')).toHaveTextContent('#12263A')
  })
})
