import { Download, Play } from 'lucide-react'
import type { StyleSummary } from '@shared/contracts/style-library'
import { SwatchDot, Button } from '@ui/atoms'
import { PageHeader } from '@ui/chrome'
import { SelectChip } from '@ui/forms'
import { TitleField } from './TitleField'
import './EditorHeader.css'

export interface EditorHeaderProps {
  title: string
  /** Slides are being made or an AI job runs: rename, restyle, Present and Export wait. */
  busy: boolean
  /** The lesson has no slides yet: Present and Export wait. */
  empty: boolean
  exporting: boolean
  styles: ReadonlyArray<StyleSummary>
  /** The style the lesson uses, if it is one of `styles`. */
  styleId: string | null
  onBack(): void
  onRename(title: string): void
  onPickStyle(styleId: string): void
  onPresent(): void
  onExport(): void
}

const WAIT = 'Wait until your slides are ready'

/**
 * The editor's page header (06 §3): My lessons, the editable title, the style chip, Present and Export to PowerPoint.
 * The two buttons use `aria-disabled` so they stay focusable and can explain why they wait.
 */
export function EditorHeader({
  title,
  busy,
  empty,
  exporting,
  styles,
  styleId,
  onBack,
  onRename,
  onPickStyle,
  onPresent,
  onExport
}: EditorHeaderProps) {
  const waiting = busy || empty
  const reason = busy ? WAIT : empty ? 'Add a slide first' : undefined
  const chip =
    styles.length > 0 ? (
      <SelectChip
        label="Your style"
        className="editor-style-chip"
        options={styles.map((style) => ({
          value: style.id,
          label: style.name,
          leading: <SwatchDot color={style.primaryHex} />,
          fill: style.tintHex
        }))}
        value={styles.some((style) => style.id === styleId) ? (styleId ?? undefined) : undefined}
        placeholder="Plain style"
        disabled={busy}
        onChange={onPickStyle}
      />
    ) : null

  return (
    <PageHeader
      variant="editor"
      className="editor-header"
      back={{ label: 'My lessons', onClick: onBack }}
      center={<TitleField title={title} disabled={busy} onCommit={onRename} />}
      actions={
        <>
          {chip}
          <Button
            icon={<Play strokeWidth={2.2} />}
            aria-disabled={waiting || undefined}
            title={reason}
            onClick={onPresent}
          >
            Present
          </Button>
          <Button
            variant="primary"
            icon={<Download strokeWidth={2.2} />}
            loading={exporting}
            loadingLabel="Exporting…"
            aria-disabled={waiting || undefined}
            title={reason}
            onClick={onExport}
          >
            Export to PowerPoint
          </Button>
        </>
      }
    />
  )
}
