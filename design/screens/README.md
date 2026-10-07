# Screen specs — Slide Planner (working title)

One build spec per screen. A coding agent builds a screen from **its spec + its image + the mockup source**. The spec wins over the mockup on behaviour; the image wins on look. If they disagree in a way that matters, follow the spec and add an "Implementation note (date):" line (see `../AGENTS.md`).

Read before any screen: `../design-system.md` + `../tokens.css` (components and tokens, in progress), `agents/ARCHITECTURE.md` and `agents/MODULES.md` (code rules). Related: `../deck-model.md`, `../style-profile.md`, `../ai-pipeline.md`, `../plugin-architecture.md`, `../claude-access.md`, `../build-plan.md`.

## Index

| # | Screen | Image | Module owner | Sidebar mode | Entry points |
|---|---|---|---|---|---|
| 01 | [Welcome](01-welcome.md) | ![](../images/01-welcome.png) | `settings` (first-run wizard, step 1) | None (TitleBar only) | First launch after the splash; any launch while setup is unfinished at step 1 |
| 02 | [Connect Claude](02-connect-claude.md) | ![](../images/02-connect-claude.png) | `settings` (first-run wizard, step 2). Same form reused in Settings › AI | None in first run; full Sidebar (224px) in Settings › AI | Welcome "Next: connect Claude"; Settings › AI; every "Connect Claude" prompt in the app |
| 03 | [Home](03-home.md) | ![](../images/03-home.png) | `home` (reads `settings`, `style-library`, `deck-builder` — cross-module, see below) | Full Sidebar (224px), Home active | Normal launch; end of first run; Sidebar Home; "My lessons" / "Home" back buttons; after Save style |
| 04 | [Create a style](04-create-style.md) | ![](../images/04-create-style.png) | `style-library` | Full Sidebar (224px), Styles active | Connect Claude "Next: your style"; Home Dropzone (drop or browse); Home StyleCard (edit mode); Sidebar Styles |
| 05 | [New lesson](05-new-lesson.md) | ![](../images/05-new-lesson.png) | `deck-builder` (chat inside it) | Icon rail (72px, "focus mode"), Home active | Home PageHeader "New lesson"; Ctrl+N anywhere |
| 06 | [Editor](06-editor.md) | ![](../images/06-editor.png) | `deck-builder` (chat, annotate and plugins inside it) | Icon rail (72px), Home active | Home "Create lesson" (opens already generating); Home LessonCard; New lesson after "Make my slides" |
| 07 | [Plugin sheet](07-plugin-sheet.md) | ![](../images/07-plugin-sheet.png) | `deck-builder` (plugin registry inside it) | Icon rail (72px) | PluginMenu tile whose plugin has inputs |

## Flow

```
launch ─► splash ─► [first run?] ─yes─► 01 Welcome ─► 02 Connect Claude ─┬─ Next: your style ─► 04 Create a style ─► 03 Home
                         │                                               └─ Skip for now ─────────────────────────► 03 Home
                         └─no─► 03 Home
03 Home ─ New lesson ─────────► 05 New lesson ─ Make my slides ─► 06 Editor (generating → ready)
03 Home ─ Create lesson ──────────────────────────────────────────► 06 Editor (generating)
03 Home ─ LessonCard ─────────────────────────────────────────────► 06 Editor
03 Home ─ Dropzone / StyleCard ─► 04 Create a style
06 Editor ─ + ─► PluginMenu ─ tile with inputs ─► 07 Plugin sheet ─ Make … / Back / Cancel ─► 06 Editor
```

## Conventions used in every spec

### Copy
- Strings in quotes are **exact**, British English, including curly apostrophes (’), curly quotes (“ ”), the ellipsis character (…), en dash (–), em dash (—) and the middle dot (·). Don't straighten them.
- `{name}` marks a dynamic value. Each spec lists where it comes from.
- Strings marked **(new)** are not in the mockups; they are proposed for states the mockups don't show. The designer may reword them; keep the meaning.
- Pluralise properly: "1 slide" / "8 slides", "1 file" / "8 files", "learned from 1 deck" / "learned from 24 decks", "1 page" / "18 pages".

### Relative dates (Home, Styles)
Computed in the renderer from an ISO timestamp, in local time, re-evaluated when the module becomes active and at midnight.

| Age (calendar days) | Text |
|---|---|
| 0 (same day) | "Today" |
| 1 | "Yesterday" |
| 2–6 | "{n} days ago" |
| 7–13 | "Last week" |
| 14–27 | "{floor(n/7)} weeks ago" |
| 28–59 | "Last month" |
| 60–364 | "{floor(n/30)} months ago" |
| ≥ 365 | en-GB date, e.g. "4 March 2025" |

