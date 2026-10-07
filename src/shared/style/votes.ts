/**
 * The cheap, local "merge" step (design/style-profile.md §2.3): count-based voting across per-file analyses.
 * It fills the "What I've learned so far" panel after every learned file, long before Claude's synthesis.
 * Pure and deterministic: same analyses in any order give the same result.
 */
import type { FileAnalysis } from '../ai/types'
import type { SlideKind } from '../deck/types'

export type ColourRole = FileAnalysis['colors'][number]['role']

export interface ColourVote {
  hex: string
  /** The role this colour won most votes for. */
  role: ColourRole
  votes: number
  /** Number of files the colour appeared in. */
  files: number
}

export interface FontVote {
  family: string
  use: 'title' | 'body' | 'other'
  files: number
  weight: number | null
  sizeRangePt: [number, number] | null
}

export interface LayoutVote {
  name: string
  description: string
  files: number
  pages: number
}

export interface SlideKindVote {
  kind: SlideKind
  slides: number
  files: number
  frequency: 'always' | 'often' | 'sometimes'
}

export interface CountedText {
  text: string
  files: number
}

export interface LearnedSoFar {
  files: number
  /** All colours, most voted first. */
  colours: ColourVote[]
  /** The winning colour per named role (never `other`). */
  palette: Partial<Record<Exclude<ColourRole, 'other'>, string>>
  fonts: FontVote[]
  layouts: LayoutVote[]
  slideKinds: SlideKindVote[]
  /** Slide kinds ordered by their average position in her decks. */
  lessonFlow: SlideKind[]
  decorations: CountedText[]
  habits: CountedText[]
  voiceRules: CountedText[]
  phrases: CountedText[]
  spelling: 'en-GB' | 'en-US' | null
}

const FREQUENCY_WEIGHT = { most: 3, many: 2, some: 1 } as const

/** `#abc`, `abc`, `#aabbcc` become `#AABBCC`; anything else is null. */
export function normaliseHex(value: string): string | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim())
  if (!match) return null
  const digits = match[1].length === 3 ? [...match[1]].map((c) => c + c).join('') : match[1]
  return `#${digits.toUpperCase()}`
}

const keyOf = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()

/** Returns `map[key]`, creating it with `init` when missing. */
function slot<K, T>(map: Map<K, T>, key: K, init: () => T): T {
  let found = map.get(key)
  if (!found) {
    found = init()
    map.set(key, found)
  }
  return found
}

const bump = (map: Map<string, number>, key: string, by = 1): void => {
  map.set(key, (map.get(key) ?? 0) + by)
}

/** Highest count wins; ties break alphabetically so results never depend on input order. */
const topKey = (counts: Map<string, number>): string | undefined =>
  [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0]

function voteColours(analyses: FileAnalysis[]): ColourVote[] {
  const byHex = new Map<string, { roles: Map<string, number>; votes: number; files: Set<number> }>()
  analyses.forEach((analysis, fileIndex) => {
    for (const colour of analysis.colors) {
      const hex = normaliseHex(colour.hex)
      if (!hex) continue
      const item = slot(byHex, hex, () => ({ roles: new Map(), votes: 0, files: new Set() }))
      const weight = FREQUENCY_WEIGHT[colour.frequency] ?? 1
      item.votes += weight
      item.files.add(fileIndex)
      bump(item.roles, colour.role, weight)
    }
  })
  return [...byHex.entries()]
    .map(([hex, item]) => ({
      hex,
      role: (topKey(item.roles) ?? 'other') as ColourRole,
      votes: item.votes,
      files: item.files.size
    }))
    .sort((a, b) => b.votes - a.votes || b.files - a.files || a.hex.localeCompare(b.hex))
}

function pickPalette(colours: ColourVote[]): LearnedSoFar['palette'] {
  const palette: LearnedSoFar['palette'] = {}
  for (const colour of colours) {
    if (colour.role === 'other' || palette[colour.role]) continue
    palette[colour.role] = colour.hex
  }
  return palette
}

function voteFonts(analyses: FileAnalysis[]): FontVote[] {
  interface Item {
    family: string
    use: FontVote['use']
    weights: Map<string, number>
    sizes: number[]
    files: Set<number>
  }
  // One entry per family AND use, so Lexend-as-title and Lexend-as-body keep their own sizes.
  const byFamilyUse = new Map<string, Item>()
  analyses.forEach((analysis, fileIndex) => {
    for (const font of analysis.fonts) {
      const family = font.family.trim()
      if (!family) continue
      const item = slot(byFamilyUse, `${family.toLowerCase()}|${font.usedFor}`, () => ({
        family,
        use: font.usedFor,
        weights: new Map<string, number>(),
        sizes: [] as number[],
        files: new Set<number>()
      }))
      item.files.add(fileIndex)
      if (font.weight) bump(item.weights, String(font.weight))
      if (font.sizePt) item.sizes.push(font.sizePt)
    }
  })
  return [...byFamilyUse.values()]
    .map((item) => ({
      family: item.family,
      use: item.use,
      files: item.files.size,
      weight: item.weights.size ? Number(topKey(item.weights)) : null,
      sizeRangePt: item.sizes.length
        ? ([Math.min(...item.sizes), Math.max(...item.sizes)] as [number, number])
        : null
    }))
    .sort(
      (a, b) => b.files - a.files || a.family.localeCompare(b.family) || a.use.localeCompare(b.use)
    )
}

