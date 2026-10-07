# Style profile — how the app learns "her style"

A **StyleProfile** is a compact, editable description of how this teacher makes slides: colours, fonts, layouts, recurring slide types, decorations and her voice. Claude builds it **once** from her old decks. After that, every generation sends the *profile* (plus two or three example slides), never the whole library.

Screens: **Create a style** ([screens/04-create-style.md](screens/04-create-style.md), image `images/04-create-style.png`), the **Your styles** card on Home, and the style SelectChip in the editor.
Example data: [`fixtures/style-profile.science-ks3.json`](fixtures/style-profile.science-ks3.json).
Owner module: `style-library` (main process does parsing, storage and Claude calls).

---

## 1. Schema

```ts
// src/shared/style/types.ts (contract)

export interface StyleProfile {
  schemaVersion: 1
  id: string
  name: string                     // "Science KS3"
  version: number                  // +1 on every change (corrections, new files)
  isDefault: boolean
  status: 'draft' | 'learning' | 'ready' | 'failed'

  tokens: {
    colors: Record<ColorToken, { hex: string; label: string; usage: string }>
    // ColorToken keys used by decks: background, text, accent, accent2?, highlight, chipBg, chipText, muted, …
    fonts: {
      title: FontSpec
      body: FontSpec
      accent?: FontSpec
    }
  }

  components: Record<string, ComponentStyle>   // "title", "kicker", "body", "chip", "callout.mini-whiteboard", "checklist", "decoration.leftBand"…
  layouts: LayoutTemplate[]                     // reusable slide skeletons
  slideTypes: SlideTypeHabit[]                  // what she uses and how often
  lessonFlow: SlideKind[]                       // her usual order, e.g. title → do-now → objectives → key-words → content… → plenary
  voice: VoiceProfile
  habits: string[]                              // human-readable bullets shown in "Layout habits"
  exemplars: Exemplar[]                         // 3–6 of her real slides, digested, used as few-shot examples
  sources: SourceRef[]
  corrections: Correction[]                     // "I never use yellow on title slides"
  confidence: Record<'colors' | 'fonts' | 'layouts' | 'voice' | 'slideTypes', 'low' | 'medium' | 'high'>
  createdAt: string; updatedAt: string
}

export interface FontSpec {
  family: string                   // as found in her files: "Lexend"
  weight: 400 | 500 | 600 | 700 | 800
  sizePt: number                   // typical size
  sizeRangePt?: [number, number]   // "40–44 pt"
  fallbackStack: string            // "'Lexend', 'Segoe UI', sans-serif"
  available: boolean               // can the app render it offline? (bundled or installed)
}

export interface ComponentStyle {
  description: string              // "Title: navy bold, last 1–3 words in accent colour"
  font?: 'title' | 'body' | 'accent'
  sizePt?: number
  bold?: boolean
  color?: string                   // token or hex
  fill?: string
  radius?: number                  // units
  padding?: [number, number]       // units (vertical, horizontal)
  uppercase?: boolean
  letterSpacingEm?: number
  rules?: string[]                 // machine-readable-ish rules for Claude: "twoToneTitle: last 1-3 words accent"
}

export interface LayoutTemplate {
  id: string                       // "content-text-left-image-right"
  name: string
  usedFor: SlideKind[]
  regions: Array<{
    name: string                   // "title", "kicker", "body", "image", "callout"
    elementType: Element['type']
    x: number; y: number; w: number; h: number   // units on 1920×1080
    styleRef?: string
    optional?: boolean
  }>
  decorations: string[]            // component keys always drawn: ["decoration.leftBand"]
}

export interface SlideTypeHabit {
  kind: SlideKind
  name: string                     // "Mini-whiteboard question"
  frequency: 'always' | 'often' | 'sometimes'
  description: string
  typicalPosition?: 'start' | 'middle' | 'end' | 'repeated'
  exampleText?: string
}

export interface VoiceProfile {
  spelling: 'en-GB' | 'en-US'
  readingAge?: string              // "KS3, short sentences"
  rules: string[]                  // "Objectives start with 'Today I will…'", "No full stops in bullets"
  phrases: string[]                // her recurring phrases
  questionStyle?: string
}

export interface Exemplar {        // a digested real slide, ≤ ~1.5k tokens each
  sourceId: string
  page: number
  kind: SlideKind
  digest: Slide                    // converted into the deck model (best effort)
  why: string                      // "Typical content slide: text left, picture right, yellow question box"
}

export interface SourceRef {
  id: string
  fileName: string
  kind: 'pdf' | 'pptx'
  pages: number
  status: 'waiting' | 'reading' | 'learned' | 'failed'
  error?: string
  addedAt: string
}

export interface Correction { text: string; at: string; appliedInVersion: number }
```

## 2. The learning pipeline

```
files ──► 1. Import ──► 2. Digest (local, no AI) ──► 3. Per-file analysis (Claude) ──► 4. Synthesis (Claude) ──► profile v1
                                                                                         ▲
                                     5. Corrections ("Anything I got wrong?") ───────────┘  ──► profile v2, v3…
```

