import { Pencil } from 'lucide-react'
import type { DragEvent, ReactNode } from 'react'
import { cx } from '../../atoms/cx'
import { Button } from '../../atoms/Button/Button'
import { Callout } from '../../atoms/Callout/Callout'
import { CardHeaderBand } from '../../atoms/CardHeaderBand/CardHeaderBand'
import { StatusPill, type StatusTone } from '../../atoms/StatusPill/StatusPill'
import { useStickToBottom } from './useStickToBottom'
import './ChatPanel.css'

export interface ChatPanelProps {
  /** Panel title (default "Your planning buddy"). */
  title?: string
  /** Under the title: "Knows your Science style". */
  subtitle?: string
  /** A status word in the header, e.g. "Working" or "Ready". */
  status?: { label: string; tone?: StatusTone }
  /** Shows an "Offline" pill: Claude cannot be reached. */
  offline?: boolean
  /** No API key: the list leads with "Connect Claude to start" and its button. */
  needsKey?: boolean
  onConnect?: () => void
  /** Files dropped anywhere on the panel. */
  onDropFiles?: (files: File[]) => void
  /** The messages (MessageUser, MessageAssistant, MessageProgress), oldest first. */
  children?: ReactNode
  /** The footer: normally a `Composer`. */
  composer?: ReactNode
  className?: string
}

const hasFiles = (event: DragEvent): boolean => event.dataTransfer.types.includes('Files')

/** The planning buddy's panel: yellow header, scrolling live message log, composer footer. */
export function ChatPanel({
  title = 'Your planning buddy',
  subtitle,
  status,
  offline = false,
  needsKey = false,
  onConnect,
  onDropFiles,
  children,
  composer,
  className
}: ChatPanelProps) {
  const { ref, onScroll, away, jump } = useStickToBottom<HTMLDivElement>()
  const pills = status || offline

  const handleDrop = (event: DragEvent): void => {
    if (!onDropFiles || !hasFiles(event)) return
    event.preventDefault()
    onDropFiles(Array.from(event.dataTransfer.files))
  }

  return (
    <aside
      className={cx('ui-chat', className)}
      aria-label={title}
      onDragOver={(event) => onDropFiles && hasFiles(event) && event.preventDefault()}
      onDrop={handleDrop}
    >
      <CardHeaderBand
        tone="yellow"
        level={2}
        title={title}
        subtitle={subtitle}
        leading={
          <span className="ui-chat__badge" aria-hidden="true">
            <Pencil size={20} strokeWidth={2.2} />
          </span>
        }
        trailing={
          pills && (
            <span className="ui-chat__pills">
              {status && <StatusPill tone={status.tone ?? 'neutral'}>{status.label}</StatusPill>}
              {offline && <StatusPill tone="neutral">Offline</StatusPill>}
            </span>
          )
        }
      />
      <div className="ui-chat__body">
        <div
          ref={ref}
          className="ui-chat__list"
          role="log"
          aria-live="polite"
          aria-label="Conversation"
          tabIndex={0}
          onScroll={onScroll}
        >
          {needsKey && (
            <Callout
              variant="info"
              title="Connect Claude to start"
              action={
                <Button variant="primary" size="sm" onClick={onConnect}>
                  Connect Claude
                </Button>
              }
            />
          )}
          {children}
        </div>
        {away && (
          <div className="ui-chat__jump">
            <Button size="sm" onClick={jump}>
              Jump to latest
            </Button>
          </div>
        )}
      </div>
      {composer && <footer className="ui-chat__footer">{composer}</footer>}
    </aside>
  )
}
