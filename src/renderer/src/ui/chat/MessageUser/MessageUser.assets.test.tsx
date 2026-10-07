import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MessageUser } from './MessageUser'

describe('MessageUser: custom text drawing', () => {
  it('lets the caller draw the text (asset chips)', () => {
    render(
      <MessageUser
        text="Put {{school_logo}} here"
        renderText={(text) => <span data-testid="drawn">{text.toUpperCase()}</span>}
      />
    )
    expect(screen.getByTestId('drawn')).toHaveTextContent('PUT {{SCHOOL_LOGO}} HERE')
  })

  it('shows the text as typed without it', () => {
    render(<MessageUser text="Put {{school_logo}} here" />)
    expect(screen.getByText('Put {{school_logo}} here')).toBeInTheDocument()
  })
})