### 1. Import (main process)
- Native file dialog, or drag-and-drop onto a Dropzone (Home or Create a style). Accept `.pdf` and `.pptx`, up to 50 files and 50 MB each.
- Copy each file into `styles/<styleId>/sources/` so the originals can move without breaking anything. Record a `SourceRef` with status `waiting`.
- Process files **one at a time** (2 at most in parallel) and push progress events to the UI (`style-library:progress`).

### 2. Digest (no AI, fast)
- **`.pptx`:** unzip with JSZip and parse the XML with `fast-xml-parser`.
  - `ppt/theme/theme1.xml`: colour scheme (`a:clrScheme`) and font scheme (`a:fontScheme`). These are exact values, better than guessing from images.
  - `ppt/slides/slideN.xml`: shapes (`p:sp`) with position/size (EMU → units ÷ 6350), fill colours, text runs (font, size in hundredths of a point, bold, colour), bullets, and pictures (`p:pic`).
  - Produce one digest per slide in the **deck model shape** (`Slide`). Count colour, font and size frequencies across the file.
- **`.pdf`:** count pages, and extract text per page (`pdfjs-dist` in main) for search and privacy checks. The visual analysis comes from Claude reading the PDF directly (it accepts PDF document blocks; check the current page/size limits with the `claude-api` skill before relying on them). For very long PDFs, send the first 40 pages.
- **Privacy:** scan the extracted text for things that look like student names, emails or phone numbers. If any are found, show a Callout in Create a style ("Some slides may contain pupil names. They'll be sent to Claude to learn your style. Remove the file if you'd rather not.").

### 3. Per-file analysis (Claude, one request per file)
- **Input:** the PDF as a document block, or for `.pptx` the digest JSON plus the theme facts. Plus the analysis instructions (`ai-pipeline.md` §4.1).
- **Output** (structured, JSON schema): a `FileAnalysis` with:
  - colours and their roles, fonts and sizes
  - layout patterns with approximate boxes
  - slide kinds per page, decorations, voice notes
  - up to 3 candidate exemplar pages with reasons
- Save to `sources/<id>.analysis.json` and mark the source `learned`. If it fails, mark it `failed` with a readable reason ("This PDF is scanned images only", "Password protected"); the other files carry on.
- **Live preview:** after every learned file, run a cheap **merge** (no AI). Count-based voting across analyses fills the "What I've learned so far" panel immediately.

### 4. Synthesis (Claude, once per change)
- Runs when all files are processed, and again whenever files are added.
- **Input:** all FileAnalyses, the vote counts and the candidate exemplars.
- **Output:** a complete `StyleProfile` (structured output), plus a **test slide** (a `Slide` in the deck model) to prove it. It's shown in TestSlidePreview, rendered by the normal `SlideView`.
- Pick 3–6 exemplars that cover different slide kinds. Store them inside the profile.

### 5. Corrections
- The teacher types into CorrectionBox ("I never use yellow on title slides").
- A Claude call takes `(profile, correction)` and returns **JSON Patch ops on the profile**, plus a one-line confirmation ("Got it: title slides won't use the yellow box"). The app applies them, bumps `version`, appends the `Correction` and re-renders the test slide.
- Small manual edits are allowed directly in the UI without Claude: rename, default checkbox, and later editing a colour swatch.

## 3. How generation uses the profile

The system prompt for every lesson-generation or edit call contains, in this order (stable first, for prompt caching):
1. The generic slide-writing instructions.
2. The deck-model schema summary.
3. **The profile JSON**, minus `sources` and `corrections` history; corrections are already applied.
4. **The exemplars**.

Then the lesson-specific content follows. See `ai-pipeline.md` §3 for the cache layout.

Rules Claude must follow (stated in the prompt):
- Use the layouts and decorations from the profile; place elements on the layout regions.
- Use colour **tokens**, not hex.
- Respect `voice.rules` and `spelling`.
- Follow `lessonFlow` unless the teacher asks otherwise.
- Never invent a slide type she doesn't use unless asked or needed by a plugin.

## 4. Storage

```
styles/
  <styleId>/
    profile.json         current StyleProfile
    history/             profile.v1.json, v2… (small; keep all)
    sources/             original files + <sourceId>.digest.json + <sourceId>.analysis.json
```
Implementation note (2026-10-06): each style folder also holds `meta.json` (name source, saved flag, per-file facts, test slide, undo list). Sources are stored as `sources/<sourceId>.pdf|pptx` next to `<sourceId>.analysis.json`; digests are recomputed on read, not stored. The styles folder is the one the service is given (`<dataDir>/<styleId>/…`).

## 5. Acceptance criteria
- Importing 8 mixed PDF/PPTX files shows per-file status changes in real time, and the panel fills in before all files finish.
- A failed file doesn't stop the others and shows a readable reason.
- For `.pptx` sources, theme colours and fonts in the profile match the file's theme exactly.
- The test slide renders with the profile's fonts, colours and decorations (the left band, two-tone title and yellow callout in the fixture).
- A correction changes the profile, bumps the version and re-renders the test slide within one Claude round-trip.
- A lesson generated with the profile uses only colour tokens defined in it, and its layouts' regions.
