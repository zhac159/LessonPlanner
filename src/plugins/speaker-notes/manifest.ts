/** Speaker notes (design/plugin-architecture.md §6 #2). Pure data. */
import { defineManifest } from '@shared/plugins/manifest'

export default defineManifest({
  id: 'speaker-notes',
  name: 'Speaker notes',
  title: 'Speaker notes',
  description: 'Talking points for each slide',
  icon: 'sticky-note',
  tint: 'butter',
  scope: 'lesson',
  inputs: [
    { id: 'slides', type: 'slideRange', label: 'Which slides?', default: 'all' },
    {
      id: 'length',
      type: 'choice',
      label: 'How long?',
      options: [
        { value: 'short', label: 'Short', description: 'One or two sentences' },
        { value: 'full', label: 'Full', description: 'Two to four sentences with prompts' }
      ],
      default: 'short'
    },
    { id: 'timings', type: 'boolean', label: 'Include timings', default: true }
  ],
  output: ['slides'],
  action: 'Add notes',
  estimate: 'About 15 seconds',
  needsSlides: true,
  usesStyle: true,
  order: 2
})
