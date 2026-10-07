import { ArrowRight, KeyRound } from 'lucide-react'
import { Button, Callout, Card, IconTile, ProgressPills, SetupSteps, TextLink } from '@ui/atoms'
import type { ConnectClaude } from '../hooks/useConnectClaude'
import type { PictureMaker } from '../hooks/usePictureMaker'
import { ApiKeyForm } from './ApiKeyForm'
import { ConsoleLink } from './ConsoleLink'
import { isNonBlockingError } from './outcome'
import { PictureMakerSection } from './PictureMakerSection'
import './connect.css'

const PILLS = [
  { id: 'you', label: 'About you' },
  { id: 'connect', label: 'Connect Claude' },
  { id: 'style', label: 'Your style (optional)' }
]

const HOW_TO = [
  { id: 'console', title: 'Open the Claude Console', detail: <ConsoleLink /> },
  {
    id: 'create',
    title: 'Create an API key',
    detail: 'Add credit and set a monthly limit there too'
  },
  { id: 'paste', title: 'Paste it below', detail: 'Then test the connection' }
]

export interface ConnectStepProps {
  claude: ConnectClaude
  /** The optional picture maker section under the model choice (A7). It never blocks "Next". */
  picture: PictureMaker
  /** "You" pill: back to Welcome with the values kept. */
  onBack(): void
  /** "Skip for now": the typed key (if any) is discarded. */
  onSkip(): void
  /** Leave the wizard with Claude connected (or "Continue anyway"). */
  onContinue(): void
}

/** First-run step 2 (design/screens/02-connect-claude.md). */
export function ConnectStep({ claude, picture, onBack, onSkip, onContinue }: ConnectStepProps) {
  const { status } = claude
  const hasTyped = claude.keyValue.trim().length > 0
  const continueAnyway = Boolean(status?.hasKey) && !hasTyped && isNonBlockingError(claude.outcome)
  const nextDisabled =
    !status ||
    claude.busy ||
    picture.busy ||
    !status.encryptionAvailable ||
    (!hasTyped && !status.hasKey)

  /** A typed picture-maker key is saved untested; a key that is refused keeps the teacher here to fix it. */
  const proceed = async (): Promise<void> => {
    if (await picture.saveTyped()) onContinue()
  }

  const next = async (): Promise<void> => {
    if (continueAnyway) return proceed()
    const outcome =
      hasTyped || claude.outcome !== 'connected' ? await claude.runTest() : 'connected'
    if (outcome === 'connected') await proceed()
  }

  return (
    <div className="connect">
      <div className="connect__header">
        <div className="connect__spacer" />
        <ProgressPills steps={PILLS} current={1} onStepClick={onBack} />
      </div>
      <main className="connect__main">
        <Card variant="page" padding={32} className="connect__card" as="section">
          <div className="connect__body">
            <div className="connect__title-row">
              <IconTile size={60} tone="yellow">
                <KeyRound size={26} />
              </IconTile>
              <div className="connect__title-text">
                <h1 className="connect__title" tabIndex={-1}>
                  Connect Claude
                </h1>
                <p className="connect__lead">
                  Slide Planner uses Claude to read your old decks and write new lessons. Add a
                  Claude API key once to switch it on. If someone set this up for you, they can add
                  it in Settings instead.
                </p>
              </div>
            </div>
            <Callout variant="info" title="Can I use my Claude Pro or Max subscription?">
              Not in other apps. Anthropic only allows subscription sign-in inside its own apps, so
              apps like this one connect with an API key. Usage is billed to whoever owns the key.
            </Callout>
            <SetupSteps variant="cards" items={HOW_TO} aria-label="How to get a key" />
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
                autoFocus={!status.hasKey}
              />
            )}
            {picture.status && (
              <PictureMakerSection
                mode="first-run"
                status={picture.status}
                keyValue={picture.keyValue}
                onKeyChange={picture.setKeyValue}
                replacing={picture.replacing}
                onReplace={picture.startReplace}
                onKeepSaved={picture.keepSaved}
                error={picture.formError}
                busy={picture.busy}
                outcome={picture.outcome}
                collapsed={picture.collapsed}
                onReopen={picture.reopen}
                onTest={() => void picture.runTest()}
                onSkip={() => void picture.skip()}
                onRemove={picture.remove}
                onModelChange={(model) => void picture.changeModel(model)}
              />
            )}
          </div>
          <footer className="connect__footer">
            <TextLink onClick={onSkip}>Skip for now</TextLink>
            <span className="connect__footer-spacer" />
            <Button
              variant="primary"
              size="xl"
              iconAfter={<ArrowRight />}
              disabled={nextDisabled}
              onClick={() => void next()}
            >
              {continueAnyway ? 'Continue anyway' : 'Next: your style'}
            </Button>
          </footer>
        </Card>
      </main>
    </div>
  )
}
