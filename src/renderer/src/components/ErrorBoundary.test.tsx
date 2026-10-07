import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

let shouldThrow = true
function Bomb() {
  if (shouldThrow) throw new Error('kaboom')
  return <p>all good</p>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = true
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('renders its children when nothing goes wrong', () => {
    render(
      <ErrorBoundary scope="test">
        <p>fine</p>
      </ErrorBoundary>
    )
    expect(screen.getByText('fine')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows an alert with the error message and a default title', () => {
    render(
      <ErrorBoundary scope="shell">
        <Bomb />
      </ErrorBoundary>
    )
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('This part of the app hit a problem')
    expect(alert).toHaveTextContent('kaboom')
  })

  it('uses a custom title and logs the scope', () => {
    render(
      <ErrorBoundary scope="module:home" title="This module hit a problem">
        <Bomb />
      </ErrorBoundary>
    )
    expect(screen.getByRole('heading', { name: 'This module hit a problem' })).toBeInTheDocument()
    expect(console.error).toHaveBeenCalledWith(
      '[module:home] crashed',
      expect.any(Error),
      expect.any(String)
    )
  })

  it('recovers with "Try again" once the cause is fixed', async () => {
    render(
      <ErrorBoundary scope="test">
        <Bomb />
      </ErrorBoundary>
    )
    shouldThrow = false
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('all good')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
