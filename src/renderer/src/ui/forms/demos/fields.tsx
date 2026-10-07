import type { ReactNode } from 'react'
import { Select } from '../Select/Select'
import { TextArea } from '../TextArea/TextArea'
import { TextField } from '../TextField/TextField'

const stack = { display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 520 } as const

const MODELS = [
  { value: 'sonnet', label: 'Claude Sonnet' },
  { value: 'opus', label: 'Claude Opus' },
  { value: 'haiku', label: 'Claude Haiku (unavailable)', disabled: true }
]

/** TextField: sizes, variants and every state. */
export function TextFieldStates(): ReactNode {
  return (
    <div style={stack}>
      <TextField
        label="Your name"
        size="xl"
        strongValue
        defaultValue="Ms Patel"
        hint="Shown on your lessons"
      />
      <TextField label="Subject" placeholder="e.g. Science" />
      <TextField label="Style name" error="Give your style a name" invalid />
      <TextField label="Disabled" disabled defaultValue="Can’t edit this" />
      <TextField label="Checking name…" loading defaultValue="Science KS3" />
      <TextField label="Search lessons and styles" variant="search" placeholder="Search" />
      <TextField
        label="Claude API key"
        variant="password"
        size="xl"
        defaultValue="sk-ant-1234567890"
      />
      <TextField label="Lesson title" variant="title" placeholder="Untitled lesson" />
    </div>
  )
}

/** TextArea: default, auto-grow, error, disabled. */
export function TextAreaStates(): ReactNode {
  return (
    <div style={stack}>
      <TextArea label="Learning objectives" placeholder={'By the end of the lesson…\n• …'} />
      <TextArea
        label="Auto-growing notes"
        autoGrow
        rows={2}
        defaultValue={'Line one\nLine two\nLine three'}
      />
      <TextArea label="With an error" error="Add at least one objective" />
      <TextArea label="Disabled" disabled defaultValue="Locked" />
    </div>
  )
}

/** Select: label above and inline, sizes, error, disabled. */
export function SelectStates(): ReactNode {
  return (
    <div style={stack}>
      <Select label="Model" options={MODELS} hint="Sonnet is a good default" />
      <Select
        label="Sort"
        labelPosition="inline"
        size="sm"
        options={MODELS}
        placeholder="Choose…"
      />
      <Select label="With an error" options={MODELS} placeholder="Choose…" error="Pick a model" />
      <Select label="Disabled" options={MODELS} disabled />
    </div>
  )
}
