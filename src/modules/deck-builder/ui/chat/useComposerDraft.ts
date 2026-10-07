import { useCallback, useState } from 'react'
import { useClient } from '@renderer/sdk'
import { MAX_ATTACHMENTS, type AttachmentCardProps } from '@ui/chat'
import { useToast } from '@ui/overlays'
import { DECK_BUILDER, type DeckBuilderApi } from '@shared/contracts/deck-builder'
import type { AttachmentRef } from '@shared/contracts/deck-builder-chat'
import type { Draft } from './useChatSession'

export const TOO_MANY_FILES = `You can attach up to ${MAX_ATTACHMENTS} files.`
export const NO_PATH = 'Couldn’t attach that. Use the paperclip to pick the file instead.'

interface Pending {
  key: string
  name: string
}

let pendingCounter = 0

/**
 * What she is typing and attaching (06 §8.5): text, up to three files from the paperclip, a drop or a
 * paste. It lives as long as the panel does, so the draft survives the plugin sheet and navigating away.
 */
export function useComposerDraft(lessonId: string) {
  const client = useClient<DeckBuilderApi>(DECK_BUILDER)
  const toast = useToast()
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<AttachmentRef[]>([])
  const [pending, setPending] = useState<Pending[]>([])
  const full = attachments.length + pending.length >= MAX_ATTACHMENTS

  const complain = useCallback((message: string) => toast.show({ message, tone: 'error' }), [toast])

  const add = useCallback(
    (attachment: AttachmentRef) => setAttachments((current) => [...current, attachment]),
    []
  )

  /** The paperclip: the native file dialog. */
  const pick = useCallback(async (): Promise<void> => {
    if (full) return void complain(TOO_MANY_FILES)
    try {
      const result = await client['chat:attach']({ lessonId })
      if (!result.ok) complain(result.message)
      else if ('attachment' in result) add(result.attachment)
    } catch {
      complain(NO_PATH)
    }
  }, [client, lessonId, full, add, complain])

  /** Files dropped on the panel or pasted into the box. */
  const addFiles = useCallback(
    async (files: File[]): Promise<void> => {
      const room = MAX_ATTACHMENTS - attachments.length - pending.length
      if (files.length > room) complain(TOO_MANY_FILES)
      for (const file of files.slice(0, Math.max(room, 0))) {
        const path = window.api.files.pathFor(file)
        if (!path) {
          complain(NO_PATH)
          continue
        }
        const key = `pending-${(pendingCounter += 1)}`
        setPending((current) => [...current, { key, name: file.name }])
        try {
          const result = await client['chat:attachPath']({ lessonId, path })
          if (result.ok) add(result.attachment)
          else complain(result.message)
        } catch {
          complain(NO_PATH)
        } finally {
          setPending((current) => current.filter((p) => p.key !== key))
        }
      }
    },
    [attachments.length, pending.length, client, lessonId, add, complain]
  )

  const remove = useCallback(
    (id: string) => setAttachments((current) => current.filter((a) => a.id !== id)),
    []
  )

  const draft: Draft = { text, attachments }
  const cards: Array<AttachmentCardProps & { id: string }> = [
    ...attachments.map((a) => ({ id: a.id, name: a.name, kind: a.kind, sizeBytes: a.sizeBytes })),
    ...pending.map((p) => ({ id: p.key, name: p.name, status: 'uploading' as const }))
  ]

  return {
    text,
    setText,
    draft,
    cards,
    pick,
    addFiles,
    remove,
    full,
    /** After a send: the box is empty again. */
    clear: useCallback(() => {
      setText('')
      setAttachments([])
    }, []),
    /** A send that did not go: the draft comes back. */
    restore: useCallback((back: Draft) => {
      setText((current) => (current === '' ? back.text : current))
      setAttachments((current) => (current.length === 0 ? back.attachments : current))
    }, [])
  }
}
