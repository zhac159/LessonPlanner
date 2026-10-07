import { useCallback, useRef, useState } from 'react'
import { DECK_BUILDER, type EditorApi } from '@shared/contracts/deck-builder'
import { useClient } from '@renderer/sdk'
import { useToast } from '@ui/overlays'
import { exportOutcome } from '../logic/exportMessages'

export interface PptxExport {
  /** The Save dialog or the write is in progress ("Exporting…"). */
  exporting: boolean
  /** Picture spots are still empty and nothing was saved: the editor asks before going on (A12). */
  spotsPrompt: { count: number; slides: number[] } | null
  start(): Promise<void>
  /** "Export anyway": exports again, leaving the empty spots out. */
  startIgnoringSpots(): Promise<void>
  /** Closes the question without exporting. */
  dismissSpots(): void
}

/**
 * Export to PowerPoint (06 §8.11): native Save dialog in main, then a toast that says how it went. While picture
 * spots are empty main answers `spots` first; the editor asks, and "Export anyway" calls again with `ignoreSpots`.
 */
export function usePptxExport(lessonId: string): PptxExport {
  const client = useClient<EditorApi>(DECK_BUILDER)
  const toast = useToast()
  const [exporting, setExporting] = useState(false)
  const [spotsPrompt, setSpotsPrompt] = useState<PptxExport['spotsPrompt']>(null)
  const running = useRef(false)

  const run = useCallback(
    async (ignoreSpots: boolean) => {
      if (running.current) return
      running.current = true
      setExporting(true)
      try {
        const result = await client.exportPptx({
          lessonId,
          ...(ignoreSpots ? { ignoreSpots } : {})
        })
        if (result.status === 'spots') {
          setSpotsPrompt({ count: result.count, slides: result.slides })
          return
        }
        setSpotsPrompt(null)
        const outcome = exportOutcome(result)
        if (!outcome) return
        if (outcome.kind === 'error') {
          toast.show({ message: outcome.message, tone: 'error' })
          return
        }
        toast.show({
          message: outcome.message,
          durationMs: 10000,
          action: {
            label: 'Open in PowerPoint',
            onAction: () => void client.openExport({ path: outcome.path }).catch(() => {})
          }
        })
      } catch {
        setSpotsPrompt(null)
        toast.show({ message: 'Couldn’t save the file. Try another folder.', tone: 'error' })
      } finally {
        running.current = false
        setExporting(false)
      }
    },
    [client, lessonId, toast]
  )

  const start = useCallback(() => run(false), [run])
  const startIgnoringSpots = useCallback(() => run(true), [run])
  const dismissSpots = useCallback(() => setSpotsPrompt(null), [])
  return { exporting, spotsPrompt, start, startIgnoringSpots, dismissSpots }
}
