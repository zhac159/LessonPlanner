# 06 · Editor — chat, circle-to-edit, + menu

![](../images/06-editor.png)

**Purpose:** where she refines a lesson: see and reorder slides, chat with the planning buddy, circle any area of a slide to say what to change, run plugins from the + menu, then present or export to PowerPoint.

Mockup source: `../canvas/project/Editor.dc.html` (board 1440×940). The image shows one moment: slide 3 selected, Circle to edit active, a region labelled on the slide, a circle-edit request in progress, and the PluginMenu open. Deep references: `../deck-model.md` (ops, undo, rendering, export), `../ai-pipeline.md` §5–9 (chat tools, circle-to-edit, events, errors), `../plugin-architecture.md`.

---

## 2. Owner & navigation

| Item | Value |
|---|---|
| Owning module | `deck-builder`. **Chat**, **annotate** (RegionOverlay, circle tool) and **plugins** are parts of it, not separate modules (`../build-plan.md`). It reads style profiles from `style-library` and gets the AI client from `settings` (cross-module; README D-d) |
| Sidebar mode | Icon rail (72px), Home active (same rail as 05) |
| How you get here | Home LessonCard (`{ kind: 'open-lesson', lessonId }`); Home "Create lesson" (opens generating, see 05 §7); 05 after generation; Start from a past lesson / Blank slide (05) |

| Control | Goes to / does | Mockup href |
|---|---|---|
| Rail Home / Styles / Plugins / Settings / avatar | As 05 | `Main.dc.html`, `StyleBuilder.dc.html`, `#`, `ConnectClaude.dc.html` |
| "My lessons" | 03 Home | `Main.dc.html` |
| Style SelectChip | Menu of styles; picking another style asks to restyle (§8.10) | — |
| "Present" | Full-screen slideshow (§8.12) | — |
| "Export to PowerPoint" | Native Save dialog, then a toast with "Open in PowerPoint" (§8.11) | — |
| PluginTile with inputs (e.g. Quiz) | 07 Plugin sheet in place of the chat | `PluginSheet.dc.html` |
| PluginTile without inputs | Runs at once; progress in chat | — |
| "Manage", "More plugins" | Plugins page (not designed; placeholder) | `#` |

## 3. Layout

```
┌ TitleBar 40 ──────────────────────────────────────────────────────────────────────────────┐
├ Rail ┬ Header: [‹ My lessons]   Y8 Science — Photosynthesis   [● Your style ▾][▷ Present][⤓ Export] ┤
│      ├──────────────────────────────────────────────────────────┬─────────────────────────┤
│      │ ToolRail │ SlideStage (16:9, max 900)                     │ ChatPanel               │
│      │  ▸ ◯ ✎ T │   RegionOverlay + RegionLabel                  │  header band            │
│      │  ▢ ─ ↶ ↷ │                                                │  transcript (scrolls)   │
│      │          │ (hint pill when Circle tool is on)             │  [PluginMenu popover]   │
│      │          │ Filmstrip: [1][2][3*][4][5][6]… [+]            │  Composer (pinned)      │
└──────┴──────────┴────────────────────────────────────────────────┴─────────────────────────┘
```

