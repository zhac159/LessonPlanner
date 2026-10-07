import { useCallback, useState } from 'react'
import { splitByExtension } from '@ui/atoms'
import { useToast } from '@ui/overlays'
import { useClient, useShell } from '@renderer/sdk'
import {
  STYLE_LIBRARY,
  type RejectedFile,
  type StyleLibraryApi
} from '@shared/contracts/style-library'
import { rejectedMessage, rejectOnClient, STYLE_EXTENSIONS } from '../model/newLesson'

const NOT_STARTED = 'I couldn’t start that style. Try again.'

export interface StyleActions {
  /** A draft is being created from dropped or picked files. */
  busy: boolean
  /** Click or Enter on the Dropzone: native dialog, then a draft. */
  browse(): Promise<void>
  /** Files dropped on the Dropzone: PDFs and PowerPoints start a draft, the rest are reported. */
  drop(files: File[]): Promise<void>
  openStyle(styleId: string): void
  /** "Manage" and "Show all": the Styles list. */
  manage(): void
  /** "Create a new style…" in the style chip: an empty draft. */
  createStyle(): void
}

/** What the Your styles card does: open, manage, and start a style from files (03 §8). */
export function useStyleActions(): StyleActions {
  const library = useClient<StyleLibraryApi>(STYLE_LIBRARY)
  const { navigate } = useShell()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const finish = useCallback(
    (styleId: string, rejected: ReadonlyArray<RejectedFile>) => {
      const message = rejectedMessage(rejected)
      if (message) toast.show({ message })
      navigate(STYLE_LIBRARY, { kind: 'new-style', styleId })
    },
    [navigate, toast]
  )

  const browse = useCallback(async () => {
    setBusy(true)
    try {
      const result = await library.pickAndCreateDraft()
      if (!result.ok)
        return void toast.show({ message: result.message || NOT_STARTED, tone: 'error' })
      if ('cancelled' in result) return
      finish(result.styleId, result.rejected)
    } catch {
      toast.show({ message: NOT_STARTED, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }, [library, finish, toast])

  const drop = useCallback(
    async (files: File[]) => {
      const { accepted, rejected } = splitByExtension(files, STYLE_EXTENSIONS)
      if (accepted.length === 0) {
        const message = rejectedMessage(rejectOnClient(rejected))
        if (message) toast.show({ message })
        return
      }
      const skipped = rejectOnClient(rejected)
      setBusy(true)
      try {
        const result = await library.createDraft({
          paths: accepted.map((file) => window.api.files.pathFor(file))
        })
        if (!result.ok)
          return void toast.show({ message: result.message || NOT_STARTED, tone: 'error' })
        finish(result.styleId, [...skipped, ...result.rejected])
      } catch {
        toast.show({ message: NOT_STARTED, tone: 'error' })
      } finally {
        setBusy(false)
      }
    },
    [library, toast, finish]
  )

  return {
    busy,
    browse,
    drop,
    openStyle: (styleId) => navigate(STYLE_LIBRARY, { kind: 'edit-style', styleId }),
    manage: () => navigate(STYLE_LIBRARY),
    createStyle: () => navigate(STYLE_LIBRARY, { kind: 'new-style' })
  }
}
