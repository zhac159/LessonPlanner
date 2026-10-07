# 05 · New lesson (empty editor → generating)

![](../images/05-new-lesson.png)

**Purpose:** the editor before any slides exist. She tells the planning buddy what she's teaching (paste objectives or drop the LO document), sets year / length / ability / slide count, and presses "Make my slides". The same screen then shows the lesson **generating** until it becomes the normal editor (06).

Mockup source: `../canvas/project/NewLesson.dc.html` (board 1440×940). Generation pipeline: `../ai-pipeline.md` §4.4–4.6, §7. The generating state is described here but not drawn (`../README.md` open decision 3).

---

## 2. Owner & navigation

| Item | Value |
|---|---|
| Owning module | `deck-builder` (the chat lives inside it; README › Channel names). 05 and 06 are the **same editor view** in different states: no slides (05) vs slides (06) |
| Sidebar mode | Icon rail (72px, "focus mode"), Home item active |
| How you get here | Home PageHeader "New lesson"; Ctrl+N anywhere outside first run (intent `{ kind: 'new-lesson' }`). Home "Create lesson" skips the empty state and opens directly in **Generating** (§7) |
| Persistence | A new lesson is **not saved** until the first "Make my slides", "Blank slide" or "Start from a past lesson". Leaving an untouched new lesson leaves nothing behind on Home |

| Control | Goes to / does | Mockup href |
|---|---|---|
| Rail Home | 03 Home | `Main.dc.html` |
| Rail Styles | Styles (see 04 §2) | `StyleBuilder.dc.html` |
| Rail Plugins | Plugins page (placeholder) | `#` |
| Rail Settings | Settings | `ConnectClaude.dc.html` |
| Rail avatar | Settings › Profile | — |
| "My lessons" | 03 Home (generation, if running, carries on) | `Main.dc.html` |
| Style SelectChip | Menu of styles; "Create a new style…" → 04 | — |
| "Start from a past lesson" | Dialog to pick a past lesson; the copy opens in 06 | — |
| "Blank slide" | Creates the lesson with one blank slide; shows 06 | — |
| "Make my slides" | Starts generation (this screen, Generating state), ending in 06 | `Editor.dc.html` |

## 3. Layout

```
┌ TitleBar 40 ───────────────────────────────────────────────────────────────────────────┐
├ Rail 72 ┬ Header: [‹ My lessons]   [ Untitled lesson ]   [Your style ▾][Present][Export] ┤
│  ⌂      ├───────────────────────────────────────────────────┬───────────────────────────┤
│  🎨     │  SlideStage (EmptyState, dashed, 16:9, max 900)    │ ChatPanel                 │
│  ⊞      │                                                   │  CardHeaderBand (yellow)  │
│         │                                                   │  transcript (scrolls)     │
│  ⚙      │  Filmstrip placeholders ▭ ▭ ▭ ▭                    │  Composer (pinned)        │
│  (A)    │                                                   │                           │
└─────────┴───────────────────────────────────────────────────┴───────────────────────────┘
```

| Region | Size and behaviour (from the mockup) |
|---|---|
| Rail | 72px, white, 2px ink right border, padding 14px 0, column, gap 8px, items centred. Items 44×44, radius 12px, 20px icons, icon-only with tooltip and `aria-label` ("Home", "Styles", "Plugins", "Settings"). Active: orange fill, 2px ink, shadow 2px. Spacer, Settings, then a 34px lilac avatar with the initial (`aria-label` "{name}") |
| Header | Row, wraps, padding 14px 20px, gap 14px. "My lessons" (44px secondary pill, chevron). Title area `flex: 1`, min-width 200px, centres a TextField 320px wide (max 100%), 40px, 2px dashed #B9B1D9, radius 10px, transparent, centred text, display font 700 18px. Style SelectChip (44px pill, style tint fill, 12px dot). Present and Export to PowerPoint Buttons (44px, radius 12px; here disabled: #B9B1D9 border, #6B6485 text, transparent) |
| Body | Row, padding 4px 20px 20px, gap 20px. **Fills the remaining viewport height; the page itself never scrolls** |
| Main column | `flex: 999 1 600px`, column, centred, gap 16px |
| SlideStage (empty) | Width 100%, max-width 900px, 16:9, 2px dashed ink, radius 14px, white, centred column gap 14px, padding 24px. Scales down so stage + filmstrip fit the body height: `width = min(900px, column width, (body height − 110px) × 16/9)` |
| EmptyState contents | 72px icon tile (highlight yellow, 2px ink, radius 20px, shadow 4px, 34px monitor icon); title 28px display 800; body 16px / 1.5, max-width 440px, ink-2; row of two 44px secondary pill Buttons (gap 10px, margin-top 6px) |
| Filmstrip (placeholder) | Same width as the stage; four 132px 16:9 slots, 2px dashed #B9B1D9, radius 10px, gap 12px. Decorative (`aria-hidden`) |
| ChatPanel | `flex: 1 1 400px`, column, white, 2px ink, radius 22px, shadow 6px; height = body height. CardHeaderBand (yellow, 2px ink bottom border, padding 16px 18px, gap 12px): 40px white circle with pencil icon + title 18px display 800 + subtitle 13px. Transcript: `flex: 1`, padding 18px, column gap 16px, scrolls. Composer area: padding 14px 18px 18px, pinned at the bottom |
| Composer (this screen) | Column gap 8px, padding 10px, 2px ink, radius 18px, white, **4px highlight-yellow outer ring** (attention while the lesson is empty). TextArea 7 rows, no border. Action row: + IconButton (44px circle) · paperclip IconButton (44px circle) · spacer · primary Button "Make my slides" (44px pill, orange, shadow 3px, 800, arrow) |

