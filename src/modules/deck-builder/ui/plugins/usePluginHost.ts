import { useCallback, useRef, useState } from 'react'
import { useClient } from '@renderer/sdk'
import { initialValues, type FormValues } from '@ui/plugin'
import { useToast } from '@ui/overlays'
import { DECK_BUILDER, type DeckBuilderApi } from '@shared/contracts/deck-builder'
import type { RegionDraft, StartedJob } from '@shared/contracts/deck-builder-chat'
import type { PluginManifestView, PluginSummary } from '@shared/contracts/deck-builder-plugins'
import type { Deck } from '@shared/deck/types'
import type { PluginRequest } from '../chat/transcriptState'
import { requestSummary, runContext, slideContextOf, unavailableReason } from './logic'
import { usePlugins } from './usePlugins'

/** What the host asks of the chat when a run starts. */
export interface PluginRunSink {
  startPlugin(request: PluginRequest): void
  pluginStarted(job: StartedJob): void
  pluginFailed(requestId: string): void
}

export interface PluginHostArgs {
  lessonId: string
  deck: Deck
  selectedSlideIds: string[]
  currentSlideId: string | null
  regions: RegionDraft[]
  /** A job is running: tiles are disabled and the sheet says wait. */
  busy: boolean
  chat: PluginRunSink
}

interface Loaded {
  manifest: PluginManifestView
  lastInputs: Record<string, unknown> | null
}

const UNAVAILABLE = 'That plugin isn’t available right now.'
let requestCounter = 0

/**
 * Everything behind the "+" menu and the options sheet (06 §8.7, 07 §8): the plugin list, opening a
 * plugin, the values kept while the sheet is closed, and starting a run as a job.
 */
export function usePluginHost(args: PluginHostArgs) {
  const { lessonId, deck, selectedSlideIds, currentSlideId, regions, busy, chat } = args
  const client = useClient<DeckBuilderApi>(DECK_BUILDER)
  const toast = useToast()
  const { plugins } = usePlugins()
  const [menuOpen, setMenuOpen] = useState(false)
  const [sheet, setSheet] = useState<Loaded | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const manifests = useRef(new Map<string, Loaded>())
  const remembered = useRef(new Map<string, FormValues>())
  const lastRun = useRef<{ pluginId: string; inputs: FormValues } | null>(null)
  const slides = slideContextOf(deck, selectedSlideIds, currentSlideId)

  const reasonFor = useCallback(
    (plugin: PluginSummary): string | null =>
      unavailableReason(plugin, {
        busy,
        slideCount: deck.slides.length,
        regionCount: regions.length
      }),
    [busy, deck.slides.length, regions.length]
  )

  const load = useCallback(
    async (pluginId: string): Promise<Loaded | null> => {
      const cached = manifests.current.get(pluginId)
      if (cached) return cached
      try {
        const result = await client['plugins:getManifest']({ pluginId })
        if (result.ok) {
          const loaded = { manifest: result.manifest, lastInputs: result.lastInputs }
          manifests.current.set(pluginId, loaded)
          return loaded
        }
        toast.show({ message: result.message, tone: 'error' })
      } catch {
        toast.show({ message: UNAVAILABLE, tone: 'error' })
      }
      return null
    },
    [client, toast]
  )

  /** Starts the run; true when the job started. */
  const run = useCallback(
    async (manifest: PluginManifestView, inputs: FormValues): Promise<boolean> => {
      const request: PluginRequest = {
        id: `local:request-${(requestCounter += 1)}`,
        pluginId: manifest.id,
        title: manifest.title,
        icon: manifest.icon,
        tint: manifest.tint,
        summary: requestSummary(manifest, inputs, slides)
      }
      chat.startPlugin(request)
      setSubmitting(true)
      try {
        const started = await client['plugins:run']({
          pluginId: manifest.id,
          lessonId,
          inputs,
          context: runContext(deck, selectedSlideIds, currentSlideId, regions)
        })
        if (started.ok) {
          chat.pluginStarted(started)
          lastRun.current = { pluginId: manifest.id, inputs }
          manifests.current.delete(manifest.id) // its last-used values just changed
          remembered.current.delete(manifest.id)
          setSheet(null)
          return true
        }
        chat.pluginFailed(request.id)
        toast.show({ message: started.message, tone: 'error' })
      } catch {
        chat.pluginFailed(request.id)
        toast.show({ message: UNAVAILABLE, tone: 'error' })
      } finally {
        setSubmitting(false)
      }
      return false
    },
    [client, lessonId, deck, selectedSlideIds, currentSlideId, regions, slides, chat, toast]
  )

  /** A tile was chosen: plugins with options open the sheet, the others run with their defaults. */
  const choose = useCallback(
    async (plugin: PluginSummary): Promise<void> => {
      const loaded = await load(plugin.id)
      if (!loaded) return
      if (plugin.hasInputs && loaded.manifest.inputs.length > 0) setSheet(loaded)
      else await run(loaded.manifest, initialValues(loaded.manifest.inputs, slides, null))
    },
    [load, run, slides]
  )

  /** "Try again" on a failed plugin run: the same options. */
  const rerunLast = useCallback(async (): Promise<void> => {
    const previous = lastRun.current
    const loaded = previous && (await load(previous.pluginId))
    if (previous && loaded) await run(loaded.manifest, previous.inputs)
  }, [load, run])

  const pluginId = sheet?.manifest.id
  return {
    plugins,
    menuOpen,
    setMenuOpen,
    reasonFor,
    choose,
    rerunLast,
    slides,
    submitting,
    /** The open sheet's manifest and starting values, or null while the chat is showing. */
    sheet: sheet && {
      manifest: sheet.manifest,
      lastInputs: (pluginId && remembered.current.get(pluginId)) || sheet.lastInputs
    },
    /** Back arrow or Esc: close and keep these values for next time this session. */
    back(values: FormValues): void {
      if (pluginId) remembered.current.set(pluginId, values)
      setSheet(null)
    },
    /** Cancel: close and forget this session's edits. */
    cancel(): void {
      if (pluginId) remembered.current.delete(pluginId)
      setSheet(null)
    },
    submit: (values: FormValues): Promise<boolean> =>
      sheet ? run(sheet.manifest, values) : Promise.resolve(false)
  }
}
