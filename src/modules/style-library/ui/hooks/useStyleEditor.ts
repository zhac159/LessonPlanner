import { useCallback, useState } from 'react'
import { useClient } from '@renderer/sdk'
import type { StyleLibraryApi } from '@shared/contracts/style-library'
import { useToast } from '@ui/overlays'
import { MODULE_ID } from '../../shared'
import { savedMessage } from '../model/messages'
import { pendingFiles } from '../model/progressText'
import { useCorrection, type Correction } from './useCorrection'
import { useFileActions, type FileActions } from './useFileActions'
import { useLearnedAnnouncement } from './useLearnedAnnouncement'
import { useStyleDraft, type StyleDraft } from './useStyleDraft'
import { useStyleIdentity, DEFAULT_NAME, type StyleIdentity } from './useStyleIdentity'

export interface StyleEditorOptions {
  /** The style to show; null starts an empty draft that is created by its first files. */
  styleId: string | null
  mode: 'new' | 'edit'
  /** Her subject from Welcome (the starting name of a new draft). */
  subject?: string | null
  /** She has no other style: the default checkbox starts ticked. */
  firstStyle: boolean
  /** The style was saved (the screen goes Home). */
  onSaved(): void
}

export interface StyleEditor {
  styleId: string | null
  draft: StyleDraft
  identity: StyleIdentity
  files: FileActions
  correction: Correction
  /** "Learned from {file name}" for the live region. */
  announcement: string
  canSave: boolean
  saving: boolean
  save(): Promise<void>
}

/** The whole Create a style screen's state and actions, composed from small hooks. */
export function useStyleEditor({
  styleId: initialId,
  mode,
  subject,
  firstStyle,
  onSaved
}: StyleEditorOptions): StyleEditor {
  const styles = useClient<StyleLibraryApi>(MODULE_ID)
  const toast = useToast()
  const [styleId, setStyleId] = useState<string | null>(initialId)
  const [saving, setSaving] = useState(false)
  const draft = useStyleDraft(styleId)
  const { view, reload, adopt } = draft

  const identity = useStyleIdentity({
    styleId,
    view,
    adopt,
    initialName: subject?.trim() || DEFAULT_NAME,
    initialDefault: firstStyle
  })
  const files = useFileActions({ styleId, onCreated: setStyleId, reload })
  const correction = useCorrection(styleId, reload)
  const announcement = useLearnedAnnouncement(view?.files ?? [])

  const hasLearned = (view?.progress.learned ?? 0) > 0
  const canSave = hasLearned && !saving && (mode === 'new' || identity.changed)

  const save = useCallback(async (): Promise<void> => {
    if (!styleId || !view || saving) return
    setSaving(true)
    try {
      if (!(await identity.flush())) return
      const result = await styles.save({ styleId })
      if (!result.ok) {
        toast.show({ message: result.message, tone: 'error' })
        return
      }
      toast.show({ message: savedMessage(identity.name.trim(), pendingFiles(view.progress)) })
      onSaved()
    } finally {
      setSaving(false)
    }
  }, [identity, onSaved, saving, styleId, styles, toast, view])

  return { styleId, draft, identity, files, correction, announcement, canSave, saving, save }
}
