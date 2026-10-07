/**
 * Speaker notes (main process). Asks Claude for notes for the chosen slides and writes them with ONE ChangeSet
 * (`updateSlide` per slide), so Undo takes them all away at once.
 */
import { fail } from '@shared/result'
import { definePlugin, orThrow, PluginError } from '@shared/plugins/types'
import { resolveSlides } from '@shared/plugins/slideRange'
import { describeSlides } from '@shared/plugins/slideText'
import { NOTES_INSTRUCTIONS, notesPrompt, notesSchema, readOptions, usableNotes } from './notes'

const count = (n: number): string => `${n} ${n === 1 ? 'slide' : 'slides'}`

export default definePlugin({
  id: 'speaker-notes',
  async run(ctx, inputs) {
    const { options } = orThrow(readOptions(inputs))
    const slides = resolveSlides(ctx.deck, options.slides, ctx.selection)
    if (slides.length === 0) throw new PluginError(fail('invalid-input', 'Make some slides first.'))

    ctx.progress(`Reading ${count(slides.length)}…`)
    const slideText = describeSlides(
      slides,
      (s) => ctx.deck.slides.findIndex((d) => d.id === s.id) + 1
    )
    ctx.progress('Writing speaker notes…')
    const written = orThrow(
      await ctx.ai.structured({
        instructions: NOTES_INSTRUCTIONS,
        prompt: notesPrompt(
          options,
          {
            title: ctx.deck.title,
            yearGroup: ctx.deck.meta.yearGroup,
            durationMin: ctx.deck.meta.durationMin
          },
          slideText
        ),
        schema: notesSchema,
        effort: 'low',
        maxTokens: 1500 + 500 * slides.length
      })
    )
    const { notes } = orThrow(
      usableNotes(
        written.data.notes,
        slides.map((s) => s.id)
      )
    )

    ctx.signal.throwIfAborted()
    orThrow(
      await ctx.applyChanges(
        [...notes].map(([slideId, text]) => ({
          op: 'updateSlide' as const,
          slideId,
          set: { notes: text }
        })),
        `Added speaker notes to ${count(notes.size)}`
      )
    )
    const missing = slides.length - notes.size
    return {
      message:
        `I wrote speaker notes for ${count(notes.size)}.` +
        (missing > 0 ? ` ${count(missing)} could not be done: ask me to try those again.` : '')
    }
  }
})
