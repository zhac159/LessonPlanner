import { Button } from '@ui/atoms'
import { Dialog } from '@ui/overlays'

export interface HomeExportSpotsDialogProps {
  /** Empty picture spots the export found; null = closed. */
  count: number | null
  busy: boolean
  onExportAnyway(): void
  onOpenLesson(): void
  onCancel(): void
}

/** "{n} picture spots are empty and will be skipped": Esc exports nothing. */
export function HomeExportSpotsDialog({
  count,
  busy,
  onExportAnyway,
  onOpenLesson,
  onCancel
}: HomeExportSpotsDialogProps) {
  const n = count ?? 0
  return (
    <Dialog
      open={count !== null}
      onClose={onCancel}
      title={
        n === 1
          ? '1 picture spot is empty and will be skipped'
          : `${n} picture spots are empty and will be skipped`
      }
      description="They won’t appear in the PowerPoint. Open the lesson to fill them, or export without them."
      size="sm"
      dismissible={!busy}
      footer={
        <>
          <Button variant="secondary" loading={busy} onClick={onExportAnyway}>
            Export anyway
          </Button>
          <Button variant="primary" disabled={busy} data-autofocus="" onClick={onOpenLesson}>
            Open lesson
          </Button>
        </>
      }
    />
  )
}
