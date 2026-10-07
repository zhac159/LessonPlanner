import { useCallback, useEffect, useRef, useState } from 'react'
import { useClient, useEvent } from '@renderer/sdk'
import {
  DECK_BUILDER,
  type DeckBuilderApi,
  type DeckBuilderEvents,
  type DocumentReadResult,
  type LoDocument
} from '@shared/contracts/deck-builder'
import { splitByExtension } from '@ui/atoms'
import { MAX_DOCUMENTS, type DraftDocument } from '../buildRequest'

/** The files Claude can read for objectives (05 §8.5). */
export const LO_EXTENSIONS = ['.docx', '.pdf', '.pptx'] as const

export const TOO_MANY_DOCUMENTS = `You can attach up to ${MAX_DOCUMENTS} documents.`
export const WRONG_FILE_TYPE = 'I can read Word, PDF and PowerPoint documents.'
export const ATTACH_FAILED = 'I couldn’t attach that file. Try again.'
export const UNREADABLE = 'Couldn’t read this file'

type ReadOutcome = { ok: true; result: DocumentReadResult } | { ok: false }

/** "3 objectives found". */
export const objectivesFound = (count: number): string =>
  `${count} ${count === 1 ? 'objective' : 'objectives'} found`

const applyOutcome = (doc: DraftDocument, outcome: ReadOutcome): DraftDocument =>
  outcome.ok
    ? { ...doc, status: 'ready', detail: objectivesFound(outcome.result.objectives.length) }
    : { ...doc, status: 'error', detail: undefined }

export interface LoDocumentsState {
  documents: DraftDocument[]
  /** A readable problem with the last attempt ("You can attach up to 3 documents."), or null. */
  error: string | null
  /** A file is being added. */
  adding: boolean
  /** The paperclip and Dropzone click: native dialog, then import. */
  pick(): Promise<void>
  /** Files dropped on the Dropzone or the panel. */
  drop(files: File[]): Promise<void>
  remove(id: string): void
  dismissError(): void
}

/**
 * The learning-objective documents attached to the new lesson. Main reads each one right after it is
 * imported (when there is a key) and says so with `documentRead`, which can arrive before the import
 * call has returned: early answers are kept until their document shows up.
 */
export function useLoDocuments(options: {
  /** True when a key is present, so main will read the document and "Reading…" is honest. */
  reads: boolean
  /** Called with what Claude found in a document (year group, length). */
  onRead?: (result: DocumentReadResult) => void
}): LoDocumentsState {
  const deckBuilder = useClient<DeckBuilderApi>(DECK_BUILDER)
  const [documents, setDocuments] = useState<DraftDocument[]>([])
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const outcomes = useRef(new Map<string, ReadOutcome>())
  const count = useRef(0)
  useEffect(() => {
    count.current = documents.length
  }, [documents.length])
  const { reads, onRead } = options

  useEvent<DeckBuilderEvents, 'documentRead'>(DECK_BUILDER, 'documentRead', (event) => {
    const outcome: ReadOutcome = event.result.ok
      ? { ok: true, result: event.result }
      : { ok: false }
    outcomes.current.set(event.documentId, outcome)
    setDocuments((list) =>
      list.map((d) => (d.id === event.documentId ? applyOutcome(d, outcome) : d))
    )
    if (outcome.ok) onRead?.(outcome.result)
  })

  const append = useCallback(
    (document: LoDocument) => {
      const early = outcomes.current.get(document.id)
      const fresh: DraftDocument = { ...document, status: reads ? 'reading' : 'ready' }
      setDocuments((list) =>
        list.some((d) => d.id === document.id)
          ? list
          : [...list, early ? applyOutcome(fresh, early) : fresh]
      )
    },
    [reads]
  )

  const pick = useCallback(async () => {
    if (count.current >= MAX_DOCUMENTS) return setError(TOO_MANY_DOCUMENTS)
    setError(null)
    setAdding(true)
    try {
      const picked = await deckBuilder.pickLoDocument()
      if (!picked.ok) setError(picked.message)
      else if ('document' in picked) append(picked.document)
    } catch {
      setError(ATTACH_FAILED)
    } finally {
      setAdding(false)
    }
  }, [deckBuilder, append])

  const drop = useCallback(
    async (files: File[]) => {
      const { accepted, rejected } = splitByExtension(files, LO_EXTENSIONS)
      const room = Math.max(MAX_DOCUMENTS - count.current, 0)
      const batch = accepted.slice(0, room)
      setError(
        accepted.length > room
          ? TOO_MANY_DOCUMENTS
          : rejected.length > 0 && batch.length === 0
            ? WRONG_FILE_TYPE
            : null
      )
      if (batch.length === 0) return
      setAdding(true)
      try {
        for (const file of batch) {
          const imported = await deckBuilder.importLoDocument({
            path: window.api.files.pathFor(file)
          })
          if (imported.ok) append(imported.document)
          else setError(imported.message)
        }
      } catch {
        setError(ATTACH_FAILED)
      } finally {
        setAdding(false)
      }
    },
    [deckBuilder, append]
  )

  const remove = useCallback((id: string) => {
    setDocuments((list) => list.filter((d) => d.id !== id))
    setError(null)
  }, [])

  return { documents, error, adding, pick, drop, remove, dismissError: () => setError(null) }
}
