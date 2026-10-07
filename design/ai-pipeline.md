# AI pipeline — every Claude call the app makes

How the app uses Claude: which calls, what goes in, what comes out, how edits reach the deck, and how errors and costs are handled.

> **Before writing any code that calls Claude, invoke the `claude-api` skill** (the code ROADMAP says the same). It holds the current model IDs, SDK method names, structured-output syntax, PDF limits and prompt-caching rules. API details below were checked on 2026-10-06 but will drift. Where this doc and the skill disagree on an API detail, the skill wins. Where they disagree on *behaviour*, this doc wins.

---

## 1. Ground rules

| Rule | Why |
|---|---|
| Every Claude call runs in the **main process** (a module's `main.ts`). The renderer only sends intents and receives events | The API key must never reach page code (code decision D5) |
| The API key is stored with Electron `safeStorage` and read only when building the client | `claude-access.md` |
| SDK: `@anthropic-ai/sdk` (TypeScript). One shared client factory, e.g. `src/main/ai/client.ts` | Same retries, timeouts and headers everywhere |
| Claude changes decks **only** through `DeckOp`s (`deck-model.md` §3), never free text or HTML | Validated and undoable |
| Long calls **stream**; progress goes to the UI with `ctx.emit` | Nothing looks frozen; chat text appears live |
| Every call can be **cancelled** (AbortController). Cancelling a chat edit or plugin leaves the deck unchanged; cancelling a **generation** keeps the slides already finished, as one ChangeSet | Stop button in Composer and in progress messages |
| Every call logs usage to `usage.jsonl` | Cost shown in Settings (§10) |

## 2. Models and request defaults

| Setting | Value |
|---|---|
| Default model | `claude-opus-5-5` (Settings › Model, "best quality") |
| Cheaper option | `claude-sonnet-5-5` ("faster and cheaper") |
| Thinking | Adaptive. On Claude Opus 5.5 thinking is always on and can't be disabled; tune with **effort** |
| Effort (`output_config.effort`) | Set explicitly per task (table §4). Opus 5.5 defaults to `medium` |
| Structured results | `output_config.format` with a JSON schema (structured outputs). Forced `tool_choice` (`any`/`tool`) is **rejected** by Opus 5.5 / Sonnet 5.5; use `auto` + `strict: true` tools where tools are needed |
| Refusals | Check `stop_reason === 'refusal'` before reading content. Enable server-side fallbacks (`fallbacks: "default"` with the `server-side-fallback-2026-07-01` beta) as the skill recommends |
| No assistant prefill | Not supported on current models; use instructions or structured outputs |
| Streaming | Required for anything that may exceed ~16k output tokens; use the SDK's final-message helper when only the end result matters |
| Images & PDFs | Sent as `image` / `document` content blocks (base64). PDFs: check page and size limits in the skill |

## 3. Prompt layout and caching

Order every request **stable → volatile** so the prompt cache hits. A cache hit costs about a tenth of fresh input.

```
system:
  [A] App instructions for this task type              ← never changes        (cache breakpoint 1)
  [B] Deck-model schema summary + allowed element types  ← never changes
  [C] StyleProfile JSON + exemplars                       ← changes rarely       (cache breakpoint 2)
messages:
  [D] Lesson meta + objectives                            ← per lesson
  [E] …conversation turns (append-only)…                  ← grows                (automatic/last breakpoint)
  [F] Latest user turn (+ deck snapshot / region images)  ← volatile
```

- Never put timestamps, random ids or "current time" in [A]–[C].
- Serialise JSON with stable key order.
- **Append-only history:** current models check that earlier turns, including thinking blocks, are unchanged ("preserved thinking"). Store and replay the API's raw content blocks exactly as received. Never edit or trim earlier turns; use the API's compaction feature if a chat ever gets huge (see the skill).

## 4. The calls

| # | Call | When | Input | Output | Effort | Stream |
|---|---|---|---|---|---|---|
| 4.1 | `analyseStyleFile` | Each imported deck | PDF document block **or** `.pptx` digest JSON + theme facts | `FileAnalysis` (structured) | medium | no |
| 4.2 | `synthesiseProfile` | After all files (and when files are added) | All FileAnalyses + vote counts + candidate exemplars | `StyleProfile` + `testSlide` (structured) | high | yes |
| 4.3 | `applyStyleCorrection` | CorrectionBox | Profile + correction text | `{ patch: JsonPatchOp[], message }` | low | no |
| 4.4 | `extractObjectives` | LO document uploaded / long paste | `.docx` text (via `mammoth`), PDF block or `.pptx` digest | `{ title, subject?, yearGroup?, objectives[], context? }` | low | no |
| 4.5 | `planLesson` | "Make my slides" | Profile [C] + meta + objectives | `LessonPlan` (structured) | medium | yes (progress) |
| 4.6 | `writeSlide` ×N | After the plan, **3 in parallel** | Profile [C] + plan + this slide's brief + neighbouring slide titles | `Slide` (structured) | medium | per slide |
| 4.7 | `chatTurn` | Every editor chat message | Profile [C] + history + deck outline + the user turn (+ regions) | Streamed text + tool calls → `ChangeSet`s | medium (high for "redo the whole lesson") | yes |
| 4.8 | Plugin runs | From the PluginSheet | Defined by each plugin (`plugin-architecture.md`) | Slides / file / message | per plugin | yes |
| 4.9 | `testConnection` | Connect Claude › Test | Tiny prompt (`max_tokens` ≈ 16) | ok / typed error | low | no |

### 4.1 `FileAnalysis` (structured output)
```ts
interface FileAnalysis {
  colors: Array<{ hex: string; role: 'background'|'text'|'accent'|'highlight'|'chip'|'other'; evidence: string; frequency: 'most'|'many'|'some' }>
  fonts: Array<{ family: string; usedFor: 'title'|'body'|'other'; sizePt?: number; weight?: number }>
  layouts: Array<{ name: string; description: string; regions: Array<{ name: string; elementType: string; x: number; y: number; w: number; h: number }>; pages: number[] }>
  decorations: Array<{ description: string; shape?: string; x?: number; y?: number; w?: number; h?: number; color?: string }>
  slideKinds: Array<{ page: number; kind: SlideKind; title?: string }>
  voice: { rules: string[]; phrases: string[]; spelling: 'en-GB'|'en-US'|'unknown' }
  habits: string[]
  exemplarCandidates: Array<{ page: number; why: string }>
  problems?: string[]          // "pages 4–9 are scanned images", "mostly a worksheet, not slides"
}
```

### 4.5 `LessonPlan` (structured output)
```ts
interface LessonPlan {
  title: string                  // "Y8 Science — Photosynthesis"
  summary: string                // one paragraph shown in chat
  slides: Array<{
    kind: SlideKind
    layoutId: string             // must exist in the profile
    purpose: string              // "Retrieval starter on last lesson (respiration) to surface the misconception"
    keyContent: string[]         // bullet facts / questions to include
    minutes?: number
    objectiveRefs: number[]      // which LOs it serves (indexes)
  }>
}
```
- **Validate:** every objective is covered, `layoutId`s exist, and the slide count is within ±2 of the target.
- **Then** call `writeSlide` for every planned slide, 3 at a time. Each finished slide is inserted with its own `insertSlides` op and pushed to the UI, so the filmstrip fills up live. The whole generation is still **one** ChangeSet for undo, committed at the end.

### 4.6 `writeSlide` rules (in the prompt)
- Place elements on the chosen layout's regions. Coordinates must stay inside 1920×1080.
- Include the layout's decorations as `locked` shapes.
- Use colour tokens. Two-tone titles use runs (`color: "token:accent"` on the last words) when the profile says so.
- Respect the text budget per region:
  - title ≤ 8 words
  - bullets ≤ 12 words each, at most 4 per box
  - callout ≤ 20 words
- Pictures: emit an `image` with a `placeholder.description` (the app has no image search yet). For labelled scientific or process diagrams, emit a `diagram` element with SVG (rules in `deck-model.md` §6) **only** when it will be clear and correct; otherwise use a placeholder.
- Write speaker notes in the teacher's voice: 2–4 sentences, including timings and likely misconceptions.

## 5. Editor chat: tools

`chatTurn` runs a tool loop. The SDK's tool runner can drive it (check the skill for the TypeScript helper), or a manual loop. All tools use `strict: true` and `tool_choice: auto`.

> Implementation note (2026-10-06): `apply_changes` and `run_plugin` are **not** `strict`: their inputs are open-ended objects (deck operations with partial element patches, plugin inputs) that strict schemas cannot express (`additionalProperties: false` everywhere). They are validated in code instead, and `apply_changes` is retried once on invalid ops as specified. The other tools are strict. Structured outputs (`FileAnalysis`, `LessonPlan`, slides, style drafts) use "wire" schemas with no optional fields and no open maps (`"" / 0 / false` mean "not set"; colours and components are arrays); mappers in `src/main/ai/schemas/` convert them to the types in this document. The loop runs the model's tool calls in order and ends the turn when `apply_changes` is rejected twice in a row.

| Tool | Input | Does | Returns |
|---|---|---|---|
| `read_slides` | `{ slideIds: string[] }` | Returns full `Slide` JSON for those slides | JSON |
| `view_slide` | `{ slideId: string }` | Renders the slide to PNG at 1280×720 (offscreen `SlideView`) so Claude can check how it looks | image block |
| `apply_changes` | `{ summary: string, ops: DeckOp[] }` | Validates + applies as one ChangeSet, pushes `chat:changes` to the UI | `{ ok, changeSetId }` or `{ ok:false, errors[] }` |
| `run_plugin` | `{ pluginId: string, inputs: object }` | Runs a plugin the teacher asked for in words ("make a quiz") with sensible defaults | Plugin result summary |
| `list_plugins` | `{}` | Enabled plugins + their input schemas | JSON |

**Context sent each turn** (in [F]):
- The **deck outline**: for each slide, `id`, `kind`, title text, element ids with `name`/`type`, and a "doesn't fit" flag.
- Full JSON for the selected slide and any slide with a region on it.
- Claude calls `read_slides` for anything else.

**Behaviour rules** (in the system prompt):
- Make the smallest change that satisfies the request.
- Don't touch slides that weren't mentioned.
- After `apply_changes`, reply in **one or two sentences** saying what changed. The UI shows the ChangeSet as a ResultChip with Undo.
- Ask a question instead of guessing when the request is ambiguous **and** a wrong guess would be costly (e.g. "delete the practical?" when there are two practical slides).
- If `apply_changes` returns errors, fix them and call it again **once**. If it fails twice, explain plainly.

## 6. Circle to edit (region edits)

What the teacher sees is in `screens/06-editor.md`. Under the hood:

1. **Capture.** The RegionOverlay records the pointer path in slide units. On release, the path is closed and simplified (Ramer–Douglas–Peucker, tolerance 4 units). The result is a `Region`:
   ```ts
   interface Region { id: string; n: number; slideId: string; path: Array<[number, number]>; bbox: { x: number; y: number; w: number; h: number } }
   ```
2. **Hit-test** each element box against the region polygon. An element is **targeted** if ≥ 30% of its area is inside, or the region lies mostly inside the element. Record `targetElementIds`, sorted by overlap.
3. **Images:** in main, render the slide to PNG (1280×720) with the loop drawn on it in the region colour and its number. Also render a **crop** of the bbox plus 10% padding at 2× resolution.
4. **Message.** The user turn contains:
   - the teacher's text
   - for each region: the annotated full-slide image, the crop, and a text block such as `Region 1 on slide 3 (id s3) targets elements: e3-photo (image "Photo: leaf in sunlight"). Region bbox: x 1075, y 300, w 790, h 550.`
   - the full JSON of that slide
5. **Claude answers** with `apply_changes`, e.g. `replaceSlide`, or `removeElement` + `addElement` of a `diagram` in the same box.
6. **Cleanup.** Regions clear from the slide and the Composer after the message is sent. They stay visible in the sent message as RegionChips, and hovering a chip re-highlights the area.

Multiple regions (1, 2, 3…) can be in one message, even on different slides. The text can refer to them as "1" and "2".

## 7. Events to the UI (main → renderer)

| Channel | Payload | Used for |
|---|---|---|
| `deck-builder:gen-progress` | `{ lessonId, stage: 'reading'|'planning'|'writing'|'done'|'error', done: number, total: number, message?: string, title?: string }` | MessageProgress, filmstrip skeletons |
| `deck-builder:slide-ready` | `{ lessonId, slide: Slide, index: number }` | Fill the filmstrip one by one |
| `chat:delta` | `{ lessonId, messageId, text: string }` | Streaming assistant text |
| `chat:status` | `{ lessonId, messageId, step: string, state: 'running'|'done'|'error' }` | Progress steps ("Reading the circled area ✓") |
| `chat:changes` | `{ lessonId, changeSet: ChangeSet }` | Apply to the local deck store, show ResultChip |
| `chat:done` | `{ lessonId, messageId, usage }` | End of turn |
| `ai:error` | `{ scope, code, message, retryable }` | Friendly error states (§9) |
| `style-library:progress` | `{ styleId, sourceId, status, partialProfile? }` | Create a style live panel |

Progress step text can come from the app (known stages) or from Claude's between-tool progress notes. Current models can return short progress summaries; see "thinking display: updates" in the skill.

## 8. Chat storage

`lessons/<id>/chat.jsonl`, one record per message, append-only:
```ts
interface ChatRecord {
  id: string
  role: 'user' | 'assistant'
  at: string
  ui: {                                   // what the ChatPanel shows
    text: string
    attachments?: Array<{ name: string; kind: 'docx'|'pdf'|'pptx'|'image' }>
    regions?: Array<{ n: number; slideNumber: number }>
    changeSetIds?: string[]
    pluginId?: string
  }
  api: unknown[]                          // the exact content blocks sent/received, replayed verbatim
  usage?: Usage
}
```

## 9. Errors (what the teacher sees)

Map SDK error classes (typed exceptions, never string matching) to friendly messages. Show them as a MessageAssistant with an error style and a single action.

| Case | Message | Action |
|---|---|---|
| No key / auth error | "Claude isn't connected. Add your API key to keep going." | Open Settings › AI |
| Out of credit / billing | "Your Claude account is out of credit." | Open platform.claude.com |
| Rate limited / overloaded | (auto-retry with backoff ×3, then) "Claude is busy right now. Try again in a minute." | Retry |
| Network | "Can't reach Claude. Check your internet connection." | Retry |
| Refusal (after fallback) | "Claude couldn't help with that request." | — |
| Invalid ops twice | "I couldn't make that change cleanly. Nothing was changed." | Retry / Rephrase |
| Output cut off (`max_tokens`) | Retry automatically once with a higher limit, then show the partial result as a draft | — |
| Cancelled (chat edit / plugin) | "Stopped. Nothing was changed." | — |
| Cancelled (generation) | "Stopped after 5 of 8 slides." | Finish the rest |

A failed generation keeps any slides already finished ("5 of 8 slides made — Finish the rest?").

## 10. Usage and cost

- Log every response's `usage` (input, output, cache read, cache write) with the model and task to `usage.jsonl`.
- Settings › AI shows "This month: about $X". Use a price table kept in one file, `src/shared/ai/prices.ts`, that's easy to update.

Rough cost per action with **Claude Opus 5.5** at the published API rates on 2026-10-06 ($4 per million input tokens, $20 per million output, cache reads $0.20 per million). These are planning numbers, not promises; check real usage in the Claude Console.

| Action | Assumptions | Rough cost |
|---|---|---|
| Create a style from 20 decks | ~15 pages each, ~2.5k tokens per page, ~3k output per file + synthesis | **$4–5 once** |
| Generate an 8-slide lesson | plan + 8 slide calls, profile cached | **~$0.70** |
| A chat edit or circle edit | ~25k input mostly cached, 2–4k output | **$0.05–0.12** |
| A plugin run (quiz) | like 2–3 slide calls | **$0.15–0.30** |

Claude Sonnet 5.5 ($2 / $10 per million) costs roughly half. Cached input is what keeps edits cheap, so protect the cache layout (§3).

## 11. Prompts (starting drafts — iterate with real decks)

### [A] Slide writer (used by 4.5, 4.6, 4.7)
```
You are the lesson-slide author inside a teacher's planning app. You write slides that look and sound like
the teacher made them herself.

You work only through the deck model described below. Coordinates are 1920×1080 units. Colours must be
style tokens ("token:accent"), not hex, unless drawing a diagram.

Follow the style profile exactly: its layouts, decorations, fonts, colour roles, slide types, lesson flow
and voice rules. Prefer her habits over generic presentation advice. Keep text short enough for a
classroom: titles ≤ 8 words, bullets ≤ 12 words, no more than 4 bullets in a box.

Use British English unless the profile says otherwise. Never invent facts. For science, maths and other
subject content, be accurate at the stated year group's level and address the misconceptions the teacher
mentions. Use placeholders for photos. Draw a diagram (SVG) only when you can make it clear and correct.
```

### [A] Editor chat (4.7)
```
You are the teacher's planning buddy, editing an existing lesson deck with her. She sees the slides next
to this chat.

Make the smallest change that does what she asked, using apply_changes. Don't change slides she didn't
mention. Regions she circled are attached as images plus the element ids they cover; "this", "here" and
"it" refer to those regions. After a change, reply in one or two friendly sentences saying what you
changed. Ask a short question only if the request is ambiguous and a wrong guess would waste her time.

If she asks for something a plugin does (a quiz, worksheet, differentiated versions, speaker notes,
starter/plenary), use run_plugin.
```

### [A] Style analyst (4.1, 4.2)
```
You are analysing a teacher's own slide decks to learn her visual and teaching style so new slides can
match it. Report what she actually does, with evidence (page numbers), not what good design would be.
Distinguish her consistent habits from one-offs. Colours: give hex values and their role. Fonts: family,
typical sizes. Layouts: approximate boxes on a 1920×1080 grid. Also note recurring slide types (Do Now,
objectives, key words, mini-whiteboard questions…), decorations, and how she writes (spelling,
tone, recurring phrases). If pages are unreadable or not slides, say so in problems.
```

## 12. Quality checks (build an eval early)

Keep `design/fixtures/` as the starting golden set and add 3 real LO sets from the teacher. For each generated lesson, check automatically:
- the JSON is valid
- every objective is covered
- only profile tokens and layouts are used
- no text overflows
- the slide count is within range

Check by hand, on a 1–5 rubric:
- **Looks like hers:** the teacher's own verdict.
- **Accurate content:** facts are correct.
- **Right level:** pitched for the stated year group.
- **Usable as is:** she could teach from it without edits.

Re-run after any prompt or model change.
