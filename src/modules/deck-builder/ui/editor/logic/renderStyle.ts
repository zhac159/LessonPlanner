import type { StyleProfileView } from '@shared/contracts/style-library'
import type { StyleProfile } from '@shared/style/types'

/**
 * What SlideView reads from a lesson's style. `openLesson` sends the display projection (`StyleProfileView`), which
 * carries the `tokens` and `components` the renderer needs; the parts of a full profile that only the AI and the
 * Styles screen use (layouts, exemplars, sources) are left empty. `null` draws the plain default style.
 */
export function renderStyleOf(view: StyleProfileView | null): StyleProfile | null {
  if (!view) return null
  return {
    schemaVersion: 1,
    id: '',
    name: '',
    version: view.version,
    isDefault: false,
    status: 'ready',
    tokens: view.tokens,
    components: view.components,
    layouts: [],
    slideTypes: [],
    lessonFlow: [],
    voice: { spelling: 'en-GB', rules: [], phrases: [] },
    habits: view.habits,
    exemplars: [],
    sources: [],
    corrections: [],
    confidence: {
      colors: 'high',
      fonts: 'high',
      layouts: 'high',
      voice: 'high',
      slideTypes: 'high'
    },
    createdAt: '',
    updatedAt: ''
  }
}
