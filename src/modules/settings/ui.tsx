import { SlidersHorizontal } from 'lucide-react'
import { defineUiModule } from '@renderer/sdk'
import { SettingsView } from './ui/SettingsView'

/** Settings: the first-run wizard (Welcome, Connect Claude) and the Settings page (About you, Claude). */
export default defineUiModule({
  id: 'settings',
  title: 'Settings',
  icon: SlidersHorizontal,
  order: 100,
  nav: 'bottom',
  chrome: 'sidebar',
  component: SettingsView
})
