import { useId } from 'react'
import type { MakeVersions } from '@shared/assets/pictureMaker'
import type { MakeMode } from '@shared/contracts/assets'
import { Button } from '../../atoms/Button/Button'
import { Callout } from '../../atoms/Callout/Callout'
import { TextLink } from '../../atoms/TextLink/TextLink'
import { cx } from '../../atoms/cx'
import { RadioPillGroup } from '../../forms/RadioPill/RadioPill'
import { TextArea } from '../../forms/TextArea/TextArea'
import { costLine } from '../internal/format'
import './MakeRequestForm.css'

export interface MakeRequestFormProps {
  prompt: string
  onPromptChange: (prompt: string) => void
  versions: MakeVersions
  onVersionsChange: (versions: MakeVersions) => void
  onMake: () => void
  /** A job is running: the button shows "Making…" and does nothing. */
  busy?: boolean
  mode: MakeMode
  /** From `make:mode`; used for "About 54 cents · Google bills this" in picture-maker mode. */
  perPictureUsd?: number
  /** The request sounds like a photo while only Claude's drawing is available. */
  wantsPhoto?: boolean
  /** "Add a picture maker" (Settings › AI). */
  onAddPictureMaker?: () => void
  className?: string
}

/** "What should it be?", "Versions" 2 or 4 and the dark "Make 4" button, with the cost or vector-mode copy under it. */
export function MakeRequestForm({
  prompt,
  onPromptChange,
  versions,
  onVersionsChange,
  onMake,
  busy = false,
  mode,
  perPictureUsd,
  wantsPhoto = false,
  onAddPictureMaker,
  className
}: MakeRequestFormProps) {
  const reasonId = useId()
  const empty = prompt.trim().length === 0
  const unavailable = mode === 'unavailable'
  const blocked = empty || unavailable
  const reason = unavailable
    ? 'Making pictures needs your Claude key. Connect Claude in Settings first.'
    : empty
      ? 'Say what the new picture should be first.'
      : undefined

  return (
    <div className={cx('as-make-form', className)}>
      <TextArea
        label="What should it be?"
        strongLabel
        rows={2}
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
      />
      <div className="as-make-form__row">
        <div className="as-make-form__versions">
          <span className="as-make-form__versions-label" aria-hidden="true">
            Versions
          </span>
          <RadioPillGroup
            legend="Versions"
            hideLegend
            value={String(versions)}
            onChange={(value) => onVersionsChange(Number(value) as MakeVersions)}
            options={[
              { value: '2', label: '2' },
              { value: '4', label: '4' }
            ]}
          />
        </div>
        <Button
          variant="dark"
          loading={busy}
          loadingLabel="Making…"
          aria-disabled={blocked || undefined}
          aria-describedby={reason ? reasonId : undefined}
          onClick={onMake}
        >
          {`Make ${versions}`}
        </Button>
      </div>
      {reason && (
        <p id={reasonId} className="as-sr-only">
          {reason}
        </p>
      )}
      {mode === 'picture-maker' && perPictureUsd !== undefined && (
        <p className="as-make-form__note">{costLine(perPictureUsd, versions)}</p>
      )}
      {mode === 'vector' && (
        <p className="as-make-form__note">
          No picture maker connected, so Claude will draw this as a simple icon or diagram.{' '}
          {onAddPictureMaker && (
            <TextLink onClick={onAddPictureMaker}>Add a picture maker</TextLink>
          )}
        </p>
      )}
      {mode === 'vector' && wantsPhoto && (
        <Callout variant="warning">
          Photo-like pictures need the picture maker. Add one in Settings › AI, or try Find online.
        </Callout>
      )}
      {unavailable && (
        <Callout variant="warning">
          Making pictures needs your Claude key. Connect Claude in Settings first.
        </Callout>
      )}
    </div>
  )
}
