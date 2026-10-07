/** The plugin UI's pure rules: when a tile is disabled, what the sheet knows about the slides, how a run reads. */
import {
  slideRangeOptions,
  type FormValues,
  type SlideContext
} from '../../../../renderer/src/ui/plugin/PluginSheet/values'
import type {
  PluginInput,
  PluginManifestView,
  PluginRunContext,
  PluginSummary
} from '@shared/contracts/deck-builder-plugins'
import type { RegionDraft } from '@shared/contracts/deck-builder-chat'
import type { Deck } from '@shared/deck/types'

export const WAIT_REASON = 'Wait for the current change to finish.'
export const NO_SLIDES_REASON = 'Make your slides first'
export const NO_REGION_REASON = 'Circle something first'

/** Why a plugin cannot run right now (a tooltip on its disabled tile), or null when it can (06 §8.7). */
export function unavailableReason(
  plugin: Pick<PluginSummary, 'needsSlides' | 'scope'>,
  state: { busy: boolean; slideCount: number; regionCount: number }
): string | null {
  if (state.busy) return WAIT_REASON
  if (plugin.needsSlides && state.slideCount === 0) return NO_SLIDES_REASON
  if (plugin.scope === 'region' && state.regionCount === 0) return NO_REGION_REASON
  return null
}

/** The editor state that words and defaults "Which slides?" (slide numbers are 1-based). */
export function slideContextOf(
  deck: Pick<Deck, 'slides'>,
  selectedSlideIds: readonly string[],
  currentSlideId: string | null
): SlideContext {
  const ids = deck.slides.map((slide) => slide.id)
  const current = Math.max(currentSlideId ? ids.indexOf(currentSlideId) + 1 : 1, 1)
  const selected = ids.flatMap((id, i) => (selectedSlideIds.includes(id) ? [i + 1] : []))
  return { total: ids.length, current, selected: selected.length > 0 ? selected : [current] }
}

/** What `plugins:run` needs to know about the editor; main validates it again. */
export function runContext(
  deck: Pick<Deck, 'slides'>,
  selectedSlideIds: readonly string[],
  currentSlideId: string | null,
  regions: readonly RegionDraft[]
): PluginRunContext {
  const first = deck.slides[0]?.id ?? ''
  const current =
    currentSlideId && deck.slides.some((s) => s.id === currentSlideId) ? currentSlideId : first
  const selected = selectedSlideIds.filter((id) => deck.slides.some((s) => s.id === id))
  return {
    currentSlideId: current,
    selectedSlideIds: selected.length > 0 ? selected : current ? [current] : [],
    ...(regions.length > 0 ? { regions: [...regions] } : {})
  }
}

/** "How many questions?" -> "questions". */
const nounOf = (label: string): string =>
  label
    .replace(/^how many\s+/i, '')
    .replace(/\?$/, '')
    .toLowerCase()

function partOf(input: PluginInput, value: unknown, slides: SlideContext): string | null {
  switch (input.type) {
    case 'number':
      return typeof value === 'number' ? `${value} ${nounOf(input.label)}` : null
    case 'slideRange':
      return slideRangeOptions(slides).find((o) => o.value === value)?.label ?? null
    case 'choice':
      return input.options.find((o) => o.value === value)?.label ?? null
    case 'text':
      return typeof value === 'string' && value.trim() ? value.trim().slice(0, 40) : null
    case 'multi':
    case 'boolean':
      return null
  }
}

/** The line under the request bubble: "10 questions · All 8 slides · Mixed · Slides at the end of this lesson". */
export function requestSummary(
  manifest: Pick<PluginManifestView, 'inputs'>,
  values: FormValues,
  slides: SlideContext
): string {
  // Amounts first, then which slides, then the choices: "10 questions · All 8 slides · Mixed · …".
  const rank = (input: PluginInput): number =>
    input.type === 'number' ? 0 : input.type === 'slideRange' ? 1 : 2
  return [...manifest.inputs]
    .sort((a, b) => rank(a) - rank(b))
    .map((input) => partOf(input, values[input.id], slides))
    .filter((part): part is string => part !== null)
    .join(' · ')
}
