# Deck model — the single source of truth for a lesson

A lesson is a **Deck**: JSON that describes every slide and element. The app renders slides from it, Claude edits it with **operations**, and `.pptx` is only an *export*. Nothing else (HTML, PowerPoint files) is ever the source of truth.

The types below are the contract. Put them in `src/shared/deck/` (as the code ROADMAP suggests) so the main process, the renderer, the AI layer and plugins share them. Validate every deck and every operation with a runtime schema (e.g. `zod`) at the boundary, because AI output and IPC arguments are untrusted.

Example data that matches the mockups: [`fixtures/deck.photosynthesis.json`](fixtures/deck.photosynthesis.json).

---

## 1. Coordinates and units

| Thing | Value |
|---|---|
| Slide size | **1920 × 1080 units** (16:9). `deck.size` is always `{ width: 1920, height: 1080 }` in schema v1 |
| Unit → inches | `in = units / 144` → the slide is 13.333 × 7.5 in (PowerPoint "Widescreen") |
| Unit → EMU | `emu = units × 6350` |
| Font sizes | Stored in **points** (PowerPoint's unit). On the slide, `1 pt = 2 units` (40 pt title ≈ 80 units tall) |
| Origin | Top-left; `x, y, w, h` are the element's box before rotation; `rotation` is in degrees clockwise about the box centre |

Why 1920×1080: whole numbers are easy for Claude to reason about, and they map cleanly to inches and EMU.

## 2. Types

```ts
// src/shared/deck/types.ts (contract, not implementation)

export interface Deck {
  schemaVersion: 1
  id: string                      // ULID
  title: string                   // "Y8 Science — Photosynthesis"
  meta: LessonMeta
  styleId: string | null          // StyleProfile used; null = plain default style
  styleVersion: number | null     // StyleProfile.version at generation time
  size: { width: 1920; height: 1080 }
  slides: Slide[]
  createdAt: string               // ISO 8601
  updatedAt: string
}

export interface LessonMeta {
  subject?: string                // "Science"
  yearGroup?: string              // "Year 8" (free text: schools differ)
  durationMin?: number            // 50
  ability?: string                // "Mixed ability", "Set 3"…
  targetSlideCount?: number       // "About 8 slides"
  objectives: string[]            // learning objectives, verbatim from the teacher
  context?: string                // extra notes: "lots of them mix up respiration and photosynthesis"
}

export interface Slide {
  id: string
  kind: SlideKind
  layoutId?: string               // StyleProfile.layouts[].id
  background?: Fill
  elements: Element[]             // painted in array order (later = on top) unless z is set
  notes?: string                  // speaker notes, plain text with \n
  source?: { by: 'ai' | 'user' | 'plugin'; pluginId?: string }
}

export type SlideKind =
  | 'title' | 'do-now' | 'objectives' | 'key-words' | 'content' | 'question'
  | 'activity' | 'practical' | 'check' | 'plenary' | 'exit-ticket'
  | 'quiz' | 'answers' | 'section' | 'custom'

interface ElementBase {
  id: string
  x: number; y: number; w: number; h: number
  rotation?: number
  z?: number
  locked?: boolean                // decorations from the style (e.g. the teal left band) are locked
  styleRef?: string               // key into StyleProfile.components, e.g. "title", "chip", "callout.mini-whiteboard"
  name?: string                   // human label used in prompts: "photo", "objectives list"
}

export type Element =
  | TextElement | ChipsElement | CalloutElement | ImageElement
  | DiagramElement | ShapeElement | TableElement

export interface TextElement extends ElementBase {
  type: 'text'
  role: 'title' | 'kicker' | 'subtitle' | 'heading' | 'body' | 'caption' | 'label'
  paragraphs: Paragraph[]
  align?: 'left' | 'center' | 'right'
  valign?: 'top' | 'middle' | 'bottom'
  fontSizePt?: number             // overrides the style's size for this role
  autoFit?: 'shrink' | 'none'     // default 'shrink'
}

export interface Paragraph {
  runs: Run[]
  list?: 'none' | 'bullet' | 'number' | 'checkbox'
  level?: 0 | 1 | 2
}

export interface Run {
  text: string
  bold?: boolean; italic?: boolean; underline?: boolean
  color?: ColorValue               // used for two-colour titles: last words "token:accent"
}

export interface ChipsElement extends ElementBase {   // key word chips
  type: 'chips'
  items: string[]
}

export interface CalloutElement extends ElementBase { // e.g. the yellow mini-whiteboard box
  type: 'callout'
  variant: string                  // component key without prefix: "mini-whiteboard", "do-now", "warning"
  label?: string                   // "Mini-whiteboards:" (rendered bold)
  paragraphs: Paragraph[]
}

export interface ImageElement extends ElementBase {
  type: 'image'
  assetId?: string                 // file in the lesson's assets folder
  placeholder?: { description: string }  // "Photo: leaf in sunlight" when no image yet
  fit: 'cover' | 'contain'
  alt: string
  radius?: number
}

export interface DiagramElement extends ElementBase { // Claude-drawn labelled diagrams
  type: 'diagram'
  svg: string                      // sanitised SVG (see §6)
  alt: string
}

export interface ShapeElement extends ElementBase {
  type: 'shape'
  shape: 'rect' | 'roundRect' | 'ellipse' | 'line' | 'arrow'
  fill?: Fill
  stroke?: Stroke
  radius?: number                  // roundRect corner radius in units
}

export interface TableElement extends ElementBase {
  type: 'table'
  rows: string[][]
  headerRow: boolean
  colWidths?: number[]             // units; must sum to w
}

export type ColorValue = `token:${string}` | `#${string}`   // "token:accent" or "#0E7C7B"
export interface Fill { color: ColorValue; opacity?: number }
export interface Stroke { color: ColorValue; width: number; dash?: 'solid' | 'dash' }
```

**Colour tokens** (`token:accent`, `token:text`, `token:highlight`, …) resolve through the deck's StyleProfile (`style-profile.md`). Prefer tokens over hex, because then a restyle is just a token change. Hex is allowed for one-offs, for example diagram fills.

## 3. Editing: operations (the only way to change a deck)

Every change (by the teacher, Claude or a plugin) is a **ChangeSet** of operations. One ChangeSet = one undo step = one entry in the version history.

```ts
export interface ChangeSet {
  id: string
  by: 'user' | 'ai' | 'plugin'
  pluginId?: string
  summary: string                  // "Replaced the photo on slide 3 with a labelled leaf diagram"
  ops: DeckOp[]
  at: string
}

export type DeckOp =
  | { op: 'insertSlides'; afterSlideId: string | null; slides: Slide[] }      // null = at start
  | { op: 'deleteSlides'; slideIds: string[] }
  | { op: 'moveSlide'; slideId: string; afterSlideId: string | null }
  | { op: 'replaceSlide'; slide: Slide }                                      // same id
  | { op: 'updateSlide'; slideId: string; set: Partial<Pick<Slide, 'kind' | 'layoutId' | 'background' | 'notes'>> }
  | { op: 'addElement'; slideId: string; element: Element }
  | { op: 'updateElement'; slideId: string; elementId: string; set: Partial<Element> } // shallow merge; arrays replaced whole
  | { op: 'removeElement'; slideId: string; elementId: string }
  | { op: 'setMeta'; title?: string; meta?: Partial<LessonMeta> }
```

### Applying operations
1. Validate every op against the schema. Reject the whole ChangeSet if any op references an unknown slide or element id. The AI layer retries once with the error message (see `ai-pipeline.md`).
2. Apply immutably (for example with `immer`) and record inverse patches for undo.
3. **Normalise** after applying:
   - Clamp boxes inside the slide.
   - Give new elements ids if they're missing.
   - Drop empty runs.
   - Make sure ids are unique.
4. **Locked elements** can't be removed or moved by AI ops unless the op targets them explicitly *and* the teacher's message asked for it.
5. Save: write `deck.json`, append the ChangeSet to `changes.jsonl`, bump `updatedAt`.

### Undo / redo
- Undo applies the inverse patches of the latest ChangeSet.
- The redo stack clears when a new ChangeSet arrives.
- Undo works across app restarts, because ChangeSets are persisted.
- Implementation note (2026-10-06): `changes.jsonl` lines also carry the immer `patches`/`inversePatches` of each ChangeSet, and undo/redo are appended as `{"v":1,"kind":"undo"}` / `{"v":1,"kind":"redo"}` marker lines, so both stacks (redo too) are rebuilt on restart. A whole AI generation is merged into ONE line with `groupChangeSets` (`src/shared/deck/history.ts`).
- Version history (later): rebuild any earlier version by replaying `changes.jsonl` from a snapshot. Snapshot every 20 ChangeSets.

## 4. Rendering (preview, thumbnails, present mode)

- **One renderer, `SlideView`**, takes `(slide, styleProfile)` and draws absolutely positioned HTML at 1920×1080. It is scaled to its container with a CSS `transform: scale()`. The same component draws the stage, the filmstrip thumbnails, the home cards and present mode.
- **Element mapping:**
  - **Text:** `role` and `styleRef` resolve fonts, colours and sizes from the profile.
  - **Chips:** pills in a wrapping row.
  - **Callout:** rounded box with an optional bold label.
  - **Image:** `<img>`, or the placeholder (tinted box plus a centred caption).
  - **Diagram:** inline sanitised SVG.
  - **Table:** an HTML table.
- **Text fitting:** when `autoFit: 'shrink'`, measure and shrink the font size in 2% steps, to 60% at most. If text still overflows, show a small orange "doesn't fit" badge on the element in the editor (never in exports) and tell Claude about it on the next turn.
- **Fonts:** the renderer is offline (CSP), so slide fonts must be available locally:
  - Bundle common education fonts with `@fontsource` (Lexend, Open Sans, Poppins, Nunito…).
  - Otherwise rely on fonts installed on Windows (Calibri, Arial, Segoe UI…).
  - If the profile's font isn't available, fall back to the profile's `fallbackStack` and show a note in the style screen.
- **Selection overlay** (editor only): selected element outline, resize handles (later), and the RegionOverlay for circle-to-edit (`ai-pipeline.md` §6).

## 5. Export to PowerPoint (`.pptx`)

Exports run in the main process with **PptxGenJS**. Keep the mapping in one shared module next to the renderer mapping so they can't drift.

| Deck | PptxGenJS |
|---|---|
| `size` | `pptx.layout = 'LAYOUT_WIDE'` (13.333 × 7.5 in) |
| Positions | `x: x/144, y: y/144, w: w/144, h: h/144` (inches) |
| `text` | `slide.addText(runs[], { fontFace, fontSize, color, bold, align, valign, fit: 'shrink' })` — runs keep per-run colour/bold; `list: 'bullet'` → `bullet: true`; `'number'` → `bullet: { type: 'number' }`; `'checkbox'` → `bullet: { code: '2610' }` (☐) |
| `chips` | one `roundRect` shape with text per chip, laid out like the renderer (computed positions, not autofit) |
| `callout` | `roundRect` with fill + `addText` with the bold label run first |
| `image` | `addImage({ path })` from the assets folder; placeholder → tinted `roundRect` + caption |
| `diagram` | rasterise the SVG to PNG at 2× (Electron offscreen render or `@resvg/resvg-js`) and `addImage`; also keep the SVG in the lesson's assets |
| `shape` | `addShape` with `fill`, `line`, `rectRadius`, `rotate` |
| `table` | `addTable(rows, { colW, fontFace, fontSize, border })` |
| `notes` | `slide.addNotes(notes)` |
| tokens | resolve to hex at export time (PowerPoint has no tokens) |
| fonts | write the profile's real font names (e.g. "Lexend"). If the teacher's PC lacks the font, PowerPoint substitutes. Warn in the export toast when a font isn't installed |

After saving (native Save dialog, default name `<title>.pptx`), offer **Open in PowerPoint** (`shell.openPath`).

**Acceptance:** exporting `fixtures/deck.photosynthesis.json` opens in PowerPoint with no repair prompt. Every element is within 2 units of its preview position, and the title's two colours and the yellow callout are preserved.

Implementation note (2026-10-06): callouts are a roundRect plus a separate text frame inset by the component padding; arrows are a line with an arrowhead; the checkbox glyph takes the text colour (PptxGenJS cannot colour bullets); the exporter post-processes slide XML to keep paragraph properties schema-valid; the diagram SVG is not written to assets by the exporter (the lesson store does that). Chip and diagram maths live in src/shared/deck/layout.ts and src/main/export/.

## 6. Safety rules for AI-produced content

- **SVG diagrams** pass a strict sanitiser before they're saved or rendered:
  - Allowed: `svg, g, path, rect, circle, ellipse, line, polyline, polygon, text, tspan, defs, marker, title, desc`.
  - Never allowed: `script`, `foreignObject`, `image` (external refs), event attributes, `href` to anything other than `#ids`, or CSS `url()` to external resources.
  - Required: `viewBox`; maximum 200 KB.
- Text is plain text. Never render AI text as HTML.
- Asset ids are generated by the app, never by Claude.

## 7. Storage layout (local, under the module's `ctx.dataDir`)

```
lessons/
  <lessonId>/
    deck.json            current Deck
    changes.jsonl        one ChangeSet per line (undo/history)
    chat.jsonl           conversation (see ai-pipeline.md §8)
    assets/              images, diagram SVG + PNG, uploaded LO documents
    thumb.png            first-slide thumbnail for Home (rendered on save, 480×270)
index.json               lesson list cache: id, title, yearGroup, slideCount, updatedAt (rebuilt if missing)
```
Write files atomically (write to a temp file, then rename). Corrupt JSON shows a recoverable error card on Home rather than crashing.

> Implementation note (2026-10-06): a lesson folder also holds `lesson.json` (title source and sticky notes), `generation.json` (the plan of a stopped generation, for "Finish the rest") and `outputs/` (files made by plugins); attached LO documents wait in `<data>/inbox/` until the lesson exists, and a deleted lesson waits in `<data>/deleted/` for its undo window before it goes to the Recycle Bin. `changes.jsonl` is written after `deck.json` (a crash in between loses one undo step, never invents one). A lesson whose `deck.json` cannot be read keeps its index entry, flagged `damaged`.
