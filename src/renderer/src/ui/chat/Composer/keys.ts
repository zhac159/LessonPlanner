/** The bits of a keyboard event the Composer looks at (so it can be tested without the DOM). */
export interface ComposerKeyEvent {
  key: string
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  /** True while an input method (IME) is composing text: Enter then confirms the composition. */
  isComposing: boolean
}

/**
 * Should this key press send the message?
 * Ctrl+Enter (or Cmd+Enter) always sends. Plain Enter sends only when `enterSends`; Shift+Enter
 * is always a new line. Enter that confirms an IME composition never sends.
 */
export function isSubmitKey(event: ComposerKeyEvent, enterSends: boolean): boolean {
  if (event.key !== 'Enter' || event.isComposing) return false
  if (event.ctrlKey || event.metaKey) return true
  return enterSends && !event.shiftKey
}
