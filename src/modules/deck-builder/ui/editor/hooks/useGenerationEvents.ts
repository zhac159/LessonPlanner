import { useEffect, useState } from 'react'
import {
  DECK_BUILDER,
  type DeckBuilderEvents,
  type LessonsApi
} from '@shared/contracts/deck-builder'
import { useClient, useEvent } from '@renderer/sdk'
import { useToast } from '@ui/overlays'
import { IDLE_GENERATION, withProgress, withSlide, type GenerationView } from '../logic/generation'

export interface GenerationEvents {
  view: GenerationView
  /** The title the plan produced, shown in the header before the deck on disk has it. */
  title: string | null
  /** "Finish the rest": starts the job again for the slides that are missing. */
  finish(): Promise<void>
}

/**
 * Follows a lesson's generation (05 §7): progress events and the slides as they finish. When the job ends, `onEnded`
 * re-reads the deck (the slides reach `deck.json` once, at the end) and the held slides are let go afterwards, so the
 * filmstrip never flickers.
 */
export function useGenerationEvents(
  lessonId: string,
  startedRunning: boolean,
  onEnded: () => Promise<void>
): GenerationEvents {
  const client = useClient<LessonsApi>(DECK_BUILDER)
  const toast = useToast()
  const [view, setView] = useState<GenerationView>(() =>
    startedRunning
      ? {
          ...IDLE_GENERATION,
          running: true,
          progress: { lessonId, stage: 'planning', done: 0, total: 0 }
        }
      : IDLE_GENERATION
  )
  const [title, setTitle] = useState<string | null>(null)

  useEffect(() => {
    if (!startedRunning) return
    setView((was) =>
      was.running
        ? was
        : {
            ...was,
            running: true,
            progress: { lessonId, stage: 'planning', done: 0, total: 0 }
          }
    )
  }, [startedRunning, lessonId])

  useEvent<DeckBuilderEvents, 'gen-progress'>(DECK_BUILDER, 'gen-progress', (event) => {
    if (event.lessonId !== lessonId) return
    setView((was) => withProgress(was, event))
    if (event.title) setTitle(event.title)
    if (event.stage === 'done' || event.stage === 'error') {
      void onEnded().finally(() => {
        setView((was) => ({ ...was, live: [] }))
        setTitle(null)
      })
    }
  })

  useEvent<DeckBuilderEvents, 'slide-ready'>(DECK_BUILDER, 'slide-ready', (event) => {
    if (event.lessonId === lessonId) setView((was) => withSlide(was, event))
  })

  const finish = async (): Promise<void> => {
    const { done, total } = view.progress ?? { done: 0, total: 0 }
    try {
      const result = await client.finishGeneration({ lessonId })
      if (!result.ok) {
        toast.show({ message: result.message, tone: 'error' })
        return
      }
      setView((was) => ({
        ...was,
        running: true,
        progress: { lessonId, stage: 'writing', done, total }
      }))
    } catch {
      toast.show({ message: 'Couldn’t carry on with the slides. Try again.', tone: 'error' })
    }
  }

  return { view, title, finish }
}
