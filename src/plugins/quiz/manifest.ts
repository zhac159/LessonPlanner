/** Quiz from slides (design/screens/07-plugin-sheet.md §6, plugin-architecture.md §6 #1). Pure data. */
import { defineManifest } from '@shared/plugins/manifest'

export default defineManifest({
  id: 'quiz',
  name: 'Quiz',
  title: 'Quiz from slides',
  description: 'Quick-check questions in your format',
  icon: 'list-checks',
  tint: 'peach',
  scope: 'lesson',
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
      options: [
        { value: 'mcq', label: 'Multiple choice' },
        { value: 'tf', label: 'True or false' },
        { value: 'gap', label: 'Fill the gap (uses your key words)' },
        { value: 'short', label: 'Short answer' }
      ],
      default: ['mcq', 'tf'],
      minSelected: 1
    },
    {
      id: 'difficulty',
      type: 'choice',
      label: 'Difficulty',
      options: [
        { value: 'mixed', label: 'Mixed' },
        { value: 'core', label: 'Core' },
        { value: 'stretch', label: 'Stretch' }
      ],
      default: 'mixed'
    },
    {
      id: 'destination',
      type: 'choice',
      label: 'Where should it go?',
      options: [
        {
          value: 'slides',
          label: 'Slides at the end of this lesson',
          description: 'In your style, with an answer slide'
        },
        {
          value: 'docx',
          label: 'Printable quiz (Word)',
          description: 'A4 sheet plus a separate answer key'
        },
        { value: 'both', label: 'Both' }
      ],
      default: 'slides'
    }
  ],
  output: ['slides', 'file'],
  action: 'Make quiz',
  estimate: 'About 20 seconds',
  needsSlides: true,
  usesStyle: true,
  order: 1
})
