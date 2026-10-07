import { ArrowRight, Paperclip, Plus, Square } from 'lucide-react'
import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref
} from 'react'
import { cx } from '../../atoms/cx'
import { Button } from '../../atoms/Button/Button'
import { IconButton } from '../../atoms/IconButton/IconButton'
import { AttachmentCard, type AttachmentCardProps } from '../AttachmentCard/AttachmentCard'
import { RegionChip, type RegionChipProps } from '../RegionChip/RegionChip'
import { isSubmitKey } from './keys'
import './Composer.css'

/** The most files one message may carry. */
export const MAX_ATTACHMENTS = 3
const DEFAULT_PLACEHOLDER = 'Paste learning objectives or ask for a change…'
const REGION_PLACEHOLDER = 'Say what to change in the circled area…'
const DISABLED_PLACEHOLDER = 'Connect Claude to start chatting'

export interface ComposerProps {
  /** The draft text (controlled). */
  value: string
  onChange: (value: string) => void
  /** Enter / Ctrl+Enter / the Send button. Only called when there is something to send. */
  onSend: () => void
  /** The Stop button, shown instead of Send while `busy`. */
  onStop?: () => void
  /** Claude is working: Send becomes Stop and Enter does nothing. */
  busy?: boolean
  /** No API key: the whole composer is locked. */
  disabled?: boolean
  /** `generate` is the New lesson button ("Make my slides"): orange, and Enter adds a new line. */
  mode?: 'send' | 'generate'
  /** Overrides the send button's wording. */
  sendLabel?: string
  /** Does plain Enter send? Defaults to true for `send` and false for `generate`. Ctrl+Enter always sends. */
  enterSends?: boolean
  placeholder?: string
  /** Rows when empty: 2 in the editor, 7 on New lesson. It grows to about 10 rows, then scrolls. */
  minRows?: number
  /** Staged files, shown as cards with a remove ×. */
  attachments?: Array<AttachmentCardProps & { id: string }>
  onRemoveAttachment?: (id: string) => void
  /** Staged circled regions, shown as numbered chips with a remove ×. */
  regions?: Array<RegionChipProps & { id: string }>
  onRemoveRegion?: (id: string) => void
  /** More staged items (asset chips) after the regions and files; the caller draws and removes them. */
  staged?: ReactNode
  /** The message cannot be sent yet (for example a `{{name}}` that is not an asset): Send is off. */
  sendBlocked?: boolean
  /** A line under the box, e.g. "No asset called owl.". */
  notice?: ReactNode
  /** Hover / focus over a staged region chip (`null` when it ends), to highlight it on the slide. */
  onHighlightRegion?: (id: string | null) => void
  /** The paperclip. */
  onAttach?: () => void
  /** The + button that opens the plugin menu. */
  onPlus?: () => void
  /** Is the plugin menu open? Sets `aria-expanded` on +. */
  pluginsOpen?: boolean
  /** Files pasted into the textarea (they are not inserted as text). */
  onPasteFiles?: (files: File[]) => void
  textareaRef?: Ref<HTMLTextAreaElement>
  className?: string
}

