import { Button } from '@ui/atoms'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import './ModuleHost.css'

interface ErrorBoundaryProps {
  /** Shown in the console log, e.g. "module:home" or "shell". */
  scope: string
  title?: string
  children: ReactNode
}

/**
 * Catches render errors below it and shows an error card instead of a blank window.
 * Used per module (one crash leaves the rest of the app working) and around the whole shell
 * (so the title bar and its close button always survive).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[${this.props.scope}] crashed`, error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="module-error" role="alert">
        <h2>{this.props.title ?? 'This part of the app hit a problem'}</h2>
        <p>{this.state.error.message}</p>
        <Button variant="secondary" onClick={() => this.setState({ error: null })}>
          Try again
        </Button>
      </div>
    )
  }
}
