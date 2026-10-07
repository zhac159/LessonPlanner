# Plugins — the "+" menu

Goal: when someone asks for a new feature ("can it make a worksheet?"), it gets added as a **plugin**: one folder, with no changes to screens, the editor or the chat.

> **Terminology** (matches the code repo): a **module** is a code feature area that appears as a page, under `src/modules/<id>/`. A **plugin** is a capability the teacher triggers from the **+** menu in the chat Composer. Plugins live *inside* the lesson editor (`deck-builder` module) as a second registry.

Screens: PluginMenu in [screens/06-editor.md](screens/06-editor.md) (`images/06-editor.png`); PluginSheet in [screens/07-plugin-sheet.md](screens/07-plugin-sheet.md) (`images/07-plugin-sheet.png`).

---

## 1. Where plugins show up

| Surface | What it shows |
|---|---|
| **PluginMenu** (the + button in Composer) | A 2-column grid of PluginTiles (pastel colour + icon + name) and a "More plugins" tile. Header: "What shall we make?" with a **Manage** link |
| **Chat in plain words** | "Make me a quiz on slides 3–7". Claude calls `run_plugin` (`ai-pipeline.md` §5) |
| **PluginSheet** | The plugin's options form. It temporarily replaces the chat panel; the back arrow returns to the chat with the draft message kept |
| **Plugins page** (sidebar, later) | Turn plugins on or off, set default options |

Plugins **never** add their own panels, toolbars or pages. Their results always land in one of these:
1. **Slides** inserted into or changed in the deck, as one ChangeSet with Undo.
2. **A file**, shown as an AttachmentCard in the chat with Open / Show in folder (e.g. a Word worksheet).
3. **A chat message**, e.g. suggestions or a checklist.

## 2. What every plugin declares (its manifest)

| Field | Meaning | Example (Quiz) |
|---|---|---|
| `id` | Folder name, unique | `quiz` |
| `name` | Verb-noun name, under 3 words | "Quiz" (sheet title "Quiz from slides") |
| `description` | One line, under 45 characters | "Quick-check questions in your format" |
| `icon` | One lucide icon name | `list-checks` |
| `tone` | Pastel tile colour from the design system (`design-system.md`) | `peach` |
| `scope` | `lesson` (whole deck), `slides` (a selection), `region` (a circled area) | `lesson` |
| `inputs` | Options as a JSON-schema-like list; the PluginSheet form is **generated** from it | see §4 |
| `output` | `slides`, `file`, `message` or a combination | `slides` or `file` |
| `usesStyle` | Must the result follow the style profile? (almost always yes) | yes |
| `estimate` | Rough cost/time shown under the Make button | "About 20 seconds" |

## 3. Lifecycle (what the teacher sees)

1. Click **+** → the PluginMenu pops up above the Composer (Esc or clicking outside closes it).
2. Pick a tile. If the plugin has inputs, the **PluginSheet** opens with defaults filled in. If not, it runs straight away.
3. Click the main button (e.g. **Make quiz**). The sheet closes, the chat shows a MessageProgress ("Writing 10 questions…") with a Stop button.
4. The result arrives as slides added (ResultChip "4 quiz slides added · Undo"), a file card, or a message.
5. She can keep refining in chat ("make question 3 easier"), because the result is just normal deck content.

## 4. Inputs → the generated form

Supported input types and the component each one renders as:

| Input type | Component | Example |
|---|---|---|
| `choice` (≤ 4 options) | RadioPill row | Which slides? All 8 slides / Slides 3–7 / Just slide 3 |
| `choice` (descriptive options) | RadioCard list | Where should it go? Slides at the end / Printable quiz (Word) / Both |
| `multi` | Checkbox list | Question types |
| `number` | NumberStepper (min/max/step) | How many questions? 10 |
| `text` | TextField / TextArea | Extra instructions |
| `boolean` | Checkbox | Add an answer slide |
| `slideRange` | RadioPill with "All / Selected / This slide" computed from the editor state | — |

Validation and defaults come from the manifest. The **Make …** button label comes from the manifest too (`action: "Make quiz"`).

## 5. Where the code lives (guidance for the IDE agents)

- Proposed folder: `src/plugins/<id>/`, discovered with `import.meta.glob`, the same pattern as modules.
  - `manifest.ts`: pure data, shared by renderer and main.
  - `run.ts`: **main process only**, because it calls Claude.
- `run(ctx, inputs)` receives a context that provides:
  - the current deck (read-only) and selection/regions
  - the style profile
  - an AI helper (structured call / slide writer from `ai-pipeline.md`)
  - progress reporting and a cancel signal
  - output helpers: `applyChanges(ops, summary)`, `saveFile(name, bytes)`, `postMessage(text)`
- A broken plugin is skipped with a log entry, the same way the module registry skips a broken module.
- The code-side `agents/DECISIONS.md` should record this as a decision when it's built.

## 6. First plugins (backlog, in order)

| # | Plugin | Scope | Inputs | Output | Tone |
|---|---|---|---|---|---|
| 1 | **Quiz from slides** | lesson / slides | which slides, number (3–30, default 10), types (multiple choice, true/false, fill the gap, short answer), difficulty (mixed/core/stretch), destination (slides / Word / both), answer slide | slides and/or `.docx` | peach |
| 2 | **Speaker notes** | lesson / slides | which slides, length (short/full), include timings | notes on each slide | butter |
| 3 | **Differentiate** | slides / region | support / stretch / both, what to change (wording, scaffolds, extension task) | new slides placed after each original | sky |
| 4 | **Starter & plenary** | lesson | starter type (retrieval, Do Now, odd one out), plenary type (exit ticket, 3-2-1), minutes | slides at the start/end | purple-soft |
| 5 | **Worksheet** | lesson | sections, answer key, A4 portrait | `.docx` (via the `docx` npm package in main) | mint |
| later | Find image, Translate (EAL), Retrieval grid, Homework, Seating-plan-free group task, Accessibility check, Timer slide | — | — | — | — |

## 7. Checklist for adding a plugin
1. Copy the `quiz` folder and change the manifest.
2. Write its prompt as a variation of the slide-writer prompt (`ai-pipeline.md` §11). Reuse the shared helpers; don't call the SDK directly.
3. Results must go through `applyChanges` / `saveFile` / `postMessage` only.
4. Add a fixture-based test: run against `fixtures/deck.photosynthesis.json` with a mocked Claude response and check the ChangeSet is valid.
5. Add a row to §6 and to `README.md`'s status table.

## 8. Design rules
- Name: verb-noun, under 3 words. Description: one line, under 45 characters.
- Icon: lucide only, never emoji. Tile colour: a `tone` from the design system.
- Use the generated form; custom UI needs a design review and a mockup in `design/` first.
- Results must be undoable and must follow the style profile.
