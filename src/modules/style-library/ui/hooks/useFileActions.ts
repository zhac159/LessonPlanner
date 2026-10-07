import { useCallback, useState } from 'react'
import { useClient } from '@renderer/sdk'
import type {
  AddedFiles,
  RejectedFile,
  StyleFile,
  StyleLibraryApi
} from '@shared/contracts/style-library'
import type { Result } from '@shared/result'
import { useToast } from '@ui/overlays'
import { MODULE_ID } from '../../shared'
import { rejectionMessages } from '../model/messages'

/** `count` dropped items that were not PDF or PowerPoint, as rejections. */
const notFiles = (count: number): RejectedFile[] =>
  Array.from({ length: count }, () => ({ name: '', reason: 'type' as const }))

export interface FileActions {
  /** Files are being added: the Dropzone shows "Adding n files…". */
  adding: number
  /** Dropped files that are PDF or PowerPoint. */
  addDropped(files: File[]): Promise<void>
  /** Tells her that `count` dropped files were not PDF or PowerPoint. */
  skip(count: number): void
  /** Opens the native file dialog. */
  browse(): Promise<void>
  remove(file: StyleFile): Promise<void>
  retry(file: StyleFile): Promise<void>
  /** "Carry on" after the queue paused. */
  resume(): Promise<void>
}

export interface FileActionsOptions {
  /** Null while the draft does not exist yet: the first files create it. */
  styleId: string | null
  /** A draft was created from the first files. */
  onCreated(styleId: string): void
  /** Ask main for the whole view again (after a removal or restore, which have no file event). */
  reload(): Promise<unknown>
}

/**
 * Everything the files card does: add (drop or dialog), remove with an Undo toast, retry and resume.
 * Failures and skipped files are told to her in toasts; the file list itself updates from events.
 */
export function useFileActions({ styleId, onCreated, reload }: FileActionsOptions): FileActions {
  const styles = useClient<StyleLibraryApi>(MODULE_ID)
  const toast = useToast()
  const [adding, setAdding] = useState(0)

  const tell = useCallback(
    (messages: string[]) => messages.forEach((message) => toast.show({ message })),
    [toast]
  )
  const fail = useCallback(
    (message: string): void => void toast.show({ message, tone: 'error' }),
    [toast]
  )

  const report = useCallback(
    (result: Result<Partial<AddedFiles> & { styleId?: string; cancelled?: true }>) => {
      if (!result.ok) return fail(result.message)
      if (result.styleId) onCreated(result.styleId)
      tell(rejectionMessages(result.rejected ?? []))
    },
    [fail, onCreated, tell]
  )

  const guarded = useCallback(
    async (count: number, run: () => Promise<void>): Promise<void> => {
      setAdding(count)
      try {
        await run()
      } catch {
        fail('Couldn’t add those files. Please try again.')
      } finally {
        setAdding(0)
      }
    },
    [fail]
  )

  const addDropped = useCallback(
    (files: File[]) =>
      guarded(files.length, async () => {
        const paths = files.map((file) => window.api.files.pathFor(file))
        if (paths.length === 0) return
        report(
          styleId ? await styles.addFiles({ styleId, paths }) : await styles.createDraft({ paths })
        )
      }),
    [guarded, report, styleId, styles]
  )

  const skip = useCallback((count: number) => tell(rejectionMessages(notFiles(count))), [tell])

  const browse = useCallback(
    () =>
      guarded(0, async () => {
        const result = styleId
          ? await styles.pickFiles({ styleId })
          : await styles.pickAndCreateDraft()
        if (result.ok && 'cancelled' in result) return
        report(result as Result<AddedFiles & { styleId?: string }>)
      }),
    [guarded, report, styleId, styles]
  )

  const remove = useCallback(
    async (file: StyleFile) => {
      if (!styleId) return
      const result = await styles.removeFile({ styleId, fileId: file.id })
      if (!result.ok) return fail(result.message)
      void reload()
      toast.show({
        message: `Removed ${file.name}`,
        action: {
          label: 'Undo',
          onAction: () => {
            void styles
              .restoreFile({ styleId, fileId: file.id })
              .then((undone) => (undone.ok ? reload() : fail(undone.message)))
          }
        }
      })
    },
    [fail, reload, styleId, styles, toast]
  )

  const retry = useCallback(
    async (file: StyleFile) => {
      if (!styleId) return
      const result = await styles.retryFile({ styleId, fileId: file.id })
      if (!result.ok) fail(result.message)
    },
    [fail, styleId, styles]
  )

  const resume = useCallback(async () => {
    if (!styleId) return
    const result = await styles.resume({ styleId })
    if (!result.ok) fail(result.message)
  }, [fail, styleId, styles])

  return { adding, addDropped, skip, browse, remove, retry, resume }
}
