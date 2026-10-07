# Roadmap

The product vision, and how each part is expected to plug into the framework. Nothing below is built yet unless
marked **done**. Update this file as features ship or plans change.

## Vision (the owner's words, condensed)

> I am a teacher and I mostly work on PowerPoint presentations. I will upload all the PDFs I have made so the AI knows
> my style, then it creates new decks for new lessons for me. I still want it to be engaging: a chat where I can refine
> the result with the AI, with features like **circling bits of slides and asking Claude to change them**.

Other requirements stated so far: sleek look, performance matters "but not too much", the app should be modular so
features can be added over time, an animated welcome ("Welcome Alice") on launch, a close (X) at the top right.

## Environment facts

- The owner's machine is Windows 10, with **desktop PowerPoint installed** (its COM automation is registered) and no
  LibreOffice. So exact slide rendering of a real `.pptx` is possible through PowerPoint itself if ever needed.
- .NET 10, Node 22 and Java are installed; Python is only reachable through the `py` launcher (there is no `python` on PATH); Rust and
  Go are not installed. (Node is what this app uses.)
- AI = Claude via the Anthropic API. **When implementing anything that calls Claude, invoke the `claude-api` skill
  first** for current model IDs, PDF/image input limits, streaming, tool use and prompt caching. Do not hard-code model
  IDs from memory. Making API calls needs an Anthropic API key (separate from a Claude chat subscription) and costs
  money per use, so surface usage/cost to the owner.

## Design alignment (read this with design/)

The owner (or a parallel design session) maintains [`design/`](../design/README.md): a product brief, three candidate visual directions,
a plugin spec and HTML mockups. It was written **while the framework was being built**, so some of it is newer than the code. It is the source
of truth for look and behaviour; this roadmap says how to build it. Mapping, as of 2026-10-06:

| Design screen / concept | Source | Becomes |
|---|---|---|
| My lessons / library (home) | NewLesson, Main mockups | replaces the placeholder `home` page (or a `library` module with order 0) |
| Create a style: upload decks, "Learning 6 of 8 files", a Style Profile (colours, fonts, layout habits, slide types, how you write), test slide | StyleBuilder | `style-library` module (below). **Accepts both PDFs and PowerPoint files** (SignIn and StyleBuilder say "PDF or PowerPoint"; the product brief says `.pptx`). Several named profiles ("Science KS3") |
| New lesson: paste or drop learning objectives (Word, PDF or PowerPoint), set-up chips (year group, length, ability, slide count) | NewLesson | part of the `lesson-editor` module |
| Editor: slide list, slide canvas, chat panel, circle to edit with numbered *region chips*, Undo, Present, Export to PowerPoint | Editor, Main, Studio, Focus | `lesson-editor` module = the old `deck-builder` + `chat` + `annotate` ideas, presented as one screen |
| "+" menu in the chat composer, slash commands, side sheet, plugin manager | PluginSheet, plugin-architecture.md | **plugins** (see below) |
| Connect Claude: paste an API key once, test connection, choose a model | ConnectClaude | `settings` module. The design says "Anthropic only allows subscription sign-in in its own apps, so apps like this connect with an API key". The mockup says the key is "stored encrypted on the server"; **the desktop app has no server**, so store it locally, encrypted with Electron `safeStorage`, in the main process |
| Sign in with Google / Microsoft / email | SignIn | **open question**: the mockups assume accounts, the brief puts multi-user out of scope, and this is a local desktop app. Ask the owner before building any sign-in |

