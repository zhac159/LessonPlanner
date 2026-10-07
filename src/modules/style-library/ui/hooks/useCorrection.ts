import { useCallback, useState } from 'react'
import { useClient } from '@renderer/sdk'
import type { StyleLibraryApi } from '@shared/contracts/style-library'
import { MODULE_ID } from '../../shared'

export interface Correction {
  value: string
  setValue(text: string): void
  busy: boolean
  /** The AI error copy, shown under the box; the text stays in the field. */
  error: string | undefined
  /** Claude's one-line message after the last successful correction. */
  confirmation: string | undefined
  submit(text: string): Promise<void>
}

/**
 * "Anything I got wrong?": sends the correction to main, which asks Claude and bumps the profile version.
 * The panel and the test slide update through the usual `progress` event; `reload` is the fallback.
 */
export function useCorrection(styleId: string | null, reload: () => Promise<unknown>): Correction {
  const styles = useClient<StyleLibraryApi>(MODULE_ID)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [confirmation, setConfirmation] = useState<string | undefined>()

  const submit = useCallback(
    async (text: string): Promise<void> => {
      if (!styleId || busy) return
      setBusy(true)
      setError(undefined)
      try {
        const result = await styles.correct({ styleId, text })
        if (result.ok) {
          setConfirmation(result.message)
          setValue('')
          await reload()
        } else {
          setError(result.message)
        }
      } catch {
        setError('Something went wrong talking to Claude.')
      } finally {
        setBusy(false)
      }
    },
    [busy, reload, styleId, styles]
  )

  return { value, setValue, busy, error, confirmation, submit }
}
