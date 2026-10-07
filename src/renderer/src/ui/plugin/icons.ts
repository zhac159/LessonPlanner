import {
  BookOpen,
  ClipboardList,
  FileText,
  Image,
  Languages,
  Layers,
  Lightbulb,
  ListChecks,
  NotebookText,
  Plus,
  Presentation,
  Puzzle,
  Sparkles,
  Timer,
  Users,
  type LucideIcon
} from 'lucide-react'

/**
 * The lucide icons plugin manifests may name (plugin-architecture.md §2 `icon`). The renderer
 * bundles only these, not the whole icon set; add a line here when a plugin needs another.
 */
const PLUGIN_ICONS: Record<string, LucideIcon> = {
  'list-checks': ListChecks,
  users: Users,
  'file-text': FileText,
  'notebook-text': NotebookText,
  timer: Timer,
  plus: Plus,
  languages: Languages,
  image: Image,
  layers: Layers,
  lightbulb: Lightbulb,
  'book-open': BookOpen,
  'clipboard-list': ClipboardList,
  presentation: Presentation,
  sparkles: Sparkles
}

/** The icon for a manifest's icon name; a puzzle piece for a name we do not know. */
export function pluginIcon(name: string): LucideIcon {
  return isPluginIcon(name) ? PLUGIN_ICONS[name] : Puzzle
}

/** True when `name` is a known plugin icon. */
export function isPluginIcon(name: string): boolean {
  return Object.hasOwn(PLUGIN_ICONS, name)
}
