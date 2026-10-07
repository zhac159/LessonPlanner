import { lazy } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import { defineUiModule } from '@renderer/sdk'

/**
 * Assets: the library of logos, icons and pictures she reuses (A1), the review of pictures found in her
 * decks (A2), "Make a new one like these" (A8) and "Find online" (A9). Sits between Styles and Plugins.
 */
export default defineUiModule({
  id: 'assets',
  title: 'Assets',
  icon: ImageIcon,
  order: 30,
  nav: 'top',
  chrome: 'sidebar',
  // Loaded the first time the page opens (the shell shows a loading state meanwhile), not at startup.
  component: lazy(() => import('./ui/AssetsView').then((m) => ({ default: m.AssetsView })))
})
