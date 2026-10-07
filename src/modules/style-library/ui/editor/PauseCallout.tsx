import { Button, Callout } from '@ui/atoms'
import type { PauseCopy } from '../model/messages'

export interface PauseCalloutProps {
  copy: PauseCopy
  /** "Carry on": restart the paused queue. */
  onResume: () => void
  /** "Connect Claude" / "Open Settings": go to Settings → Claude. */
  onConnect: () => void
}

/** Shown at the top of Your files while the queue is paused for an account or network problem (04 §5). */
export function PauseCallout({ copy, onResume, onConnect }: PauseCalloutProps) {
  return (
    <Callout
      variant="error"
      action={
        <span className="cs-pause__actions">
          {copy.action === 'console' && (
            <a
              className="cs-pause__link"
              href="https://platform.claude.com/"
              target="_blank"
              rel="noreferrer"
            >
              Open platform.claude.com ↗
            </a>
          )}
          {(copy.action === 'connect' || copy.action === 'settings') && (
            <Button size="sm" variant="dark" onClick={onConnect}>
              {copy.action === 'connect' ? 'Connect Claude' : 'Open Settings'}
            </Button>
          )}
          <Button size="sm" onClick={onResume}>
            Carry on
          </Button>
        </span>
      }
    >
      {copy.message}
    </Callout>
  )
}
