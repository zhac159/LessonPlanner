import { ImageIcon, RefreshCw } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { Button, IconTile, StatusPill, TextLink } from '@ui/atoms'
import { Select, TextField } from '@ui/forms'
import { ConfirmDialog } from '@ui/overlays'
import type { PictureMakerModel, PictureMakerStatus } from '@shared/contracts/settings'
import { PICTURE_MODEL_OPTIONS, isPictureModel, priceNote } from '../pictureModels'
import { CANNOT_ENCRYPT } from './ApiKeyForm'
import { FREE_TEST_NOTE, pictureOutcomeCopy } from './pictureOutcome'
import type { TestOutcome } from './outcome'
import './connect.css'
import './picture.css'

export const AI_STUDIO_URL = 'https://aistudio.google.com/'
export const DISCLOSURE =
  'Pictures you pick are sent to Google to match the look. Photos and pupil pictures never are.'
export const SKIPPED_LINE = 'Picture maker skipped. You can add it any time in Settings › AI.'

export interface PictureMakerSectionProps {
  /** First run shows "Skip"; Settings shows "Remove key" and the model choice. */
  mode: 'first-run' | 'settings'
  status: PictureMakerStatus
  keyValue: string
  onKeyChange(value: string): void
  /** A saved key exists but a new one is being typed. */
  replacing: boolean
  onReplace(): void
  onKeepSaved(): void
  /** Format or storage error shown under the field. */
  error: string | null
  /** Saving or testing: the buttons wait and the pill says "Checking…". */
  busy: boolean
  /** Result of the latest check, or null for none. */
  outcome: TestOutcome | null
  /** First run, after "Skip": fold into one line. */
  collapsed: boolean
  onReopen(): void
  onTest(): void
  onSkip(): void
  onRemove(): Promise<void>
  onModelChange(model: PictureMakerModel): void
}

/**
 * "Add a picture maker" (screen A7): the optional Google AI Studio key, its free check and, in Settings, the model
 * and "Remove key". Presentational; the state lives in `usePictureMaker`. Never blocks the page it sits in.
 */
export function PictureMakerSection({
  mode,
  status,
  keyValue,
  onKeyChange,
  replacing,
  onReplace,
  onKeepSaved,
  error,
  busy,
  outcome,
  collapsed,
  onReopen,
  onTest,
  onSkip,
  onRemove,
  onModelChange
}: PictureMakerSectionProps) {
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)

  if (mode === 'first-run' && collapsed) {
    return (
      <p className="pms-skipped">
        {SKIPPED_LINE}
        <TextLink onClick={onReopen}>Add it now</TextLink>
      </p>
    )
  }

  const showSaved = status.hasKey && !replacing
  const locked = !status.encryptionAvailable
  const canTest = !locked && (showSaved || keyValue.trim().length > 0)
  const copy = outcome ? pictureOutcomeCopy(outcome) : null

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (canTest && !busy) onTest()
    } else if (event.key === 'Escape' && replacing) {
      event.preventDefault()
      onKeepSaved()
    }
  }

  const remove = async (): Promise<void> => {
    setRemoving(true)
    try {
      await onRemove()
    } finally {
      setRemoving(false)
      setConfirming(false)
    }
  }

  return (
    <section className="pms" aria-labelledby="pms-title">
      <div className="pms__head">
        <IconTile size={52} tone="white">
          <ImageIcon size={24} />
        </IconTile>
        <div className="pms__head-text">
          <div className="pms__title-row">
            <h3 id="pms-title" className="pms__title">
              Add a picture maker
            </h3>
            <StatusPill tone="inverse" size="md">
              Optional
            </StatusPill>
          </div>
          <p className="pms__lead">
            Google’s <strong>Nano Banana Pro</strong> makes new pictures in your style when you use
            “Make a new one like these” on the Assets page. Without it, Claude draws simple icons
            and diagrams instead.
          </p>
        </div>
      </div>

      {showSaved ? (
        <div className="akf__field">
          <span className="akf__label" id="pms-saved-label">
            Google AI Studio API key
          </span>
          <div className="akf__row">
            <div className="akf__saved" role="group" aria-labelledby="pms-saved-label">
              Saved key ending in {status.keyLast4}
            </div>
            <Button size="xl" onClick={onReplace} disabled={busy}>
              Replace
            </Button>
          </div>
        </div>
      ) : (
        <div className="akf__field">
          <TextField
            label="Google AI Studio API key"
            strongLabel
            variant="password"
            size="xl"
            value={keyValue}
            onChange={(event) => onKeyChange(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={locked}
            error={locked ? CANNOT_ENCRYPT : (error ?? undefined)}
            autoComplete="off"
            spellCheck={false}
          />
          {replacing && status.hasKey && (
            <TextLink onClick={onKeepSaved} className="akf__keep">
              Keep the saved key
            </TextLink>
          )}
        </div>
      )}

      <div className="pms__notes">
        <p className="akf__helper">
          Get a key at{' '}
          <a className="console-link" href={AI_STUDIO_URL} target="_blank" rel="noreferrer">
            aistudio.google.com ↗
          </a>
          . Google bills it per picture. Stored encrypted on this computer, like your Claude key.
        </p>
        <p className="akf__helper">{DISCLOSURE}</p>
      </div>

      <div className="pms__test">
        <Button
          icon={<RefreshCw />}
          loading={busy}
          loadingLabel="Testing…"
          disabled={!canTest}
          onClick={onTest}
        >
          Test picture maker
        </Button>
        {busy ? (
          <StatusPill tone="working" size="lg" live>
            Checking…
          </StatusPill>
        ) : (
          copy && (
            <StatusPill
              tone={outcome === 'connected' ? 'done' : 'error'}
              size="lg"
              check={outcome === 'connected'}
              live
            >
              {copy.pill}
            </StatusPill>
          )
        )}
        <span className="pms__spacer" />
        {mode === 'first-run' ? (
          <TextLink onClick={onSkip} disabled={busy}>
            Skip — I’ll add it later
          </TextLink>
        ) : (
          status.hasKey && (
            <TextLink className="pms__danger" onClick={() => setConfirming(true)} disabled={busy}>
              Remove key
            </TextLink>
          )
        )}
      </div>
      <div className="pms__notes" aria-live="polite">
        {copy?.helper && <p className="akf__helper">{copy.helper}</p>}
        <p className="akf__helper">{FREE_TEST_NOTE}</p>
      </div>

      {mode === 'settings' && status.hasKey && (
        <div className="akf__field">
          <Select
            label="Picture maker model"
            value={status.model}
            options={PICTURE_MODEL_OPTIONS.map(({ value, label }) => ({ value, label }))}
            disabled={busy}
            onChange={(value) => isPictureModel(value) && onModelChange(value)}
          />
          <p className="akf__helper">{priceNote(status.model)}</p>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title="Remove the picture maker key?"
        message="“Make a new one like these” will use Claude’s simple drawings until you add a key again."
        confirmLabel="Remove key"
        destructive
        busy={removing}
        onConfirm={() => void remove()}
        onCancel={() => setConfirming(false)}
      />
    </section>
  )
}
