import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { insertAssetToken } from '@shared/assets/tokens'
import { finishTypedToken, firstMatch, typedTokenAt } from '../logic/composerTokens'
import { useAssetLibrary } from './useAssetLibrary'

export type InsertPickerMode = 'sheet' | 'typed'

export interface InsertPickerArgs {
  text: string
  setText(text: string): void
  textarea: RefObject<HTMLTextAreaElement | null>
  /** The "+" button, where focus goes when the picker is dismissed. */
  plus: RefObject<HTMLElement | null>
  /** The picker was opened from the "+" menu (counts as a use of "Add asset"). */
  onUsed(): void
}

/**
 * A4: the asset picker over the chat, from "+ › Add asset" (a sheet) or from typing `{{` (a popover that mirrors the
 * typed letters). Picking puts `{{name}}` at the caret; nothing is placed on a slide here.
 */
export function useInsertPicker({ text, setText, textarea, plus, onUsed }: InsertPickerArgs) {
  const [mode, setMode] = useState<InsertPickerMode | null>(null)
  const [caret, setCaret] = useState(0)
  const nextCaret = useRef<number | null>(null)
  const card = useRef<HTMLDivElement>(null)
  const library = useAssetLibrary('', mode !== null)

  const typed = mode === 'typed' ? typedTokenAt(text, Math.min(caret, text.length)) : null
  const typedQuery = mode === 'typed' ? (typed?.query ?? '') : undefined

  // After the text changed by a pick: caret behind the token and focus back in the box.
  useEffect(() => {
    const at = nextCaret.current
    if (at === null) return
    nextCaret.current = null
    const box = textarea.current
    box?.focus()
    box?.setSelectionRange(at, at)
  }, [text, textarea])

  /** Call with every change of the text: opens or closes the `{{` popover. */
  const onTextChange = useCallback(
    (next: string): void => {
      const at = textarea.current?.selectionStart ?? next.length
      setCaret(at)
      setMode((was) => (typedTokenAt(next, at) ? 'typed' : was === 'typed' ? null : was))
    },
    [textarea]
  )

  const openSheet = useCallback((): void => {
    onUsed()
    setCaret(textarea.current?.selectionStart ?? text.length)
    setMode('sheet')
  }, [onUsed, textarea, text.length])

  const close = useCallback(
    (returnTo: 'plus' | 'box' = 'box'): void => {
      setMode(null)
      const target = returnTo === 'plus' ? plus.current : textarea.current
      queueMicrotask(() => target?.focus())
    },
    [plus, textarea]
  )

  const pick = useCallback(
    (assetId: string): void => {
      const asset = library.assets.find((a) => a.id === assetId)
      if (!asset) return
      const at = textarea.current?.selectionStart ?? caret
      const done =
        (mode === 'typed' ? finishTypedToken(text, at, asset.name) : null) ??
        insertAssetToken(text, at, asset.name)
      nextCaret.current = done.caret
      setText(done.text)
      setMode(null)
    },
    [library.assets, textarea, caret, mode, text, setText]
  )

  /** On the Composer's wrapper (capture): while the popover is open Enter completes, Esc leaves the text, ↓ goes in. */
  const onKeyDownCapture = (event: KeyboardEvent<HTMLElement>): void => {
    if (mode !== 'typed') return
    const inBox = event.target === textarea.current
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setMode(null)
    } else if (event.key === 'Enter' && inBox && !event.shiftKey) {
      const match = firstMatch(library.assets, typedQuery ?? '')
      if (!match) return
      event.preventDefault()
      event.stopPropagation()
      pick(match.id)
    } else if (event.key === 'ArrowDown' && inBox) {
      const tile = card.current?.querySelector<HTMLElement>('[data-grid-item]')
      if (!tile) return
      event.preventDefault()
      tile.focus()
    }
  }

  return { mode, typedQuery, library, card, onTextChange, openSheet, close, pick, onKeyDownCapture }
}
