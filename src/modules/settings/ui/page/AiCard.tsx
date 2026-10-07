import { useState, type Ref } from 'react'
import { Card, TextLink } from '@ui/atoms'
import { ConfirmDialog } from '@ui/overlays'
import type { UsageSummary } from '@shared/contracts/settings'
import { ApiKeyForm } from '../connect/ApiKeyForm'
import { PictureMakerSection } from '../connect/PictureMakerSection'
import type { ConnectClaude } from '../hooks/useConnectClaude'
import type { PictureMaker } from '../hooks/usePictureMaker'
import { usageLine } from '../hooks/usageLine'
import './page.css'

export interface AiCardProps {
  claude: ConnectClaude
  picture: PictureMaker
  usage: UsageSummary | null
  /** Deletes the saved key (after the teacher confirmed). */
  onRemoveKey(): Promise<void>
  /** The heading, so the `{ kind: 'ai' }` intent can move focus to it. */
  headingRef?: Ref<HTMLHeadingElement>
}

/** Settings › AI: the Connect Claude form in Settings mode, with the usage line and "Remove key" (02 §8 step 9). */
export function AiCard({ claude, picture, usage, onRemoveKey, headingRef }: AiCardProps) {
  const { status } = claude
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)

  const remove = async (): Promise<void> => {
    setRemoving(true)
    try {
      await onRemoveKey()
    } finally {
      setRemoving(false)
      setConfirming(false)
    }
  }

  return (
    <Card
      as="section"
      variant="page"
      padding={32}
      className="settings__card"
      aria-labelledby="settings-ai"
    >
      <h2 id="settings-ai" className="settings__card-title" tabIndex={-1} ref={headingRef}>
        Claude
      </h2>
      {status && (
        <ApiKeyForm
          status={status}
          keyValue={claude.keyValue}
          onKeyChange={claude.setKeyValue}
          replacing={claude.replacing}
          onReplace={claude.startReplace}
          onKeepSaved={claude.keepSaved}
          error={claude.formError}
          busy={claude.busy}
          outcome={claude.outcome}
          onTest={() => void claude.runTest()}
          onModelChange={(model) => void claude.changeModel(model)}
        />
      )}
      {picture.status && (
        <PictureMakerSection
          mode="settings"
          status={picture.status}
          keyValue={picture.keyValue}
          onKeyChange={picture.setKeyValue}
          replacing={picture.replacing}
          onReplace={picture.startReplace}
          onKeepSaved={picture.keepSaved}
          error={picture.formError}
          busy={picture.busy}
          outcome={picture.outcome}
          collapsed={false}
          onReopen={picture.reopen}
          onTest={() => void picture.runTest()}
          onSkip={() => void picture.skip()}
          onRemove={picture.remove}
          onModelChange={(model) => void picture.changeModel(model)}
        />
      )}
      <footer className="settings__footer">
        {usage && <p className="settings__usage">{usageLine(usage)}</p>}
        <span className="settings__footer-spacer" />
        {status?.hasKey && (
          <TextLink className="settings__danger" onClick={() => setConfirming(true)}>
            Remove key
          </TextLink>
        )}
      </footer>
      <ConfirmDialog
        open={confirming}
        title="Remove your API key?"
        message="Slide Planner won’t be able to make or change slides until you add a key again."
        confirmLabel="Remove key"
        destructive
        busy={removing}
        onConfirm={() => void remove()}
        onCancel={() => setConfirming(false)}
      />
    </Card>
  )
}
