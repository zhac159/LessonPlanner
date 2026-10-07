import { Copy, ExternalLink, FileDown, Pencil, Trash2 } from 'lucide-react'
import { ConfirmDialog, ContextMenu, type MenuItem } from '@ui/overlays'
import type { LessonSummary } from '@shared/contracts/deck-builder'
import type { LessonActions } from '../hooks/useLessonActions'
import { HomeExportSpotsDialog } from './ExportSpotsDialog'
import { RenameLessonDialog } from './RenameLessonDialog'

/** The ⋯ menu entries for one lesson (03 §5). A lesson still generating cannot be copied or exported. */
export function lessonMenuItems(lesson: LessonSummary, actions: LessonActions): MenuItem[] {
  const generating = lesson.status === 'generating'
  return [
    { id: 'open', label: 'Open', icon: <ExternalLink />, onSelect: () => actions.open(lesson) },
    {
      id: 'duplicate',
      label: 'Duplicate',
      icon: <Copy />,
      disabled: generating,
      onSelect: () => void actions.duplicate(lesson)
    },
    {
      id: 'rename',
      label: 'Rename…',
      icon: <Pencil />,
      disabled: generating,
      onSelect: () => actions.startRename(lesson)
    },
    {
      id: 'export',
      label: 'Export to PowerPoint',
      icon: <FileDown />,
      disabled: generating,
      onSelect: () => void actions.exportPptx(lesson)
    },
    {
      id: 'delete',
      label: 'Delete…',
      icon: <Trash2 />,
      danger: true,
      onSelect: () => actions.askDelete(lesson)
    }
  ]
}

/** The card menu, the Rename dialog and the Delete confirmation, driven by `useLessonActions`. */
export function LessonOverlays({ actions }: { actions: LessonActions }) {
  const { menu, renaming, deleting } = actions
  return (
    <>
      <ContextMenu
        open={menu !== null}
        anchor={menu?.anchor ?? null}
        items={menu ? lessonMenuItems(menu.lesson, actions) : []}
        onClose={actions.closeMenu}
        label="Lesson actions"
      />
      <RenameLessonDialog
        title={renaming?.title ?? null}
        busy={actions.busy}
        error={actions.renameError}
        onSave={(title) => void actions.saveRename(title)}
        onCancel={actions.cancelRename}
      />
      <HomeExportSpotsDialog
        count={actions.spots?.count ?? null}
        busy={actions.busy}
        onExportAnyway={() => void actions.exportAnyway()}
        onOpenLesson={actions.openSpotsLesson}
        onCancel={actions.cancelSpots}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="Delete this lesson?"
        message={`“${deleting?.title ?? ''}” will move to the Recycle Bin.`}
        confirmLabel="Delete"
        destructive
        busy={actions.busy}
        onConfirm={() => void actions.confirmDelete()}
        onCancel={actions.cancelDelete}
      />
    </>
  )
}
