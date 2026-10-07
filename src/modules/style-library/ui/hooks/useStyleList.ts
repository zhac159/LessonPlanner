import { useCallback, useEffect, useState } from 'react'
import { useClient, useEvent } from '@renderer/sdk'
import type { StyleLibraryEvents, StyleSummary } from '@shared/contracts/style-library'
import { useToast } from '@ui/overlays'
import { MODULE_ID, type StyleLibraryFullApi } from '../../shared'

export interface StyleList {
  /** Default first, then most recently changed (as main sorts them); null while loading. */
  styles: StyleSummary[] | null
  error: string | null
  setDefault(style: StyleSummary): Promise<void>
  remove(style: StyleSummary): Promise<boolean>
}

/** All styles for the Styles page; stays live through the `changed` event. */
export function useStyleList(): StyleList {
  const client = useClient<StyleLibraryFullApi>(MODULE_ID)
  const toast = useToast()
  const [styles, setStyles] = useState<StyleSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    client
      .list()
      .then((list) => alive && setStyles(list))
      .catch(() => alive && setError('Couldn’t load your styles.'))
    return () => {
      alive = false
    }
  }, [client])

  useEvent<StyleLibraryEvents, 'changed'>(MODULE_ID, 'changed', setStyles)

  const setDefault = useCallback(
    async (style: StyleSummary) => {
      const result = await client.update({
        styleId: style.id,
        isDefault: true
      })
      if (result.ok) toast.show({ message: `“${style.name}” is now your default style` })
      else toast.show({ message: result.message, tone: 'error' })
    },
    [client, toast]
  )

  const remove = useCallback(
    async (style: StyleSummary) => {
      const result = await client.deleteStyle({ styleId: style.id })
      toast.show(
        result.ok
          ? { message: `Deleted “${style.name}”` }
          : { message: result.message, tone: 'error' }
      )
      return result.ok
    },
    [client, toast]
  )

  return { styles, error, setDefault, remove }
}
