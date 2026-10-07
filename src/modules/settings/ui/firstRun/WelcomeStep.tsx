import { ArrowRight, Lock } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button, Callout, Card, SetupSteps } from '@ui/atoms'
import { TextField } from '@ui/forms'
import { useDelayedFlag } from '../hooks/useDelayedFlag'
import { WelcomeIllustration } from './WelcomeIllustration'
import './welcome.css'

export const NAME_MISSING = 'Add your name so I know what to call you.'
const NAME_MAX = 40
const SUBJECT_MAX = 60

const HERO_STEPS = [
  { id: 'upload', title: 'Upload your old decks — PDF or PowerPoint' },
  { id: 'objectives', title: 'Paste your learning objectives' },
  { id: 'refine', title: 'Refine by chatting — or just circle what to change' }
]

export const SETUP_STEPS = [
  { id: 'about', title: 'About you' },
  { id: 'connect', title: 'Connect Claude' },
  { id: 'style', title: 'Your style', optional: true }
]

export interface WelcomeStepProps {
  initialName: string
  initialSubject: string
  /** Saves the answers; resolves with an error message to show, or null when saved. */
  onNext(values: { name: string; subject: string }): Promise<string | null>
}

/** First-run step 1 (design/screens/01-welcome.md): who is the teacher, and what does she teach. */
export function WelcomeStep({ initialName, initialSubject, onNext }: WelcomeStepProps) {
  const [name, setName] = useState(initialName)
  const [subject, setSubject] = useState(initialSubject)
  const [nameTouched, setNameTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const showSpinner = useDelayedFlag(saving, 300)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
    nameRef.current?.select()
  }, [])

  const valid = name.trim().length > 0
  const nameError = nameTouched && !valid ? NAME_MISSING : undefined

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!valid || saving) return
    setSaving(true)
    setSaveError(null)
    const error = await onNext({ name: name.trim(), subject: subject.trim() })
    setSaving(false)
    setSaveError(error)
  }

  return (
    <div className="welcome">
      <section className="welcome__hero" aria-labelledby="welcome-title">
        <div className="welcome__hero-text">
          <h1 id="welcome-title" className="welcome__title">
            Plan lessons in your own style.
          </h1>
          <p className="welcome__lead">
            Show it the slides you’ve already made. Slide Planner learns how you teach, then builds
            new lessons from your learning objectives.
          </p>
        </div>
        <SetupSteps variant="hero" items={HERO_STEPS} aria-label="What Slide Planner does" />
        <WelcomeIllustration />
      </section>

      <section className="welcome__side">
        <Card variant="page" padding={32} className="welcome__card">
          <form className="welcome__form" onSubmit={(event) => void submit(event)} noValidate>
            <div className="welcome__intro">
              <h2 className="welcome__heading">Welcome!</h2>
              <p className="welcome__sub">Let’s get you set up. It takes about two minutes.</p>
            </div>
            <SetupSteps items={SETUP_STEPS} current={0} aria-label="Setup steps" />
            <TextField
              ref={nameRef}
              label="What should I call you?"
              size="xl"
              strongValue
              value={name}
              maxLength={NAME_MAX}
              error={nameError}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => setNameTouched(true)}
              autoComplete="off"
            />
            <TextField
              label="What do you mostly teach?"
              size="xl"
              value={subject}
              maxLength={SUBJECT_MAX}
              placeholder="e.g. KS3 Science"
              onChange={(event) => setSubject(event.target.value)}
              autoComplete="off"
            />
            <Button
              type="submit"
              variant="primary"
              size="xl"
              className="welcome__next"
              iconAfter={<ArrowRight />}
              disabled={!valid}
              loading={showSpinner}
            >
              Next: connect Claude
            </Button>
            {saveError && <Callout variant="error">{saveError}</Callout>}
            <p className="welcome__privacy">
              <Lock size={16} aria-hidden="true" />
              <span>
                Everything stays on this computer. No account needed. Files go to Claude only when
                you ask it to learn your style or make slides.
              </span>
            </p>
          </form>
        </Card>
      </section>
    </div>
  )
}