/** The message box: staged items, an auto-growing textarea, and the +, paperclip and Send row. */
export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  busy = false,
  disabled = false,
  mode = 'send',
  sendLabel,
  enterSends = mode === 'send',
  placeholder,
  minRows = 2,
  attachments = [],
  onRemoveAttachment,
  regions = [],
  onRemoveRegion,
  staged: stagedExtra,
  sendBlocked = false,
  notice,
  onHighlightRegion,
  onAttach,
  onPlus,
  pluginsOpen = false,
  onPasteFiles,
  textareaRef,
  className
}: ComposerProps) {
  const labelId = useId()
  const area = useRef<HTMLTextAreaElement | null>(null)
  const setArea = useCallback(
    (el: HTMLTextAreaElement | null) => {
      area.current = el
      if (typeof textareaRef === 'function') textareaRef(el)
      else if (textareaRef) textareaRef.current = el
    },
    [textareaRef]
  )

  // Grow with the content; the CSS caps the height at about ten rows.
  useLayoutEffect(() => {
    const el = area.current
    if (!el) return
    el.style.height = 'auto'
    if (el.scrollHeight > 0) el.style.height = `${el.scrollHeight}px`
  }, [value, minRows])

  const hasText = value.trim() !== ''
  const canSend =
    !disabled &&
    !busy &&
    !sendBlocked &&
    (hasText || (attachments.length > 0 && regions.length === 0))

  const submit = (): void => {
    if (canSend) onSend()
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    const { key, shiftKey, ctrlKey, metaKey } = event
    const isComposing = event.nativeEvent.isComposing
    if (!isSubmitKey({ key, shiftKey, ctrlKey, metaKey, isComposing }, enterSends)) return
    event.preventDefault()
    submit()
  }
  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>): void => {
    const files = Array.from(event.clipboardData.files)
    if (files.length === 0 || !onPasteFiles) return
    event.preventDefault()
    onPasteFiles(files)
  }

  const resolvedPlaceholder = disabled
    ? DISABLED_PLACEHOLDER
    : regions.length > 0
      ? REGION_PLACEHOLDER
      : (placeholder ?? DEFAULT_PLACEHOLDER)
  const staged = attachments.length > 0 || regions.length > 0 || !!stagedExtra

  return (
    <div className={cx('ui-composer', className)} data-disabled={disabled || undefined}>
      {staged && (
        <div className="ui-composer__staged">
          {regions.map(({ id, ...chip }) => (
            <RegionChip
              key={id}
              {...chip}
              onRemove={onRemoveRegion && (() => onRemoveRegion(id))}
              onHighlight={(on) => onHighlightRegion?.(on ? id : null)}
            />
          ))}
          {stagedExtra}
          {attachments.map(({ id, ...card }) => (
            <AttachmentCard
              key={id}
              {...card}
              onRemove={onRemoveAttachment && (() => onRemoveAttachment(id))}
            />
          ))}
        </div>
      )}
      <label id={labelId} htmlFor={`${labelId}-input`} className="sr-only">
        Message your planning buddy
      </label>
      <textarea
        id={`${labelId}-input`}
        ref={setArea}
        className="ui-composer__input"
        rows={minRows}
        value={value}
        disabled={disabled}
        placeholder={resolvedPlaceholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
      />
      {notice && (
        <p className="ui-composer__notice" role="status">
          {notice}
        </p>
      )}
      <div className="ui-composer__actions">
        <IconButton
          aria-label="Plugins"
          aria-haspopup="menu"
          aria-expanded={pluginsOpen}
          disabled={disabled}
          onClick={onPlus}
        >
          <Plus strokeWidth={2.4} />
        </IconButton>
        <IconButton
          aria-label="Attach a file"
          disabled={disabled || attachments.length >= MAX_ATTACHMENTS}
          onClick={onAttach}
        >
          <Paperclip strokeWidth={2.2} />
        </IconButton>
        <span className="ui-composer__spacer" />
        {busy ? (
          <Button
            shape="pill"
            icon={<Square fill="currentColor" strokeWidth={0} />}
            onClick={onStop}
          >
            Stop
          </Button>
        ) : mode === 'generate' ? (
          <Button
            variant="primary"
            shape="pill"
            className="ui-composer__generate"
            iconAfter={<ArrowRight strokeWidth={2.2} />}
            disabled={!canSend}
            onClick={submit}
          >
            {sendLabel ?? 'Make my slides'}
          </Button>
        ) : (
          <Button
            variant="dark"
            shape="pill"
            iconAfter={<ArrowRight strokeWidth={2.2} />}
            disabled={!canSend}
            onClick={submit}
          >
            {sendLabel ?? 'Send'}
          </Button>
        )}
      </div>
    </div>
  )
}
