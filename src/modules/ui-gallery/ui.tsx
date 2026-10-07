import { LayoutGrid } from 'lucide-react'
import { lazy } from 'react'
import { defineUiModule } from '@renderer/sdk'

/**
 * Developer-only page that shows every UI-kit component in every state. Hidden from the sidebar:
 * open it with `navigate('ui-gallery')` (the smoke and screenshot scripts do). It is loaded lazily
 * so the specimens stay out of the way of normal start-up.
 */
export default defineUiModule({
  id: 'ui-gallery',
  title: 'UI gallery',
  icon: LayoutGrid,
  nav: 'hidden',
  chrome: 'sidebar',
  component: lazy(() => import('@ui/gallery').then((m) => ({ default: m.GalleryPage })))
})
