import { useEffect, useState } from 'react'
import { useClient } from '@renderer/sdk'
import {
  STYLE_LIBRARY,
  type StyleLibraryApi,
  type StyleSummary
} from '@shared/contracts/style-library'

export interface StyleChoice {
  /** All styles, default first; empty until loaded or when she has none. */
  styles: StyleSummary[]
  /** The chosen style id; null is the built-in plain style. */
  styleId: string | null
  /** The chosen style, if any. */
  style: StyleSummary | null
  choose(styleId: string | null): void
}

/** Styles a lesson can use (not drafts or failed ones), the default first, otherwise in main's order. */
export const usableStyles = (styles: StyleSummary[]): StyleSummary[] =>
  styles
    .filter((s) => s.status !== 'draft' && s.status !== 'failed')
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))

/** The styles for the style chip, with the default one selected until she picks another (05 §8.7). */
export function useStyleChoice(): StyleChoice {
  const library = useClient<StyleLibraryApi>(STYLE_LIBRARY)
  const [styles, setStyles] = useState<StyleSummary[]>([])
  const [picked, setPicked] = useState<{ id: string | null } | null>(null)

  useEffect(() => {
    let live = true
    library
      .list()
      .then((list) => live && setStyles(usableStyles(list)))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [library])

  const styleId = picked ? picked.id : (styles[0]?.id ?? null)
  const style = styles.find((s) => s.id === styleId) ?? null
  return { styles, styleId, style, choose: (id) => setPicked({ id }) }
}
