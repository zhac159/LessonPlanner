import { useMemo } from 'react'
import { useClient } from '@renderer/sdk'
import { useToast } from '@ui/overlays'
import { DECK_BUILDER, type DeckBuilderApi } from '@shared/contracts/deck-builder'
import type { ChatItem } from '@shared/contracts/deck-builder-chat'

export const CONSOLE_URL = 'https://platform.claude.com/'
export const PLUGINS_SOON = 'More plugins are coming soon.'
const FILE_FAILED = 'Couldn’t open that file.'

/** What the buttons in the transcript do besides talking to Claude. */
export interface ErrorHandlers {
  retry(): void
  settings(): void
  finish(): void
}

/** Opening files a plugin made, the single action under an error message, and the plugin manager placeholder. */
export function useFileActions() {
  const client = useClient<DeckBuilderApi>(DECK_BUILDER)
  const toast = useToast()
  return useMemo(() => {
    const report = async (call: Promise<{ ok: boolean }>): Promise<void> => {
      try {
        const result = await call
        if (!result.ok) toast.show({ message: FILE_FAILED, tone: 'error' })
      } catch {
        toast.show({ message: FILE_FAILED, tone: 'error' })
      }
    }
    return {
      open: (path: string): void => void report(client.openExport({ path })),
      show: (path: string): void => void report(client.showExport({ path })),
      managePlugins: (): void => void toast.show({ message: PLUGINS_SOON }),
      /** The one action of an error message: Try again, Open Settings, Open platform.claude.com or Finish the rest. */
      errorAction(item: ChatItem, handlers: ErrorHandlers): void {
        const action = item.error?.action
        if (action === 'retry') handlers.retry()
        else if (action === 'settings') handlers.settings()
        else if (action === 'finish') handlers.finish()
        else if (action === 'console') window.open(CONSOLE_URL, '_blank', 'noopener')
      }
    }
  }, [client, toast])
}
