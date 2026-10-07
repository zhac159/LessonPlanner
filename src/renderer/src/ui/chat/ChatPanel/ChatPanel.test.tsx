import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChatPanel } from './ChatPanel'
import { NEAR_BOTTOM_PX } from './useStickToBottom'

/** happy-dom has no layout: give the log a scrollable geometry. */
function geometry(log: HTMLElement, scrollHeight: number, clientHeight: number): void {
  Object.defineProperty(log, 'scrollHeight', { configurable: true, value: scrollHeight })
  Object.defineProperty(log, 'clientHeight', { configurable: true, value: clientHeight })
}

describe('ChatPanel', () => {
  it('is a labelled complementary region with the title as heading', () => {
    render(<ChatPanel subtitle="Knows your Science style" />)
    const panel = screen.getByRole('complementary', { name: 'Your planning buddy' })
    expect(panel).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your planning buddy' })).toBeInTheDocument()
    expect(screen.getByText('Knows your Science style')).toBeInTheDocument()
  })

  it('shows a custom title', () => {
    render(<ChatPanel title="Quiz maker" />)
    expect(screen.getByRole('complementary', { name: 'Quiz maker' })).toBeInTheDocument()
  })

  it('shows its messages in a polite live log', () => {
    render(
      <ChatPanel>
        <p>Hello there</p>
      </ChatPanel>
    )
    const log = screen.getByRole('log', { name: 'Conversation' })
    expect(log).toHaveAttribute('aria-live', 'polite')
    expect(log).toHaveTextContent('Hello there')
  })

  it('puts the composer slot in the footer', () => {
    render(<ChatPanel composer={<div>composer here</div>} />)
    expect(screen.getByRole('contentinfo')).toHaveTextContent('composer here')
  })

  it('has no footer without a composer', () => {
    render(<ChatPanel />)
    expect(screen.queryByRole('contentinfo')).toBeNull()
  })

  it('shows a status pill and an offline pill when asked', () => {
    const { rerender } = render(<ChatPanel />)
    expect(screen.queryByText('Offline')).toBeNull()
    rerender(<ChatPanel status={{ label: 'Working', tone: 'working' }} offline />)
    expect(screen.getByText('Working')).toBeInTheDocument()
    expect(screen.getByText('Offline')).toBeInTheDocument()
  })

  describe('no API key', () => {
    it('leads with "Connect Claude to start" and a button that connects', async () => {
      const onConnect = vi.fn()
      render(<ChatPanel needsKey onConnect={onConnect} />)
      expect(screen.getByText('Connect Claude to start')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Connect Claude' }))
      expect(onConnect).toHaveBeenCalledTimes(1)
    })

    it('shows no prompt when a key is set', () => {
      render(<ChatPanel />)
      expect(screen.queryByText('Connect Claude to start')).toBeNull()
    })
  })

  describe('scrolling', () => {
    it('follows the newest message while she is at the bottom', () => {
      const { rerender } = render(<ChatPanel>one</ChatPanel>)
      const log = screen.getByRole('log')
      geometry(log, 1000, 400)
      rerender(<ChatPanel>one two</ChatPanel>)
      expect(log.scrollTop).toBe(1000)
      expect(screen.queryByRole('button', { name: 'Jump to latest' })).toBeNull()
    })

    it('stops following when she scrolls up more than the threshold and offers a jump', () => {
      const { rerender } = render(<ChatPanel>one</ChatPanel>)
      const log = screen.getByRole('log')
      geometry(log, 1000, 400)
      log.scrollTop = 1000 - 400 - (NEAR_BOTTOM_PX + 20)
      fireEvent.scroll(log)
      const before = log.scrollTop
      rerender(<ChatPanel>one two</ChatPanel>)
      expect(log.scrollTop).toBe(before)
      expect(screen.getByRole('button', { name: 'Jump to latest' })).toBeInTheDocument()
    })

    it('keeps following when she is within the threshold of the bottom', () => {
      render(<ChatPanel>one</ChatPanel>)
      const log = screen.getByRole('log')
      geometry(log, 1000, 400)
      log.scrollTop = 1000 - 400 - (NEAR_BOTTOM_PX - 10)
      fireEvent.scroll(log)
      expect(screen.queryByRole('button', { name: 'Jump to latest' })).toBeNull()
    })

    it('jumps to the latest and hides the button', async () => {
      render(<ChatPanel>one</ChatPanel>)
      const log = screen.getByRole('log')
      geometry(log, 1000, 400)
      log.scrollTop = 0
      fireEvent.scroll(log)
      await userEvent.click(screen.getByRole('button', { name: 'Jump to latest' }))
      expect(log.scrollTop).toBe(1000)
      expect(screen.queryByRole('button', { name: 'Jump to latest' })).toBeNull()
    })

    it('follows content that grows inside a child without a re-render', async () => {
      render(
        <ChatPanel>
          <div data-testid="msg">a</div>
        </ChatPanel>
      )
      const log = screen.getByRole('log')
      geometry(log, 1200, 400)
      await act(async () => {
        screen.getByTestId('msg').append(document.createTextNode(' more'))
        await Promise.resolve()
      })
      expect(log.scrollTop).toBe(1200)
    })
  })

  describe('dropping files', () => {
    const dropOn = (target: HTMLElement, files: File[]): void => {
      fireEvent.drop(target, { dataTransfer: { types: ['Files'], files } })
    }

    it('hands dropped files to onDropFiles', () => {
      const onDropFiles = vi.fn()
      render(<ChatPanel onDropFiles={onDropFiles} />)
      const file = new File(['x'], 'LOs.docx')
      dropOn(screen.getByRole('complementary'), [file])
      expect(onDropFiles).toHaveBeenCalledWith([file])
    })

    it('ignores drops that are not files', () => {
      const onDropFiles = vi.fn()
      render(<ChatPanel onDropFiles={onDropFiles} />)
      fireEvent.drop(screen.getByRole('complementary'), {
        dataTransfer: { types: ['text/plain'], files: [] }
      })
      expect(onDropFiles).not.toHaveBeenCalled()
    })

    it('does nothing without a handler', () => {
      render(<ChatPanel />)
      expect(() =>
        dropOn(screen.getByRole('complementary'), [new File(['x'], 'a.pdf')])
      ).not.toThrow()
    })
  })
})
