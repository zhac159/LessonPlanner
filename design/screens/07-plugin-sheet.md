# 07 · Plugin options sheet (Quiz)

![](../images/07-plugin-sheet.png)

**Purpose:** collect a plugin's options before it runs. The sheet temporarily replaces the chat panel's content; its form is **generated** from the plugin's input list, so new plugins need no new screens. Quiz is the example.

Mockup source: `../canvas/project/PluginSheet.dc.html` (board 1440×1080). Plugin manifest, input types and lifecycle: `../plugin-architecture.md` §2–4.

---

## 2. Owner & navigation

| Item | Value |
|---|---|
| Owning module | `deck-builder` (the plugin registry lives inside it; plugin code in `src/plugins/<id>/` per `../plugin-architecture.md` §5) |
| Sidebar mode | Icon rail (72px), as 06. Everything outside the chat panel (header, ToolRail, stage, filmstrip) stays as in 06 and remains usable |
| How you get here | 06 PluginMenu → a tile whose plugin has inputs. Later: a slash command (`/quiz`) with inputs to fill |

| Control | Goes to / does | Mockup href |
|---|---|---|
| Back arrow ("Back to chat") | Back to the chat; this sheet's values are kept for next time this session; the Composer draft is untouched | `Editor.dc.html` |
| "Cancel" | Back to the chat; changes in this sheet are discarded | `Editor.dc.html` |
| "Make quiz" | Runs the plugin, returns to the chat, which shows progress then the result | — |
| Header, rail, filmstrip | As 06 (selecting slides updates "Which slides?", §8) | — |

## 3. Layout

The sheet occupies exactly the ChatPanel's box (same size, border, radius 22px, shadow 6px). The rest of the screen is 06 (stage, ToolRail, filmstrip; hint pill only if Circle to edit is on).

