import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Composer } from './Composer'

const box = (): HTMLTextAreaElement =>
  screen.getByRole('textbox', { name: 'Message your planning buddy' })

describe('Composer: asset chips, blocked Send and the notice line', () => {
  it('draws the staged extras with the other staged items', () => {
    render(
      <Composer value="Put it here" onChange={() => {}} onSend={() => {}} staged={<b>a chip</b>} />
    )
    expect(screen.getByText('a chip')).toBeInTheDocument()
  })

  it('turns Send off, even for Enter, while the message cannot be sent', async () => {
    const onSend = vi.fn()
    render(
      <Composer
        value="Add {{unicorn}}"
        onChange={() => {}}
        onSend={onSend}
        sendBlocked
        notice="No asset called unicorn."
      />
    )
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('No asset called unicorn.')
    box().focus()
    await userEvent.setup().keyboard('{Enter}')
    expect(onSend).not.toHaveBeenCalled()
  })

  it('shows no notice by default and sends as before', async () => {
    const onSend = vi.fn()
    render(<Composer value="Hello" onChange={() => {}} onSend={onSend} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Send' }))
    expect(onSend).toHaveBeenCalledTimes(1)
  })
})
