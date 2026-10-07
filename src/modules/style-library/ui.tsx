import { lazy } from 'react'
import { Palette } from 'lucide-react'
import { defineUiModule } from '@renderer/sdk'

/** Styles: learn her style from her own decks (Create a style) and manage her styles. */
export default defineUiModule({
  id: 'style-library',
  title: 'Styles',
  icon: Palette,
  order: 20,
  nav: 'top',
  chrome: 'sidebar',
  // Loaded the first time the screen opens (the shell shows a loading state meanwhile), not at startup.
  component: lazy(() =>
    import('./ui/StyleLibraryView').then((m) => ({ default: m.StyleLibraryView }))
  )
})
