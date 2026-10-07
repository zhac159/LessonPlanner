import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { ASSET_KINDS, ASSET_KIND_LABELS, type AssetKind } from '@shared/assets/types'
import type { LeftOutReason } from '@shared/contracts/assets'
import { cx } from '../../atoms/cx'
import { Thumb } from '../internal/Thumb'
import { decksLabel, leftOutLabel } from '../internal/format'
import './ReviewRow.css'

export interface ReviewRowProps {
  /** The proposed name; editable. */
  name: string
  kind: AssetKind
  thumbSrc?: string | null
  /** "In 24 decks". */
  decks: number
  keep: boolean
  /** Why it was left out (the pill replaces the kind). Ticking it still keeps it. */
  leftOut?: { reason: LeftOutReason; ofName?: string } | null
  /** The message of the name check under the field (red). */
  nameError?: string
  onKeepChange: (keep: boolean) => void
  /** Blur or Enter with a changed name: the caller validates it. */
  onNameCommit: (name: string) => void
  onKindChange?: (kind: AssetKind) => void
  className?: string
}

/** One found picture in A2: tick to keep, edit the name, see the kind (or why it was left out) and how many decks. */
export function ReviewRow({
  name,
  kind,
  thumbSrc,
  decks,
  keep,
  leftOut,
  nameError,
  onKeepChange,
  onNameCommit,
  onKindChange,
  className
}: ReviewRowProps) {
  const errorId = useId()
  const [draft, setDraft] = useState(name)
  useEffect(() => setDraft(name), [name])

  const commit = (): void => {
    if (draft !== name) onNameCommit(draft)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
    } else if (event.key === 'Escape') {
      setDraft(name)
    }
  }

  return (
    <article
      className={cx('as-review', className)}
      data-left-out={leftOut ? 'true' : undefined}
      data-keep={keep || undefined}
      aria-label={name}
    >
      <label className="as-review__keep">
        <input type="checkbox" checked={keep} onChange={(e) => onKeepChange(e.target.checked)} />
        <span>Keep</span>
        <span className="as-sr-only">{` ${name}`}</span>
      </label>
      <Thumb src={thumbSrc} className="as-review__thumb" />
      <input
        className="as-review__name as-mono"
        aria-label={`Name of ${name}`}
        aria-invalid={nameError ? true : undefined}
        aria-describedby={nameError ? errorId : undefined}
        value={draft}
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
      {nameError && (
        <p id={errorId} className="as-review__error">
          {nameError}
        </p>
      )}
      <div className="as-review__foot">
        {leftOut ? (
          <span className="as-kind as-review__reason" data-reason={leftOut.reason}>
            {leftOutLabel(leftOut.reason, leftOut.ofName)}
          </span>
        ) : onKindChange ? (
          <select
            className="as-kind as-review__kind"
            data-kind={kind}
            aria-label={`Kind of ${name}`}
            value={kind}
            onChange={(event) => onKindChange(event.target.value as AssetKind)}
          >
            {ASSET_KINDS.map((k) => (
              <option key={k} value={k}>
                {ASSET_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        ) : (
          <span className="as-kind" data-kind={kind}>
            {ASSET_KIND_LABELS[kind]}
          </span>
        )}
        <span className="as-review__decks">{decksLabel(decks)}</span>
      </div>
    </article>
  )
}
