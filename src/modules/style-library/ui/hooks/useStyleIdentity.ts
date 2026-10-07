import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useClient } from '@renderer/sdk'
import type { StyleDraftView, StyleLibraryApi } from '@shared/contracts/style-library'
import { MODULE_ID } from '../../shared'

/** Longest style name (StylesService.MAX_NAME_LENGTH). */
export const NAME_MAX = 40
/** The name a style has until she or synthesis picks a better one. */
export const DEFAULT_NAME = 'My style'
/** Typing pauses this long before the name is saved (04 §8). */
export const NAME_DEBOUNCE_MS = 500
export const NAME_REQUIRED = 'Give this style a name.'

export interface StyleIdentityOptions {
  /** Null while the draft has no files yet and so does not exist in main. */
  styleId: string | null
  view: StyleDraftView | null
  /** Takes the view main returns after a change of the default flag. */
  adopt(view: StyleDraftView): void
  /** Her subject from Welcome, else "My style": the starting name of a new draft. */
  initialName: string
  /** Checked by default when she has no other saved style. */
  initialDefault: boolean
}

export interface StyleIdentity {
  name: string
  setName(text: string): void
  nameError: string | undefined
  nameRef: RefObject<HTMLInputElement | null>
  isDefault: boolean
  setIsDefault(checked: boolean): void
  /** True when the name or the default flag differs from what the style had when it was opened. */
  changed: boolean
  /** Saves a pending name now. False (and focus on the field) when the name is empty. */
  flush(): Promise<boolean>
}

/**
 * The style name and the "Make this my default style" checkbox: local while the draft does not exist yet,
 * saved straight away (default) or 500 ms after typing stops (name) once it does. An automatic name
 * suggested by synthesis shows up until she types her own.
 */
export function useStyleIdentity({
  styleId,
  view,
  adopt,
  initialName,
  initialDefault
}: StyleIdentityOptions): StyleIdentity {
  const styles = useClient<StyleLibraryApi>(MODULE_ID)
  // Null until she types: then the saved name (or a suggestion from synthesis) shows.
  const [typedName, setTypedName] = useState<string | null>(null)
  const name = typedName ?? view?.name ?? initialName
  const [localDefault, setLocalDefault] = useState(initialDefault)
  const [nameError, setNameError] = useState<string | undefined>()
  const nameRef = useRef<HTMLInputElement | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const baseline = useRef<{ name: string; isDefault: boolean } | null>(null)
  const latest = useRef({ name, styleId })
  latest.current = { name, styleId }

  useEffect(() => {
    if (view && baseline.current?.name === undefined) {
      baseline.current = { name: view.name, isDefault: view.isDefault }
    }
  }, [view])

  const makeDefault = useCallback(
    async (id: string): Promise<void> => {
      const result = await styles.update({ styleId: id, isDefault: true })
      if (result.ok) adopt(result.style)
    },
    [styles, adopt]
  )

  const save = useCallback(
    async (id: string, text: string): Promise<void> => {
      if (text.trim()) await styles.update({ styleId: id, name: text.trim() })
    },
    [styles]
  )

  const cancelTimer = (): void => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = undefined
  }

  // The draft was created by its first files: push what she set before it existed.
  const startedPending = useRef(styleId === null)
  const pushed = useRef(false)
  useEffect(() => {
    if (!startedPending.current || pushed.current || !styleId || !view) return
    pushed.current = true
    const wanted = (typedName ?? initialName).trim()
    if (wanted && wanted !== view.name) {
      setTypedName(wanted)
      void save(styleId, wanted)
    }
    if (localDefault && !view.isDefault) void makeDefault(styleId)
  }, [styleId, view, localDefault, typedName, initialName, save, makeDefault])

  // Leaving with a name still waiting to be saved: save it now.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current)
        if (latest.current.styleId) void save(latest.current.styleId, latest.current.name)
      }
    },
    [save]
  )

  const setName = (text: string): void => {
    const next = text.slice(0, NAME_MAX)
    setTypedName(next)
    setNameError(undefined)
    cancelTimer()
    if (styleId)
      timer.current = setTimeout(() => void save(styleId, next).then(cancelTimer), NAME_DEBOUNCE_MS)
  }

  const flush = async (): Promise<boolean> => {
    if (!name.trim()) {
      setNameError(NAME_REQUIRED)
      nameRef.current?.focus()
      return false
    }
    if (styleId && timer.current) {
      cancelTimer()
      await save(styleId, name)
    }
    return true
  }

  const isDefault = view ? view.isDefault : localDefault
  const setIsDefault = (checked: boolean): void => {
    setLocalDefault(checked)
    if (styleId && checked) void makeDefault(styleId)
  }

  const changed =
    baseline.current !== null &&
    (name.trim() !== baseline.current.name || isDefault !== baseline.current.isDefault)

  return { name, setName, nameError, nameRef, isDefault, setIsDefault, changed, flush }
}
