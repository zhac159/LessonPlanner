import { useEffect, useState } from 'react'
import { useClient, useEvent } from '@renderer/sdk'
import {
  STYLE_LIBRARY,
  type StyleLibraryApi,
  type StyleLibraryEvents
} from '@shared/contracts/style-library'

/** The name of the lesson's style for "Knows your Science style"; null while unknown or for the plain style. */
export function useStyleName(styleId: string | null): string | null {
  const client = useClient<StyleLibraryApi>(STYLE_LIBRARY)
  const [name, setName] = useState<string | null>(null)
  const [stamp, setStamp] = useState(0)
  useEvent<StyleLibraryEvents, 'changed'>(STYLE_LIBRARY, 'changed', () => setStamp((n) => n + 1))
  useEffect(() => {
    let live = true
    if (!styleId) {
      setName(null)
      return
    }
    client
      .list()
      .then((styles) => live && setName(styles.find((s) => s.id === styleId)?.name ?? null))
      .catch(() => live && setName(null))
    return () => {
      live = false
    }
  }, [client, styleId, stamp])
  return name
}