| Region | Size and behaviour (from the mockup) |
|---|---|
| Sheet header (CardHeaderBand) | Fill = the plugin's tint (Quiz: peach #FFD6C9). Row, padding 14px 16px, gap 12px, 2px ink bottom border, radius 20px 20px 0 0. Back IconButton (44px circle, white, 2px ink, chevron). Title block (`flex: 1`): h2 19px display 800, subtitle 13px ink-2. Right: 44px decorative icon tile (white, 2px ink, radius 12px, the plugin's 22px icon) |
| Form | `form`, `flex: 1`, column gap 20px, padding 18px, scrolls vertically |
| Field group | `fieldset` without border; `legend` 15px / 800, margin-bottom 8px |
| RadioPill row | Wraps, gap 8px. Pill 40px, padding 0 14px, 2px ink, 14px; **selected** orange fill + 700; **unselected** white + 600. A native radio sits inside each pill (ink accent) |
| NumberStepper row | Label (`flex: 1`, 15px / 800) + control: 2px ink, radius 12px, overflow hidden; − (44×44, right border) · input (56×44, centred, 17px / 800) · + (44×44, left border) |
| Checkbox list | Column gap 6px; rows min-height 40px, gap 12px, 22px boxes, 15px |
| RadioCard list | Column gap 8px; card padding 12px 14px, 2px ink, radius 14px, gap 12px, 20px radio top-aligned; title 700 + description 13px; **selected** cream fill (#FFF4D6) + shadow 3px 3px 0 ink |
| Footer | Row, gap 10px, padding 14px 18px 18px, 2px soft-line top border (#E4DFF7). "Cancel" (44px secondary pill) · spacer · "Make quiz" (48px primary pill, orange, shadow 3px, 16px / 800, arrow). Always visible (the form scrolls above it) |

**Narrower windows.** The sheet follows the ChatPanel width (min 340px at a 1100px window). RadioPill rows wrap (as drawn: "Just slide 3" on a second line at 400px); RadioCards and checkboxes stack anyway. **Shorter windows:** the form scrolls; header and footer stay fixed.

## 4. Components

| Component | Variant / notes |
|---|---|
| PluginSheet | Container that swaps the ChatPanel's content; animates in from the right (200ms transform; none with reduced motion) |
| CardHeaderBand | Plugin-tint variant with back button, title, subtitle, icon tile |
| IconButton | Back (44px circle) |
| RadioPill | `choice` inputs with ≤ 4 short options, and `slideRange` |
| NumberStepper | `number` inputs |
| Checkbox | `multi` and `boolean` inputs |
| RadioCard | `choice` inputs with descriptions |
| TextField / TextArea | `text` inputs (not used by Quiz) |
| Select | `choice` inputs with more than 4 options and no descriptions (not used by Quiz) |
| Button | Secondary pill ("Cancel"), primary pill ("Make quiz") |
| Callout | Error/blocked states (§7) |

Mapping input type → component (from `../plugin-architecture.md` §4): `choice` → RadioPill if ≤ 4 options without descriptions, RadioCard if any option has a description, Select otherwise; `multi` → Checkbox list; `number` → NumberStepper; `text` → TextField (TextArea if `multiline`); `boolean` → Checkbox; `slideRange` → RadioPill with computed options.

## 5. Content & copy

All strings below except the "new" ones come from the **Quiz manifest**, not app code.

| Element | Text | Dynamic? |
|---|---|---|
| Back `aria-label` | "Back to chat" | App |
| Title | "Quiz from slides" | Manifest `title` (the tile shows `name` "Quiz") |
| Subtitle | "Quick-check questions in your format" | Manifest `description` |
| Field 1 legend | "Which slides?" | — |
| Field 1 options | "All 8 slides" · "Slides 3–7" · "Just slide 3" | Computed (§8): "All {n} slides" · "Slides {a}–{b}" (or "{m} selected slides" if not contiguous) · "Just slide {k}" |
| Field 2 label | "How many questions?" | — |
| Field 2 stepper | "10"; buttons `aria-label` "Fewer questions" / "More questions" | Value 3–30 |
| Field 3 legend | "Question types" | — |
| Field 3 options | "Multiple choice" ✓ · "True or false" ✓ · "Fill the gap (uses your key words)" · "Short answer" | Defaults ticked as shown |
| Field 4 legend | "Difficulty" | — |
| Field 4 options | "Mixed" · "Core" · "Stretch" | Default Mixed |
| Field 5 legend | "Where should it go?" | — |
| Field 5 cards | "Slides at the end of this lesson" / "In your style, with an answer slide"; "Printable quiz (Word)" / "A4 sheet plus a separate answer key"; "Both" | Default first |
| Footer | "Cancel" · "Make quiz" | Make label = manifest `action` |

**New copy:**

| Where | Copy |
|---|---|
| Multi validation | "Pick at least one question type." (generic: "Pick at least one.") under the fieldset |
| Number out of range (on blur, value clamped) | "Choose between 3 and 30." |
| Estimate (manifest `estimate`, under the footer, 12px muted, right-aligned) | "About 20 seconds" |
| No slides | Callout above the footer: "Make some slides first." |
| Job running | Helper under the footer: "Wait for the current change to finish." |
| No API key | README "Connect Claude" prompt as a Callout above the footer |
| Request bubble in chat | Mini tile (tint + icon) + "Quiz from slides" + summary "10 questions · All 8 slides · Mixed · Slides at the end of this lesson" |
| Progress steps | "Reading 8 slides…" → "Writing 10 questions…" → "Making the quiz slides…" → "Making the answer slide…" (Word: "Writing the Word file…") |
| Result | ResultChip "{n} quiz slides added" + "Undo"; Word: AttachmentCard "{lesson title} quiz.docx" / "Word document" with "Open" · "Show in folder" |

## 6. Data

```ts
'plugins:getManifest' (args: { pluginId: string }) → Result<{ manifest: PluginManifestView; lastInputs: Record<string, unknown> | null }>
interface PluginManifestView {          // the renderer-safe part of manifest.ts (plugin-architecture.md §2)
  id: string; name: string; title: string; description: string
  icon: string; tint: 'peach' | 'sky' | 'mint' | 'butter' | 'purple-soft'
  scope: 'lesson' | 'slides' | 'region'
  inputs: PluginInput[]
  output: Array<'slides' | 'file' | 'message'>
  action: string                        // "Make quiz"
  estimate?: string                     // "About 20 seconds"
  needsSlides: boolean
}
type PluginInput =
  | { id: string; type: 'slideRange'; label: string; default: 'all' | 'selected' | 'current' }
  | { id: string; type: 'number'; label: string; min: number; max: number; step: number; default: number; decrementLabel: string; incrementLabel: string }
  | { id: string; type: 'multi'; label: string; options: Array<{ value: string; label: string }>; default: string[]; minSelected?: number }
  | { id: string; type: 'choice'; label: string; options: Array<{ value: string; label: string; description?: string }>; default: string }
  | { id: string; type: 'text'; label: string; placeholder?: string; multiline?: boolean; maxLength?: number; required?: boolean }
  | { id: string; type: 'boolean'; label: string; default: boolean }

'plugins:run' (args: {
  pluginId: string
  lessonId: string
  inputs: Record<string, unknown>       // validated again in main against the manifest
  context: { currentSlideId: string; selectedSlideIds: string[]; regions?: RegionDraft[] }
}) → Result<{ jobId: string; messageId: string }>
'plugins:cancel' (args: { jobId }) → void

// Events: the chat events from 06 (chat:status, chat:delta, chat:changes, chat:done, ai:error with scope 'plugin'), plus
'plugins:file' (event) → { lessonId; messageId; file: { name: string; path: string; kind: 'docx' | 'pdf' | 'pptx' } }
```

**Quiz manifest inputs** (`src/plugins/quiz/manifest.ts`):

| id | type | label | options / range | default |
|---|---|---|---|---|
| `slides` | slideRange | "Which slides?" | computed | `selected` if more than one slide is selected, else `all` |
| `count` | number | "How many questions?" | 3–30, step 1 | 10 |
| `types` | multi | "Question types" | `mcq` "Multiple choice", `tf` "True or false", `gap` "Fill the gap (uses your key words)", `short` "Short answer"; `minSelected: 1` | `['mcq', 'tf']` |
| `difficulty` | choice | "Difficulty" | `mixed` "Mixed", `core` "Core", `stretch` "Stretch" | `mixed` |
| `destination` | choice | "Where should it go?" | `slides` "Slides at the end of this lesson" / "In your style, with an answer slide"; `docx` "Printable quiz (Word)" / "A4 sheet plus a separate answer key"; `both` "Both" | `slides` |

- Last-used inputs are saved per plugin (main, e.g. `plugins/<id>.last.json`) when a run starts, and returned by `getManifest`. `slides` is never restored from last time; it is recomputed from the editor state.
- Slides output: one ChangeSet (`by: 'plugin'`, `pluginId: 'quiz'`), inserted at the end of the lesson. Word output: saved to `lessons/<id>/assets/` and shown as an AttachmentCard.

> Implementation note (2026-10-06): plugin files are saved to `lessons/<id>/outputs/` (assets/ is for pictures and attachments), numbered when a name is taken; last-used inputs are kept for all plugins in one `plugin-inputs.json` next to `index.json`; the quiz has no separate "answer slide" toggle (the "slides" destination always adds the answer slide(s), as the card text says); the multi values are `mcq`, `tf`, `gap`, `short` as in the table above.

## 7. States

| State | What it looks like |
|---|---|
| Default | As the image: defaults (or last-used values), Make quiz enabled |
| Multi-selection in the filmstrip | "Which slides?" shows the middle option ("Slides 3–7") and selects it |
| Single slide selected | Only "All {n} slides" and "Just slide {k}" are shown |
| One-slide lesson | One pill "Just slide 1", selected |
| Invalid | No question type ticked: error under "Question types", `aria-invalid` on the group, Make quiz disabled |
| No slides | Make quiz disabled; "Make some slides first." Callout (normally unreachable because the tile is disabled) |
| Job running | Make quiz disabled with "Wait for the current change to finish." Back/Cancel work |
| No API key | Make quiz shows the Connect Claude prompt Callout instead of running; values kept |
| Running (after Make quiz) | The sheet has closed; the chat shows the request bubble, a MessageProgress with steps and "Stop" (`../plugin-architecture.md` §3) |
| Done | MessageAssistant (one or two sentences) + ResultChip "{n} quiz slides added" + Undo; new slides flash in the filmstrip. Word: AttachmentCard with Open / Show in folder. Both: both |
| Error | README AI error copy in the chat with "Try again" (re-runs with the same inputs). Stopped: "Stopped. Nothing was changed." |
| Long content | Form scrolls; header and footer fixed. Long option labels wrap inside RadioCards; RadioPill labels don't wrap (pills wrap to new rows) |

## 8. Interactions & behaviour

1. **Open:** from the PluginMenu. `plugins:getManifest` (cached per session). The sheet slides in over the chat panel content; the transcript and Composer are hidden but kept as they were. Focus moves to the sheet title (`tabindex="-1"`), so screen readers announce it.
2. **"Which slides?" options** are computed from the editor state every time the filmstrip selection changes while the sheet is open:
   - `all` → "All {n} slides".
   - `selected` → shown only when more than one slide is selected in the filmstrip (Shift+click / Ctrl+click, 06 §8.1): "Slides {a}–{b}" if contiguous, else "{m} selected slides".
   - `current` → "Just slide {k}" (the slide on the stage).
3. **NumberStepper:** − / + change by `step`; − disabled at `min`, + at `max`. ↑/↓ in the input step by 1, PageUp/PageDown by 5. Typing is digits only; on blur the value clamps into range (with the range message if it changed).
4. **RadioPill / RadioCard groups** use native radio keyboard behaviour (arrow keys move the choice within a group). Checkboxes toggle with Space.
5. **Make quiz** (also Ctrl+Enter anywhere in the sheet):
   1. Validate (multi minimum, required text, number range). If invalid, focus the first invalid group.
   2. No usable key → Connect Claude prompt; stop.
   3. `plugins:run({ pluginId, lessonId, inputs, context })`.
   4. Close the sheet (back to the chat), add the request bubble and a MessageProgress. Results arrive through the 06 chat events.
6. **Back arrow / Esc:** close the sheet without running. Values are kept in memory for this plugin until the app quits; reopening shows them.
7. **Cancel:** close the sheet without running and discard this session's edits (next open shows last-run values or defaults).
8. **Composer draft:** never touched by opening or closing the sheet; when the chat returns, focus goes back to the + button.
9. **Tab order:** Back → each field in order → Cancel → Make quiz. The icon tile in the header is decorative (`aria-hidden`).
10. **While the sheet is open** the rest of the editor works (select slides, Present, Export). Pressing + is impossible (the Composer is hidden); the ToolRail keeps its current tool.

## 9. Acceptance criteria

- [ ] At 1440×1080 with the fixture lesson and slide 3 selected, the screen matches `07-plugin-sheet.png` (with a 3–7 multi-selection for the middle option).
- [ ] The form is generated from the manifest: changing a label or default in `manifest.ts` changes the sheet with no UI code change.
- [ ] Each input type renders as the mapped component (RadioPill, NumberStepper, Checkbox list, RadioCard; TextField and Select for other plugins).
- [ ] Selecting slides 3–7 in the filmstrip while the sheet is open makes "Slides 3–7" appear; selecting one slide removes it.
- [ ] The stepper can't go below 3 or above 30; typing 45 clamps to 30 on blur.
- [ ] Unticking every question type disables Make quiz and shows "Pick at least one question type."
- [ ] Back returns to the chat with the Composer draft (text and region chips) unchanged; reopening Quiz shows the values she left.
- [ ] Cancel returns to the chat and the next open shows last-run values or defaults.
- [ ] Esc closes the sheet; Ctrl+Enter runs it.
- [ ] Make quiz with defaults closes the sheet, shows progress with Stop, then "{n} quiz slides added" with Undo; the quiz slides follow her style and include an answer slide.
- [ ] The whole quiz is one undo step.
- [ ] Choosing "Printable quiz (Word)" produces an AttachmentCard whose Open launches Word.
- [ ] With no API key, Make quiz shows the Connect Claude prompt and nothing is sent.

## 10. Open questions

1. **"Slides 3–7":** the image shows this option while only slide 3 looks selected. The spec ties it to a filmstrip multi-selection (`../plugin-architecture.md` §4 "All / Selected / This slide"). Confirm, and confirm multi-select in the filmstrip.
2. **Answer slide:** `../plugin-architecture.md` §6 lists an "answer slide" input; the sheet has none (the RadioCard says "with an answer slide"). The spec always adds one for slide output.
3. **Estimate:** the manifest's `estimate` ("About 20 seconds") isn't drawn. The spec puts it under the footer; drop it?
4. **Back vs Cancel:** is the difference (keep vs discard values) worth having, or should both simply close?
5. **Where the Word file goes:** the spec keeps it in the lesson folder with Open / Show in folder. Should it ask where to save, like Export?
6. In the image no ToolRail tool is active; the spec keeps the previous tool (normally Select).
