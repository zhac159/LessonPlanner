/**
 * The AI boundary (design/ai-pipeline.md). Every Claude call runs in the MAIN process behind the
 * `AiService` interface below; feature code depends on the interface, never on the SDK, so tests use
 * a fake. Implementations live in src/main/ai. Pure types: no runtime code.
 */
import type { ZodType } from 'zod'
import type { Anchor, AssetKind } from '../assets/types'
import type { ChangeSet, DeckOp, Slide, SlideKind } from '../deck/types'
import type { Result } from '../result'
import type { StyleProfile } from '../style/types'

export type ModelChoice = 'claude-opus-5-5' | 'claude-sonnet-5-5'

export interface Usage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

export type AiTask =
  | 'testConnection'
  | 'analyseStyleFile'
  | 'synthesiseProfile'
  | 'applyStyleCorrection'
  | 'extractObjectives'
  | 'planLesson'
  | 'writeSlide'
  | 'chatTurn'
  | 'describeAssets'
  | 'describeStyleOfAssets'
  | 'drawSvg'
  | 'plugin'

/** `output_config.effort` (how hard the model thinks). */
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

/**
 * One message of the Claude conversation exactly as sent/received (content blocks verbatim, thinking blocks
 * included). Chat history is replayed append-only, so store these untouched (design/ai-pipeline.md §3, §8).
 */
export interface ApiMessage {
  role: 'user' | 'assistant'
  content: unknown[]
}

/** Every call can be cancelled; cancelling leaves the deck unchanged. */
export interface CallOptions {
  signal?: AbortSignal
}

// ---- 4.1 FileAnalysis (design/ai-pipeline.md §4.1)
export interface FileAnalysis {
  colors: Array<{
    hex: string
    role: 'background' | 'text' | 'accent' | 'highlight' | 'chip' | 'other'
    evidence: string
    frequency: 'most' | 'many' | 'some'
  }>
  fonts: Array<{
    family: string
    usedFor: 'title' | 'body' | 'other'
    sizePt?: number
    weight?: number
  }>
  layouts: Array<{
    name: string
    description: string
    regions: Array<{
      name: string
      elementType: string
      x: number
      y: number
      w: number
      h: number
    }>
    pages: number[]
  }>
  decorations: Array<{
    description: string
    shape?: string
    x?: number
    y?: number
    w?: number
    h?: number
    color?: string
  }>
  slideKinds: Array<{ page: number; kind: SlideKind; title?: string }>
  voice: { rules: string[]; phrases: string[]; spelling: 'en-GB' | 'en-US' | 'unknown' }
  habits: string[]
  exemplarCandidates: Array<{ page: number; why: string }>
  problems?: string[]
}

/** What the app hands Claude for one file: a PDF as bytes, or a `.pptx` digest (no AI, local). */
export type StyleFileInput =
  | { kind: 'pdf'; fileName: string; pdf: Uint8Array }
  | { kind: 'pptx'; fileName: string; digest: unknown }

// ---- 4.4 / 4.5
export interface ExtractedObjectives {
  title: string
  subject?: string
  yearGroup?: string
  objectives: string[]
  context?: string
}

export interface LessonPlan {
  title: string
  summary: string
  slides: Array<{
    kind: SlideKind
    layoutId: string
    purpose: string
    keyContent: string[]
    minutes?: number
    objectiveRefs: number[]
  }>
}

export interface LessonBrief {
  title?: string
  subject?: string
  yearGroup?: string
  durationMin?: number
  ability?: string
  targetSlideCount?: number
  objectives: string[]
  context?: string
}

// ---- 4.7 chat
export interface ChatTurnInput {
  lessonId: string
  messageId: string
  text: string
  /** Rendered region images (PNG bytes) + targeted element ids, see ai-pipeline.md §6. */
  regions?: Array<{
    n: number
    slideId: string
    slideNumber: number
    annotatedPng: Uint8Array
    cropPng: Uint8Array
    targetElementIds: string[]
    bbox: { x: number; y: number; w: number; h: number }
  }>
  attachments?: Array<{ name: string; kind: 'docx' | 'pdf' | 'pptx' | 'image' }>
  /** The teacher's library: its catalogue goes into the prompt and `list_assets` / `place_asset` are offered. */
  assets?: ChatAssets
}

