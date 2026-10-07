# Build plan — what the IDE agents should build, in order

This is the plan; the code is written elsewhere (the Electron app in this repo). Each milestone lists:
- **Build:** what to make
- **Read:** the design docs it depends on
- **Done when:** checks a person can do in the running app

The code-side rules (modules, IPC, sandboxed renderer, `npm run typecheck` / `npm test` / `npm run smoke`) are in `agents/README.md`. Follow them.

Planned code modules (from the code ROADMAP): `settings`, `style-library`, `deck-builder` (with chat, annotate and plugins inside it), plus the existing `home`.

---

## M1 · Re-skin the shell to direction B
- **Build:**
  - Swap the provisional dark theme for `design/tokens.css`. Bundle the Bricolage Grotesque and Figtree fonts locally.
  - Restyle the title bar and sidebar to match: white bar with an ink rule, orange active item, user chip at the bottom.
  - Add a "focus" layout so the sidebar can shrink to the 72px rail in the lesson editor.
  - Build the shared components from `design-system.md` and a hidden "UI gallery" page showing every component and state.
- **Read:** `design-system.md`, `tokens.css`, `images/03-home.png`, `images/06-editor.png`.
- **Done when:** the gallery matches the mockups side by side; contrast and focus rings pass; the sidebar matches `03-home.png`.

## M2 · First run and settings (`settings` module)
- **Build:** Welcome and Connect Claude screens. Name stored and shown on the splash. API key saved encrypted, test connection, model choice, Settings › AI page reusing the same form.
- **Read:** `screens/01-welcome.md`, `screens/02-connect-claude.md`, `claude-access.md`, `ai-pipeline.md` §1–2, §9.
- **Done when:** a fresh install shows Welcome → Connect Claude → Home. A wrong key shows the right error, a good key shows Connected, and the key never appears in renderer memory or logs.

## M3 · Deck model, renderer and export (no AI yet)
- **Build:** the deck types and validation, `SlideView` renderer, thumbnails, and PowerPoint export. Load `design/fixtures/deck.photosynthesis.json` and `style-profile.science-ks3.json` as sample data.
- **Read:** `deck-model.md`, `style-profile.md` §1.
- **Done when:** the sample lesson renders like `images/06-editor.png` (minus the chat). Exporting opens in PowerPoint without repair, with positions, the two-colour title and the yellow box intact.

## M4 · Home and lesson library (`home` module)
- **Build:** greeting, Make a new lesson card, Your styles card, Past lessons grid with filters, sort, search and card menu. Lessons stored locally.
- **Read:** `screens/03-home.md`.
- **Done when:** matches `images/03-home.png`. Filters, sort and search work. Opening a card opens the editor with that lesson.

## M5 · Create a style (`style-library` module)
- **Build:** import PDF/PPTX, local digest, per-file Claude analysis with live progress, synthesis, the live "What I've learned" panel, test slide, corrections, save and default.
- **Read:** `screens/04-create-style.md`, `style-profile.md`, `ai-pipeline.md` §4.1–4.3.
- **Done when:**
  - Real decks from the teacher produce a profile she agrees with.
  - Failed files show a reason.
  - A correction updates the test slide.

## M6 · Making a lesson (`deck-builder`)
- **Build:** New lesson screen, LO document upload, lesson set-up chips, planning plus slides streaming in one by one, auto title, one undo step for the whole generation, cancel.
- **Read:** `screens/05-new-lesson.md`, `ai-pipeline.md` §3–4, §7.
- **Done when:** pasting the photosynthesis objectives gives about 8 slides in the fixture style. The filmstrip fills live, and Stop leaves already-finished slides.

## M7 · Editor chat
- **Build:** the chat panel with streaming replies, the editing tools (`read_slides`, `view_slide`, `apply_changes`), result chips with Undo, undo/redo across restarts, filmstrip reordering, simple direct text editing, error messages.
- **Read:** `screens/06-editor.md`, `ai-pipeline.md` §5, §8–9.
- **Done when:** "make slide 4 shorter" changes only slide 4. Undo restores it. Errors show the friendly messages.

## M8 · Circle to edit
- **Build:** the circle tool, region chips (several, numbered), sending region images and targeted elements to Claude, clearing after send.
- **Read:** `screens/06-editor.md`, `ai-pipeline.md` §6.
- **Done when:** circling the photo on slide 3 and asking for "a labelled leaf diagram" replaces just that element with a diagram in the same place.

## M9 · Plugins
- **Build:** the plugin registry, the + menu, the generated options sheet, and the Quiz, then Speaker notes plugins.
- **Read:** `plugin-architecture.md`, `screens/07-plugin-sheet.md`.
- **Done when:** Quiz with defaults adds quiz slides in her style plus an answer slide, as one undo step. "Make a quiz" typed in chat does the same.

## M10 · Present, polish, package
- **Build:** present mode, the usage figure in Settings, empty/error states everywhere, keyboard and screen-reader pass, performance check, installer.
- **Done when:** a full run-through (first run → style → lesson → circle edit → quiz → export) works on the packaged app.

---

## Working agreement for agents
- **Design rules the look and behaviour.** If something in `design/` is impossible or unclear, don't improvise silently. Note the deviation in the relevant design doc ("Implementation note: …") and tell the owner.
- **Never** restyle the teacher's slide content with app colours. Slides use only the style profile.
- **Invoke the `claude-api` skill** before any Claude-related code (model IDs, structured outputs, caching, PDF limits).
- Keep `design/README.md`'s status table and the code-side `agents/CHANGELOG.md` up to date as milestones land.