| Region | Size and behaviour (from the mockup) |
|---|---|
| Rail, TitleBar | As 05 |
| Header | As 05, except: the title is plain text (display font 700, 18px, centred; becomes the dashed TextField on hover/focus/click); Present is an enabled secondary Button (white, 2px ink, radius 12px, play icon); Export to PowerPoint is the primary Button (orange, shadow 3px, download icon) |
| Body | As 05: row, padding 4px 20px 20px, gap 20px, fills the viewport height, **no page scroll** |
| Main column | `flex: 999 1 600px`, row (wraps in the markup), gap 20px, `align-items: flex-start` |
| ToolRail | `flex: 0 0 auto`, column, padding 8px, gap 6px, 2px ink, radius 18px, white, shadow 4px. ToolButtons 48×48, radius 12px, 22px icons. Active: orange fill + 2px ink border. Divider (2px #E4DFF7, margin 4px 6px) before Undo/Redo. `role="toolbar"`, `aria-orientation="vertical"`, `aria-label` "Canvas tools" |
| Stage column | `flex: 1 1 480px`, column, centred, gap 16px |
| SlideStage | Width 100%, max-width 900px, 16:9, 2px ink, radius 14px, shadow 6px, white, `overflow: hidden`. Renders `SlideView` scaled to fit. Size: `min(900px, column width, (body height − 170px) × 16/9)` so the filmstrip always stays visible |
| RegionOverlay | Absolutely positioned SVG over the stage, same box; loops drawn in orange (#FF6B3D), 5px non-scaling stroke, round caps |
| RegionLabel | White pill, 2px ink, padding 4px 10px 4px 4px, 13px / 700 Figtree; 22px orange number circle. Pinned near the top-left of the loop's bounding box, kept inside the stage |
| Hint pill | Shown only while Circle to edit is active: padding 8px 14px, 2px dashed ink, pill, cream fill, 14px / 600, loop icon |
| Filmstrip | Width = stage width, row, gap 12px, `overflow-x: auto`, padding 4px 6px 10px 2px. Each item: SlideThumb 132px wide (16:9, 2px ink, radius 10px) above a number badge (min 20×20, radius 6px, 2px ink, 12px / 700). **Selected:** thumbnail shadow 4px 4px 0 orange, badge orange. Last item: Add slide (76×78, 2px dashed ink, radius 10px, plus icon) |
| ChatPanel | As 05 (`flex: 1 1 400px` in the markup; use `0 1 400px`, min-width 340px; see 05 §3). Transcript: column gap 16px, padding 18px |
| Composer | Column gap 8px, padding 10px, 2px ink, radius 18px, white (no yellow ring). RegionChips and AttachmentCards row (wraps, gap 6px) above a 2-row TextArea that grows to 8 rows. Action row: + (44px circle; **orange** while the menu is open), paperclip (44px circle), spacer, dark "Send" pill (44px, ink fill, white, arrow) |
| PluginMenu | Popover anchored to the Composer: `position: absolute`, left/right 18px, bottom = 6px above the Composer's top, over the transcript. Column gap 10px, padding 14px, 2px ink, radius 20px, white, shadow 6px. Header row: "What shall we make?" (display 800, 16px) ↔ "Manage" (13px / 700 link). Grid: 2 equal columns, gap 8px. Max height 360px, then the grid scrolls |
| PluginTile | Column, start-aligned, gap 6px, padding 12px, 2px ink, radius 14px, pastel fill, 22px icon, name 700. "More plugins": white fill, dashed border, plus icon |

Tints in the image: Quiz peach #FFD6C9, Differentiate sky #D7E8FF, Worksheet mint #DFF5D8, Speaker notes butter #FFF0B8, Starter & plenary lilac #EAD9FF (named in `../plugin-architecture.md` §6).

**Narrower windows.** Keep the ChatPanel beside the main column down to 1100px (05 §3). Inside the main column, ToolRail (68px) + gap + stage column (min 480px) needs 568px; at 1100px the column is ~600px, so they stay side by side. Below that the markup wraps the ToolRail above the stage; acceptable only below the supported minimum.

**Shorter windows.** The stage shrinks (formula above). At 1280×800 the stage is about 660×371px; the hint pill and filmstrip remain visible.

Implementation note (2026-10-06): the stage height budget is `100vh − 372px` (not −306px) so the filmstrip stays on screen at 1100×600 while the Circle hint pill wraps to two lines in a narrow column; it only changes the stage size below about 760px of window height.

## 4. Components

| Component | Variant / notes |
|---|---|
| Sidebar | Rail |
| PageHeader | Editor variant |
| Button | Secondary pill (My lessons), secondary (Present), primary (Export), dark pill (Send), small pill 32px (Undo in ResultChip) |
| SelectChip | Style chip (add a chevron; see Open questions) |
| ToolRail, ToolButton | 7 tools: Select, Circle to edit, Draw, Text, Sticky note, Undo, Redo |
| SlideStage | Hosts SlideView + selection outline + RegionOverlay |
| RegionOverlay, RegionLabel, RegionChip | Circle to edit (§8.4) |
| Callout | Hint pill (dashed, cream) |
| Filmstrip, SlideThumb | Selected / normal / skeleton / dragging / drop indicator |
| ChatPanel, CardHeaderBand | As 05 |
| MessageUser | Right-aligned bubble: max-width 88%, padding 12px 14px, 2px ink, radius 18px 18px 4px 18px, lilac #E9E3FF, column gap 8–10px. Contains AttachmentCards, RegionChips (start-aligned), text |
| MessageAssistant | Left, max-width 92%, no bubble, line-height 1.5, column gap 10px. Text + optional ResultChip row / AttachmentCard / error style |
| MessageProgress | Dashed 2px ink, radius 14px, padding 10px 12px, three 8px dots (orange shades, animated), step text 600, "Stop" button |
| AttachmentCard | White, 2px ink, radius 12px, padding 8px 10px: 32px tinted icon tile (Word: sky) + name 14px / 700 + kind 12px muted. Assistant file outputs add "Open" and "Show in folder" buttons |
| ResultChip | Mint pill (#DFF5D8), 2px ink, 13px / 700, followed by an "Undo" pill Button (32px) |
| Composer | Editor variant |
| IconButton | +, paperclip, × on chips |
| PluginMenu, PluginTile | `role="menu"`, tiles `role="menuitem"` |
| ContextMenu, ConfirmDialog, Toast | Filmstrip menu, restyle confirm, export result |

## 5. Content & copy

| Element | Text | Dynamic? |
|---|---|---|
| Header title | "Y8 Science — Photosynthesis" | `deck.title` |
| Style chip | "Your style: Science" | "Your style: {style name}" (see Open questions) |
| Header buttons | "My lessons", "Present", "Export to PowerPoint" | — |
| ToolRail `aria-label`s + tooltips | "Select (V)", "Circle to edit (C)", "Draw (D)", "Text (T)", "Sticky note (N)", "Undo (Ctrl+Z)", "Redo (Ctrl+Y)" | Undo/Redo tooltips add the step: "Undo: {summary}" **(new)** |
| Hint pill | "Circle it, then say what you want — the assistant does the rest." | — |
| RegionLabel | "1" (draft); "1" + "Swap for a diagram" (sent, while highlighted) | Number; caption (§8.4) |
| Filmstrip item `aria-label` | "Slide 3: What do plants need?" | "Slide {n}: {slide title text}" |
| Filmstrip thumbnail text (image) | "Title", "Do Now", "What do plants need?", "Key words", "The word equation", "Practical: leaf starch test", "Check for understanding", "Plenary" | Slide content (SlideView), not app copy |
| Add slide | `aria-label` "Add slide" | — |
| Panel | "Your planning buddy" / "Knows your Science style" | As 05 |
| User message 1 | AttachmentCard "Y8 Photosynthesis LOs.docx" / "Word document"; text "Can you build tomorrow’s lesson from these? 50 minutes, mixed-ability Year 8." | Her message |
| Assistant message | "Done! 8 slides in your Science style — Do Now, tick-box objectives, key word chips and your yellow mini-whiteboard prompts." | Streamed from Claude |
| ResultChip + action | "8 slides added" + "Undo" | ChangeSet label (§8.6) |
| User message 2 | RegionChip "1" + "Slide 3 · circled"; text "Swap this photo for a labelled diagram of a leaf cross-section." | — |
| MessageProgress | "Drawing your leaf diagram…" | From `chat:status` |
| PluginMenu | "What shall we make?", "Manage"; tiles "Quiz", "Differentiate", "Worksheet", "Speaker notes", "Starter & plenary", "More plugins"; `aria-label` "Plugins" | Tiles from the plugin registry |
| Composer | Hidden label "Message your planning buddy"; placeholder "Paste learning objectives or ask for a change…"; `aria-label`s "Plugins", "Attach a file"; "Send" | — |

**New copy for states and actions not drawn:**

| Where | Copy |
|---|---|
| Composer with regions and no text | Placeholder "Say what to change in the circled area…" |
| RegionChip (draft) | "{n}" + "Slide {k} · circled", × `aria-label` "Remove region {n}" |
| Draw markup chip | "Slide {k} · marked up", × "Remove drawing" |
| Too many regions toast | "Up to 9 circles per message." |
| Send while running | Button "Stop" (square icon) |
| MessageProgress stop | "Stop" |
| Chat edit cancelled (`../ai-pipeline.md` §9) | "Stopped. Nothing was changed." |
| Ops failed twice (`../ai-pipeline.md` §9) | "I couldn’t make that change cleanly. Nothing was changed." + "Try again" |
| ResultChip after Undo | Chip text "Undone", action "Redo" |
| ResultChip Undo not latest (tooltip) | "Undo the later changes first" |
| Jump button | "Jump to latest" |
| Filmstrip menu | "Duplicate slide", "Delete slide", "Move left", "Move right", "Add slide after" |
| Delete slide toast | "Slide deleted" + "Undo" |
| Doesn't-fit badge (editor only, `../deck-model.md` §4) | "Doesn’t fit" |
| Restyle confirm | Title "Restyle this lesson?" / "All {n} slides will be redrawn in {style name}. You can undo this." / "Cancel" · "Restyle" |
| Export | Button while saving "Exporting…"; toast "Saved {file name}" + "Open in PowerPoint" · "Show in folder"; missing font line "{font} isn’t installed on this PC, so PowerPoint will swap it."; locked file "Close {file name} in PowerPoint, then try again."; other failure "Couldn’t save the file. Try another folder." |
| Present end screen | "End of slide show. Click or press Esc to exit." |
| Present control bar | `aria-label`s "Previous slide", "Next slide", "Exit slide show"; counter "{n} / {total}" |
| Lesson can't open | Error card: "This lesson couldn’t be opened." + Button "Back to Home" |
| Sticky note placeholder | "Note to self…" |

## 6. Data

```ts
'deck-builder:openLesson' (args: { lessonId }) → Result<LessonView>
interface LessonView {
  deck: Deck                                   // deck-model.md §2
  titleSource: 'auto' | 'user'
  style: StyleProfileView | null               // from style-library; what SlideView needs (04 §6)
  history: HistoryState
  chat: ChatItem[]                             // the ui part of chat.jsonl (ai-pipeline.md §8)
  runningJob: { jobId: string; kind: 'generation' | 'chat' | 'plugin'; messageId: string } | null
  stickyNotes: StickyNote[]                    // proposed, §8.3
}
interface HistoryState { canUndo: boolean; canRedo: boolean; undoChangeSetId: string | null; redoChangeSetId: string | null; undoSummary?: string; redoSummary?: string }
interface ChatItem {
  id: string; role: 'user' | 'assistant'; at: string
  text: string
  attachments?: AttachmentRef[]
  regions?: Array<{ n: number; slideId: string; slideNumber: number; path: Array<[number, number]>; caption: string }>
  result?: { changeSetId: string; label: string; slideIds: string[]; undone: boolean }
  file?: { name: string; path: string; kind: 'docx' | 'pdf' | 'pptx' }
  error?: { code: ErrorCode; message: string; action?: 'retry' | 'settings' | 'console' | 'finish' }
  pluginId?: string
}
interface AttachmentRef { id: string; name: string; kind: 'docx' | 'pdf' | 'pptx' | 'image'; sizeBytes: number }

// Direct edits by the teacher (one ChangeSet each, by: 'user')
'deck-builder:applyOps' (args: { lessonId; ops: DeckOp[]; summary: string }) → Result<{ changeSet: ChangeSet; history: HistoryState }>
'deck-builder:undo' (args: { lessonId }) → Result<{ deck: Deck; history: HistoryState }>
'deck-builder:redo' (args: { lessonId }) → Result<{ deck: Deck; history: HistoryState }>
'deck-builder:renameLesson' (args: { lessonId; title }) → Result
'deck-builder:setStickyNotes' (args: { lessonId; notes: StickyNote[] }) → Result     // proposed

// Chat (area inside deck-builder)
'chat:send' (args: {
  lessonId: string
  text: string
  attachmentIds: string[]
  regions: RegionDraft[]
  markup: Array<{ slideId: string; strokes: Array<Array<[number, number]>> }>   // Draw tool, slide units
  selectedSlideId: string
}) → Result<{ jobId: string; messageId: string }>
interface RegionDraft {                         // ai-pipeline.md §6 Region + hit-test result
  id: string; n: number; slideId: string
  path: Array<[number, number]>                 // closed, simplified (RDP tolerance 4 units), slide units 1920×1080
  bbox: { x: number; y: number; w: number; h: number }
  targetElementIds: string[]                    // sorted by overlap
}
'chat:cancel' (args: { jobId }) → void
'chat:attach' (args: { lessonId }) → Result<{ attachment: AttachmentRef } | { cancelled: true }>   // native dialog
'chat:attachPath' (args: { lessonId; path }) → Result<{ attachment: AttachmentRef }>             // drop

// Events (ai-pipeline.md §7)
'chat:delta'   → { lessonId; messageId; text }
'chat:status'  → { lessonId; messageId; step: string; state: 'running' | 'done' | 'error' }
'chat:changes' → { lessonId; changeSet: ChangeSet }        // apply to the local deck, add the ResultChip
'chat:done'    → { lessonId; messageId; usage }
'ai:error'     → { scope: 'chat' | 'generation' | 'plugin'; code: AiErrorCode; message: string; retryable: boolean }
'deck-builder:gen-progress', 'deck-builder:slide-ready'    // generation, see 05

// Export & present
'deck-builder:exportPptx' (args: { lessonId }) → ExportResult      // main shows the Save dialog, writes with PptxGenJS (deck-model.md §5)
type ExportResult =
  | { status: 'saved'; path: string; fileName: string; missingFonts: string[] }
  | { status: 'cancelled' }
  | { status: 'error'; code: 'file-locked' | 'io'; message: string }
'deck-builder:openExport' (args: { path }) → Result               // shell.openPath; only paths main exported this session
'deck-builder:showExport' (args: { path }) → Result               // shell.showItemInFolder
'deck-builder:present' (args: { on: boolean }) → void             // BrowserWindow.setFullScreen (README D-g)

// Plugins (area inside deck-builder)
'plugins:list' () → PluginSummary[]
interface PluginSummary { id: string; name: string; description: string; icon: string; tint: 'peach' | 'sky' | 'mint' | 'butter' | 'purple-soft'; scope: 'lesson' | 'slides' | 'region'; hasInputs: boolean; needsSlides: boolean; order: number }
'plugins:run' → see 07 §6

// Other modules
'style-library:list' / 'style-library:changed'   // style chip menu; re-render if this lesson's style changes
```

- The deck in the renderer is a local copy kept in sync from `applyOps`, `undo`/`redo` results and `chat:changes`. Main is the source of truth (`deck.json`, `changes.jsonl`).
- Undo/redo works across restarts (ChangeSets are persisted; `../deck-model.md` §3).

## 7. States

| State | What it looks like |
|---|---|
| Default (ready) | Slide 1 selected (or the last selected slide for this lesson), Select tool active, no hint pill, PluginMenu closed, Composer empty |
| Image moment | Slide 3 selected; Circle to edit active (hint pill shown); a sent request in progress (MessageProgress); the loop re-highlighted with its caption because the sent RegionChip is hovered (§8.4); PluginMenu open |
| Loading a lesson | Header shows the title at once (from Home); stage and filmstrip skeletons; transcript skeleton (2 grey bubbles). Under 300ms show nothing extra |
| Generating | See 05 §7 |
| AI job running (chat or plugin) | MessageProgress with step text and Stop; Composer Send becomes "Stop"; she can keep typing a draft. Stage is **view-only**: ToolRail tools disabled except Select (selecting slides still works), filmstrip reorder/add/delete disabled, Present/Export/style chip disabled. One job per lesson at a time |
| Change landed | MessageAssistant (one or two sentences) + ResultChip + Undo. Added slides flash orange in the filmstrip for 1 s and scroll into view; the selection stays where it was unless the selected slide was replaced (then it shows the new version) |
| AI error | MessageAssistant in error style (peach left rule) with the README copy and one action Button. The deck is unchanged (except generation, see 05) |
| No API key | Composer works; Send adds the Connect Claude prompt to the transcript and sends nothing |
| Offline | StatusPill "Offline" in the panel header (README); sends fail with the network copy and the draft returns to the Composer |
| Empty deck (all slides deleted) | Stage shows the 05 EmptyState; chat history stays; Present/Export disabled |
| Missing font | `SlideView` uses the fallback stack; a one-time Toast: "{font} isn’t available offline, so slides use {fallback} here." **(new)** |
| Text overflow | Orange "Doesn’t fit" badge on the element in the editor only (never in Present or export) |
| Long content | Long title: ellipsis at the available width, full title in the tooltip. Many slides: filmstrip scrolls horizontally and keeps the selected slide in view. Long chat: stays scrolled to the bottom unless she scrolled up, then a "Jump to latest" button appears above the Composer. Many plugins: PluginMenu grid scrolls past 360px |
| Lesson can't open (corrupt JSON) | Error card in place of stage and chat, with "Back to Home" (`../deck-model.md` §7) |

## 8. Interactions & behaviour

### 8.1 Slides and the filmstrip
- **Select a slide:** click a thumbnail. The filmstrip is a `role="listbox"` (`aria-orientation="horizontal"`, `aria-multiselectable="true"`) of `role="option"` items with roving tabindex: ←/→ move the selection, Home/End go to first/last, Enter moves focus to the stage. With focus on the stage (not in a text field), PageUp/PageDown also change slides.
- **Select several slides** (used by plugins' "Which slides?", 07 §8): Shift+click or Shift+←/→ selects a range, Ctrl+click toggles one slide. The stage shows the last clicked slide (orange badge + shadow); the other selected thumbnails get the orange shadow with a white badge. A plain click or Esc in the filmstrip goes back to a single selection. Delete with several selected deletes them all (one ChangeSet).
- **Reorder:** drag a thumbnail (starts after 6px of movement). A 4px orange insertion bar shows the drop position; the strip auto-scrolls near its edges; Esc cancels the drag. Keyboard: Alt+← / Alt+→ moves the selected slide. Each move is one `moveSlide` ChangeSet.
- **Add slide:** the + at the end inserts a blank slide **after the selected slide**, using the style's content layout, and selects it. One ChangeSet.
- **Thumbnail menu** (right-click, Shift+F10, Menu key): Duplicate slide, Delete slide, Move left, Move right, Add slide after. Delete key on a focused thumbnail deletes the slide (toast with Undo; no dialog).
- The slide number badges are part of the option, not separate targets.

### 8.2 Tools (ToolRail)

| Tool | Key | Behaviour |
|---|---|---|
| Select | V | Default. Click an element on the stage to select it (2px orange outline; no resize handles in v1). Drag to move (one `updateElement` ChangeSet on release). Double-click a text element to edit its text in place (Esc or click outside commits). Delete/Backspace removes a selected unlocked element. Arrow keys nudge 10 units (Shift: 50). Esc deselects |
| Circle to edit | C | §8.4 |
| Draw | D | Freehand orange marks (arrows, underlines, crossings-out) on the annotation layer, **for Claude**, not slide content. They attach to the next message as part of that slide's image (a "Slide {k} · marked up" chip) and clear after sending. Proposed; see Open questions |
| Text | T | Click on the slide to add a text box there (body role, style's body font), typing immediately. Esc or click outside commits one `addElement` ChangeSet; an empty box is discarded |
| Sticky note | N | Places a small yellow note for herself on the slide ("Note to self…"). Stored with the lesson, never exported, never sent to Claude. Proposed; see Open questions |
| Undo | Ctrl+Z | `deck-builder:undo`. Undoes the latest ChangeSet, whoever made it |
| Redo | Ctrl+Y, Ctrl+Shift+Z | `deck-builder:redo` |

- Letter shortcuts work only when focus isn't in a text field. Ctrl+Z inside a text field is the field's own text undo.
- **Esc** (stage focused): cancels an in-progress stroke → else deselects → else returns to Select.
- The ToolRail is a `role="toolbar"` with roving tabindex (↑/↓ between buttons). Active tool has `aria-pressed="true"`.
- Undo/Redo buttons are disabled when there is nothing to undo/redo.

### 8.3 Direct edits and undo
- Every direct edit is one ChangeSet (`by: 'user'`) and one undo step. **Every AI change (chat, circle edit, generation, plugin) is one ChangeSet and one undo step**, however many ops or slides it contains.
- Undo/redo history survives restarts.

### 8.4 Circle to edit (step by step)
1. **Turn it on:** click the ToolButton or press C. The cursor becomes a pen over the stage; the hint pill appears under the stage.
2. **Draw:** pointer down on the stage starts a loop (pointer capture). The path draws live in orange. Points are stored in slide units (1920×1080).
3. **Release:**
   - If the loop is tiny (bounding box under 40×40 units or path under 120 units long), discard it and treat it as a click (a click inside an existing loop selects that region).
   - Otherwise the loop **snaps closed**: join the end to the start with a smooth curve (150ms; instant with reduced motion), then simplify (Ramer–Douglas–Peucker, tolerance 4 units).
4. **Number:** the region gets the next number, starting at 1 for this draft message (max existing + 1, across all slides). A **RegionLabel** with just the number appears at the loop's top-left.
5. **Chip:** a **RegionChip** "{n} Slide {k} · circled" appears in the Composer above the TextArea. Focus moves to the TextArea so she can type straight away; the tool stays on so she can circle more.
6. **More regions:** each new loop adds the next number (1, 2, 3…), on any slide. Up to 9 per message (then a toast). Only the current slide's loops are drawn on the stage; thumbnails of other slides with regions show a small orange dot.
7. **Remove a region:** × on its chip, or select its label/loop (click with the Select or Circle tool) and press Delete/Backspace. Numbers are **not** renumbered (her text may already say "make 2 bigger"); the next new region uses max + 1.
8. **Esc:** while drawing → cancel that loop. Otherwise as §8.2 (deselect, then back to Select). Regions already drawn stay until sent or removed.
9. **Hover / focus a draft RegionChip** → its loop thickens; clicking the chip selects that slide.
10. **Send:** needs text (with regions and no text, Send is disabled and the placeholder reads "Say what to change in the circled area…"). The renderer hit-tests each loop against element boxes (an element is targeted if ≥ 30% of its area is inside the loop, or the loop lies mostly inside the element) and sends `RegionDraft`s with `chat:send`. Main renders the annotated slide images and crops (`../ai-pipeline.md` §6).
11. **After send:** regions **clear** from the stage and the Composer. The sent MessageUser shows read-only RegionChips. Hovering or focusing a sent chip re-draws its loop on the slide (if that slide is selected; clicking the chip selects it) with a RegionLabel showing the number and a caption: her message cut to about 24 characters at a word boundary, with "…". (The image shows this hover moment with a summarised caption; see Open questions.)
12. If a slide with a draft region is deleted, its regions are removed and a toast says "Region {n} was on a deleted slide." **(new)**.

### 8.5 Chat
- **Composer keys:** Enter = Send; Shift+Enter = new line; Ctrl+Enter = Send.
- **Send** is enabled when the TextArea has non-space text (or there are attachments and no regions). No usable key → Connect Claude prompt. Otherwise `chat:send`; clear the Composer (text, chips, attachments); add the MessageUser; add a MessageProgress.
- **Streaming:** `chat:delta` text appears in a MessageAssistant as it arrives (plain text with line breaks and simple bullets; never render as HTML). `chat:status` updates the MessageProgress step; finished steps show a ✓ above the current one (max 4 visible).
- **Stop:** "Stop" in the MessageProgress or the Composer → `chat:cancel`. The deck is unchanged; the message reads "Stopped. Nothing was changed."
- **Attachments:** paperclip → `chat:attach` (native dialog: `.docx`, `.pdf`, `.pptx`, `.png`, `.jpg`); dropping files on the ChatPanel → `chat:attachPath`. Max 3 per message; each shows as an AttachmentCard with × in the Composer.
- **Scrolling:** auto-scrolls to the newest item unless she has scrolled up more than 80px; then "Jump to latest" appears.
- **Draft kept:** the Composer draft (text, regions, attachments) survives switching to the PluginSheet, navigating away and back (module stays mounted).

### 8.6 ResultChip and Undo
- Each ChangeSet from Claude or a plugin adds a ResultChip under the assistant's reply, labelled from the ChangeSet: "{n} slides added", "Slide {k} changed", "{n} slides changed", "{n} slides removed", "{n} quiz slides added".
- Clicking the chip selects the first affected slide; hovering outlines the affected thumbnails in orange.
- **Undo** on the chip is enabled only while that ChangeSet is the latest applied one (top of the undo stack); otherwise it's disabled with the tooltip "Undo the later changes first". After undoing, the chip reads "Undone" and the button "Redo" (while that ChangeSet is on top of the redo stack).

### 8.7 PluginMenu (+)
- **Open:** click + (or Enter/Space on it). Typing "/" as the first character of an empty Composer also opens it (from `../design-directions.md`; should). The + turns orange and gets `aria-expanded="true"`; focus moves to the first enabled tile.
- **Keyboard:** ←/→ move within a row, ↑/↓ between rows (↑ from the first row reaches "Manage"), Home/End first/last tile, Enter/Space activates, Tab closes the menu and moves on, **Esc closes** and returns focus to +.
- **Close:** Esc, clicking outside, choosing a tile, or pressing + again.
- **Tiles:** enabled plugins from `plugins:list`, in `order`, then "More plugins" last. Each tile shows the name only; its description is the tooltip and `aria-description`. Tiles are disabled (`aria-disabled`) while a job runs, or when the plugin needs slides and the deck is empty ("Make your slides first").
- **Choosing a tile:** plugin with inputs → 07 PluginSheet replaces the chat panel content; plugin without inputs → `plugins:run` with defaults immediately, progress in the chat.
- **Manage / More plugins** → Plugins page (placeholder until designed).

### 8.8 Title
Click the header title to edit (dashed TextField). Enter or blur saves (`renameLesson`, one setMeta ChangeSet); Esc reverts; max 80 characters; empty restores the previous title.

### 8.9 Selection after AI changes
Never move the selection to another slide on her behalf; scroll added slides into view and flash them. If the selected slide was replaced, show the new version.

### 8.10 Style chip
Opens a ContextMenu of her styles. Choosing a different style opens the Restyle ConfirmDialog; "Restyle" sends a chat turn that redraws all slides in that style (one ChangeSet, high effort; `../ai-pipeline.md` §4.7). Proposed; see Open questions.

### 8.11 Export to PowerPoint (Ctrl+E, new)
1. `deck-builder:exportPptx({ lessonId })`. Main opens the native Save dialog (default name "{title}.pptx" with characters Windows forbids replaced; default folder = last used, else Documents) and writes the file (`../deck-model.md` §5). The button shows "Exporting…" meanwhile.
2. `saved` → Toast "Saved {file name}" with "Open in PowerPoint" (`openExport` → `shell.openPath`) and "Show in folder". If `missingFonts` is not empty, the toast adds the missing-font line.
3. `cancelled` → nothing. `error` → Toast with the locked-file or generic copy.
Disabled while a job runs or when there are no slides.

### 8.12 Present (F5 from slide 1, Shift+F5 / the Present button from the current slide)
1. `deck-builder:present({ on: true })` puts the window in full screen; the renderer shows a black full-window layer with the slide drawn by `SlideView`, letterboxed. No annotations, regions, sticky notes or "Doesn’t fit" badges.
2. Next: →, ↓, Space, PageDown, Enter, N, click. Previous: ←, ↑, PageUp, Backspace, P. Home/End. Number + Enter jumps to that slide. B or . toggles a black screen; W or , a white screen.
3. Moving the mouse shows a small control bar (bottom-left: previous, "{n} / {total}", next, exit) that fades after 2 s; the cursor hides after 2 s idle.
4. After the last slide: a black end screen "End of slide show. Click or press Esc to exit."
5. Esc exits (`present({ on: false })`) and selects the slide she was on.

## 9. Acceptance criteria

- [ ] At 1440×940 with the fixture lesson, the editor matches `06-editor.png` (minus the in-progress chat state).
- [ ] At 1280×800 and 1100×800 the ChatPanel stays on the right, the page doesn't scroll, and the stage + filmstrip are fully visible.
- [ ] ←/→ in the filmstrip change the selected slide; Shift+click selects a range (3–7); dragging slide 5 before slide 2 (or Alt+→) reorders it as one undo step.
- [ ] Pressing C, drawing a loop round the photo on slide 3 and releasing shows a closed loop with label "1" and a "1 Slide 3 · circled" chip in the Composer, with focus in the TextArea.
- [ ] A second loop gets "2"; removing chip 1 leaves "2" (no renumbering); a tiny scribble creates nothing; Esc while drawing cancels the loop and Esc again returns to Select.
- [ ] With regions and no text, Send is disabled. After sending, regions disappear from the slide and Composer and appear as chips in the sent message; hovering a sent chip re-highlights the loop.
- [ ] The circle edit replaces only the targeted element and shows "Slide 3 changed" with Undo; Undo restores the photo in one step.
- [ ] The whole 8-slide generation and each chat/plugin change are each a single undo step, also after restarting the app; ResultChip Undo is disabled when a later change exists.
- [ ] + opens the PluginMenu, arrow keys move between tiles, Esc closes it and focus returns to +; clicking outside also closes it.
- [ ] Choosing Quiz opens the PluginSheet; choosing a no-input plugin runs it straight away.
- [ ] Export saves a `.pptx` through the Save dialog that opens in PowerPoint without a repair prompt; the toast's "Open in PowerPoint" opens it.
- [ ] Present goes full screen from the current slide, arrow keys and Esc work, and no annotations show.
- [ ] Stop during a chat edit leaves the deck unchanged and says "Stopped. Nothing was changed."
- [ ] With no API key, Send shows the Connect Claude prompt and nothing is sent.

## 10. Open questions

1. **Region after sending:** the image keeps the loop and the label "Swap for a diagram" on the slide while the request runs; `../ai-pipeline.md` §6 clears regions after sending. The spec clears them and re-shows them on chip hover. Where does the short caption come from: her text (spec) or a summary from Claude?
2. **Draw and Sticky note** have no defined behaviour in the design docs. The spec makes Draw "marks for Claude" and Sticky note "private notes". Confirm, or drop them from v1.
3. **Speaker notes:** the Speaker notes plugin writes `slide.notes`, but the editor has nowhere to show notes. Add a collapsible notes strip under the stage?
4. **Style chip:** "Your style: Science" vs "Science KS3" elsewhere; no chevron although it's a menu. Is restyling a whole lesson from the chip wanted, or should the chip be read-only here?
5. **Add slide:** blank content slide (spec) or a menu of her slide types (Do Now, Key words…)?
6. Plugin tint names: `../plugin-architecture.md` says Worksheet is mint and Starter & plenary purple-soft; the image uses #DFF5D8 and #EAD9FF. Confirm token names in `../design-system.md`.
7. Resize handles for selected elements are "later" in `../deck-model.md` §4; v1 is move only. Confirm.