/** What the chat `run_plugin` / `list_plugins` tools call (wired by the plugin host). */
export interface ChatPlugins {
  list(): unknown
  run(pluginId: string, inputs: Record<string, unknown>): Promise<unknown>
}

// ---- the teacher's assets in generation and chat (agents/ASSETS.md §5.4)

/** One library picture as the writer sees it: names and words, never pixels. */
export interface AssetFact {
  id: string
  /** The chat name Claude must use (`school_logo`). */
  name: string
  title: string
  kind: AssetKind
  description: string
  tags: string[]
  /** The picture's own size (SVG: viewBox scaled), so a placed picture keeps its shape. */
  width: number
  height: number
  vector: boolean
}

/** The library for a prompt: the text block (placement rules + one line per asset) and a lookup by name. */
export interface AssetCatalogue {
  /** Appended to the cached style prefix; '' when the library is empty and there is nothing to say. */
  text: string
  /** The asset with this name in any case (also past the 60 lines the text shows), or undefined. */
  find(name: string): AssetFact | undefined
}

/** The chat tool `place_asset`: flat on purpose (strict tool schema); "not used" is 'none' / 0 / ''. */
export interface PlaceToolArgs {
  asset: string
  slideId: string
  anchor: Anchor | 'none'
  boxX: number
  boxY: number
  boxW: number
  boxH: number
  /** The number of a circled region of THIS message, 0 = none. */
  region: number
  /** The id of a picture spot on the slide, '' = none. */
  spot: string
  /** 0 = the style's own width, else 240. */
  widthUnits: number
  fit: 'fit' | 'fill'
  /** True only when she said replace or swap: the picture under the circle is updated in place. */
  replaceUnder: boolean
}

export type PlaceToolResult =
  | {
      ok: true
      changeSet: ChangeSet
      elementId: string
      placed: { x: number; y: number; w: number; h: number }
    }
  | { ok: false; error: string }

/** What the chat turn may do with the library: read the catalogue, search it, and place a picture. */
export interface ChatAssets {
  catalogue: AssetCatalogue
  /** `list_assets`: names, kinds, titles, descriptions and tags (no pictures). */
  list(query: { query: string; kind: string }): AssetFact[]
  /** `place_asset`: ONE ChangeSet (already applied, journaled and announced to the UI). */
  place(args: PlaceToolArgs): Promise<PlaceToolResult>
}

export interface StructuredRequest<T> {
  /** Stable task instructions (cached). */
  instructions: string
  /** Style profile placed in the cached prefix when the output should match her style. */
  profile?: StyleProfile | null
  /** Volatile per-run input. */
  prompt: string
  schema: ZodType<T>
  effort?: Effort
  maxTokens?: number
  images?: Uint8Array[]
}

// ---- pictures (agents/ASSETS.md §5)

/** The extractor's guess at what a picture is (`KindHint` in src/main/import/assets/types.ts, same values). */
export type AssetKindHint = 'logo' | 'symbol-card' | 'photo' | 'icon' | 'banner' | 'other'

/** One picture sent to `describeAssets`: a thumbnail (PNG or JPEG, at most 512 px on the long side) plus the extractor's facts. */
export interface DescribeImageInput {
  /** The caller's number for it; the answer comes back under the same number. Unique inside one call. */
  index: number
  png: Uint8Array
  hint: AssetKindHint
  nearbyText: string
  fileNames: string[]
  /** The original file's sha256 (the cache key). Defaults to the sha256 of `png`. */
  sha256?: string
}

/** Claude's name and description of one picture. `olderVersionOf` is the `index` of a clearly better copy in the same call, else null. */
export interface DescribedAsset {
  index: number
  title: string
  name: string
  kind: AssetKind
  description: string
  tags: string[]
  maybePupils: boolean
  blurry: boolean
  olderVersionOf: number | null
}

/** Callbacks the chat loop uses to reach the UI (wired to `ctx.emit` by the module). */
export interface ChatSink {
  delta(text: string): void
  status(step: string, state: 'running' | 'done' | 'error'): void
  /** A validated, already-applied ChangeSet (one undo step). */
  changes(changeSet: ChangeSet): void
}

