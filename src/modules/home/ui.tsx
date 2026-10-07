import { House } from 'lucide-react'
import { defineUiModule } from '@renderer/sdk'
import { HomeView } from './ui/HomeView'

/** Home: greeting, the Make a new lesson card, Your styles and the past lessons (03-home.md). */
export default defineUiModule({
  id: 'home',
  title: 'Home',
  icon: House,
  order: 0,
  nav: 'top',
  chrome: 'sidebar',
  component: HomeView
})
