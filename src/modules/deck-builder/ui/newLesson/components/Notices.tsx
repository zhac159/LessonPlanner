import { Button, Callout } from '@ui/atoms'
import { MessageAssistant, MessageProgress } from '@ui/chat'

export const CONNECT_PROMPT = 'Connect Claude to use this.'

export interface NoticesProps {
  /** The lesson is being made. */
  creating: boolean
  /** Why the lesson was not made, or null. */
  error: string | null
  /** Offer "Try again" with the error. */
  retryable: boolean
  /** Make my slides was pressed with no key (nothing was sent). */
  needsKey: boolean
  /** A readable problem with the last document, or null. */
  documentError: string | null
  onRetry(): void
  onConnect(): void
  onDismissDocumentError(): void
}

/** What the transcript adds after the intro: progress, errors and the Connect Claude prompt. */
export function Notices({
  creating,
  error,
  retryable,
  needsKey,
  documentError,
  onRetry,
  onConnect,
  onDismissDocumentError
}: NoticesProps) {
  return (
    <>
      {documentError && (
        <Callout variant="error" onDismiss={onDismissDocumentError}>
          {documentError}
        </Callout>
      )}
      {needsKey && (
        <Callout
          variant="action"
          action={
            <Button variant="primary" size="sm" onClick={onConnect}>
              Connect Claude
            </Button>
          }
        >
          {CONNECT_PROMPT}
        </Callout>
      )}
      {creating && <MessageProgress label="Starting your lesson…" />}
      {error && (
        <MessageAssistant
          variant="error"
          text={error}
          action={retryable ? { label: 'Try again', onClick: onRetry } : undefined}
        />
      )}
    </>
  )
}
