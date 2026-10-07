import { useCallback, useState } from 'react'
import { anchorBelow, type MenuItem, type Point } from '@ui/overlays'

export interface AnchoredMenu {
  open: boolean
  anchor: Point | null
  label: string
  items: MenuItem[]
  /** Opens under the control that has focus (the button she just pressed). */
  show(label: string, items: MenuItem[]): void
  close(): void
}

const FALLBACK: Point = { x: 240, y: 240 }

/** State for a small menu that opens under the button that asked for it ("Which lesson?", the usage list). */
export function useAnchoredMenu(): AnchoredMenu {
  const [state, setState] = useState<{ anchor: Point; label: string; items: MenuItem[] } | null>(
    null
  )
  const show = useCallback((label: string, items: MenuItem[]) => {
    const focused = document.activeElement
    const anchor =
      focused && focused !== document.body && 'getBoundingClientRect' in focused
        ? anchorBelow(focused)
        : FALLBACK
    setState({ anchor, label, items })
  }, [])
  const close = useCallback(() => setState(null), [])
  return {
    open: state !== null,
    anchor: state?.anchor ?? null,
    label: state?.label ?? '',
    items: state?.items ?? [],
    show,
    close
  }
}
