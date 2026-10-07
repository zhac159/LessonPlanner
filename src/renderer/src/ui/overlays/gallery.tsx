import { Copy, Download, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import type { GalleryGroup } from '../gallery'
import { Button } from '../atoms/Button/Button'
import { ConfirmDialog } from './ConfirmDialog/ConfirmDialog'
import { ContextMenu } from './ContextMenu/ContextMenu'
import { anchorBelow, type Point } from './ContextMenu/position'
import { Dialog } from './Dialog/Dialog'
import { ToastProvider, useToast } from './Toast/ToastProvider'

function MenuDemo() {
  const trigger = useRef<HTMLButtonElement>(null)
  const [anchor, setAnchor] = useState<Point | null>(null)
  return (
    <>
      <Button
        ref={trigger}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={() => trigger.current && setAnchor(anchorBelow(trigger.current))}
      >
        Lesson actions
      </Button>
      <ContextMenu
        open={anchor !== null}
        anchor={anchor}
        label="Lesson actions"
        onClose={() => setAnchor(null)}
        items={[
          { id: 'dup', label: 'Duplicate', icon: <Copy />, onSelect: () => {} },
          { id: 'export', label: 'Export to PowerPoint', icon: <Download />, onSelect: () => {} },
          { id: 'locked', label: 'Rename (coming soon)', disabled: true, onSelect: () => {} },
          { id: 'delete', label: 'Delete…', icon: <Trash2 />, danger: true, onSelect: () => {} }
        ]}
      />
    </>
  )
}

function DialogDemo() {
  const [open, setOpen] = useState<'plain' | 'confirm' | 'destructive' | null>(null)
  const close = (): void => setOpen(null)
  return (
    <>
      <Button onClick={() => setOpen('plain')}>Open dialog</Button>
      <Button onClick={() => setOpen('confirm')}>Open confirm</Button>
      <Button onClick={() => setOpen('destructive')}>Open destructive confirm</Button>
      <Dialog
        open={open === 'plain'}
        onClose={close}
        title="Rename lesson"
        description="Pick a name you will recognise next term."
        footer={
          <>
            <Button onClick={close}>Cancel</Button>
            <Button variant="primary" onClick={close}>
              Save
            </Button>
          </>
        }
      >
        <input aria-label="Lesson name" defaultValue="Photosynthesis" />
      </Dialog>
      <ConfirmDialog
        open={open === 'confirm'}
        title="Replace your slides?"
        message="The planning buddy will rebuild all 8 slides in your style."
        confirmLabel="Replace slides"
        onConfirm={close}
        onCancel={close}
      />
      <ConfirmDialog
        open={open === 'destructive'}
        title="Remove your API key?"
        message="Slide Planner won’t be able to make or change slides until you add a key again."
        confirmLabel="Remove key"
        destructive
        onConfirm={close}
        onCancel={close}
      />
    </>
  )
}

function ToastButtons() {
  const toast = useToast()
  return (
    <>
      <Button onClick={() => toast.show({ message: 'Duplicated “Photosynthesis”' })}>Plain</Button>
      <Button
        onClick={() =>
          toast.show({
            message: 'Removed notes.pdf',
            action: { label: 'Undo', onAction: () => {} }
          })
        }
      >
        With Undo
      </Button>
      <Button
        onClick={() => toast.show({ message: 'Couldn’t save that. Try again.', tone: 'error' })}
      >
        Error
      </Button>
    </>
  )
}

const gallery: GalleryGroup = {
  title: 'Overlays',
  sections: [
    { name: 'ContextMenu (arrows, Home/End, type-ahead, Esc)', render: () => <MenuDemo /> },
    {
      name: 'Dialog and ConfirmDialog (focus trap, Esc, focus returns)',
      render: () => <DialogDemo />
    },
    {
      name: 'Toast (4 s, 6 s with an action, pauses on hover)',
      render: () => (
        <ToastProvider>
          <ToastButtons />
        </ToastProvider>
      )
    }
  ]
}

export default gallery