### Channel names
- Written `<area>:<name>`. `settings:`, `style-library:`, `deck-builder:`, `home:` are **module ids**, so `settings:getProfile` is `ctx.handle('getProfile')` in `src/modules/settings/main.ts`, called from that module's UI as `api.invoke('getProfile')`.
- `chat:`, `plugins:` and `annotate:` are **areas inside `deck-builder`** (build-plan: deck-builder hosts chat, annotate and plugins). Register them as module-local channels named `chat:send`, `plugins:run`… (colons are allowed in channel names), so the bus key is `deck-builder:chat:send`. If they ever become separate modules, only the prefix changes.
- Event names follow `../ai-pipeline.md` §7 where it already defines them (`deck-builder:gen-progress`, `deck-builder:slide-ready`, `chat:delta`, `chat:status`, `chat:changes`, `chat:done`, `ai:error`, `style-library:progress`).
- Payload shapes are TypeScript-ish pseudotypes. Put real types and channel constants in each module's `shared.ts`. Every handler validates its arguments (renderer input is untrusted).

### Results and errors across IPC
The bridge only carries an error **message** (`agents/ARCHITECTURE.md` › IPC). Handlers whose failures the UI must tell apart **return** a result instead of throwing:

```ts
type Result<T extends object = {}> = ({ ok: true } & T) | { ok: false; code: ErrorCode; message: string; retryAfterSeconds?: number }
type ErrorCode = AiErrorCode | 'not-found' | 'invalid-input' | 'io' | 'file-locked' | 'cancelled'
type AiErrorCode =
  | 'no-key'            // no stored key
  | 'invalid-key'       // 401 authentication_error
  | 'no-credit'         // 402 billing_error, or a 400 whose error says the credit balance is too low
  | 'permission'        // 403 permission_error
  | 'model-unavailable' // 404 not_found_error on the model
  | 'rate-limited'      // 429 rate_limit_error
  | 'overloaded'        // 529 overloaded_error, 500 api_error
  | 'network'           // APIConnectionError, timeout, DNS, offline
  | 'too-large'         // 413 request_too_large
  | 'refused'           // stop_reason "refusal" after server-side fallback
  | 'unknown'
```
Map with the SDK's typed error classes, never by matching message text (`../ai-pipeline.md` §9; the `claude-api` skill lists the classes). The one exception is "credit balance too low", which some accounts receive as a 400; classify it as `no-credit`.

### Shared AI error copy (in-app, outside Connect Claude)
From `../ai-pipeline.md` §9. Shown as a MessageAssistant in its error style (chat) or a Callout in its error style (elsewhere), always with one action.

| Code | Message | Action (Button) |
|---|---|---|
| `no-key`, `invalid-key` | "Claude isn’t connected. Add your API key to keep going." | "Open Settings" → Settings › AI |
| `no-credit` | "Your Claude account is out of credit." | "Open platform.claude.com ↗" (external) |
| `rate-limited`, `overloaded` | (after automatic retries with backoff ×3) "Claude is busy right now. Try again in a minute." | "Try again" |
| `network` | "Can’t reach Claude. Check your internet connection." | "Try again" |
| `refused` | "Claude couldn’t help with that request." | none |
| `model-unavailable`, `permission` | "Your API key can’t use {model name}. Pick another model in Settings." **(new)** | "Open Settings" |
| `too-large` | "That file is too big to send to Claude." **(new)** | none |
| `unknown` | "Something went wrong talking to Claude." **(new)** | "Try again" |

Connect Claude has its own, more specific wording for test results (see `02-connect-claude.md`).

### Long-running jobs
Generation, style learning, chat turns and plugin runs are **jobs** owned by the main process. Each start call returns `{ jobId }`, progress arrives as events, and each area has a cancel channel. Jobs keep running when the teacher navigates elsewhere (modules stay mounted, `agents/DECISIONS.md` D8; main owns the work anyway).

### "Connect Claude" prompt (used on several screens)
When an AI action is attempted with no usable key, don't call main. Show a Callout (action style): text "Connect Claude to use this." **(new)** + Button "Connect Claude" → Settings › AI (the 02 form). Keep whatever the teacher typed.

### Offline
The renderer can read `navigator.onLine`. When it is `false`, AI buttons stay enabled but a StatusPill "Offline" **(new)** shows in the ChatPanel header (editor screens) and actual failures use the `network` copy. No other global banner.

## Components

Exact names, defined in `../design-system.md`. Specs only reference these names; variants are named in each spec.

