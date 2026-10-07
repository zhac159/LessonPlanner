/**
 * The plugins area of the `deck-builder` module: the registry shown in the "+" menu and the options
 * sheet (design/screens/06-editor.md §6, 07-plugin-sheet.md §6, plugin-architecture.md §2). Plugin
 * runs reuse the chat events (`chat:status`, `chat:changes`, …) with `ai:error` scope 'plugin'.
 */
import type { Result } from '../result'
import type { DocumentKind, RegionDraft, StartedJob } from './deck-builder-chat'
import { keysOf } from './names'

export type PluginTint = 'peach' | 'sky' | 'mint' | 'butter' | 'purple-soft'
export type PluginScope = 'lesson' | 'slides' | 'region'

/** One row in the "+" menu (06 §6). */
export interface PluginSummary {
  id: string
  name: string
  description: string
  icon: string
  tint: PluginTint
  scope: PluginScope
  hasInputs: boolean
  needsSlides: boolean
  order: number
}

/** One option field of the plugin sheet (07 §6). */
export type PluginInput =
  | { id: string; type: 'slideRange'; label: string; default: 'all' | 'selected' | 'current' }
  | {
      id: string
      type: 'number'
      label: string
      min: number
      max: number
      step: number
      default: number
      decrementLabel: string
      incrementLabel: string
    }
  | {
      id: string
      type: 'multi'
      label: string
      options: Array<{ value: string; label: string }>
      default: string[]
      minSelected?: number
    }
  | {
      id: string
      type: 'choice'
      label: string
      options: Array<{ value: string; label: string; description?: string }>
      default: string
    }
  | {
      id: string
      type: 'text'
      label: string
      placeholder?: string
      multiline?: boolean
      maxLength?: number
      required?: boolean
    }
  | { id: string; type: 'boolean'; label: string; default: boolean }

export type PluginInputType = PluginInput['type']

/** The renderer-safe part of a plugin's manifest (07 §6, plugin-architecture.md §2). */
export interface PluginManifestView {
  id: string
  name: string
  title: string
  description: string
  icon: string
  tint: PluginTint
  scope: PluginScope
  inputs: PluginInput[]
  output: Array<'slides' | 'file' | 'message'>
  /** Button label, e.g. "Make quiz". */
  action: string
  /** e.g. "About 20 seconds". */
  estimate?: string
  needsSlides: boolean
}

/** What the editor knows when the run starts; re-validated in main (07 §6). */
export interface PluginRunContext {
  currentSlideId: string
  selectedSlideIds: string[]
  regions?: RegionDraft[]
}

export interface PluginsApi {
  /** Plugins for the "+" menu, in display order (06 §6). */
  'plugins:list'(): PluginSummary[]
  /** Manifest and last-used inputs for the options sheet (07 §6). */
  'plugins:getManifest'(args: {
    pluginId: string
  }): Result<{ manifest: PluginManifestView; lastInputs: Record<string, unknown> | null }>
  /** Starts a plugin run as a job; inputs are validated again against the manifest (07 §6). */
  'plugins:run'(args: {
    pluginId: string
    lessonId: string
    inputs: Record<string, unknown>
    context: PluginRunContext
  }): Result<StartedJob>
  /** Cancels a running plugin job (07 §6). */
  'plugins:cancel'(args: { jobId: string }): void
}

export interface PluginsEvents {
  /** A plugin produced a file, shown as an AttachmentCard (07 §6). */
  'plugins:file': {
    lessonId: string
    messageId: string
    file: { name: string; path: string; kind: DocumentKind }
  }
}

export const PLUGINS_METHODS = keysOf<PluginsApi>()([
  'plugins:list',
  'plugins:getManifest',
  'plugins:run',
  'plugins:cancel'
])

export const PLUGINS_EVENTS = keysOf<PluginsEvents>()(['plugins:file'])