export interface AiService {
  testConnection(
    opts?: CallOptions & { model?: ModelChoice }
  ): Promise<Result<{ model: string; latencyMs: number }>>
  analyseStyleFile(
    input: StyleFileInput,
    opts?: CallOptions
  ): Promise<Result<{ analysis: FileAnalysis }>>
  synthesiseProfile(
    input: { name: string; analyses: FileAnalysis[]; existing?: StyleProfile },
    opts?: CallOptions & { onPartial?: (partial: Partial<StyleProfile>) => void }
  ): Promise<Result<{ profile: StyleProfile; testSlide: Slide }>>
  applyStyleCorrection(
    input: { profile: StyleProfile; correction: string },
    opts?: CallOptions
  ): Promise<Result<{ profile: StyleProfile; message: string }>>
  extractObjectives(
    input: { text?: string; pdf?: Uint8Array; pptxDigest?: unknown },
    opts?: CallOptions
  ): Promise<Result<{ extracted: ExtractedObjectives }>>
  planLesson(
    input: { profile: StyleProfile | null; brief: LessonBrief },
    opts?: CallOptions & { onProgress?: (message: string) => void }
  ): Promise<Result<{ plan: LessonPlan }>>
  writeSlide(
    input: {
      profile: StyleProfile | null
      brief: LessonBrief
      plan: LessonPlan
      index: number
      /** The teacher's assets: placed by `assetName`; without it the slide only gets picture spots. */
      assets?: AssetCatalogue
    },
    opts?: CallOptions
  ): Promise<Result<{ slide: Slide }>>
  /**
   * One editor chat turn (tool loop). `applyOps` is supplied by the caller (deck-builder): it validates
   * and applies a ChangeSet to the live deck and returns `{ ok:false, errors }` on invalid ops.
   */
  chatTurn(
    input: ChatTurnInput & {
      profile: StyleProfile | null
      deckOutline: unknown
      selectedSlideJson?: unknown
      /** `ApiMessage[]` from earlier turns, replayed verbatim (append-only). */
      history: unknown[]
      /** Overrides the default `medium` effort (e.g. `high` for "redo the whole lesson"). */
      effort?: Effort
      /** Plugin bridge; when absent the `run_plugin` / `list_plugins` tools are not offered. */
      plugins?: ChatPlugins
      applyOps: (
        summary: string,
        ops: DeckOp[]
      ) => Promise<{ ok: true; changeSetId: string } | { ok: false; errors: string[] }>
      readSlides: (slideIds: string[]) => unknown
      viewSlide: (slideId: string) => Promise<Uint8Array>
    },
    sink: ChatSink,
    opts?: CallOptions
  ): Promise<Result<{ usage: Usage; apiBlocks: unknown[] }>>
  /**
   * Names and describes pictures (cheaper model, 12 per request, cached by sha256). Names come back already
   * unique against `taken` and against each other. Never send a picture that may show pupils.
   */
  describeAssets(
    input: { images: DescribeImageInput[]; taken: string[] },
    opts?: CallOptions
  ): Promise<Result<{ described: DescribedAsset[] }>>
  /** One short paragraph on the look shared by the picked pictures (at most 6), for the picture maker's prompt. */
  describeStyleOfAssets(
    input: { images: Uint8Array[]; kinds: AssetKind[] },
    opts?: CallOptions
  ): Promise<Result<{ description: string }>>
  /** Vector mode: Claude draws `versions` simple pictures as sanitised SVG (no picture maker connected). Refuses `photo`. */
  drawSvg(
    input: { prompt: string; styleDescription: string; kind: AssetKind; versions: number },
    opts?: CallOptions
  ): Promise<Result<{ svgs: string[] }>>
  /**
   * One structured-output call for plugins and future features: free-form instructions in, JSON that
   * matches `schema` out. The schema must avoid open maps (use arrays of `{ key, value }` instead).
   */
  structured<T>(
    request: StructuredRequest<T>,
    opts?: CallOptions
  ): Promise<Result<{ data: T; usage: Usage }>>
}