TitleBar, Sidebar (full 224px / rail 72px), PageHeader, Button, IconButton, ToggleChip, SelectChip, TextField, TextArea, Select, Checkbox, RadioPill, RadioCard, NumberStepper, StatusPill, FileTypeBadge, ProgressBar, ProgressPills, SetupSteps, Card, CardHeaderBand, Callout, Dropzone, EmptyState, SwatchStack, StyleCard, LessonCard, SlideThumb, Filmstrip, SlideStage, ToolRail, ToolButton, RegionOverlay, RegionLabel, RegionChip, ChatPanel, MessageUser, MessageAssistant, MessageProgress, AttachmentCard, ResultChip, Composer, PluginMenu, PluginTile, PluginSheet, ColourRole, FontSample, TestSlidePreview, CorrectionBox.

The specs also need four pieces the list above doesn't name. Add them to the design system: **ContextMenu** (LessonCard ⋯ menu, filmstrip thumbnail menu, SelectChip menus), **ConfirmDialog** (Delete lesson, Remove key), **Dialog** (Rename lesson, Choose a past lesson), **Toast** (export saved, lesson deleted, files skipped).

SlideThumb, SlideStage and TestSlidePreview all draw slides with the single `SlideView` renderer (`../deck-model.md` §4). App colours and fonts never reach slide content.

## Cross-cutting dependencies (decide before building; record in `agents/DECISIONS.md`)

These are framework (core) changes. The code rules say core changes need a DECISIONS entry. None of them is a new IPC channel.

| # | Need | Why | Suggested approach |
|---|---|---|---|
| D-a | **Chrome modes**: none / full Sidebar / 72px rail | First run has no sidebar; Home and Styles have the 224px Sidebar; the editor has the rail | `useShell().setChrome('none' \| 'sidebar' \| 'rail')`, or a static `chrome` field on `UiModule` plus an override for the first-run wizard |
| D-b | **Sidebar items ≠ module list** | The design shows Home, Styles, Plugins (top) and Settings (bottom) plus a user chip; `deck-builder` has no nav item | `UiModule.nav?: 'top' \| 'bottom' \| 'hidden'`; Sidebar renders the user chip itself (name + Claude status from `settings`) |
| D-c | **Navigate with an intent** | Home must open the editor on a lesson, open Create a style with files queued, open Settings › AI | `navigate(moduleId, intent?: { kind: string; [k: string]: unknown })`; the target module reads it from `useShell()` |
| D-d | **Cross-module reads** (the ROADMAP open question) | Home lists lessons (`deck-builder`) and styles (`style-library`) and needs the profile (`settings`); the editor needs style profiles; every AI module needs the API key | Options from `agents/ROADMAP.md`: a main-side service registry (`ctx.provide` / `ctx.use`), a renderer store, or merging modules. These specs assume Home can call `deck-builder:*`, `style-library:*` and `settings:*` read channels and that main-side modules can get the API client from `settings` |
| D-e | **Shared UI kit** | Every module uses the same components (LessonCard on Home, SlideView in three modules) but modules may only import `@renderer/sdk`, `@shared/*` and their own folder | Export the component library through `@renderer/sdk` (or a new `@renderer/ui` alias kept in the four alias files) |
| D-f | **Paths of dropped files** | Dropzones receive `File` objects; a sandboxed renderer can't see their paths | Preload exposes `webUtils.getPathForFile(file)` as `window.api.files.pathFor(file)`; main validates every path (exists, is a file, allowed extension, size) before copying it |
| D-g | **Full screen for Present** | All web permission requests are denied by default, which blocks the Fullscreen API | Main toggles `BrowserWindow.setFullScreen()` through a `deck-builder:present` channel |
| D-h | **Theme and fonts** | `tokens.css` today is dark with Inter; the design is light Classroom with Bricolage Grotesque + Figtree (mockups load Google Fonts, which the CSP and offline renderer forbid) | M1 in `../build-plan.md`: swap tokens, bundle fonts locally (e.g. `@fontsource`); allow `img-src data:` in the CSP for thumbnails |
| D-i | **Window minimum width** | `src/main/window.ts` has `minWidth: 960`; these specs are designed for ≥ 1100px | Raise `minWidth` to 1100 (default stays 1280×800) |
| D-j | **App name** | Mockups say "Slide Planner", `APP_CONFIG.appName` says "Planning App" | Owner decision (`../README.md` open decision 1). Specs write "Slide Planner" |

## Global keyboard shortcuts

