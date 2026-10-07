import { lazy } from 'react'
import { Presentation } from 'lucide-react'
import { defineUiModule } from '@renderer/sdk'

/**
 * Lessons: the New lesson screen (05) and the lesson editor (06). It has no sidebar item of its own: Home opens it with
 * `navigate('deck-builder', { kind: 'new-lesson' | 'create-lesson' | 'open-lesson', … })`, and it uses the 72px rail.
 */
export default defineUiModule({
  id: 'deck-builder',
  title: 'Lessons',
  icon: Presentation,
  nav: 'hidden',
  chrome: 'rail',
  // Loaded the first time the screen opens (the shell shows a loading state meanwhile), not at startup.
  component: lazy(() =>
    import('./ui/DeckBuilderView').then((m) => ({ default: m.DeckBuilderView }))
  )
})