**Narrower windows.** In the markup the ChatPanel wraps under the main column when `600 + 20 + 400 > body width`, i.e. below a ~1190px window. Do **not** wrap at supported widths: use ChatPanel `flex: 0 1 400px; min-width: 340px` and main `flex: 1 1 560px; min-width: 0`, so at 1100px the panel is ~340px and the stage ~600px. Same rule in 06 and 07. Below the 1100px minimum, wrapping is acceptable.

## 4. Components

| Component | Variant / notes |
|---|---|
| TitleBar | Standard |
| Sidebar | Rail (72px) |
| PageHeader | Editor variant: back Button, inline title TextField, SelectChip, Buttons |
| Button | Secondary pill ("My lessons", "Start from a past lesson", "Blank slide"), secondary disabled ("Present", "Export to PowerPoint"), primary pill ("Make my slides") |
| TextField | Inline title (dashed when empty or focused; plain text otherwise) |
| SelectChip | Style chip (44px); set-up chips (40px, 14px / 700). The Year chip uses the year tint (Year 8 mint #DFF5D8) |
| SlideStage | Empty variant hosting an EmptyState |
| EmptyState | Icon tile, title, body, actions |
| Filmstrip | Placeholder variant (4 dashed slots); skeleton and filled variants in Generating |
| SlideThumb | Skeleton (Generating) and real |
| ChatPanel | With CardHeaderBand |
| CardHeaderBand | Yellow, avatar + title + subtitle |
| MessageAssistant | Heading variant (title 20px display 800 + paragraph) for the intro |
| Dropzone | Chat variant: `button`, dashed 2px ink, radius 16px, cream fill, padding 22px 16px, 26px file-upload icon, title 800, line 13px |
| Composer | Tall (7 rows) with attention ring |
| IconButton | + ("Plugins", `aria-haspopup="menu"`, `aria-expanded`), paperclip ("Attach a file") |
| AttachmentCard | In the Composer after attaching / dropping a document |
| MessageUser, MessageProgress, ResultChip | Generating state |
| PluginMenu | If + is pressed on an empty lesson (tiles disabled, §8) |
| Dialog | "Choose a past lesson" |

## 5. Content & copy

| Element | Text | Dynamic? |
|---|---|---|
| Back | "My lessons" | — |
| Title placeholder | "Untitled lesson" | Filled automatically from the plan (§8) or typed |
| Title label (hidden) | "Lesson title" | — |
| Style chip | "Your style: Science KS3" | "Your style: {style name}"; "Plain style" when none |
| Present | "Present" | Disabled until slides exist |
| Export | "Export to PowerPoint" | Disabled until slides exist |
| EmptyState title | "Your slides will appear here" | — |
| EmptyState body | "Tell the planning buddy what you’re teaching. Paste your learning objectives or drop the document they’re in." | — |
| EmptyState buttons | "Start from a past lesson" · "Blank slide" | — |
| Panel title | "Your planning buddy" | — |
| Panel subtitle | "Knows your Science style" | "Knows your {style name} style"; plain style: "Ready to plan with you" **(new)** (see Open questions on the short name) |
| Intro heading | "What are we teaching?" | — |
| Intro body | "Paste your learning objectives, or drop the document they’re in. It also helps to tell me the year group, how long the lesson is, and anything the class finds tricky." | — |
| Set-up label | "Lesson set-up" | — |
| Set-up chips | "Year 8" · "50 min" · "Mixed ability" · "About 8 slides" | Year: "Year 7"…"Year 13", "Form time". Length: "{n} min" (30, 40, 45, 50, 60, 75, 90). Ability: "Mixed ability", "Higher ability", "Lower ability". Slides: "About {n} slides" (6, 8, 10, 12, 15) |
| Dropzone | "Drop your learning objectives" / "Word, PDF or PowerPoint · or click to browse" | — |
| Composer label (hidden) | "Message your planning buddy" | — |
| Composer text (image) | "Photosynthesis, Y8 set 3. Lots of them mix up respiration and photosynthesis." / "LO1: Describe where photosynthesis happens in a plant" / "LO2: Write the word equation for photosynthesis" / "LO3: Explain why photosynthesis is endothermic" | The image shows text she has pasted. Empty Composer placeholder **(new)**: "e.g. Photosynthesis, Y8 set 3. Lots of them mix up respiration and photosynthesis." / "LO1: Describe where photosynthesis happens in a plant" |
| Composer buttons | `aria-label` "Plugins", "Attach a file"; "Make my slides" | — |

**Generating and state copy (all new unless quoted from `../ai-pipeline.md`):**

| Moment | Copy |
|---|---|
| Set-up summary under her message | "Year 8 · 50 min · Mixed ability · About 8 slides" (12px muted) |
| MessageProgress steps | "Reading your objectives…" → "Planning about {n} slides…" → "Making slide {k} of {total}…" |
| MessageProgress stop | Button "Stop" |
| Composer while running | Send button becomes "Stop" (square icon) |
| Done (MessageAssistant, streamed from Claude) | e.g. "Done! 8 slides in your Science style — Do Now, tick-box objectives, key word chips and your yellow mini-whiteboard prompts." |
| Done ResultChip | "{n} slides added" + Button "Undo" |
| Stopped | "Stopped after {n} of {total} slides." + ResultChip "{n} slides added" + "Undo" + Button "Finish the rest" |
| Failed mid-way (`../ai-pipeline.md` §9) | README error line, then "{n} of {total} slides made — Finish the rest?" + Button "Finish the rest" |
| No key | README "Connect Claude" prompt as a MessageAssistant (action style) |
| Document reading | AttachmentCard subtitle "Reading…" → "{n} objectives found" / "Couldn’t read this file" |
| Disabled plugin tile tooltip | "Make your slides first" |
| Present / Export tooltip while generating | "Wait for the slides to finish" |
| Past lesson dialog | Title "Start from a past lesson"; search placeholder "Search lessons"; Button "Use this lesson" |

## 6. Data

```ts
'style-library:list' () → StyleSummary[]                      // style chip menu, default style (03 §6)
'settings:getPreferences' () → { lastYearGroup?: string; lastLengthMin?: number; lastAbility?: string }
'settings:aiStatusChanged' (event) → AiStatus                 // key present?

'deck-builder:pickLoDocument' () → Result<{ document: LoDocument } | { cancelled: true }>   // paperclip + Dropzone click (also .png/.jpg for the paperclip)
'deck-builder:importLoDocument' (args: { path: string }) → Result<{ document: LoDocument }>  // drop (README D-f)
'deck-builder:documentRead' (event) → { documentId: string; result: Result<{ objectives: string[]; title?: string; yearGroup?: string; durationMin?: number }> }
   // main runs extractObjectives (ai-pipeline.md §4.4) right after import, if a key is present

'deck-builder:createLesson' (req: CreateLessonRequest) → Result<{ lessonId: string; jobId: string | null; messageId: string | null }>
interface CreateLessonRequest {
  objectivesText: string                  // the Composer text
  documentIds: string[]                   // attached LO documents (max 3)
  styleId: string | null
  title: string | null                    // only if she typed one
  meta: Partial<LessonMeta>               // yearGroup, durationMin, ability, targetSlideCount (deck-model.md §2)
  startGeneration: boolean                // true for "Make my slides"
  blankSlide?: boolean                    // "Blank slide"
}
'deck-builder:generate' (args: { lessonId; text: string; documentIds: string[]; meta: Partial<LessonMeta> }) → Result<{ jobId; messageId }>
   // when the lesson already exists (e.g. after undoing a generation)
'deck-builder:finishGeneration' (args: { lessonId }) → Result<{ jobId; messageId }>   // "Finish the rest"
'deck-builder:cancel' (args: { jobId }) → void
'deck-builder:renameLesson' (args: { lessonId; title }) → Result                     // a setMeta ChangeSet (one undo step)
'deck-builder:listLessons' () → LessonSummary[]                                        // past-lesson dialog
'deck-builder:duplicateLesson' (args: { lessonId }) → Result<{ lesson: LessonSummary }>

// Events (ai-pipeline.md §7)
'deck-builder:gen-progress' → { lessonId; stage: 'reading' | 'planning' | 'writing' | 'done' | 'error'; done: number; total: number; message?: string; title?: string }
   // title: proposed addition, sent once the plan exists, so the header fills early
'deck-builder:slide-ready' → { lessonId; slide: Slide; index: number }
'chat:delta'   → { lessonId; messageId; text: string }
'chat:changes' → { lessonId; changeSet: ChangeSet }   // the whole generation, committed once at the end (one undo step)
'chat:done'    → { lessonId; messageId; usage }
'ai:error'     → { scope: 'generation'; code: AiErrorCode; message: string; retryable: boolean }
```

- Storage: `lessons/<id>/deck.json`, `changes.jsonl`, `chat.jsonl`, `assets/` (LO documents move here from a temporary inbox on create) (`../deck-model.md` §7).
- Set-up choices are saved as preferences when the lesson is created.
- The renderer shows slides from `slide-ready` immediately; the deck on disk changes once, when the ChangeSet commits.

## 7. States

| State | What it looks like |
|---|---|
| Empty (default) | As the image, but with an empty Composer showing the placeholder. Present/Export disabled. Make my slides disabled until there is text or an attachment |
| Ready to send | As the image: Composer has text, Year chip shows "Year 8" (detected from "Y8"), Make my slides enabled |
| Document attached | AttachmentCard(s) above the TextArea inside the Composer (FileTypeBadge, name, "Reading…" then "{n} objectives found", × remove). Detected year / length update their chips only if she hasn't changed them |
| No API key | Everything usable; pressing Make my slides adds the Connect Claude prompt to the transcript and sends nothing. The document isn't read until there is a key |
| **Generating** (not drawn) | 1. Her message appears as a MessageUser (attachments + text) with the set-up summary under it. The intro stays; the set-up group and the Dropzone are removed from the transcript. 2. A MessageProgress (dashed card, animated dots, step text, "Stop") follows. 3. When the plan arrives: the header title fills in (if empty), and the filmstrip shows `total` **skeleton** SlideThumbs (shimmer; number badges under them). 4. Each `slide-ready` swaps its skeleton for the real thumbnail (150ms fade); slides may finish out of order. 5. The first finished slide replaces the EmptyState on the SlideStage and is selected; later slides don't steal the selection. 6. The ToolRail appears with every tool disabled except Select (view only). 7. Style chip disabled; Present/Export disabled with the "Wait…" tooltip; the Composer drops its yellow ring and shrinks to 2 rows; its send button reads "Stop" |
| Done | MessageProgress is replaced by the streamed MessageAssistant + ResultChip "{n} slides added" + Undo. Everything enabled. The screen is now 06 |
| Stopped | Finished slides are kept as one ChangeSet; "Stopped after…" message with Undo and "Finish the rest" |
| Error mid-way | Finished slides kept; error MessageAssistant with "Finish the rest" (retry) |
| Undo the generation | All generated slides removed; the stage returns to this empty state (the lesson and chat remain, the set-up group does not come back; chips can be set by typing) |
| Offline | Make my slides proceeds and fails fast with the README network copy; the draft text is restored to the Composer |
| Long content | Composer grows with content up to 12 rows, then scrolls. Very long pasted text (> 20,000 characters) is accepted; attaching a document is suggested in a hint under the Composer: "That’s a lot of text. Attaching the document may work better." **(new)** |

## 8. Interactions & behaviour

1. **On open:** focus the Composer TextArea. Defaults: style = default style; set-up chips from preferences (else Year: none chosen → chip reads "Year group" **(new)**, 50 min, Mixed ability, slides from the length rule below).
2. **Typing in the Composer:** if the text mentions a year ("Y8", "Year 8", "yr 8") or a length ("50 minutes", "50 min") and she hasn't touched that chip, update the chip (local regex, no AI). Everything else is left to `extractObjectives` in main.
3. **Keys in this Composer:** **Enter adds a new line** (objectives are multi-line); **Ctrl+Enter = Make my slides**. (In 06 the Composer sends on Enter. The difference is deliberate: the first message starts a costly generation.)
4. **Set-up chips:** each opens a ContextMenu (arrow keys, Enter, Esc). Slide count follows the length until she picks one: 30 → 6, 40 → 6, 45 → 8, 50 → 8, 60 → 10, 75 → 12, 90 → 15.
5. **Dropzone / paperclip / drop on the panel:** attach up to 3 documents (`.docx`, `.pdf`, `.pptx`; the paperclip also accepts `.png`, `.jpg`). Each becomes an AttachmentCard in the Composer. Main reads it (`documentRead` event).
6. **Title:** click (or Tab) into the title field to type. Enter or blur commits, Esc reverts. Max 80 characters. Before the lesson exists the title is kept locally and sent with `createLesson`; afterwards `renameLesson`. Once the title is set by hand, generation never overwrites it.
7. **Style chip:** ContextMenu of styles + "Create a new style…". Changing style before generating just changes `styleId`; the panel subtitle follows.
8. **Make my slides:**
   1. No usable key → Connect Claude prompt; stop.
   2. `createLesson({ …, startGeneration: true })` (or `generate` if the lesson exists).
   3. Clear the Composer; render the Generating state from the events (§7).
   4. Stop (in MessageProgress or the Composer) → `deck-builder:cancel({ jobId })`.
9. **Start from a past lesson:** Dialog with a search field and a grid of LessonCards (3 columns, no menus). "Use this lesson" (or double-click / Enter on a card) → `duplicateLesson` → the copy opens in 06 (this empty lesson is discarded; it was never saved).
10. **Blank slide:** `createLesson({ blankSlide: true, startGeneration: false })` → one empty slide using the style's title layout → 06 with Select active.
11. **+ (Plugins) on an empty lesson:** opens the PluginMenu (06 §8); tiles for plugins that need slides are disabled (`aria-disabled`) with the tooltip "Make your slides first".
12. **Leaving during generation:** "My lessons" or the rail just navigates; the job continues in main and the Home card shows "Making slides…". Returning shows the current state.

## 9. Acceptance criteria

- [ ] At 1440×940 the empty screen matches `05-new-lesson.png` (with the Composer text pasted in).
- [ ] At 1280×800 and 1100×800 the ChatPanel stays beside the stage and the page doesn't scroll; the Composer is fully visible.
- [ ] Pasting the photosynthesis text switches the Year chip to "Year 8" if it hadn't been touched.
- [ ] Enter adds a line; Ctrl+Enter or the button starts generation.
- [ ] With no API key, Make my slides shows the Connect Claude prompt and nothing is sent.
- [ ] After Make my slides the filmstrip shows skeletons for the planned count, then fills slide by slide; the stage shows slide 1 as soon as it exists.
- [ ] The title fills in automatically ("Y8 Science — Photosynthesis") unless she typed one.
- [ ] Present and Export stay disabled until generation finishes, then enable.
- [ ] Stop keeps finished slides, shows "Stopped after {n} of {total} slides." and Undo removes them all in one step.
- [ ] The whole generation is one undo step (one ChangeSet in `changes.jsonl`).
- [ ] Leaving mid-generation and coming back shows progress continued; Home showed "Making slides…".
- [ ] Opening New lesson and leaving without doing anything adds nothing to Home.
- [ ] "Blank slide" opens the editor with one empty slide in her style; "Start from a past lesson" opens a copy of the chosen lesson.

## 10. Open questions

1. **Stop semantics differ between docs:** `../build-plan.md` M6 says Stop keeps finished slides; `../ai-pipeline.md` §1/§9 says cancelling leaves the deck unchanged ("Stopped. Nothing was changed."). This spec keeps finished slides for **generation** and uses "nothing changed" for chat edits and plugins. Confirm.
2. **Composer example:** is the photosynthesis text a placeholder or prefilled text? The spec treats the image as "already pasted" and uses a shorter placeholder for the empty state.
3. **Style name in the chip and subtitle:** "Your style: Science KS3" here vs "Your style: Science" in 06/07, and "Knows your Science style". Is there a short name? The spec uses the full name everywhere.
4. **+ button on an empty lesson:** keep it (with disabled tiles) or hide it until slides exist?
5. **Ability options:** "Mixed ability / Higher ability / Lower ability" are a guess; teachers may want sets ("Set 3") or SEN notes. Free text?
6. Should the style SelectChip show a chevron (it's a menu)? The image has none.