function voteLayouts(analyses: FileAnalysis[]): LayoutVote[] {
  const byName = new Map<string, LayoutVote>()
  for (const analysis of analyses) {
    const seen = new Set<string>()
    for (const layout of analysis.layouts) {
      const key = keyOf(layout.name)
      if (!key) continue
      const item = slot(byName, key, () => ({
        name: layout.name.trim(),
        description: layout.description,
        files: 0,
        pages: 0
      }))
      if (!seen.has(key)) item.files++
      seen.add(key)
      item.pages += layout.pages.length
    }
  }
  return [...byName.values()].sort(
    (a, b) => b.files - a.files || b.pages - a.pages || a.name.localeCompare(b.name)
  )
}

function voteSlideKinds(analyses: FileAnalysis[]): { votes: SlideKindVote[]; flow: SlideKind[] } {
  interface Item {
    slides: number
    files: Set<number>
    position: number
  }
  const byKind = new Map<SlideKind, Item>()
  analyses.forEach((analysis, fileIndex) => {
    const ordered = [...analysis.slideKinds].sort((a, b) => a.page - b.page)
    ordered.forEach((entry, index) => {
      const item = slot(byKind, entry.kind, () => ({ slides: 0, files: new Set(), position: 0 }))
      item.slides++
      item.files.add(fileIndex)
      item.position += ordered.length > 1 ? index / (ordered.length - 1) : 0
    })
  })
  const withKinds = analyses.filter((a) => a.slideKinds.length > 0).length || 1
  const frequencyOf = (files: number): SlideKindVote['frequency'] =>
    files === withKinds ? 'always' : files * 2 >= withKinds ? 'often' : 'sometimes'
  const votes = [...byKind.entries()]
    .map(([kind, item]) => ({
      kind,
      slides: item.slides,
      files: item.files.size,
      frequency: frequencyOf(item.files.size)
    }))
    .sort((a, b) => b.slides - a.slides || a.kind.localeCompare(b.kind))
  const flow = [...byKind.entries()]
    .map(([kind, item]) => ({ kind, mean: item.position / item.slides }))
    .sort((a, b) => a.mean - b.mean || a.kind.localeCompare(b.kind))
    .map((item) => item.kind)
  return { votes, flow }
}

/** Counts how many files mention each text (case/punctuation-insensitive), most mentioned first. */
function countTexts(lists: string[][]): CountedText[] {
  const byKey = new Map<string, CountedText>()
  for (const list of lists) {
    const seen = new Set<string>()
    for (const raw of list) {
      const text = raw.trim()
      const key = keyOf(text)
      if (!key) continue
      const item = slot(byKey, key, () => ({ text, files: 0 }))
      if (!seen.has(key)) item.files++
      seen.add(key)
    }
  }
  return [...byKey.values()].sort((a, b) => b.files - a.files) // stable: first seen wins ties
}

function voteSpelling(analyses: FileAnalysis[]): LearnedSoFar['spelling'] {
  const counts = new Map<string, number>()
  for (const analysis of analyses) {
    if (analysis.voice.spelling !== 'unknown') bump(counts, analysis.voice.spelling)
  }
  return (topKey(counts) as 'en-GB' | 'en-US' | undefined) ?? null
}

/** Merges per-file analyses into the live "What I've learned so far" data. */
export function aggregateAnalyses(analyses: FileAnalysis[]): LearnedSoFar {
  const colours = voteColours(analyses)
  const kinds = voteSlideKinds(analyses)
  return {
    files: analyses.length,
    colours,
    palette: pickPalette(colours),
    fonts: voteFonts(analyses),
    layouts: voteLayouts(analyses),
    slideKinds: kinds.votes,
    lessonFlow: kinds.flow,
    decorations: countTexts(analyses.map((a) => a.decorations.map((d) => d.description))),
    habits: countTexts(analyses.map((a) => a.habits)),
    voiceRules: countTexts(analyses.map((a) => a.voice.rules)),
    phrases: countTexts(analyses.map((a) => a.voice.phrases)),
    spelling: voteSpelling(analyses)
  }
}
