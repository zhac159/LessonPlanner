import { ArrowRight, Monitor, Paperclip, Plus, Timer } from 'lucide-react'
import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { Button, Callout, Card, IconTile, SwatchDot } from '@ui/atoms'
import { AttachmentCard } from '@ui/chat'
import { SelectChip, TextArea, type SelectChipOption } from '@ui/forms'
import type { StyleSummary } from '@shared/contracts/style-library'
import { LENGTHS } from '../model/newLesson'
import type { NewLessonForm } from '../hooks/useNewLesson'
import './NewLessonCard.css'

/** Sentinel option value for "Create a new style…" in the style chip. */
export const NEW_STYLE_VALUE = '__new-style__'
const PLAIN_VALUE = '__plain__'

export interface NewLessonCardProps {
  form: NewLessonForm
  /** The teacher's styles, in chip-menu order. */
  styles: ReadonlyArray<StyleSummary>
  /** "Create a new style…" was chosen in the style chip. */
  onCreateStyle(): void
  /** "Connect Claude" in the prompt that replaces creation when no key is saved. */
  onConnectClaude(): void
}

function styleOptions(styles: ReadonlyArray<StyleSummary>): SelectChipOption[] {
  const list: SelectChipOption[] =
    styles.length > 0
      ? styles.map((style) => ({
          value: style.id,
          label: style.name,
          leading: <SwatchDot color={style.primaryHex} />,
          fill: style.tintHex
        }))
      : [
          {
            value: PLAIN_VALUE,
            label: 'Plain style',
            leading: <SwatchDot color="var(--line-muted)" />
          }
        ]
  return [
    ...list,
    { value: NEW_STYLE_VALUE, label: 'Create a new style…', leading: <Plus size={16} /> }
  ]
}

const lengthOptions: SelectChipOption[] = LENGTHS.map((minutes) => ({
  value: String(minutes),
  label: `${minutes} min`
}))

const isCreateKey = (event: KeyboardEvent): boolean =>
  event.key === 'Enter' && (event.ctrlKey || event.metaKey)

/** The orange "Make a new lesson" card: objectives, document, style, length and Create lesson (03 §3). */
export function NewLessonCard({
  form,
  styles,
  onCreateStyle,
  onConnectClaude
}: NewLessonCardProps) {
  const [dragging, setDragging] = useState(false)
  const depth = useRef(0)

  const submitOnCtrlEnter = (event: KeyboardEvent): void => {
    if (!isCreateKey(event)) return
    event.preventDefault()
    void form.create()
  }

  const onDragEnter = (event: DragEvent): void => {
    if (!event.dataTransfer?.types.includes('Files')) return
    event.preventDefault()
    depth.current += 1
    setDragging(true)
  }
  const onDragLeave = (): void => {
    depth.current = Math.max(depth.current - 1, 0)
    if (depth.current === 0) setDragging(false)
  }
  const onDrop = (event: DragEvent): void => {
    event.preventDefault()
    depth.current = 0
    setDragging(false)
    void form.dropDocument(Array.from(event.dataTransfer?.files ?? []))
  }

  return (
    <Card
      as="section"
      tone="accent"
      padding={28}
      shadow="lg"
      className="home-new"
      data-dragging={dragging || undefined}
      aria-labelledby="home-new-title"
      onDragEnter={onDragEnter}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="home-new__head">
        <IconTile size={52} tone="white">
          <Monitor strokeWidth={2.2} />
        </IconTile>
        <h2 id="home-new-title" className="home-new__title">
          Make a new lesson
        </h2>
      </div>
      <p className="home-new__intro">
        Paste your learning objectives, or drop the document they’re in. I’ll build the slides in
        your style.
      </p>
      <TextArea
        label="Learning objectives"
        hideLabel
        rows={4}
        className="home-new__objectives"
        placeholder={
          'e.g. Year 8 Science — Photosynthesis\nLO1: Describe where photosynthesis happens in a plant\nLO2: Write the word equation…'
        }
        value={form.text}
        onChange={(event) => form.setText(event.target.value)}
        onKeyDown={submitOnCtrlEnter}
      />
      {form.document && (
        <AttachmentCard
          name={form.document.name}
          sizeBytes={form.document.sizeBytes}
          kind={form.document.kind}
          onRemove={form.removeDocument}
        />
      )}
      {form.needsClaude && (
        <Callout
          variant="action"
          action={<Button onClick={onConnectClaude}>Connect Claude</Button>}
        >
          Claude isn’t connected yet, so I can’t make slides.
        </Callout>
      )}
      {form.error && <Callout variant="error">{form.error}</Callout>}
      <div className="home-new__actions">
        <Button
          shape="pill"
          icon={<Paperclip strokeWidth={2.2} />}
          onClick={() => void form.pickDocument()}
        >
          {form.document ? 'Replace document' : 'Upload LO document'}
        </Button>
        <SelectChip
          label="Style"
          options={styleOptions(styles)}
          value={form.styleId ?? PLAIN_VALUE}
          onChange={(value) =>
            value === NEW_STYLE_VALUE ? onCreateStyle() : form.chooseStyle(value)
          }
        />
        <SelectChip
          label="Lesson length"
          options={lengthOptions}
          value={String(form.lengthMin)}
          leading={<Timer size={18} strokeWidth={2.2} />}
          onChange={(value) => form.chooseLength(Number(value))}
        />
        <span className="home-new__spacer" />
        <Button
          variant="dark"
          size="lg"
          iconAfter={<ArrowRight strokeWidth={2.4} />}
          loading={form.creating}
          loadingLabel="Creating…"
          disabled={!form.canCreate}
          onClick={() => void form.create()}
        >
          Create lesson
        </Button>
      </div>
    </Card>
  )
}
