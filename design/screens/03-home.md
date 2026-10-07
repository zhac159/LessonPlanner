# 03 · Home

![](../images/03-home.png)

**Purpose:** the teacher's starting point: make a new lesson in one step, see and add styles, and find past lessons.

Mockup source: `../canvas/project/Main.dc.html` (board 1440×1320; the file name is historical, it is the Home screen).

---

## 2. Owner & navigation

| Item | Value |
|---|---|
| Owning module | `home` (replaces today's reference HomeView). It **reads and triggers** data owned by `settings`, `style-library` and `deck-builder`; this depends on the cross-module decision (README D-d, `agents/ROADMAP.md` › Cross-module communication). The "Modules that failed to load" list from the current reference Home moves to a Callout at the bottom of this page, shown only when there are issues |
| Sidebar mode | Full Sidebar (224px), **Home** active |
| How you get here | Normal launch; end of first run; Sidebar Home; rail Home; "My lessons" (editor) and "Home" (Create a style) back buttons; after Save style |

| Control | Goes to / does | Mockup href |
|---|---|---|
| Sidebar Home | This screen | `Main.dc.html` |
| Sidebar Styles | `style-library` (Styles list; see 04 §2 for what opens) | `StyleBuilder.dc.html` |
| Sidebar Plugins | Plugins page (not designed; placeholder EmptyState until it exists) | `#` |
| Sidebar Settings | `settings` (Settings page; Settings › AI is 02's form) | `ConnectClaude.dc.html` |
| Sidebar user chip | Settings › Profile | — |
| PageHeader "New lesson" | 05 New lesson (empty editor) | `NewLesson.dc.html` |
| "Upload LO document" | Native open dialog, then stays here with the document attached | — |
| Style SelectChip | Menu of styles; "Create a new style…" → 04 | — |
| Length SelectChip | Menu of lengths | — |
| "Create lesson" | Creates the lesson and opens **06 Editor already generating** (not the empty 05) | `NewLesson.dc.html` (see Open questions) |
| "Manage" (Your styles) | Styles list (`style-library`) | `#` |
| StyleCard | 04 Create a style in edit mode for that style | — |
| Dropzone "Create a new style" | 04 Create a style with the files queued | `StyleBuilder.dc.html` |
| LessonCard | 06 Editor on that lesson | `Editor.dc.html` |

Navigation to other modules uses `navigate(moduleId, intent)` (README D-c): `{ kind: 'open-lesson', lessonId, jobId? }`, `{ kind: 'new-lesson' }`, `{ kind: 'new-style', styleId }`, `{ kind: 'edit-style', styleId }`, `{ kind: 'ai' }`.

## 3. Layout

```
┌ TitleBar 40 ───────────────────────────────────────────────────────────────┐
├ Sidebar 224 ┬ Content (scrolls) ───────────────────────────────────────────┤
│ Home        │ PageHeader: greeting ............ [search] [+ New lesson]   │
│ Styles      │ ┌ Make a new lesson (orange) ──────┐ ┌ Your styles ───────┐  │
│ Plugins     │ │ TextArea                          │ │ StyleCard          │  │
│             │ │ [Upload][Style▾][Length▾]         │ │ StyleCard          │  │
│             │ │ [Create lesson →]                 │ │ Dropzone           │  │
│ Settings    │ └───────────────────────────────────┘ └────────────────────┘  │
│ user chip   │ Past lessons [All][Year 7]…            Sort [Last edited ▾]   │
│             │ LessonCard grid (auto-fill, min 260px)                       │
└─────────────┴──────────────────────────────────────────────────────────────┘
```

| Region | Size and behaviour (from the mockup) |
|---|---|
| Sidebar | 224px, white, 2px ink right border, padding 16px 12px, gap 6px. Nav items 44px tall, padding 0 12px, radius 12px, 20px icon, gap 12px. **Active:** orange fill, 2px ink border, shadow 2px 2px 0 ink, 700. **Inactive:** transparent 2px border, 600. Spacer, then Settings, then the user chip (padding 10px 12px, 2px soft-line top border; 32px lilac avatar #EAD9FF with ink border and the initial in 800; name 700; status 12px muted). Full height, does not scroll |
| Content | Fills the rest, scrolls vertically. `main`: max-width 1280px, centred, padding 32px 24px 56px, column gap 36px |
| PageHeader | Row, wraps, gap 14px. Greeting block `flex: 1 1 320px` (h1 44px display 800, letter-spacing −0.02em, line-height 1.05; subtitle 17px muted, gap 6px). Search: `flex: 0 1 360px`, min-width 200px, 44px, 2px ink, pill, ground fill (#F1EEFF), 18px search icon, 15px text. New lesson: primary Button 44px, radius 12px, plus icon |
| Cards row | Row, wraps, gap 24px, children stretch to equal height |
| Make a new lesson Card | `flex: 3 1 560px`, padding 28px, orange fill, 2px ink, radius 24px, shadow 6px, column gap 16px. Header: 48px white icon tile (radius 14px, monitor icon) + h2 30px display 800. Intro 16px / 1.5, max-width 580px. TextArea rows 4, padding 14px 16px, radius 16px, white, vertical resize. Action row: wraps, gap 10px: Upload Button, style SelectChip, length SelectChip, spacer, Create lesson Button. At most widths Create lesson wraps onto its own line, left-aligned, as drawn |
| Your styles Card | `flex: 2 1 380px`, padding 24px, white, radius 24px, shadow 6px, column gap 12px. Header row: h2 24px + spacer + "Manage" link 14px / 700. StyleCards, then the Dropzone (`flex: 1`, min-height 150px) |
| Past lessons | Column gap 18px. Header row wraps, gap 12px: h2 28px (margin-right 8px), ToggleChip group (gap 8px), spacer, "Sort" label (14px / 600 muted) + Select 40px |
| Lesson grid | `grid-template-columns: repeat(auto-fill, minmax(260px, 1fr))`, gap 20px |

**Narrower windows** (content width = window − 226px):

| Window width | Cards row | Lesson grid |
|---|---|---|
| 1440 (mockup) | Side by side | 4 columns |
| 1280 (default) | Side by side (needs 964px; has ~1006px) | 3 columns |
| 1100 (minimum) | Your styles wraps **below** Make a new lesson, full width | 3 columns |

When the PageHeader can't fit on one row, the search and New lesson button wrap under the greeting, search first.

## 4. Components

| Component | Variant / notes |
|---|---|
| TitleBar | Standard |
| Sidebar | Full (224px) with user chip |
| PageHeader | Greeting variant: h1 + subtitle, search TextField (pill, leading icon, `type="search"`, visually hidden label), primary Button |
| Card | Hero-orange variant (Make a new lesson); white variant (Your styles) |
| TextArea | Learning objectives (visually hidden label) |
| Button | Secondary pill 44px with paperclip icon ("Upload LO document"); dark 48px radius 14px ("Create lesson", ink fill, white text); primary 44px ("New lesson"); link style ("Manage") |
| SelectChip | 44px pill. Style chip: fill = the selected style's tint (#D6F0EE for Science KS3) + 12px dot of its primary colour + chevron. Length chip: white + clock icon + chevron. `aria-label` "Style: {name}. Change style" / "Lesson length: {n} minutes. Change" |
| AttachmentCard | Appears in the card after a document is chosen (§7) |
| StyleCard | Row: SwatchStack + name/meta + optional "Default" StatusPill. Default row uses the style's tint fill; others white (see Open questions) |
| SwatchStack | 4 circles, 22px, 2px ink border, overlapping −6px |
| StatusPill | "Default" (ink fill, white 12px / 700); year tags on LessonCards (tinted, 2px ink, 12px / 700) |
| Dropzone | Large variant: dashed 2px ink, radius 16px, cream fill (#FFF4D6), 48px orange circle with upload icon, title 17px / 800, line 14px, meta 12px muted |
| ToggleChip | 40px pill, 2px ink. **Pressed:** ink fill, white, 700. **Not pressed:** white, 600. `aria-pressed`. Group `role="group"` `aria-label` "Filter by year group" |
| Select | Sort, 40px, radius 12px |
| LessonCard | 2px ink, radius 18px, shadow 4px 4px 0 ink, overflow hidden. Cover: 16:9 SlideThumb of the first slide with a 2px ink bottom border. Meta: padding 12px 14px 14px, gap 6px; title 16px / 700; row 13px muted, gap 8px: year StatusPill, "{n} slides", spacer, relative date. ⋯ IconButton (new, §8) top-right of the cover |
| EmptyState, Callout, ContextMenu, ConfirmDialog, Dialog, Toast | States and card menu (§7, §8) |

Year tag tints (from the mockup): Year 7 sky #D7E8FF, Year 8 mint #DFF5D8, Year 9 peach #FFD6C9, Form time lilac #EAD9FF. Year 10–13 and others: to be assigned in `../design-system.md`; until then white.

## 5. Content & copy

| Element | Text | Dynamic? |
|---|---|---|
| Sidebar | "Home", "Styles", "Plugins", "Settings" | — |
| User chip | "Alice" + "Claude connected" | Name from profile; initial = first letter uppercased. Status: "Claude connected" when a key is saved and the last test wasn't `invalid-key`; otherwise "Claude not connected" **(new)** |
| Greeting h1 | "Good morning, Alice!" | "Good morning, {name}!" 05:00–11:59, "Good afternoon, {name}!" 12:00–17:59, "Good evening, {name}!" 18:00–04:59; re-evaluated every minute while visible |
| Greeting subtitle | "What are we teaching today?" | — |
| Search placeholder / label | "Search lessons and styles" | — |
| Header button | "New lesson" | — |
| Card h2 | "Make a new lesson" | — |
| Card intro | "Paste your learning objectives, or drop the document they’re in. I’ll build the slides in your style." | — |
| TextArea label (hidden) | "Learning objectives" | — |
| TextArea placeholder | "e.g. Year 8 Science — Photosynthesis" / "LO1: Describe where photosynthesis happens in a plant" / "LO2: Write the word equation…" (three lines) | — |
| Upload button | "Upload LO document"; after a document is attached: "Replace document" **(new)** | — |
| Style chip | "Science KS3" | Selected style name (default style first); "Plain style" **(new)** when she has no styles |
| Style menu **(new)** | One item per style ("{name}", plus "Default" tag on the default), divider, "Create a new style…" | — |
| Length chip | "50 min" | "{n} min"; options 30, 40, 45, 50, 60, 75, 90; default = last used, else 50 |
| Create button | "Create lesson"; while creating "Creating…" **(new)** | — |
| Styles h2 | "Your styles" | — |
| Manage link | "Manage" | — |
| StyleCard | "Science KS3" / "Lexend · learned from 24 decks" / "Default"; "Form time" / "Nunito · learned from 6 decks" | "{name}" / "{title font} · learned from {n} decks"; while learning: "Learning · {learned} of {total} files" **(new)**; unsaved draft: StatusPill "Draft" **(new)** |
| Dropzone | "Create a new style" / "Drop old PDFs or PowerPoints here, or " + "browse files" (underlined, 700) / ".pdf and .pptx · up to 50 files" | — |
| Dropzone while dragging **(new)** | "Drop to start a new style" | — |
| Past lessons h2 | "Past lessons" | — |
| Filter chips | "All", "Year 7", "Year 8", "Year 9", "Form time" | "All" + one chip per year group present in her lessons, ordered Year 7…13, Form time, then others A–Z |
| Sort | Label "Sort"; options "Last edited", "Title A–Z", "Year group" | — |
| LessonCard | Title "Photosynthesis", tag "Year 8", "8 slides", "Today" | Title, `yearShort` tag ("Form" for Form time), slide count, relative date (README table) |
| LessonCard ⋯ **(new)** | `aria-label` "More actions for {title}"; menu "Open", "Duplicate", "Rename…", "Export to PowerPoint", "Delete…" | — |
| Generating card **(new)** | StatusPill "Making slides…" over the cover | — |

**State copy (all new):**

| State | Copy |
|---|---|
| Not connected Callout | "Claude isn’t connected yet, so I can’t make slides." + Button "Connect Claude" |
| No lessons | EmptyState: "No lessons yet" / "Paste your objectives above and press Create lesson. Your lessons will appear here." |
| No styles (inside Your styles) | Line above the Dropzone: "Teach me your style first so new lessons look like yours." |
| Search, no lessons | EmptyState: "No lessons match “{query}”" + Button "Clear search" |
| Search, no styles | Line in Your styles: "No styles match “{query}”" |
| Filter, no lessons | "No {year group} lessons yet." |
| Lessons failed to load | Callout (error): "I couldn’t load your lessons." + Button "Try again" |
| Rejected files toast | "Skipped {n} files that aren’t PDF or PowerPoint." / "Only the first 50 files were added." / "{name} is over 50 MB, so I skipped it." / ".ppt files are too old to read. Save them as .pptx first." |
| Delete confirm | Title "Delete this lesson?" / body "“{title}” will move to the Recycle Bin." / "Cancel" · "Delete" |
| Rename dialog | Title "Rename lesson" / TextField label "Lesson title" / "Cancel" · "Save" |
| Toasts | "Duplicated “{title}”", "Lesson deleted", "Saved {file name}" + "Open in PowerPoint" |
| Document attached | AttachmentCard "{file name}" / "Word document" · "PDF" · "PowerPoint" + remove × (`aria-label` "Remove {file name}") |

## 6. Data

```ts
// settings
'settings:getProfile' () → UserProfile                    // greeting, user chip (see 01)
'settings:getAiStatus' () → AiStatus                      // user chip, not-connected Callout (see 02)
'settings:aiStatusChanged' (event) → AiStatus
'settings:getPreferences' () → { lastLengthMin: number | null; homeSort: 'edited' | 'title' | 'year' }
'settings:setPreferences' (patch) → void

// style-library
'style-library:list' () → StyleSummary[]
interface StyleSummary {
  id: string; name: string; isDefault: boolean
  status: 'draft' | 'learning' | 'ready' | 'failed'
  swatches: string[]            // ≤ 4 hex in this order: accent, text, highlight, chipBg (Science KS3: #0E7C7B #12263A #FFE36E #E3F2F1)
  titleFont: string             // "Lexend"
  deckCount: number             // learned sources
  learning: { learned: number; total: number } | null
  primaryHex: string; tintHex: string   // chip dot and chip/row fill
  updatedAt: string
}
'style-library:changed' (event) → StyleSummary[]
'style-library:createDraft' (args: { paths: string[] }) → Result<{ styleId: string; added: number; rejected: RejectedFile[] }>   // drop
'style-library:pickAndCreateDraft' () → Result<{ styleId: string; added: number; rejected: RejectedFile[] } | { cancelled: true }> // native dialog
interface RejectedFile { name: string; reason: 'type' | 'old-ppt' | 'too-large' | 'duplicate' | 'limit' }

// deck-builder
'deck-builder:listLessons' () → LessonSummary[]
interface LessonSummary {
  id: string; title: string
  yearGroup: string | null      // "Year 8", "Form time"  (filter + sort)
  yearShort: string | null      // "Year 8", "Form"       (card tag)
  slideCount: number
  updatedAt: string
  styleId: string | null
  thumbDataUrl: string | null   // lessons/<id>/thumb.png (480×270) as a data URL (deck-model.md §7)
  status: 'ready' | 'generating'
}
'deck-builder:lessonsChanged' (event) → LessonSummary[]
'deck-builder:pickLoDocument' () → Result<{ document: LoDocument } | { cancelled: true }>   // .docx .pdf .pptx, single file
'deck-builder:importLoDocument' (args: { path: string }) → Result<{ document: LoDocument }>  // drop onto the card
interface LoDocument { id: string; name: string; kind: 'docx' | 'pdf' | 'pptx'; sizeBytes: number }
'deck-builder:createLesson' (req: CreateLessonRequest) → Result<{ lessonId: string; jobId: string | null; messageId: string | null }>
// CreateLessonRequest is defined in 05 §6. Home sends:
// { objectivesText, documentIds: [] or [documentId], styleId (null = built-in plain style, deck-model.md Deck.styleId),
//   title: null, meta: { durationMin }, startGeneration: true }
// Year group, ability and slide count are inferred by extractObjectives (ai-pipeline.md §4.4) or taken from preferences.
'deck-builder:duplicateLesson' (args: { lessonId }) → Result<{ lesson: LessonSummary }>
'deck-builder:renameLesson' (args: { lessonId; title }) → Result<{ lesson: LessonSummary }>
'deck-builder:deleteLesson' (args: { lessonId }) → Result     // moves lessons/<id>/ to the Recycle Bin (shell.trashItem)
'deck-builder:exportPptx' (args: { lessonId }) → ExportResult // see 06 §6
```

- Writes from this screen: preferences (last length, sort), new lesson, new style draft, lesson duplicate / rename / delete / export.
- Search, filter and sort happen in the renderer over the lists already loaded.
- Refresh the lists when the module becomes `active` and on the `changed` events.

## 7. States

| State | What it looks like |
|---|---|
| Default | As the image |
| Loading | Greeting renders at once. Your styles shows 2 skeleton StyleCards; the grid shows 8 skeleton LessonCards (grey cover, two grey bars). Filters and sort hidden until loaded |
| No lessons | Filter chips and Sort hidden. EmptyState in place of the grid |
| No styles | Only the Dropzone (taller, fills the card) under the "Teach me your style first…" line. Style chip reads "Plain style" with a neutral dot (#B9B1D9) |
| Brand-new user | Both of the above, plus the not-connected Callout if she skipped Connect Claude |
| Not connected | Callout (action style) between the PageHeader and the cards row. "Create lesson" still enabled; pressing it shows the README "Connect Claude" prompt inside the card instead of calling main |
| Document attached | An AttachmentCard (FileTypeBadge + name + kind + ×) appears directly under the TextArea; the Upload button reads "Replace document". Create lesson is enabled even with an empty TextArea |
| Creating | Create lesson disabled, spinner, "Creating…"; the rest stays usable. On success navigate; on error show the README AI error Callout inside the card and keep the text |
| Drag over the card | Card gets a 4px highlight-yellow inner ring and the intro reads as drawn; drop accepts one `.docx/.pdf/.pptx`, rejects others with a toast |
| Drag over the Dropzone | Solid border instead of dashed, brighter fill (#FFF0B8), title "Drop to start a new style" |
| Style learning | Its StyleCard meta reads "Learning · {learned} of {total} files"; unsaved drafts show a "Draft" StatusPill instead of "Default" |
| Generating lesson | Its LessonCard is first (newest), cover is a skeleton with the "Making slides…" StatusPill, slide count updates live |
| Search active | Grid and styles list filter live; aria-live region announces "{n} lessons, {m} styles" |
| No results | Search / filter EmptyStates (§5) |
| Load error | Error Callout in the Past lessons section; the rest of the page still works |
| Long content | Lesson titles: 1 line with ellipsis in the meta (full title in `title` attribute and accessible name); the cover shows the real first slide. Long LO text: TextArea grows to 320px then scrolls. Many styles: show the first 3 StyleCards and a "Show all {n} styles" link **(new)** → Styles list. Many lessons: render progressively (first 48, more on scroll) |
| Offline | Nothing on Home needs the network until Create lesson; failures use the README network copy |

## 8. Interactions & behaviour

**Greeting.** Computed from the local clock (§5). The name comes from `settings:getProfile`; if it's missing, "Good morning!".

**Search.** Ctrl+F focuses it. Filters as you type (debounce 150ms), case- and accent-insensitive substring match on lesson title, year group and subject label, and on style name. Esc clears it (and blurs if already empty). Filtering stacks with the year filter.

**Make a new lesson card.**
1. Type or paste objectives in the TextArea. Enter adds a line; **Ctrl+Enter = Create lesson**.
2. "Upload LO document" → `deck-builder:pickLoDocument` (native dialog, filter "Learning objectives (*.docx, *.pdf, *.pptx)", single file). On success show the AttachmentCard. × removes it.
3. Dropping a file anywhere on the card does the same via `deck-builder:importLoDocument` (path from README D-f).
4. Style SelectChip opens a ContextMenu of styles (arrow keys, Enter, Esc). Default selection: the default style. "Create a new style…" → 04 with an empty draft.
5. Length SelectChip opens a ContextMenu of lengths. The choice is saved as `lastLengthMin`.
6. **Create lesson** is enabled when the TextArea has non-space text **or** a document is attached.
   - No usable key → show the Connect Claude prompt in the card; stop.
   - Else `deck-builder:createLesson({ …, startGeneration: true })` → `navigate('deck-builder', { kind: 'open-lesson', lessonId, jobId })`. The editor opens in its generating state (05 §7 "Generating").
   - After success, clear the TextArea and attachment.

**Your styles card.**
- StyleCard (a button) → 04 in edit mode for that style.
- "Manage" → Styles list.
- Dropzone: click or Enter → `style-library:pickAndCreateDraft` (native dialog, `.pdf` + `.pptx`, multi-select). Drop → filter by extension, then `style-library:createDraft({ paths })`. Either way, on success `navigate('style-library', { kind: 'new-style', styleId })` and show rejected files as one toast.
- Limits checked in main: up to 50 files per style, 50 MB each (`../style-profile.md` §2.1).

**Past lessons.**
- Filter ToggleChips are single-select: pressing a chip selects it and unpresses the others; pressing the pressed chip (other than All) goes back to All. Default All.
- Sort Select reorders: "Last edited" = `updatedAt` newest first; "Title A–Z" = `localeCompare('en-GB', { numeric: true })`; "Year group" = Year 7…13, Form time, others, then newest first. Saved as `homeSort`.
- LessonCard click / Enter → `navigate('deck-builder', { kind: 'open-lesson', lessonId })`.
- **Card menu** opens from the ⋯ IconButton (visible on hover and when the card has focus; 44px hit area), right-click, Shift+F10 or the Menu key:
  - "Open" → editor.
  - "Duplicate" → `deck-builder:duplicateLesson`; the copy ("{title} (copy)") appears first; toast.
  - "Rename…" → Dialog with the title selected; Enter saves, Esc cancels; empty title not allowed.
  - "Export to PowerPoint" → `deck-builder:exportPptx` (native Save dialog in main); toast with "Open in PowerPoint" on success.
  - "Delete…" → ConfirmDialog; confirm → `deck-builder:deleteLesson`; the card disappears; toast "Lesson deleted". Delete key on a focused card opens the same dialog.

**Keyboard order:** Sidebar → search → New lesson → TextArea → Upload → style chip → length chip → Create lesson → Manage → StyleCards → Dropzone → filter chips → Sort → LessonCards (each card, then its ⋯).

## 9. Acceptance criteria

- [ ] At 1440×1320 the screen matches `03-home.png` side by side (sidebar, greeting, both cards, chips, grid of 4).
- [ ] At 1280×800 the cards sit side by side and the grid has 3 columns; at 1100px "Your styles" wraps below the orange card.
- [ ] The greeting says morning / afternoon / evening at 11:59 / 12:00 / 18:00 and uses the saved name.
- [ ] Create lesson is disabled with an empty TextArea and no document, enabled after typing or attaching a `.docx`.
- [ ] Create lesson with objectives opens the editor with slides generating, not the empty New lesson screen.
- [ ] With no API key, Create lesson shows the Connect Claude prompt and makes no main-process AI call.
- [ ] Dropping 3 PDFs and 1 `.jpg` on the Dropzone opens Create a style with 3 files queued and a toast about 1 skipped file.
- [ ] Filter chips are generated from her lessons, are single-select, and "All" restores the full list.
- [ ] Typing "photo" in search shows only matching lessons and styles; Esc clears it.
- [ ] Sort "Title A–Z" orders cards alphabetically; the choice survives a restart.
- [ ] The LessonCard menu opens by ⋯, right-click and Shift+F10, and Duplicate / Rename / Export / Delete each work; Delete asks first and moves the lesson to the Recycle Bin.
- [ ] Relative dates follow the README table ("Today", "Yesterday", "3 days ago", "Last week", "2 weeks ago", "Last month").
- [ ] With no lessons and no styles, both empty states show and nothing overlaps.
- [ ] The Sidebar chip reads "Claude not connected" after Skip for now and "Claude connected" after a successful test, without restarting.

## 10. Open questions

1. The mockup's "Create lesson" links to the empty New lesson screen; this spec opens the editor already generating (product flow). Confirm.
2. LessonCard tag "Form" vs filter chip "Form time": is the short tag intentional?
3. Default StyleCard is tinted mint, the other is white. Is the tint "this is the default" or "this style's own tint, shown only for the default"? The spec uses the style's tint for the default row only.
4. "Manage", "Plugins" and "More plugins" have no designed destination. The spec uses a simple Styles list (StyleCards + Dropzone, full width) and a placeholder Plugins page.
5. Year tag colours for Year 10–13 and "Other" are undefined.
6. Should Home also show a "Continue where you left off" for a lesson still generating? The spec only puts it first in the grid.
