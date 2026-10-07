import { ArrowRight, ChevronLeft } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { PluginManifestView } from '@shared/contracts/deck-builder-plugins'
import { Button } from '../../atoms/Button/Button'
import { CardHeaderBand } from '../../atoms/CardHeaderBand/CardHeaderBand'
import { Callout } from '../../atoms/Callout/Callout'
import { cx } from '../../atoms/cx'
import { IconButton } from '../../atoms/IconButton/IconButton'
import { IconTile } from '../../atoms/IconTile/IconTile'
import { pluginIcon } from '../icons'
import { bandToneFor } from '../tones'
import { InputField } from './fields/InputField'
import {
  initialValues,
  progressLabel,
  reconcileSlideRanges,
  slideRangeOptions,
  validate,
  type FormValues,
  type SlideContext
} from './values'
import './PluginSheet.css'

export interface PluginSheetProps {
  /** The plugin's manifest: the form is generated from its `inputs` (07 §6). */
  manifest: PluginManifestView
  /** Editor state that words and defaults "Which slides?". Changes while open are followed. */
  slides: SlideContext
  /** Values last used for this plugin, if any. */
  lastInputs?: Record<string, unknown> | null
  /** The form is valid and Make was pressed: run with these inputs. */
  onSubmit: (inputs: FormValues) => void
  /** Back arrow or Esc: close without running, handing over the values to remember. */
  onBack: (values: FormValues) => void
  /** Cancel: close without running and forget this session's edits. */
  onCancel: () => void
  /** A chat job is running: Make waits ("Wait for the current change to finish."). */
  jobRunning?: boolean
  /** Make was pressed and the run is starting: the button shows "Making quiz…". */
  submitting?: boolean
  /** No usable API key: Make shows the Connect Claude prompt instead of running. */
  needsKey?: boolean
  /** The prompt's "Connect Claude" button. */
  onConnect?: () => void
  className?: string
}

/** Only these elements take focus when a field is invalid. */
const FOCUSABLE = 'input, select, textarea, button'

/**
 * The plugin options sheet (design-system: PluginSheet, screen 07): a side panel with a tinted
 * header, a form generated from the manifest's `inputs`, and Cancel / Make footer. It is dialog-like
 * but not modal, so the stage stays usable. Esc goes back, Ctrl+Enter makes.
 */
export function PluginSheet({
  manifest,
  slides,
  lastInputs,
  onSubmit,
  onBack,
  onCancel,
  jobRunning = false,
  submitting = false,
  needsKey = false,
  onConnect,
  className
}: PluginSheetProps) {
  const root = useRef<HTMLElement>(null)
  const title = useRef<HTMLSpanElement>(null)
  const titleId = useId()
  const [values, setValues] = useState(() => initialValues(manifest.inputs, slides, lastInputs))
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set())
  const [attempted, setAttempted] = useState(false)
  const [keyPrompt, setKeyPrompt] = useState(false)
  const previousSlides = useRef(slides)
  const slidesKey = JSON.stringify(slides)

  // Focus goes to the title so a screen reader announces the sheet (07 §8.1).
  useEffect(() => title.current?.focus(), [])

  // Follow the filmstrip while the sheet is open (07 §8.2).
  useEffect(() => {
    const before = previousSlides.current
    if (JSON.stringify(before) === slidesKey) return
    previousSlides.current = slides
    setValues((current) => reconcileSlideRanges(manifest.inputs, current, slides, before))
  }, [slidesKey, manifest.inputs])

  const slideOptions = slideRangeOptions(slides)
  const errors = validate(manifest.inputs, values, slides)
  const noSlides = manifest.needsSlides && slides.total === 0
  const blocked = Object.keys(errors).length > 0 || noSlides || jobRunning || submitting

  const setValue = (id: string, value: unknown): void => {
    setValues((current) => ({ ...current, [id]: value }))
    setTouched((current) => new Set(current).add(id))
  }

  const focusFirstInvalid = (): void => {
    const first = manifest.inputs.find((input) => errors[input.id])
    const field = first && root.current?.querySelector(`[data-field="${first.id}"]`)
    field?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
  }

  const submit = (): void => {
    if (jobRunning || submitting || noSlides) return
    if (Object.keys(errors).length > 0) {
      setAttempted(true)
      focusFirstInvalid()
    } else if (needsKey) {
      setKeyPrompt(true)
    } else {
      onSubmit(values)
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onBack(values)
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      submit()
    }
  }

  // A required text field only complains once it has been visited or Make was tried.
  const shownError = (id: string, type: string): string | undefined =>
    type === 'text' && !attempted && !touched.has(id) ? undefined : errors[id]

  const Icon = pluginIcon(manifest.icon)
  return (
    <section
      ref={root}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className={cx('plugin-sheet', className)}
      onKeyDown={onKeyDown}
    >
      <CardHeaderBand
        tone={bandToneFor(manifest.tint)}
        leading={
          <IconButton aria-label="Back to chat" onClick={() => onBack(values)}>
            <ChevronLeft strokeWidth={2.4} />
          </IconButton>
        }
        title={
          <span id={titleId} ref={title} tabIndex={-1} className="plugin-sheet__title">
            {manifest.title}
          </span>
        }
        subtitle={manifest.description}
        trailing={
          <IconTile size={44} tone="white">
            <Icon size={22} />
          </IconTile>
        }
      />
      <form className="plugin-sheet__form" onSubmit={(event) => event.preventDefault()} noValidate>
        {manifest.inputs.map((input) => (
          <div key={input.id} className="plugin-sheet__field" data-field={input.id}>
            <InputField
              input={input}
              value={values[input.id]}
              onChange={(value) => setValue(input.id, value)}
              error={shownError(input.id, input.type)}
              slideOptions={slideOptions}
            />
          </div>
        ))}
      </form>
      <footer className="plugin-sheet__footer">
        {noSlides && <Callout variant="warning">Make some slides first.</Callout>}
        {keyPrompt && needsKey && (
          <Callout
            variant="action"
            action={
              <Button size="sm" variant="primary" onClick={onConnect}>
                Connect Claude
              </Button>
            }
          >
            Connect Claude to make this.
          </Callout>
        )}
        {jobRunning && (
          <p className="plugin-sheet__helper">Wait for the current change to finish.</p>
        )}
        <div className="plugin-sheet__actions">
          <Button variant="secondary" size="md" shape="pill" onClick={onCancel}>
            Cancel
          </Button>
          <span className="plugin-sheet__spacer" />
          <Button
            variant="primary"
            size="lg"
            shape="pill"
            iconAfter={<ArrowRight strokeWidth={2.4} />}
            loading={submitting}
            loadingLabel={progressLabel(manifest.action)}
            aria-disabled={blocked || undefined}
            onClick={submit}
          >
            {manifest.action}
          </Button>
        </div>
        {manifest.estimate && <p className="plugin-sheet__estimate">{manifest.estimate}</p>}
      </footer>
    </section>
  )
}
