/** Pure projections of a StyleState into the shapes of the style-library contract. */
import type {
  LearnProgress,
  StyleDraftView,
  StyleFile,
  StyleProfileView,
  StyleSummary
} from '@shared/contracts/style-library'
import type { SourceRef, StyleProfile } from '@shared/style/types'
import { storedPictureView } from './habits'
import type { StyleState } from './types'

const FALLBACK_HEX = '#6B7280'

export const countByStatus = (state: StyleState, status: SourceRef['status']): number =>
  state.profile.sources.filter((s) => s.status === status).length

/** Files that still need reading. */
export const pendingCount = (state: StyleState): number =>
  countByStatus(state, 'waiting') + countByStatus(state, 'reading')

export function fileView(state: StyleState, source: SourceRef): StyleFile {
  const meta = state.meta.files[source.id]
  const view: StyleFile = {
    id: source.id,
    name: source.fileName,
    kind: source.kind,
    units: source.pages > 0 ? source.pages : null,
    status: source.status,
    mayContainNames: meta?.mayContainNames ?? false
  }
  if (source.status === 'failed' && meta?.error) {
    view.error = meta.error
  }
  return view
}

/** `stage` is supplied by the running job; without one it is derived from what is stored. */
export function progressView(
  state: StyleState,
  runtime?: { stage: LearnProgress['stage']; etaSeconds: number | null }
): LearnProgress {
  const learned = countByStatus(state, 'learned')
  const failed = countByStatus(state, 'failed')
  const progress: LearnProgress = {
    learned,
    failed,
    total: state.profile.sources.length,
    stage: runtime?.stage ?? (state.meta.pausedFor ? 'paused' : derivedStage(state, learned)),
    etaSeconds: runtime?.etaSeconds ?? null
  }
  if (state.meta.pausedFor) progress.pausedFor = state.meta.pausedFor
  return progress
}

function derivedStage(state: StyleState, learned: number): LearnProgress['stage'] {
  if (pendingCount(state) > 0) return 'idle'
  return learned > 0 ? 'done' : 'idle'
}

/** The panel data: null until the first file has been learned. */
export function profileView(
  state: StyleState,
  profile: StyleProfile = state.profile
): StyleProfileView | null {
  if (countByStatus(state, 'learned') === 0) return null
  const { fonts } = profile.tokens
  const picture = storedPictureView(state)
  const fontViews = (['title', 'body', 'accent'] as const).flatMap((use) => {
    const font = fonts[use]
    return font
      ? [
          {
            use,
            family: font.family,
            weight: font.weight,
            sizeRangePt: font.sizeRangePt ?? null,
            available: font.available,
            fallbackStack: font.fallbackStack
          }
        ]
      : []
  })
  return {
    colours: Object.entries(profile.tokens.colors).map(([token, c]) => ({ token, ...c })),
    fonts: fontViews,
    habits: profile.habits,
    slideTypes: profile.slideTypes.map((t) => t.name),
    voiceRules: profile.voice.rules,
    tokens: profile.tokens,
    components: profile.components,
    testSlide: state.meta.testSlide,
    version: profile.version,
    pictureHabits: picture.lines,
    assetsFound: picture.found
  }
}

export function draftView(
  state: StyleState,
  runtime?: { stage: LearnProgress['stage']; etaSeconds: number | null }
): StyleDraftView {
  const { profile } = state
  return {
    id: profile.id,
    name: profile.name,
    nameSource: state.meta.nameSource,
    isDefault: profile.isDefault,
    status: profile.status,
    files: profile.sources.map((s) => fileView(state, s)),
    progress: progressView(state, runtime),
    profile: profileView(state),
    corrections: profile.corrections.map(({ text, at }) => ({ text, at }))
  }
}

/** Home's StyleCard / style chip row. */
export function summaryView(state: StyleState): StyleSummary {
  const { profile } = state
  const colors = profile.tokens.colors
  const swatches = ['accent', 'text', 'highlight', 'chipBg']
    .map((token) => colors[token]?.hex)
    .filter((hex): hex is string => Boolean(hex))
  const pending = pendingCount(state)
  const accent = colors.accent?.hex ?? FALLBACK_HEX
  return {
    id: profile.id,
    name: profile.name,
    isDefault: profile.isDefault,
    status: profile.status,
    swatches,
    titleFont: profile.tokens.fonts.title.family,
    deckCount: countByStatus(state, 'learned'),
    learning:
      pending > 0
        ? { learned: countByStatus(state, 'learned'), total: profile.sources.length }
        : null,
    primaryHex: accent,
    tintHex: colors.chipBg?.hex ?? accent,
    updatedAt: profile.updatedAt
  }
}
