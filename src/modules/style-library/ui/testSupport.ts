/** Test-only factories for the style-library UI: views, files and a fake client. Never imported by app code. */
import type {
  LearnProgress,
  StyleDraftView,
  StyleFile,
  StyleProfileView,
  StyleSummary
} from '@shared/contracts/style-library'
import type { StyleProfile } from '@shared/style/types'
import styleJson from '../../../../design/fixtures/style-profile.science-ks3.json'

const sampleStyle = styleJson as unknown as StyleProfile

export const ISO = '2026-10-06T09:00:00.000Z'

export function makeFile(overrides: Partial<StyleFile> = {}): StyleFile {
  return {
    id: 'f1',
    name: 'Y8 Photosynthesis.pptx',
    kind: 'pptx',
    units: 14,
    status: 'learned',
    mayContainNames: false,
    ...overrides
  }
}

/** Progress consistent with `files` unless overridden. */
export function progressOf(
  files: readonly StyleFile[],
  overrides: Partial<LearnProgress> = {}
): LearnProgress {
  const count = (status: StyleFile['status']): number =>
    files.filter((file) => file.status === status).length
  const pending = count('waiting') + count('reading')
  return {
    learned: count('learned'),
    failed: count('failed'),
    total: files.length,
    stage: pending > 0 ? 'reading' : count('learned') > 0 ? 'done' : 'idle',
    etaSeconds: pending > 0 ? 60 : null,
    ...overrides
  }
}

export function makeProfileView(overrides: Partial<StyleProfileView> = {}): StyleProfileView {
  const { fonts, colors } = sampleStyle.tokens
  return {
    colours: Object.entries(colors).map(([token, colour]) => ({ token, ...colour })),
    fonts: (['title', 'body'] as const).map((use) => ({
      use,
      family: fonts[use].family,
      weight: fonts[use].weight,
      sizeRangePt: fonts[use].sizeRangePt ?? null,
      available: fonts[use].available,
      fallbackStack: fonts[use].fallbackStack
    })),
    habits: sampleStyle.habits,
    slideTypes: sampleStyle.slideTypes.map((type) => type.name),
    voiceRules: sampleStyle.voice.rules,
    tokens: sampleStyle.tokens,
    components: sampleStyle.components,
    testSlide: null,
    version: 1,
    ...overrides
  }
}

export function makeView(
  files: readonly StyleFile[] = [makeFile()],
  overrides: Partial<StyleDraftView> = {}
): StyleDraftView {
  const progress = progressOf(files)
  return {
    id: 'sty_1',
    name: 'Science KS3',
    nameSource: 'user',
    isDefault: false,
    status: 'draft',
    files: [...files],
    progress,
    profile: progress.learned > 0 ? makeProfileView() : null,
    corrections: [],
    ...overrides
  }
}

export function makeSummary(overrides: Partial<StyleSummary> = {}): StyleSummary {
  return {
    id: 'sty_1',
    name: 'Science KS3',
    isDefault: true,
    status: 'ready',
    swatches: ['#0F766E', '#14213D', '#FFE36E', '#DDF5EE'],
    titleFont: 'Lexend',
    deckCount: 8,
    learning: null,
    primaryHex: '#0F766E',
    tintHex: '#DDF5EE',
    updatedAt: ISO,
    ...overrides
  }
}

/** Eight files as in the design image: six learned, one reading, one waiting. */
export function designFiles(): StyleFile[] {
  const names = [
    ['Y8 Photosynthesis.pptx', 14],
    ['Y7 Cells and organelles.pdf', 18],
    ['Y9 Forces recap.pptx', 11],
    ['Y8 Periodic table.pdf', 22],
    ['Y7 Particle model.pptx', 12],
    ['Y9 Respiration.pdf', 16],
    ['Y8 Acids and alkalis.pptx', 15],
    ['Y7 Energy stores.pdf', 13]
  ] as const
  return names.map(([name, units], index) =>
    makeFile({
      id: `f${index + 1}`,
      name,
      units,
      kind: name.endsWith('.pdf') ? 'pdf' : 'pptx',
      status: index < 6 ? 'learned' : index === 6 ? 'reading' : 'waiting'
    })
  )
}