**Module versus plugin (do not confuse them).** A *module* (this repo's code unit, `src/modules/<id>`) adds an app feature or screen to the
sidebar. A *plugin* (design/plugin-architecture.md) is a **chat capability** the teacher invokes from the "+" menu (Quiz, Worksheet,
Differentiate, Speaker notes, Starter & plenary, Restyle from profile). Plugins declare `id, name, description, icon, scope
(lesson | slide | region), slash, inputs, output (slides | file | message), usesStyleProfile`, never add permanent panels, and always land in
slides (with undo), a chat message with an attachment card, or a side sheet. Expected implementation: the `lesson-editor` module owns a
**plugin registry** that reuses `loadModules()` from `src/shared/registry.ts` with a second glob (for example `src/plugins/<id>/plugin.ts`),
so adding a plugin is also "add a folder". Build it when the editor exists, and record the choice in DECISIONS.md.

**Visual direction is undecided** (A Studio: light, cobalt, Instrument Sans; B Classroom: bold pastel, Bricolage Grotesque + Figtree; C Focus: dark,
lime, Space Grotesk + IBM Plex). The framework's violet/cyan dark theme and Inter font are placeholders. When a direction is chosen: replace the
values in `tokens.css`, set `APP_CONFIG.windowBackground`, swap the bundled font (`npm install -D @fontsource-variable/<font>`), refresh
the logo and `resources/icon.png`, and re-run `npm run smoke` and read the screenshots. The app name "Slide Planner" in the design is a
working title; the code says "Planning App" (`APP_CONFIG.appName`, `package.json` `productName`, window title, installer name).

## Status

| Piece | Status |
|---|---|
| Framework: shell, module system, splash, title bar + close, tests, packaging, agent docs | **done** |
| Home module (reference) | **done** |
| `settings` (Connect Claude, user name) | planned (next, because the API key is needed first) |
| `style-library` (Create a style) | planned |
| `lesson-editor` (deck model + preview + chat + circle-to-edit + export) | planned; sections 3 to 5 below describe its parts |
| Plugin registry and first plugins (Quiz, Speaker notes, Differentiate) | planned, inside `lesson-editor` |
| PowerPoint bridge (optional) | idea |

## Planned modules

Proposed ids; each is a folder under `src/modules/`. Order is a suggestion, not a requirement.

### 1. `settings`
User name (replaces the hard-coded `APP_CONFIG.userName` for the splash and greeting), Anthropic API key, model choice,
future preferences. The API key is stored in the **main process**, encrypted with Electron `safeStorage`, never sent
to the renderer. Likely also the first module to need a persistent store: write a small JSON store helper on top of
`ctx.dataDir` and share it through core (record it in DECISIONS.md).

### 2. `style-library`
Teach the AI the owner's style.
- Import PDFs (and later `.pptx`) through a native file dialog (main process), copy them into `ctx.dataDir`.
- Extract per-page text and page images. Claude accepts PDFs and images directly (check the current limits with the
  `claude-api` skill) so rendering may be unnecessary; if it is needed, `pdfjs-dist` or a similar library in main.
- Have Claude analyse the corpus **once** into a compact, reusable **style profile** (layout patterns, colour palette,
  fonts, tone of voice, typical lesson structure and activities, level of detail) saved as JSON/Markdown in `ctx.dataDir`.
  Later generations send the *profile* plus a few representative pages, not the whole library. Use prompt caching.
- UI: a gallery of imported decks, the editable style profile, re-analyse button.
- **Privacy:** teaching PDFs may contain student names or other personal data. Tell the owner what is sent to the API
  and consider a redaction step.

### 3. `deck-builder` (part of `lesson-editor`)
Generate and edit decks.
- **One source of truth: a deck model** (JSON): slides -> layout + elements (text, image, shape, table) with positions in
  slide coordinates (16:9, 13.333 x 7.5 in), styles from the style profile. Put the types in `src/shared/deck/` so both
  sides use them. The model is the truth; `.pptx` is an export.
- Claude produces/edits the model through structured output or tool calls, never free-form text.
- UI: slide list, large preview rendered from the model (HTML/SVG), simple direct editing.
- Export in main with **PptxGenJS** (`npm install -D pptxgenjs`) to `.pptx`; open the result in PowerPoint with
  `shell.openPath`. Keep the model-to-preview and model-to-pptx mappings in one shared place so they cannot drift.
- Later: import an existing `.pptx` into the model.

### 4. `chat` (part of `lesson-editor`)
The conversation with Claude, scoped to the current deck.
- Messages stream from the main process (the only place the API key exists) to the UI with `ctx.emit`; the UI shows
  tokens as they arrive. History is stored per deck in `ctx.dataDir`.
- Claude edits the deck by returning **patches** (e.g. JSON Patch or an op list) that the deck module applies; show what
  changed and allow undo.
- Stays mounted when you switch modules (module host behaviour), so an in-flight answer is not lost.

### 5. `annotate` (circle to edit; part of `lesson-editor`)
- A transparent canvas/SVG layer over the slide preview: freehand circles, arrows, rectangles, optional text note.
- On send: flatten the slide (rendered preview + annotation layer) to a PNG, and send it to Claude together with the
  slide's JSON and the owner's instruction ("make this chart bigger", "simplify this wording"). The image tells Claude
  *where*; the JSON tells it *what to change*. Claude answers with a patch to the deck model.
- Hit-test annotations against element bounding boxes to name the targeted elements explicitly in the prompt
  (more reliable than relying on vision alone).

### 6. PowerPoint bridge (optional)
Drive the installed PowerPoint through COM from a small PowerShell/.NET helper started by the main process: export
thumbnails of a real `.pptx` exactly as PowerPoint draws it, open it for the owner, or run a slideshow. Only worth it if
the HTML preview and the exported file visibly disagree.

## Cross-cutting needs the framework does not provide yet

- **Persistent store / settings service** for modules (see `settings`).
- **Secrets** via `safeStorage`.
- **Long-running tasks and cancellation** (analysing many PDFs, long generations): progress events and an abort handle.
- **Cross-module communication**: chat needs the deck model; annotate needs the preview. Today modules are isolated.
  Candidate designs: a small service registry in main (`ctx.provide` / `ctx.use`), a shared in-renderer store module,
  or merging tightly coupled features into one module. Decide when the first real dependency appears; record it in DECISIONS.md.
- **Auto-update** of the installed app.
- **Light theme** (tokens are ready for it).

## Open questions for the owner

- Sign-in and accounts: needed at all, for a local single-user desktop app? (see "Design alignment")
- Should generated decks follow one fixed template per subject/year group, or be fully free-form?
- How much should the app edit existing decks versus always generating new ones?
- Is any student data present in the uploaded decks and documents?
- Which visual direction (A, B or C), and the final app name?
- Original `.pptx` files carry exact fonts, colours and layouts in their XML (easier and more accurate to learn a style from than a PDF).
  Prefer `.pptx` when both exist; keep PDF support for decks that only exist as PDFs.
