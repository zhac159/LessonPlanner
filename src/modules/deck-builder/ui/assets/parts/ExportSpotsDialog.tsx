import { Button } from '@ui/atoms'
import { Dialog } from '@ui/overlays'

export interface ExportSpotsDialogProps {
  /** Empty spots found by the export; null = closed. */
  count: number | null
  /** "Fill them first": opens A13 for the first one. */
  onFill(): void
  /** "Export anyway": exports again with `ignoreSpots`. */
  onExportAnyway(): void
  /** Esc or a click outside: nothing is exported. */
  onCancel(): void
  busy?: boolean
}

/**
 * "3 picture spots are still empty": they will not appear in the PowerPoint. A `Dialog` rather than a `ConfirmDialog`,
 * because Esc must mean "do nothing", not "export anyway".
 */
export function ExportSpotsDialog({
  count,
  onFill,
  onExportAnyway,
  onCancel,
  busy = false
}: ExportSpotsDialogProps) {
  const n = count ?? 0
  return (
    <Dialog
      open={count !== null}
      onClose={onCancel}
      title={n === 1 ? '1 picture spot is still empty' : `${n} picture spots are still empty`}
      description="They won’t appear in the PowerPoint. Fill them first, or export without them."
      size="sm"
      dismissible={!busy}
      footer={
        <>
          <Button variant="secondary" loading={busy} onClick={onExportAnyway}>
            Export anyway
          </Button>
          <Button variant="primary" disabled={busy} data-autofocus="" onClick={onFill}>
            Fill them first
          </Button>
        </>
      }
    />
  )
}
