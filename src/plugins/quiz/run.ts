/**
 * Quiz from slides (main process). Reads the chosen slides, asks Claude for questions, then makes quiz and answer
 * slides in the lesson's style (ONE undo step) and/or a printable Word file (design/screens/07-plugin-sheet.md §5).
 */
import { fail } from '@shared/result'
import { definePlugin, orThrow, PluginError } from '@shared/plugins/types'
import { resolveSlides } from '@shared/plugins/slideRange'
import { describeSlides } from '@shared/plugins/slideText'
import {
  QUIZ_INSTRUCTIONS,
  quizPrompt,
  quizSchema,
  readOptions,
  usableQuestions,
  type Question
} from './questions'
import { buildQuizSlides } from './slides'
import { buildQuizDocx } from './word'

const count = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? '' : 's'}`

export default definePlugin({
  id: 'quiz',
  async run(ctx, inputs) {
    const { options } = orThrow(readOptions(inputs))
    const slides = resolveSlides(ctx.deck, options.slides, ctx.selection)
    if (slides.length === 0) throw new PluginError(fail('invalid-input', 'Make some slides first.'))

    ctx.progress(`Reading ${count(slides.length, 'slide')}…`)
    const slideText = describeSlides(
      slides,
      (s) => ctx.deck.slides.findIndex((d) => d.id === s.id) + 1
    )
    ctx.progress(`Writing ${count(options.count, 'question')}…`)
    const written = orThrow(
      await ctx.ai.structured({
        instructions: QUIZ_INSTRUCTIONS,
        prompt: quizPrompt(
          options,
          {
            title: ctx.deck.title,
            yearGroup: ctx.deck.meta.yearGroup,
            ability: ctx.deck.meta.ability
          },
          slideText
        ),
        schema: quizSchema,
        effort: 'medium',
        maxTokens: 4000 + 400 * options.count
      })
    )
    const { questions, dropped } = orThrow(
      usableQuestions(written.data.questions as Question[], options)
    )

    const done: string[] = [`I wrote ${count(questions.length, 'question')}.`]
    if (options.destination !== 'docx') {
      ctx.progress('Making the quiz slides…')
      const made = buildQuizSlides({
        questions,
        style: ctx.style,
        deck: ctx.deck,
        newId: ctx.newId,
        pluginId: ctx.pluginId
      })
      ctx.progress('Making the answer slide…')
      ctx.signal.throwIfAborted()
      orThrow(
        await ctx.applyChanges(
          [{ op: 'insertSlides', afterSlideId: ctx.deck.slides.at(-1)?.id ?? null, slides: made }],
          `Added a ${questions.length}-question quiz`
        )
      )
      done.push(`${count(made.length, 'quiz slide')} added at the end of the lesson.`)
    }
    if (options.destination !== 'slides') {
      ctx.progress('Writing the Word file…')
      const bytes = await buildQuizDocx({
        lessonTitle: ctx.deck.title,
        questions,
        style: ctx.style
      })
      ctx.signal.throwIfAborted()
      const { file } = orThrow(await ctx.saveFile(`${ctx.deck.title} quiz.docx`, bytes))
      done.push(`Saved “${file.name}”.`)
    }
    if (dropped > 0)
      done.push(`Only ${questions.length} of the ${options.count} questions were usable.`)
    return { message: done.join(' ') }
  }
})
