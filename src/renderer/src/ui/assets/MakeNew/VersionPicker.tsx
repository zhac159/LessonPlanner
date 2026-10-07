import { useId, useRef, type KeyboardEvent } from 'react'
import { cx } from '../../atoms/cx'
import { Thumb } from '../internal/Thumb'
import './VersionPicker.css'

export interface VersionView {
  /** 1-based, as labelled. */
  index: number
  state: 'waiting' | 'ready' | 'failed'
  thumbSrc?: string | null
}

export interface VersionPickerProps {
  versions: readonly VersionView[]
  /** The chosen version's number, or null. */
  selected: number | null
  onSelect: (index: number) => void
  /** "Try this one again" on a failed version. */
  onRetryVersion?: (index: number) => void
  /** What is happening while versions are waiting: "Looking at your pictures…", "Drawing…". */
  stageLabel?: string
  label?: string
  className?: string
}

/** "Pick the one you like": 2 or 4 versions in a 2 × 2 grid, a radio group, numbered 1 to 4. */
export function VersionPicker({
  versions,
  selected,
  onSelect,
  onRetryVersion,
  stageLabel,
  label = 'Pick the one you like',
  className
}: VersionPickerProps) {
  const group = useRef<HTMLDivElement>(null)
  const labelId = useId()
  const ready = versions.filter((v) => v.state === 'ready').map((v) => v.index)
  const stop = selected !== null && ready.includes(selected) ? selected : (ready[0] ?? null)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0
    if (!step || ready.length === 0) return
    event.preventDefault()
    const at = stop === null ? -1 : ready.indexOf(stop)
    const next = ready[(at + step + ready.length) % ready.length]!
    onSelect(next)
    group.current?.querySelector<HTMLElement>(`[data-version="${next}"]`)?.focus()
  }

  return (
    <div className={cx('as-versions', className)}>
      <h3 className="as-versions__label" id={labelId}>
        {label}
      </h3>
      <div
        ref={group}
        role="radiogroup"
        aria-labelledby={labelId}
        className="as-versions__grid"
        onKeyDown={onKeyDown}
      >
        {versions.map((version) => {
          const isReady = version.state === 'ready'
          return (
            <div key={version.index} className="as-version" data-state={version.state}>
              <button
                type="button"
                role="radio"
                aria-checked={selected === version.index}
                aria-disabled={!isReady || undefined}
                aria-label={`Version ${version.index}${
                  version.state === 'waiting'
                    ? ', still making'
                    : version.state === 'failed'
                      ? ", didn't work"
                      : ''
                }`}
                tabIndex={version.index === stop ? 0 : -1}
                data-version={version.index}
                className="as-version__pick"
                onClick={() => isReady && onSelect(version.index)}
              >
                <span className="as-version__n" aria-hidden="true">
                  {version.index}
                </span>
                {isReady && <Thumb src={version.thumbSrc} className="as-version__thumb" />}
                {version.state === 'waiting' && (
                  <span className="as-version__wait">{stageLabel ?? 'Drawing…'}</span>
                )}
                {version.state === 'failed' && (
                  <span className="as-version__failed">{"Didn't work"}</span>
                )}
              </button>
              {version.state === 'failed' && onRetryVersion && (
                <button
                  type="button"
                  className="as-version__retry"
                  onClick={() => onRetryVersion(version.index)}
                >
                  {`Try this one again`}
                  <span className="as-sr-only">{` (version ${version.index})`}</span>
                </button>
              )}
            </div>
          )
        })}
      </div>
      <p className="as-sr-only" role="status">
        {selected !== null ? `Version ${selected} selected` : ''}
      </p>
    </div>
  )
}
