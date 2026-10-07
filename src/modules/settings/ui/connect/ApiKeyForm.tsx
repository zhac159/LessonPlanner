import { RefreshCw } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { Button, StatusPill, TextLink } from '@ui/atoms'
import { Select, TextField } from '@ui/forms'
import type { AiStatus, ModelChoice } from '@shared/contracts/settings'
import { MODEL_OPTIONS, isModelChoice, modelName } from '../models'
import { ConsoleLink } from './ConsoleLink'
import { outcomeCopy, type TestOutcome } from './outcome'
import './connect.css'

export const KEY_HELPER =
  'Stored encrypted on this computer and never shown again. You can replace it any time in Settings.'
export const CANNOT_ENCRYPT = 'This computer can’t store the key securely, so it wasn’t saved.'

export interface ApiKeyFormProps {
  status: AiStatus
  keyValue: string
  onKeyChange(value: string): void
  /** A saved key exists but a new one is being typed. */
  replacing: boolean
  onReplace(): void
  onKeepSaved(): void
  /** Format or storage error shown under the field. */
  error: string | null
  /** Saving the key or testing: Test and the model are locked and the pill says "Checking…". */
  busy: boolean
  /** Result of the latest test, or null for none. */
  outcome: TestOutcome | null
  onTest(): void
  onModelChange(model: ModelChoice): void
  /** Focus the key input on show (first run). */
  autoFocus?: boolean
}

/**
 * The Claude API key field, Test connection with its result, and the model choice. Used by first-run
 * step 2 and Settings › AI (design/screens/02-connect-claude.md). Presentational: the state lives in
 * `useConnectClaude`.
 */
export function ApiKeyForm({
  status,
  keyValue,
  onKeyChange,
  replacing,
  onReplace,
  onKeepSaved,
  error,
  busy,
  outcome,
  onTest,
  onModelChange,
  autoFocus
}: ApiKeyFormProps) {
  const showSaved = status.hasKey && !replacing
  const locked = !status.encryptionAvailable
  const canTest = !locked && (showSaved || keyValue.trim().length > 0)
  const copy = outcome ? outcomeCopy(outcome, modelName(status.model)) : null

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (canTest && !busy) onTest()
    } else if (event.key === 'Escape' && replacing) {
      event.preventDefault()
      onKeepSaved()
    }
  }

  return (
    <div className="akf">
      {showSaved ? (
        <div className="akf__field">
          <span className="akf__label" id="akf-saved-label">
            Claude API key
          </span>
          <div className="akf__row">
            <div className="akf__saved" role="group" aria-labelledby="akf-saved-label">
              Saved key ending in {status.keyLast4}
            </div>
            <Button size="xl" onClick={onReplace} disabled={busy}>
              Replace
            </Button>
          </div>
          <p className="akf__helper">{KEY_HELPER}</p>
        </div>
      ) : (
        <div className="akf__field">
          <TextField
            label="Claude API key"
            strongLabel
            variant="password"
            size="xl"
            value={keyValue}
            onChange={(event) => onKeyChange(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={locked}
            error={locked ? CANNOT_ENCRYPT : (error ?? undefined)}
            hint={KEY_HELPER}
            autoFocus={autoFocus || replacing}
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

      <div className="akf__test">
        <Button
          icon={<RefreshCw />}
          loading={busy}
          loadingLabel="Testing…"
          disabled={!canTest}
          onClick={onTest}
        >
          Test connection
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
      </div>
      <p className="akf__helper" aria-live="polite">
        {copy?.helper}
        {copy?.consoleLink && (
          <>
            {' '}
            <ConsoleLink />
          </>
        )}
      </p>

      <Select
        label="Model"
        value={status.model}
        options={MODEL_OPTIONS.map(({ value, label }) => ({ value, label }))}
        disabled={busy}
        onChange={(value) => isModelChoice(value) && onModelChange(value)}
      />
    </div>
  )
}
