import { useCallback, useState } from 'react'
import { useClient, useShell } from '@renderer/sdk'
import { useToast } from '@ui/overlays'
import { DECK_BUILDER, type DeckBuilderApi, type LoDocument } from '@shared/contracts/deck-builder'
import type { Result } from '@shared/result'
import type { StyleSummary } from '@shared/contracts/style-library'
import { defaultStyleId } from '../model/styles'
import { canCreate, initialLength, LO_EXTENSIONS } from '../model/newLesson'

const NOT_ATTACHED = 'I couldn’t attach that document. Try again.'
const NOT_CREATED = 'I couldn’t start that lesson. Your text is still here, so try again.'
const ONLY_LO = 'Only .docx, .pdf and .pptx files can be attached.'

export interface NewLessonForm {
  text: string
  document: LoDocument | null
  /** The chosen style id; null is the built-in plain style. */
  styleId: string | null
  lengthMin: number
  creating: boolean
  /** The Connect Claude prompt is showing inside the card. */
  needsClaude: boolean
  /** A failure other than "not connected", shown inside the card. */
  error: string | null
  canCreate: boolean
  setText(value: string): void
  chooseStyle(id: string): void
  chooseLength(minutes: number): void
  pickDocument(): Promise<void>
  /** Files dropped on the card: one `.docx`, `.pdf` or `.pptx` is attached, anything else is refused. */
  dropDocument(files: File[]): Promise<void>
  removeDocument(): void
  create(): Promise<void>
}

interface Inputs {
  styles: ReadonlyArray<StyleSummary>
  /** True/false once known; `null` while still reading the status. */
  connected: boolean | null
  lastLengthMin: number | null
  onLengthChosen(minutes: number): void
}

const extensionOf = (name: string): string => name.slice(name.lastIndexOf('.')).toLowerCase()

/**
 * The "Make a new lesson" card (03 §8): objectives, one attached document, style and length, then
 * `createLesson` with generation started and a hand-over to the editor.
 */
export function useNewLesson({
  styles,
  connected,
  lastLengthMin,
  onLengthChosen
}: Inputs): NewLessonForm {
  const deckBuilder = useClient<DeckBuilderApi>(DECK_BUILDER)
  const { navigate } = useShell()
  const toast = useToast()
  const [text, setText] = useState('')
  const [attached, setAttached] = useState<LoDocument | null>(null)
  const [chosenStyle, setChosenStyle] = useState<string | null | undefined>(undefined)
  const [chosenLength, setChosenLength] = useState<number | undefined>(undefined)
  const [creating, setCreating] = useState(false)
  const [needsClaude, setNeedsClaude] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const styleId =
    chosenStyle !== undefined && styles.some((style) => style.id === chosenStyle)
      ? chosenStyle
      : defaultStyleId(styles)
  const lengthMin = chosenLength ?? initialLength(lastLengthMin)

  const attach = useCallback(
    async (load: () => Promise<Result<{ document: LoDocument } | { cancelled: true }>>) => {
      try {
        const result = await load()
        if (!result.ok)
          return void toast.show({ message: result.message || NOT_ATTACHED, tone: 'error' })
        if ('document' in result) setAttached(result.document)
      } catch {
        toast.show({ message: NOT_ATTACHED, tone: 'error' })
      }
    },
    [toast]
  )

  const pickDocument = useCallback(
    () => attach(async () => deckBuilder.pickLoDocument()),
    [attach, deckBuilder]
  )

  const dropDocument = useCallback(
    async (files: File[]) => {
      const file = files.find((item) =>
        (LO_EXTENSIONS as readonly string[]).includes(extensionOf(item.name))
      )
      if (!file || files.length > 1) return void toast.show({ message: ONLY_LO, tone: 'error' })
      await attach(() => deckBuilder.importLoDocument({ path: window.api.files.pathFor(file) }))
    },
    [attach, deckBuilder, toast]
  )

  const create = useCallback(async () => {
    if (creating || !canCreate(text, attached !== null)) return
    setError(null)
    if (connected === false) return setNeedsClaude(true)
    setNeedsClaude(false)
    setCreating(true)
    try {
      const result = await deckBuilder.createLesson({
        objectivesText: text.trim(),
        documentIds: attached ? [attached.id] : [],
        styleId,
        title: null,
        meta: { durationMin: lengthMin },
        startGeneration: true
      })
      if (!result.ok) {
        if (result.code === 'no-key' || result.code === 'invalid-key') setNeedsClaude(true)
        else setError(result.message || NOT_CREATED)
        return
      }
      setText('')
      setAttached(null)
      navigate(DECK_BUILDER, {
        kind: 'open-lesson',
        lessonId: result.lessonId,
        jobId: result.jobId
      })
    } catch {
      setError(NOT_CREATED)
    } finally {
      setCreating(false)
    }
  }, [creating, text, attached, connected, deckBuilder, styleId, lengthMin, navigate])

  return {
    text,
    document: attached,
    styleId,
    lengthMin,
    creating,
    needsClaude,
    error,
    canCreate: canCreate(text, attached !== null),
    setText,
    chooseStyle: setChosenStyle,
    chooseLength: (minutes) => {
      setChosenLength(minutes)
      onLengthChosen(minutes)
    },
    pickDocument,
    dropDocument,
    removeDocument: () => setAttached(null),
    create
  }
}
