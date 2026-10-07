import type { PluginManifestView, PluginSummary } from '@shared/contracts/deck-builder-plugins'
import type { SlideContext } from './PluginSheet/values'

/** The Quiz plugin's manifest as screen 07 shows it (07 §5). Used by the gallery and the tests. */
export const QUIZ_MANIFEST: PluginManifestView = {
  id: 'quiz',
  name: 'Quiz',
  title: 'Quiz from slides',
  description: 'Quick-check questions in your format',
  icon: 'list-checks',
  tint: 'peach',
  scope: 'lesson',
  output: ['slides', 'file'],
  action: 'Make quiz',
  estimate: 'About 20 seconds',
  needsSlides: true,
  inputs: [
    { id: 'slides', type: 'slideRange', label: 'Which slides?', default: 'all' },
    {
      id: 'count',
      type: 'number',
      label: 'How many questions?',
      min: 3,
      max: 30,
      step: 1,
      default: 10,
      decrementLabel: 'Fewer questions',
      incrementLabel: 'More questions'
    },
    {
      id: 'types',
      type: 'multi',
      label: 'Question types',
      minSelected: 1,
      default: ['multiple-choice', 'true-false'],
      options: [
        { value: 'multiple-choice', label: 'Multiple choice' },
        { value: 'true-false', label: 'True or false' },
        { value: 'fill-gap', label: 'Fill the gap (uses your key words)' },
        { value: 'short-answer', label: 'Short answer' }
      ]
    },
    {
      id: 'difficulty',
      type: 'choice',
      label: 'Difficulty',
      default: 'mixed',
      options: [
        { value: 'mixed', label: 'Mixed' },
        { value: 'core', label: 'Core' },
        { value: 'stretch', label: 'Stretch' }
      ]
    },
    {
      id: 'destination',
      type: 'choice',
      label: 'Where should it go?',
      default: 'slides',
      options: [
        {
          value: 'slides',
          label: 'Slides at the end of this lesson',
          description: 'In your style, with an answer slide'
        },
        {
          value: 'word',
          label: 'Printable quiz (Word)',
          description: 'A4 sheet plus a separate answer key'
        },
        { value: 'both', label: 'Both' }
      ]
    }
  ]
}

/** A lesson of 8 slides with the third on the stage and nothing else selected. */
export const EIGHT_SLIDES: SlideContext = { total: 8, current: 3, selected: [3] }

/** The five plugins of the mock-up "+" menu, in order (06 §6). */
export const MOCK_PLUGINS: PluginSummary[] = [
  ['quiz', 'Quiz', 'Quick-check questions in your format', 'list-checks', 'peach'],
  ['differentiate', 'Differentiate', 'Support and stretch versions', 'users', 'sky'],
  ['worksheet', 'Worksheet', 'A printable worksheet in Word', 'file-text', 'mint'],
  ['speaker-notes', 'Speaker notes', 'Notes for each slide', 'notebook-text', 'butter'],
  ['starter-plenary', 'Starter & plenary', 'Open and close the lesson', 'timer', 'purple-soft']
].map(([id, name, description, icon, tint], index) => ({
  id,
  name,
  description,
  icon,
  tint: tint as PluginSummary['tint'],
  scope: 'lesson',
  hasInputs: true,
  needsSlides: true,
  order: index + 1
}))