| Keys | Action | Where |
|---|---|---|
| Ctrl+N | New lesson (05) | Anywhere outside first run |
| Ctrl+, | Settings | Anywhere outside first run |
| Ctrl+F | Focus the search field | Home |
| Ctrl+Enter | Submit the main action of the focused form (Create lesson, Make my slides, Make quiz) | Forms |
| Esc | Close the topmost menu / dialog / sheet; in the editor see 06 | Everywhere |

Editor shortcuts are listed in `06-editor.md`.

## Accessibility baseline (all screens)
From `../AGENTS.md`: real buttons, links and inputs; a label on every icon-only button; 44px targets; visible focus; 4.5:1 text contrast; full keyboard use. Where a mockup control is smaller than 44px (file remove × 36px, ResultChip Undo 32px, ToggleChip 40px, RadioPill 40px, set-up SelectChips 40px), keep the drawn size but extend the hit area to 44px with padding or a pseudo-element, unless the designer redraws them.

## Mockup inconsistencies for the designer
Collected from the screen specs (details in each file's "Open questions"). **Resolved on 2026-10-06:** 1 (privacy copy), 2 (steps are now "About you / Connect Claude / Your style (optional)" in both components), 5 (the style chip reads "Your style: Science KS3" with a chevron everywhere), 6 (the tag reads "Form time"), 8 (Home's Create lesson now links to the editor). 11: the design system adopts the specs' fixes (340px files column; the editor keeps the chat beside the stage down to 1100px). The rest are open for the next design pass.
1. Welcome's privacy line says only "the slides you work on" go to Claude, but style learning sends her old decks too (01).
2. Two progress components name the same wizard steps differently: SetupSteps "About you / Connect Claude / Teach it your style (optional)" vs ProgressPills "You / Connect Claude / Your style" (01, 02).
3. Step 3 of first run (Create a style) is drawn with the full Sidebar and a "Home" back button, while first run otherwise has no sidebar (04).
4. Two back-button labels lead to Home: "Home" (Create a style) and "My lessons" (editor screens) (04, 05).
5. The style chip says "Your style: Science KS3" on New lesson but "Your style: Science" on the Editor and Plugin sheet; the editor chip has no chevron although it is a SelectChip (05, 06).
6. LessonCard year tag says "Form" while the filter says "Form time" (03).
7. Sidebar "Styles" links straight to Create a style; no Styles list is drawn. "Plugins", both "Manage" links and "More plugins" go nowhere (`#`) (03, 06).
8. Home's "Create lesson" links to the empty New lesson screen in the mockup; the intended flow opens the editor already generating (03).
9. The editor image shows the loop and the label "Swap for a diagram" still on the slide after the message was sent; `../ai-pipeline.md` §6 says regions clear after sending. The specs treat the drawn state as "hovering the sent RegionChip". The pre-send Composer with RegionChips is not drawn (06).
10. The Quiz sheet shows "Slides 3–7" while only slide 3 looks selected. The specs tie it to a filmstrip multi-selection ("All / Selected / This slide" in `../plugin-architecture.md` §4), which needs multi-select in the filmstrip (06, 07).
11. Markup flex-wrap drops the chat panel under the slide below ~1190px window width, and the 380px files basis stacks Create a style's two columns below ~1300px (so at the default 1280px window they stack). Specs propose fixes (04, 05, 06).
12. New lesson shows the + (plugins) button on an empty lesson where no plugin can run yet, and shows example objectives in the Composer without saying whether they are a placeholder (05).
13. Default style row is tinted mint while the other row is white: rule unclear (default highlight vs per-style tint) (03).
14. Several targets are under 44px (see Accessibility baseline).
15. The Quiz sheet has no "answer slide" input and no `estimate` line, both listed in `../plugin-architecture.md` (07).
16. Draw and Sticky note tools are drawn but have no defined behaviour anywhere; Speaker notes output has nowhere to show in the editor (06).

## Doc inconsistencies (for the doc owners)
- ~~**Stop during generation:**~~ Resolved: `../ai-pipeline.md` §1 now says generation keeps finished slides; chat edits and plugins change nothing.
- (was) **Stop during generation:** `../build-plan.md` M6 says Stop keeps finished slides; `../ai-pipeline.md` §1 and §9 say cancelling leaves the deck unchanged. The specs keep finished slides for generation only (05).
- **Copy punctuation:** `../ai-pipeline.md` §9 and `../style-profile.md` write UI messages with straight apostrophes; the mockups use curly ones. The specs use curly apostrophes for all UI copy.
- ~~`../ai-pipeline.md` §7's `deck-builder:gen-progress` has no field for the auto title~~ Resolved: an optional `title` was added.
