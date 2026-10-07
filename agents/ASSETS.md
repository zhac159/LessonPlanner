# Your assets: build spec

**Status:** approved by the owner on 2026-10-07; this is the full build spec the proposal promised. Sources of truth for
look and behaviour: `desing_asset/README.md` (note the folder name: `desing_asset`, with the typo), the 13 images in
`desing_asset/images/A1…A13-*.png` and the mockup sources in `desing_asset/canvas/project/*.dc.html`. Nothing in `design/`
has changed; merging this into `design/` happens only when the owner asks. Read `agents/IMPLEMENTATION.md` and
`agents/EFFICIENCY.md` first, and `agents/assets/PROVIDERS.md` (image libraries, Nano Banana Pro: facts, costs, code map).

The rules of `design/screens/*.md` apply: strings are exact (British English, curly quotes), slides never use app colours or
fonts, all Claude calls run in main, everything is stored in the data folder, AI changes decks only through ChangeSets.

| Part | What |
|---|---|
| §1 | Overview: what it is, module map, what already exists |
| §2 | Data model: Asset, chat names, picture spots, library vs lesson, `{{name}}` tokens, picture habits, storage |
| §3 | The 13 screens A1 to A13 in the format of `design/screens/*.md` |
| §4 | Contracts: the new `assets` API and the amendments to deck-builder, style-library, settings and the lessons store |
| §5 | AI steps: pictures in style learning, naming, habits, generation and chat, the circle flow, make-new prompt, defects to fix |
| §6 | Export rules |
| §7 | Cost, privacy and licence rules |
| §8 | Build order: work packages with exact file ownership |
| §9 | Test strategy |
| §10 | Decisions taken, open questions for the owner, known quirks |

Already written (work package 0, this document's companion):
`src/shared/assets/**` (types, zod schemas, names, fit maths, tokens, spots, placement ops, credits, habits, fingerprints,
library helpers, picture-maker prompt; 87 unit tests) and `src/shared/contracts/assets.ts` (the typed `assets` contract with its
test). `npm run -s check -- -f shared/assets` and `-f contracts/assets` are green. Everything below that says "amendment" is a
change to an EXISTING file that its owner makes; none of them has been made yet.

---

## 1. Overview

A new sidebar page **Assets** (between Styles and Plugins) holds the teacher's reusable pictures: logos, icons, pictures,
photos, diagrams, banners, characters and symbol cards. Each has a unique **chat name** (`school_logo`), a **description Claude
reads**, tags, a source (uploaded, cut out of her decks, found online, made with Claude or Google's picture maker) and, for online
pictures, the licence and credit. She fills the library by learning a style (Claude finds the pictures she reuses), by uploading
images, PDFs or PowerPoints, by searching free image libraries, or by asking for a new one in the same look. Nothing is saved
without her OK (A2).

In a lesson she uses assets by chip (`{{school_logo}}` in the chat, or + › Add asset), by circling an area (**Add asset here**), by
filling a **picture spot** that Claude left, or just by asking in words ("put the school logo in the top right"). Claude uses
assets itself when it generates a lesson and leaves picture spots where a picture would help and she has none.

### 1.1 Module map

| Piece | Where | Owner / work package |
|---|---|---|
| Shared types, schemas, pure helpers, `assets` contract | `src/shared/assets/**`, `src/shared/contracts/assets.ts` | WP0 (done) |
| Extraction of pictures from `.pptx` and `.pdf`, grouping, "left out" reasons | `src/main/import/assets/**` (exists: `extractAssets`, `groupFindings`, `FoundAsset`) | exists |
| Image search (Openverse, Wikimedia Commons, optional Pexels), safe download, credit lines, Nano Banana Pro maker | `src/main/services/imageProviders/**` (exists; facts in `agents/assets/PROVIDERS.md`) | exists |
| Library store, review queue, thumbnails, usage scan, suggestions, make-new and online orchestration | `src/main/services/assets/**` | WP1, WP2, WP11, WP12 |
| The `assets` module (screens A1, A2, A8, A9) | `src/modules/assets/{ui.tsx,main.ts,shared.ts,ui/**,main/**}` | WP4 and WP1 |
| UI kit pieces shared by the `assets` and `deck-builder` modules | `src/renderer/src/ui/assets/**` (alias `@ui/assets`) | WP3 |
| AI calls: naming, style description, SVG drawing | `src/main/ai/calls/pictures.ts`, `prompts/pictures.ts`, `schemas/pictures.ts`, fake fixtures | WP5 |
| Style learning: pictures facts, habits, review hand-off, defects | `src/main/services/styles/**`, `src/modules/style-library/**` | WP6 |
| Deck model, slide rendering, export of spots and credits | `src/shared/deck/**`, renderer SlideView, `src/main/export/**` | WP7 |
| `placeAsset`, copy-on-use, chat tools, generation prompts | `src/main/services/{lessons,chat,generation}/**`, `src/main/ai/chat/**` | WP8 |
| Editor UI: + menu, picker, chips, circle bar, side sheets, spots | `src/modules/deck-builder/ui/**` | WP9 |
| Settings: picture-maker key | `src/modules/settings/**`, `src/main/services/settingsModule/**`, `keyStore.ts` | WP10 |

Module id `assets`, sidebar title "Assets", `order: 30` (Home 0, Styles 20, Settings 100), icon lucide `Image`. The page is
registered by adding `src/modules/assets/` only (no shell edit); intents it accepts are in §3.0.

### 1.2 Principles

1. **Her files first.** The library lives in the app's data folder; nothing leaves the PC except what is listed in §7.
2. **One picture, one id.** An asset's id never changes; names and titles are labels. Lessons keep their own copy (§2.4).
3. **Ask once, undo always.** Adding, replacing, deleting and placing are each one undo step or an Undo toast.
4. **Cheap by default.** Local checks first (hash, size, blur, repeats), Claude only for naming and the words around it (§5, §7).
5. **Editor-only marks.** Picture spots, region bars and previews never print, present or export.

---

## 2. Data model

All types below exist in code (`src/shared/assets/types.ts`); zod schemas in `schema.ts`.

### 2.1 Asset

```ts
interface Asset {
  id: string               // 'ast_' + ULID. Also the file id inside a lesson's assets folder (copy-on-use, §2.4)
  name: string             // chat name, §2.2
  title: string            // "School logo": card title and detail heading, 1-60 characters
  kind: 'logo' | 'icon' | 'picture' | 'photo' | 'diagram' | 'banner' | 'character' | 'symbol-card'
  description: string      // what Claude reads; plain sentences, at most 400 characters
  tags: string[]           // lower-case, trimmed, at most 12 of at most 24 characters
  source:                  // where it came from
    | { kind: 'uploaded'; fileName; at }
    | { kind: 'extracted'; styleId: string | null; fileName; page: number | null; at }
    | { kind: 'online'; provider: 'openverse' | 'wikimedia' | 'pexels' | 'unsplash'; at }
    | { kind: 'generated'; model; prompt; basedOn: string[]; at }          // model 'claude-svg' for drawings
  licence: { id: LicenceId; label: string; requiresCredit: boolean }       // 'unknown' for her own files ("From your files")
  credit: { text; inNotes; provider; author; title; pageUrl; licenceUrl } | null   // text = the ready credit line, §6
  file: { ext: '.png' | '.jpg' | '.webp' | '.gif' | '.svg'; width; height; bytes; sha256; phash: string | null; vector: boolean }
  foundIn: Array<{ styleId: string | null; sourceId: string; fileName: string; page: number | null }>   // decks it was seen in
  usedIn: string[]         // lesson ids: a CACHE rebuilt by scanning the lessons (§3.1 data), never edited by hand
  lastUsedAt: string | null  // set by placeAsset; feeds "Recently used"
  createdAt: string; updatedAt: string
}
```

- **Kinds.** `picture` is an illustration, drawing or AI-made scene; `photo` is a real photograph; `symbol-card` is a pictogram
  card (a word and a picture in a bordered, rounded card, used for vocabulary and sorting). The extraction service's hints map:
  `logo`→logo, `icon`→icon, `banner`→banner, `symbol-card`→symbol-card, `photo`→photo, `other`→picture (Claude's naming call
  (§5.2) has the last word, including `diagram` and `character`, which the extractor cannot tell). The filter pill "Pictures"
  holds both `picture` and `photo`; "Symbol cards" appears only when she has some (`ASSET_FILTERS`, `visibleFilters`).
- **Her real photographs** (cave paintings, an animal) are `photo` assets with source `extracted` and licence `unknown`
  ("From your files"): no credit is written for them, and they are never offered "online". The two AI-looking scenes are
  `picture`; an emoji is an `icon`.
- **Licences** (`LICENCES`, `licenceFromProviderCode`): `own`, `unknown`, `generated`, `cc0`, `public-domain`, `cc-by`, `cc-by-sa`,
  `cc-by-nc`, `cc-by-nc-sa`, `cc-by-nc-nd`, `cc-by-nd`, `pexels`, `unsplash`, `other`. "Free to use in lessons" keeps `cc0`,
  `public-domain`, `cc-by`, `cc-by-sa`, `pexels`, `unsplash` (`isFreeToUse`).
- **Fingerprints.** `sha256` finds exact repeats; `phash` is a 64-bit difference hash (`differenceHash`, 16 hex characters);
  Hamming distance ≤ 6 is "the same picture", ≤ 14 "probably another version" (`isNearDuplicate`, `isSimilar`). The
  extraction service also keeps a finer `detailHash`; it is used while reviewing and is not stored on the asset.
- **Thumbnail.** Not a field: derived at `library/<id>/thumb.png` (256 px long side) and regenerated if missing. The detail pane
  preview is a 768 px derivative made on demand. Both reach the renderer as data URLs (the renderer is offline, `AssetSummary.thumbDataUrl`).
- **Limits.** 50 MB and 10 000 px per side per file (bigger is refused with "That picture is too big."), 500 assets per library
  (soft: the list pages 60 at a time; beyond 500 the Upload button says "Your library is full. Remove some pictures first." ).
  SVG is accepted from uploads only after `sanitiseSvg` (`src/shared/deck/svg.ts`); rasterised with resvg for thumbnails and export.

### 2.2 Chat names

A chat name is how she and Claude point at an asset: `{{school_logo}}`.

| Rule | Detail (implemented in `src/shared/assets/names.ts`) |
|---|---|
| Shape | lower-case letters and digits in words joined by single underscores, at least one letter: `ASSET_NAME_RE = /^(?=.*[a-z])[a-z0-9]+(?:_[a-z0-9]+)*$/` |
| Length | 2 to 32 characters |
| Unique | case-insensitive across the whole library, and across the other candidates of a review batch |
| Reserved | `all asset assets here library new none open picture_spot region selected slide slides spot this undo redo`, and `slide_<n>`, `region_<n>`, `spot_<n>`, `picture_spot_<n>` (`isReservedAssetName`) |
| Typed input | `checkAssetName(input, taken, ownName?)` first normalises like `slugifyAssetName` ("School Logo" and "{{school logo}}" become `school_logo`), then validates; the field shows the normalised value on blur |
| Messages | too short "Use at least 2 characters." · too long "Use 32 characters or fewer." · no letter "Use letters, numbers and underscores, with at least one letter." · reserved "“{name}” is kept for the app. Try another name." · taken "You already have an asset called {name}." |
| Proposing | `suggestAssetName(title, taken)` / `uniqueAssetName`: slug, then `_2`, `_3` when taken, cut to fit 32; a reserved root gets `_image` (`slide` → `slide_image`). Claude is asked to follow her habit: noun + kind suffix (`beaker_icon`, `school_logo`, `do_now_banner`, `forest_photo`, `leaf_cross_section`); the suffix is advice, not enforced |
| Rename | Changes only `name` (and `updatedAt`). The id, the lesson copies and the decks do not change, so nothing breaks. Chat history stores refs `{ assetId, name }` and draws the CURRENT name (§2.4), so old messages follow a rename. Renaming is a local edit with no Claude call and no undo step (the old name is simply typed again) |
| Delete | The name is free again after the 7-day undo window ends; `restore` fails with "That name is taken now. Rename the other asset first." if someone took it in between |

### 2.3 Picture spots (a deck-model extension)

**Decision: reuse `ImageElement.placeholder`, do not add a new element or field.** An image element with a `placeholder` and
no `assetId` IS a picture spot (`isPictureSpot`). The placeholder object gains optional hints:

```ts
placeholder?: {
  description: string       // "A leaf in sunlight, close up": already exists
  kind?: AssetKind          // what would fit
  query?: string            // words for "Find online"; defaults to description
  suggestedAssets?: string[]  // asset ids Claude thinks would do, best first
}
```

Why: (1) `placeholder` already exists in the Deck schema, in `src/main/ai/schemas/slide.ts` (`description`) and in the exporter, so
every old deck with a described empty image is already a valid spot; (2) the Deck schema stays backwards compatible, because
every new key is optional and an old reader's zod strips what it does not know; (3) `assetId` and `placeholder` together have a
clean meaning: **filling a spot sets `assetId` and leaves `placeholder` as provenance** (what the picture was for), which also
keeps the ChangeSet journal safe (an `updateElement` that "removes" a key would not survive JSON); (4) no new `DeckOp`, no
change to `applyOps`, undo and redo work as they are. `isPictureSpot` = `type === 'image' && !assetId && !!placeholder`.

Rules: spots are editor-only. The stage draws them as a dashed box with "Picture spot", the description and a "Fill this spot"
button (A12). Thumbnails and the filmstrip draw a faint dashed box and a counter. **Present mode and export skip them** (§6).
The existing text-over-slide rendering of `placeholder.description` is a defect (§5.7) and goes away. A slide with spots is
valid, saves and undoes like any other. The editor lists them with `listPictureSpots(slides)` ("slide 3 · 1 of 3").

### 2.4 Library vs lesson: copy-on-use, same id

A lesson must keep working when the library changes, must be copyable (Duplicate lesson copies the folder), must export without
the library, and must stay small. **Decision: copy-on-use.** The first time an asset is placed in a lesson, its file is copied
into `lessons/<id>/assets/<assetId><ext>` with a manifest record in `assets.json`, and the lesson's `ImageElement.assetId` is the
**library asset's own id**. Placing it again, on any slide, reuses the copy.

| | Copy-on-use, same id (chosen) | Reference only | Copy with a new id each time |
|---|---|---|---|
| Lesson survives delete or replace in the library | yes | no: broken pictures | yes |
| Export, duplicate, move the lesson | works from the lesson folder | needs the library path | works |
| Existing loaders (`assetReader`, exporter, renderer, thumbnails) | unchanged: they already read `lessons/<id>/assets/` | all change | unchanged |
| Link back (usage, "Used in 14 lessons") | the id IS the link | the id | lost, needs a side table |
| Disk | one copy per lesson per asset (a logo is ~20 KB) | none | many copies |

Consequences: **Replace file** and **Delete** in the library never touch lessons (the delete dialog says so, A1). **Rename**
changes nothing in lessons. `usedIn` is rebuilt by scanning lessons for `image` elements whose `assetId` is in the library
(on app start, and after a lesson changes, debounced), through a small port the deck-builder main registers
(`lessonsUsingAssets()`); `lastUsedAt` is the only persisted usage fact. The lesson manifest record gets `title` (the asset's
title) as its display name; an amendment to `AssetStore` adds `addBytesWithId` (§4.5). Elements keep `name` = the asset's chat
name at placement time (used in prompts: "the school_logo") and `alt` = the asset's title.

### 2.5 `{{name}}` tokens, chips and chat history

- **Typing.** The composer's message is plain text with tokens. `{{` opens the picker as a popover with the typed letters as the
  search; picking replaces the open token with a finished `{{name}} ` (`openAssetToken`, `completeOpenToken`). + › Add asset opens
  the picker as a sheet and inserts the token at the caret (`insertAssetToken`). A typed complete `{{name}}` becomes a chip as
  soon as the closing braces are typed; Backspace on a chip deletes it whole.
- **Chips.** `parseAssetTokens` and `resolveAssetTokens(text, lookup)` turn tokens into `chip` (known name) or `missing` (unknown,
  drawn as plain text with a red underline and "No asset called {name}." under the composer; **Send is disabled** until fixed).
  Names are matched in lower case.
- **Sending.** `ChatSendArgs` gets `assetRefs: ChatAssetRef[]` (one per distinct chip, `assetRefsInText`); main resolves by id, so
  a rename between typing and sending is harmless; a deleted asset gives "{name} isn't in your library any more."
- **History.** `ChatItem.assets?: ChatAssetRef[]` stores the refs next to `text`; messages are drawn with `chips({refs})` giving
  the CURRENT name, or a greyed "removed" chip when the asset is gone. The Claude conversation (`apiBlocks`) is replayed verbatim
  and keeps old names; every turn's context carries the current catalogue (§5.4), so Claude sees renames.
- **Assistant text.** Claude writes `{{name}}` in its replies ("I used {{school_logo}} on the title slide"). Main validates each
  token against the library before streaming it: an unknown one is rewritten to the bare word (`school_logo`) so no dead chip
  appears (`sanitiseAssistantTokens`, WP8).

### 2.6 Picture habits in the style profile

`StyleProfile.pictures?: PictureHabits` (optional, so every existing profile still parses):

```ts
interface PictureHabits {
  lines: string[]            // general lines for "Picture habits": position and size, kinds used, slide types with none
  slideKinds: Array<{ kind: SlideKind; pictures: 'always' | 'usually' | 'sometimes' | 'never'; typicalBox: Box | null }>
  placements: Array<{ assetId; slideKind: SlideKind | 'every'; anchor: 'top-left' | … | 'bottom-right'; widthUnits; marginUnits; decks }>
}
```

The per-asset lines of A6 ("`school_logo` in the top-right corner of every title slide") are NOT stored: they are written from
`placements` with each asset's current name (`placementLine`), so a rename or a delete never leaves a stale sentence. Habits
are built locally and deterministically from facts by `buildPictureHabits` (§5.3); `applyStyleCorrection` may edit them
("I never use the owl on title slides" removes a placement rule).

### 2.7 Storage layout (data folder)

Under `<dataRoot>/modules/assets/` (`ctx.dataDir`), written with the helpers in `src/main/services/fsx.ts`
(`atomicWriteJson`: temp file then rename with retry; `readJsonSafe` never throws):

```
index.json                 { schemaVersion: 1, assets: Asset[], updatedAt }   a CACHE of the per-asset meta files
library/<assetId>/
  file<ext>                the original, byte for byte (SVG sanitised)
  meta.json                the Asset (the source of truth for that asset)
  thumb.png                256 px, derived, may be missing
review/<batchId>/
  batch.json               ReviewBatch + candidates (names, kinds, keep flags, left-out reasons)
  <candidateId><ext>       the cut-out pictures waiting for review (so a restart does not lose them)
online/<resultId>.json     last search page cache, 10 minutes; thumbnails in memory only
describe-cache.json        sha256 -> { title, name, kind, description, tags } (so a picture is described once)
deleted/<assetId>/         soft-deleted assets for 7 days (same layout as library/<id>)
```

And per style (existing folder `modules/style-library/<styleId>/sources/`): `<sourceId>.pictures.json` = `PictureFactsFile`
(slides and pictures seen in that file; schema `pictureFactsFileSchema`), so habits can be rebuilt when files are added,
removed or restored without reading decks again; and the lesson folder gets the copies of §2.4.

- **Write order.** For every add, edit or delete: (1) write the asset's file(s), (2) write `meta.json`, (3) rewrite `index.json`.
  A crash between 2 and 3 only leaves the index one asset behind. All writes go through one mutex per module.
- **Load.** Parse `index.json` with `safeParseAssetIndex`. If it is missing or invalid: **rebuild** by listing `library/*`, parsing
  each `meta.json` with `safeParseAsset`, checking that `file<ext>` exists and its `sha256` matches (a mismatch keeps the asset,
  re-hashes it and logs); folders that fail go to `library/_damaged/<id>` untouched. Then rewrite the index and, if anything was
  rebuilt, show a one-time Toast on the Assets page: "Your library was tidied up. {n} assets recovered." (and "{m} could not be
  read and were set aside." when m > 0). Never crash, never show an empty library because one file is damaged.
- **Names.** On load, if two assets share a name (a restored delete, a hand edit), the newer one is renamed with `uniqueAssetName`.
- **Purge.** `deleted/*` older than 7 days is removed at start-up; an unreviewed `review/*` batch is kept for 30 days.
- **Seed** (tests and screenshots): `SLIDE_PLANNER_SEED=assets` writes the 12 assets of A1 with generated SVG pictures and one pending review batch
  (`src/main/dev/seed.ts` amendment, WP1).

---

## 3. Screens

Format as in `design/screens/*.md`. Images: `desing_asset/images/A<n>-*.png` (1440 px wide boards); mockup sources
`desing_asset/canvas/project/*.dc.html`. Copy marked **(new)** is not in a mockup and needs the owner's eye; everything else
is copied from the mockups. Tokens, spacing, radii, borders and shadows are the design system's (`design/design-system.md`):
2px ink borders, hard offset shadows, category pastels for pills. Component names are the design system's unless listed in §3.0.

### 3.0 Common to all screens

**New UI-kit components** (`src/renderer/src/ui/assets/`, each with a co-located `.css` and `.test.tsx`; presentational, no IPC):

| Component | What |
|---|---|
| `AssetChip` | Pill with a 20 px round thumbnail and the mono name (`school_logo`); variants `inline` (in text), `composer` (removable), `removed` (greyed, "removed"). Hover or focus shows a popover with the picture, title and kind |
| `AssetTile` | Square tile: thumbnail on a lavender tint and the mono name, truncated with an ellipsis; `selected` = orange ring; used in pickers and sheets |
| `AssetCard` | A1 and A8 grid card: thumbnail area (120 px), title 800, name pill (mono, mint tint), kind and "14 lessons"; states `selected` (orange offset shadow), `selectable` (checkbox top-left), `checked` |
| `AssetGrid` | Roving-tabindex grid (arrow keys) of `AssetCard` or `AssetTile`; virtualises beyond 120 items |
| `FilterPills` | Row of `ToggleChip`s from `ASSET_FILTERS`/`visibleFilters`, with counts on All ("All · 12"); scrolls sideways in narrow sheets |
| `SelectionBar` | Dark bar: "{n} selected" 800 + hint, Clear (outline), action Button |
| `LicenceBadge` | Small pill: green for CC0 and public domain, blue for CC BY and CC BY-SA, amber "Check licence" for NC, ND and unknown |
| `FitControl` | Two `RadioPill`s (fit / fill) plus the optional "Replace what's underneath" `Checkbox`; wording differs per screen (props) |
| `AssetSheet` | The side sheet frame that replaces the chat panel's content (like `PluginSheet`, 07): `CardHeaderBand` (mint) with a back `IconButton`, title, subtitle and an optional round badge; scrolling body; sticky footer with Cancel/Skip and the primary button |
| `AssetPicker` | The shared picker: search, `FilterPills`, "Recently used", suggestions, "All assets · N" grid. Modes `insert` (A4), `place` (A11), `spot` (A13 first tab). Emits `onPick(assetId)` |
| `SpotMark` | The dashed "Picture spot" box with description and "Fill this spot" button (stage overlay); also the faint dashed box for thumbnails |
| `SpotsCard` | Dashed card in the chat: icon, "{n} picture spots to fill" 800, small orange button "Fill the first one" |
| `RegionActionBar` | The floating bar by a circled area: "Add asset here", "Ask Claude", × |
| `OnlineResultCard` | A9 and A13 result: thumbnail, title, source small, `LicenceBadge`, checkbox in A9 |

**Hooks** (in `src/modules/assets/ui/hooks`; the editor's own hooks in `src/modules/deck-builder/ui/hooks` call the same contract with
`useClient<AssetsApi>(ASSETS)`): `useAssets(query)`, `useAssetChips(refs)`, `useReview()`, `useOnlineSearch()`, `useMakeJob()`. Every hook has a
fake in `@test/*` so component tests need no IPC.

**Navigation and intents.** The `assets` module accepts `{ kind: 'library' }` (default), `{ kind: 'review', batchId?: string }`,
`{ kind: 'online', query?: string }` and `{ kind: 'make', basedOn?: string[] }`. Other modules open it with
`window.__shell.navigate('assets', intent)` through the module bus helper. Deep links used below: A6 "Review assets" →
`{ kind: 'review', batchId }`; A4 "Open library" → `{ kind: 'library' }`.

**Sidebar mode.** Full Sidebar with **Assets** active on A1, A2, A8, A9; **Styles** active on A6; none on A7 first run (TitleBar only);
the editor's Rail on A3 to A5 and A10 to A13. A2 shows a back button "Assets" in its header instead of the page title row.

**Errors and AI codes.** Handlers return `Result`; failures are shown with the friendly messages of `design/ai-pipeline.md` §9
(`AiErrorCode`) and these local ones: `not-found` "That asset isn't in your library any more." · `invalid-input` the message of the
name check · `too-large` "That picture is too big." · `io` "Couldn't save that. Check there's space on this PC and try again.".

### 3.1 A1 · Your assets (library, details, "12 found" banner, tabs)

![](../desing_asset/images/A1-assets-library.png) Mockup `Main.dc.html`.

**Purpose:** see, search, name, describe and tag the pictures she reuses; get to Upload, Review, Find online and Make new.

**Owner & navigation:** module `assets`. Sidebar: Assets. Reached from the Sidebar, A6 "Review assets" (review) and A4 "Open library".

**Layout:** PageHeader row: title "Your assets" (display 800, 40 px) with the lead under it; right: search field (320 px, pill) and the
primary **Upload** button. Under it the segmented tabs, then the optional banner, then the filter row, then the content row: grid (4
columns at 1440 px, `auto-fill, minmax(176px, 1fr)`) and the **detail pane** (380 px, sticky, Card shadow lg). At < 1100 px the pane
becomes a sheet over the grid (opened by selecting a card).

**Components:** PageHeader, TextField (search), Button (primary Upload, secondary Select), segmented tabs (`RadioPill` group), Callout
(banner), `FilterPills`, Select ("From"), `AssetCard`, Card (detail), TextField (mono), TextArea, `ToggleChip` (tags), Button, IconButton.

**Content & copy (exact):**

| Element | Text |
|---|---|
| Title / lead | "Your assets" · "Logos, icons and pictures you use again and again. Add them to any lesson with + › Add asset." |
| Search placeholder | "Search: logo, beaker, owl…" |
| Upload | "Upload" (upload icon) |
| Tabs | "Your assets · 12" · "Find online" |
| Banner | title "12 assets found while learning your Science KS3 style" · body "Check them before they go into your library. Nothing is added until you say so." · button "Review 12" (dark, arrow) |
| Filters | "All · 12", "Logos", "Icons", "Pictures", "Diagrams", "Banners", "Characters" (+ "Symbol cards" only when she has some) |
| Select / From | "Select" (checkbox icon) · "From" · options "Anywhere", "{Style name} style" (one per style that found assets), "Uploaded by me", "Picked online", "Made with Claude" (the last two only when she has some) |
| Card | title ("School logo"), name pill (`school_logo`), kind ("Logo"), "14 lessons" / "1 lesson" / "Not used yet" |
| Detail | heading = title · "Name in chat" · helper "Type {{school_logo}} in the chat, or pick it from + › Add asset." · "What it is" + " (Claude reads this)" · "Tags" · "+ Tag" · "Found in" "Y8 Photosynthesis.pptx, slide 1 and 23 other decks" · "Used in" "14 lessons" (link) · buttons "Use in a lesson", "Replace file", delete (trash IconButton, `aria-label="Delete school_logo"`) |
| Found in (variants) (new) | one deck "Found in Y8 Photosynthesis.pptx, slide 1" · none "Added by you" / "Picked online" / "Made with Claude" |
| Online assets (new) | the detail pane also shows the source line "Wikimedia Commons" + licence badge and "Open source page ↗" and, when a credit is needed, the credit text read-only |

**Data:** `assets:list(query)` → `AssetPage` (`items`, `total`, `libraryCount`, `counts`, `froms`, `cursor`, `pendingReview`);
`assets:get` for the pane; `assets:usage` for the "Used in" link (lesson titles and slide numbers, a small popover list; clicking a
lesson opens it in the editor); `events: assets:changed`, `assets:review:changed` refresh the page.

**States:**

| State | What shows |
|---|---|
| Loading | six skeleton cards; header and tabs are already there |
| Empty library, nothing pending | EmptyState (new): "No assets yet" · "Upload pictures, or let Slide Planner find the ones in your old decks when you learn a style." · Buttons "Upload" and "Find online" |
| Search with no match (new) | "Nothing matches “{query}”." and a "Clear search" link |
| Banner | shown while `pendingReview` is not null; hidden once reviewed. Its title keeps the count found so far and the button reads "Review {n}" (the review screen itself shows "Still reading 1 file") |
| Selected card | orange offset shadow; detail pane filled; first card is selected on load |
| Name invalid (new) | the field border turns red and the message of §2.2 shows under it in place of the helper; the old name stays until a valid one is saved |
| Delete (new) | `ConfirmDialog` only when `usedInCount > 0`: title "Delete {name}?" · body "It's used in {n} lessons. Those lessons keep their own copy." · buttons "Delete" / "Keep it". Otherwise delete at once with Toast "{name} deleted" + "Undo" (7 days: `assets:restore`) |
| Replace file (new) | native dialog for an image; Toast "{name} now uses the new file. Lessons that already use it keep the old one." |
| Library rebuilt | Toast of §2.7 |
| Error | inline error banner with Retry for `io` |

**Interactions & behaviour:**
1. Selecting a card (click, Enter) fills the pane. Editing happens in place: the name saves on blur or Enter when valid
   (`assets:checkName` runs 150 ms after the last key; `assets:rename` is the check that counts); description and title on blur
   (max 400 / 60 characters, counter appears at 90%); tags: typing in "+ Tag" then Enter or comma adds, × on a tag removes
   (lower-case, at most 12 tags of 24 characters, no duplicates).
2. **Use in a lesson** opens a small menu "Which lesson?" (new) with her five most recent lessons (title, slide count) and "Start a new
   lesson". Choosing one navigates to the editor with intent `{ kind: 'lesson', lessonId, composerText: '{{name}} ' }` so the chip is
   already in the composer and focus is there. With no lessons the button is disabled ("Make a lesson first" tooltip).
3. **Select** switches to selection mode (A8): the button becomes "Done selecting" (butter fill), cards show checkboxes, the
   detail pane is replaced by the make-new panel once at least one card is ticked (§3.8).
4. Filters and From combine; counts on the pills ignore the search so they never jump. The grid pages 60 at a time on scroll.
5. **Upload** opens the native dialog (multi-select: png jpg jpeg webp gif svg pdf pptx) → `assets:add:pick`; drops anywhere on
   the page do the same (`assets:add:paths`). A review batch opens (A2) with the files "being cut out".
6. The banner's button goes to A2. A "found" count that is 0 never shows the banner.

**Keyboard & a11y:** the grid is one tab stop (roving tabindex, arrows move, Enter selects, Space ticks in selection mode, Delete asks
to delete); `/` focuses search; the pane is a `region` labelled with the asset title; the name field has `aria-describedby` for
the helper or the error; status changes (saved, deleted) use a polite live region; cards are `role="button"` with
`aria-pressed`; thumbnails have `alt=""` because the title is text beside them.

**Acceptance criteria:**
- 12 seeded assets render as in A1 (title, name pill, kind, "n lessons"); the first is selected and the pane shows its values.
- Typing a taken name shows "You already have an asset called owl_mascot." and nothing is saved; a valid one saves and the card's pill updates.
- Adding a tag and removing it persists after reload; the asset's description edit persists.
- The banner shows "12 assets found while learning your Science KS3 style" with "Review 12" and opens A2; it disappears after Keep.
- Delete of an unused asset shows the Toast with Undo and Undo restores the asset with its name.
- Search "beak" finds `beaker_icon`; filters and counts match `ASSET_FILTERS`.

### 3.2 A2 · Check what I found (review before saving)

![](../desing_asset/images/A2-review-found-assets.png) Mockup `Review.dc.html`.

**Purpose:** nothing found automatically is saved until she says so: tick what to keep, fix names, see why something was left out.

**Owner & navigation:** module `assets`, intent `{ kind: 'review', batchId? }`. Reached from the A1 banner, A6 "Review assets", after
Upload (the batch opens straight away while it is still being cut out), and A9 "Add n to Your assets" (several picks).

**Layout:** header row (padding 14 × 24): secondary pill button "‹ Assets" (back), title "Check what I found" (display 800, 28 px),
spacer, `StatusPill` "Still reading 1 file" (butter, animated dots, only while working), primary "Keep 9 assets". Body: two columns on a
lilac page: left Card "Where I looked" (360 px), right Card (rest) with a yellow `CardHeaderBand` and a 3-column grid of candidate
cards (`minmax(220px, 1fr)`). Below 1100 px the columns stack.

**Content & copy (exact):**

| Element | Text |
|---|---|
| Left card | "Where I looked" · section label "WHILE LEARNING SCIENCE KS3" · rows `FileTypeBadge` (PPTX / PDF) + file name + "4 found" · collapsed row "+5" "5 more decks" "3 found" (expands on click) · section "UPLOADED JUST NOW" · row "Y7 icon sheet.pdf" with `ProgressBar` and "Cutting out pictures · page 4 of 6" · dashed Dropzone (compact) "Add images, a PDF or a PowerPoint" / "I'll cut out each picture and name it" · info Callout "I leave out photos that might show pupils, blurry pictures and repeats. Tick them if you want them anyway." |
| Right header | "Found 12 · keeping 9" · pills "All", "Keeping", "Left out" |
| Candidate | `Checkbox` "Keep" · thumbnail on a lavender tint · name field (mono) · kind pill ("Logo", "Banner", "Character", "Icon", "Diagram", …) · "In 24 decks" |
| Left-out candidate | dashed border, unticked, reason pill instead of the kind: "May show pupils · left out" · "Blurry · left out" · "Older version of school_logo" · (new) "Small picture · left out" · "Looks like a slide background · left out" · "Can't read this picture · left out" · "Already in Your assets" |
| Primary button | "Keep 9 assets" ("Keep 1 asset"; disabled "Nothing to keep" at 0) |
| Origin names (new) | "WHILE LEARNING {STYLE NAME}" · "UPLOADED JUST NOW" · "PICKED ONLINE" |

**Data:** `assets:review:get` → `ReviewView` (`batches`, `candidates`, `found`, `keeping`, `leftOut`, `stillReading`) and the
event `assets:review:changed` for live progress; `assets:review:edit` per change; `assets:review:accept({ batchId? })`;
`assets:review:dismiss`. The left-out reasons are the extraction service's (`LeftOutReason`: pupils, blurry, older-version,
low-resolution, background, unreadable) plus `duplicate`.

**States:**

| State | What shows |
|---|---|
| Reading | the status pill; candidates appear as each file finishes; Keep works on what is there; leaving and coming back keeps the batch |
| Nothing found (new) | EmptyState "I couldn't find any pictures to reuse in these files." · "Scanned pages and one-off photos are left out. You can still upload pictures yourself." · Button "Back to Assets" |
| A file failed (new) | its row shows `StatusPill` peach "Couldn't read" and a "Try again" link; the others carry on (reasons: password, scanned, corrupt) |
| Name problem | the candidate's field turns red with the message of §2.2 under it; **Keep** is disabled with `aria-describedby` pointing at the first problem; names are also unique across the batch |
| Filter empty | "Nothing here." in the grid |

**Interactions & behaviour:**
1. Ticking "Keep" toggles `keep`; suggestions (9 of 12) come from `FoundAsset.keep` (repeated in several decks, not left out). Ticking a
   left-out card keeps it (she overrides the app); the reason pill stays so she remembers why it was flagged.
2. Editing a name validates on blur and on Enter (`review:edit` returns `invalid-input` with the message). Clicking the kind
   pill opens a small Select of the eight kinds.
3. **Keep N assets** = `review:accept`: saves the ticked candidates into the library (files, thumbnails, descriptions, `foundIn`,
   licence `unknown`), then goes to A1 with Toast "{n} assets added to Your assets" + "Undo" (undo = soft-delete those ids). While files
   are still being read the batch stays open for the rest; the label then reads "Keep {n} assets" with the pill still showing.
4. Leaving with the back button keeps the batch ("Nothing is added until you say so"); a "Throw these away" text link at the foot of
   the left card (new) opens a `ConfirmDialog` "Throw these away?" / "Nothing from these files will be saved." / "Throw away" / "Keep looking" and calls `review:dismiss`.
5. The dropzone and a drop anywhere add files to a new "Uploaded just now" batch with the same flow (images are described
   immediately; a PDF or PowerPoint is cut out first). PDFs of scanned pages say "This PDF is only scanned pages, so there's nothing
   to cut out." on its row.
6. Photos that might show pupils are heuristics (`maybePupils`) and are **never** ticked; they never leave the PC either way (§7).

**Keyboard & a11y:** the grid is a roving-tabindex list; Space toggles Keep on the focused card; the status pill is `role="status"`;
progress bars have `aria-valuenow`; the "Keep" button reads "Keep 9 assets" for screen readers with the count.

**Acceptance criteria:**
- The A2 fixture shows nine ticked cards and three dashed unticked cards with the exact reason pills; the header reads "Found 12 · keeping 9" and the button "Keep 9 assets".
- Unticking one updates both counts at once; ticking "class_photo" makes it "keeping 10" and the button "Keep 10 assets".
- A taken name disables Keep and shows the message; fixing it re-enables it.
- Keep saves exactly the ticked ones, the library count rises by that number, the banner on A1 disappears, Undo removes them again.
- Closing and reopening the app keeps an unreviewed batch (pictures and edited names included).

### 3.3 A3 · The + menu with "Add asset"

![](../desing_asset/images/A3-plus-menu.png) Mockup `PlusMenu.dc.html`. This changes `design/screens/06-editor.md` §8.7.

**Purpose:** one place in the editor to add something: an asset from the library, or a plugin.

**Owner & navigation:** module `deck-builder` (`PluginMenu`, extended). Opened by the + in the Composer (and "/" at the start of an empty message).

**Layout:** the existing PluginMenu card (white, 2px ink, radius 20, shadow) with a new full-width tile above the plugin rows.

**Content & copy (exact):** header "What shall we add?" and link "Manage" · tile **"Add asset"** with the line "A logo, icon or picture from your library" and a dark pill
"New" · section label "MAKE WITH CLAUDE" · tiles Quiz (peach), Differentiate (sky), Worksheet (mint), Speaker notes (butter), Starter & plenary (lilac), dashed "More plugins".

**Behaviour:**
1. "Add asset" is a built-in tile, not a plugin: it is not in Manage, cannot be disabled, and does not need slides (it works in a blank lesson;
   in an empty deck the picker's "place" actions are unavailable, only chip insertion works).
2. Activating it (click, Enter, Space) closes the menu and opens the picker sheet (A4) in `insert` mode; Esc in the sheet returns focus to +.
3. The "New" pill shows until she has used the tile three times (stored in `settings` preferences `assetsMenuUses`; amendment §4.4).
4. Keyboard: it is the first tile; arrows and Home/End as the other tiles; tile has `role="menuitem"`, `aria-description` = its line.
5. Disabled (`aria-disabled`) while a job runs only if the text composer is disabled too; otherwise enabled.

**Acceptance criteria:** the tile is first, shows the three texts exactly, opens the picker; "New" is gone after the third use; the menu's existing behaviour is unchanged.

### 3.4 A4 · Asset picker in the editor

![](../desing_asset/images/A4-asset-picker.png) Mockup `EditorPicker.dc.html`.

**Purpose:** pick an asset and drop its chip into the message.

**Owner & navigation:** module `deck-builder`, component `AssetPicker` (UI kit) in an `AssetSheet`-like card **over the chat panel**: it covers the lower part of the chat, above the Composer, so the slide stays visible. Opened from A3, or as a popover when `{{` is typed.

**Layout:** card anchored above the Composer (2px ink, radius 18, shadow), header row (back ‹ IconButton, title, × IconButton), search field, filter pills, then a scrolling body: "RECENTLY USED" (3 tiles), "ALL ASSETS · 12" (3-column grid), a footer line with the tip and a link.

**Content & copy (exact):** title "Add an asset" · search "Search assets" (placeholder "Search: logo, beaker, owl…" in A4's field) · pills "All", "Logos", "Icons", "Pictures", "Diagrams" (the rest scroll) · "RECENTLY USED" · "ALL ASSETS · 12" · tiles show the mono names (long ones end with "…") ·
footer "Tip: type {{ in the chat to pick one" · "Open library".

**Data:** `assets:list({ search, filter, limit: 60 })`; recently used = `recentlyUsed` (assets with `lastUsedAt`, newest 3) from the same call (sorted `recent`).

**States:** empty library (new): "You don't have any assets yet." + "Open library" and "Find online" links; no matches: "No asset called “{query}”." ; typed-token mode: the search field is hidden and mirrors the typed letters in the composer.

**Interactions:** click or Enter on a tile **inserts `{{name}}` at the caret** in the Composer (`insertAssetToken`, or `completeOpenToken` in typed mode),
closes the picker and puts focus back in the Composer; the first tile is pre-focused; arrows move; typing filters; Esc closes without changing the text;
"Open library" opens A1 (the composer text and chips are kept as a draft). The picker never places anything by itself: placement happens when she sends the message
(Claude's `place_asset` tool, §5.4) or through A11 and A13.

**Acceptance criteria:** opening shows recent and all assets; choosing `school_logo` adds a `school_logo` chip to the message and closes the picker; typing `{{sch` shows the same picker filtered to school_logo and Enter completes it; Esc leaves the text as typed.

### 3.5 A5 · An asset chip in the chat, placed and adjusted

![](../desing_asset/images/A5-asset-in-chat.png) Mockup `EditorChip.dc.html`.

**Purpose:** use assets in plain words; every change is one undo step.

**Owner & navigation:** module `deck-builder` (Composer, MessageUser, MessageAssistant, SlideStage selection tag).

**Content & copy (exact, the mockup conversation):**
- user: "Put {{school_logo}} in the top right" → assistant: "Done! {{school_logo}} is in the top-right corner of slide 3, the size you use on your title slides." + ResultChip "Slide 3 changed" + "Undo".
- user: "Make it a bit smaller and line it up with the title" → assistant: "Shrunk it by a third and moved it level with the title." + "Slide 3 changed" + "Undo".
- composer draft: "Now add {{owl_mascot}} next to the question box, a bit smaller" + "Send".
- on the slide: the placed picture has an orange selection outline and a name tag `school_logo` pill above-left of it.

**Layout and components:** chips are inline pills (`AssetChip`): 2px ink, full radius, mint tint, 20 px round thumbnail, mono 13 px name. In a user bubble (lilac) they sit on the text baseline; in the Composer they are removable (Backspace, or × on focus). The stage's element selection tag shows `element.name` (the asset's chat name at placement).

**Behaviour:**
1. The message goes through the normal chat flow (`chat:send` with `assetRefs`). Claude sees the asset's name, kind and description in its catalogue (§5.4) and calls `place_asset({ asset, slideId, anchor | box | region, widthUnits? })`; main copies the file into the lesson (§2.4), builds the ops with `buildPlaceOps` and applies ONE ChangeSet (summary e.g. "Added school_logo to slide 3").
2. "The size you use on your title slides" comes from the style's `placements` (a rule for `school_logo` on `title` slides: anchor and `widthUnits`); with no rule Claude uses 240 units wide, 48 from the corner.
3. Follow-ups ("make it a bit smaller") are ordinary `apply_changes` on the element, which Claude finds by `name`.
4. Claude never invents an asset: an unknown `{{name}}` is refused by the composer; a name that disappeared gives the assistant a normal error message.
5. Undo reverts the ChangeSet (picture and credit note line); the file stays in the lesson folder (harmless; removed with the lesson).

**Acceptance criteria:** with the fake AI the exchange above produces an image element with `assetId`, `name: 'school_logo'`, anchored top-right with the 48-unit margin, the ResultChip and an Undo that removes it; chips render with the current name after a rename; a deleted asset's chip shows "removed".

### 3.6 A6 · Create a style: picture habits and assets found

![](../desing_asset/images/A6-style-picture-habits-and-assets.png) Mockup `StyleAssets.dc.html`. Extends `design/screens/04-create-style.md`.

**Purpose:** learning a style now also learns how she uses pictures and finds the pictures she reuses, so lessons can use them.

**Owner & navigation:** module `style-library` (the "What I've learned so far" panel). Sidebar: Styles. Two new cards at the bottom of the learned panel, above "Anything I got wrong?".

**Layout:** full-width card **Picture habits** (check list, like "Layout habits" but one column), then full-width card **Assets I found**: header row (title, count pill, right-aligned dark button), lead text, a row of six `AssetTile`s, then the existing correction box.

**Content & copy (exact):**

| Element | Text |
|---|---|
| Picture habits | title "Picture habits" · five check lines in the mockup: "A picture on the right of most content slides, about a third of the slide" · "{{school_logo}} in the top-right corner of every title slide" · "{{timer_icon}} next to the title on Do Now slides" · "Mostly real photos and simple line icons; labelled diagrams for processes" · "No pictures on objectives-only or exit-ticket slides" (tokens draw as chips) |
| Assets I found | title "Assets I found" · pill "12 found · 9 suggested" · button "Review assets" (dark) · lead "Logos, icons and pictures you reuse across your decks. Check them and they'll be saved to Your assets, ready for any lesson." · tiles `school_logo`, `do_now_banner`, `owl_mascot`, `beaker_icon`, `timer_icon`, `plant_cell…` |
| Corrections | "Anything I got wrong?" · placeholder "e.g. I never use yellow on title slides" · "Tell me" (unchanged) |

**Data:** `StyleProfileView` gains `pictureHabits: string[]` (lines with `{{name}}` tokens: general lines first, then one `placementLine` per rule with current names) and `assetsFound: { found: number; suggested: number; saved: number; batchId: string | null; preview: AssetChip[] }` (amendment §4.3);
the "Review assets" button navigates to `assets` with `{ kind: 'review', batchId }`. `StyleDraftView.progress` gets a stage note "Looking at your pictures" (§4.3). Updates arrive on `style-library:progress` like the rest.

**States:** while files are still being read the card keeps updating; before the first file is read both cards show 3 skeleton lines (Picture habits) / nothing (Assets). **No pictures** in the learned files: Picture habits shows "No pictures found in these files." and the Assets card is hidden. **Saved:** after she keeps assets the pill reads "9 saved to Your assets" (mint) and the button "Open Assets". A **single deck** (fewer than two files) shows habits with the caption "Based on 1 deck. More decks make this surer." under the list (new). Picture-habit lines come from §5.3, so they can differ in wording from the mockup's hand-written ones.

**Behaviour:** habits are rebuilt whenever files are added, removed or restored (facts are cached per file, §2.7); suggested = ticked by default in A2; **Save style does not wait for the review** (she can review later from A1). A correction such as "I never use the owl on title slides" goes through `applyStyleCorrection`, which edits `pictures.placements`.

**Acceptance criteria:** with the fake AI and the seeded decks the Picture habits card lists the general lines and one chip line per placement; the Assets card shows "12 found · 9 suggested" and the first six tiles; "Review assets" opens A2 with that batch; after Keep the card shows "9 saved to Your assets".

### 3.7 A7 · Setup: Claude and an optional picture maker

![](../desing_asset/images/A7-setup-picture-maker.png) Mockup `ConnectAI.dc.html`. Extends `design/screens/02-connect-claude.md` (first run and Settings › AI).

**Purpose:** optionally connect Google's Nano Banana Pro so "Make a new one like these" and "Make one" can create photo-like pictures.

**Owner & navigation:** module `settings` (`ApiKeyForm`). Sidebar: none on first run, Settings active in Settings › AI. The new section sits under the Model select.

**Layout:** a butter Callout card (2px ink, radius 16): icon tile (white, 2px ink, image icon), title row "Add a picture maker" + dark pill "Optional", lead, label, key row (input + Show), helper, action row: "Test picture maker" button, StatusPill, and a text link on the right. The page footer (Skip for now · Next: your style) is unchanged.

**Content & copy (exact):**
"Add a picture maker" · pill "Optional" · "Google's **Nano Banana Pro** makes new pictures in your style when you use “Make a new one like these” on the Assets page. Without it, Claude draws simple icons and diagrams instead." ·
label "Google AI Studio API key" · key field masked, "Show" · helper "Get a key at aistudio.google.com ↗. Google bills it per picture. Stored encrypted on this computer, like your Claude key." (link opens `https://aistudio.google.com/` externally) ·
button "Test picture maker" · pill "Connected" · link "Skip — I'll add it later".

**Extra copy (new):** skipped state line "Picture maker skipped. You can add it any time in Settings › AI." · Settings variant adds "Remove key" link and, once connected, a Select "Picture maker model": "Nano Banana Pro — best quality (recommended)" / "Nano Banana 2.1 — faster and cheaper" with a note "About $0.13 a picture" / "About $0.03 a picture" (from `PICTURE_PRICES_USD`, shown as "about") ·
errors: bad shape "That doesn't look like a Google key. They start with AIza." · `invalid-key` "Google didn't accept that key." · `no-credit` "Google says this key has no credit. Picture makers need a paid Google project (a $5 top-up)." · `rate-limited` "Google is busy. Try again in a minute." · `network` "Couldn't reach Google. Check your internet." · `model-unavailable` "That picture maker isn't available on this key." (mapped by `mapGeminiHttpError`, `agents/assets/PROVIDERS.md` §6.4).

**Data:** `settings:getPictureMakerStatus`, `setPictureMakerKey`, `testPictureMaker`, `removePictureMakerKey`, `skipPictureMaker`, `setPictureMakerModel` and event `pictureMakerStatusChanged` (§4.4). The key lives in main only (`safeStorage`, a second secret next to the Claude key); only `keyLast4` reaches the renderer.

**Behaviour:** the section never blocks "Next: your style" and is never required. "Test picture maker" stores the typed key (if any), sends ONE tiny real request (`testPictureMaker`: a one-word image prompt at 1K, ≈ $0.13 on Pro, so the helper under the button says "A test costs about 13 cents." (new)) and shows Connected or the error. "Next: your style" saves an untested typed key without testing it. "Skip — I'll add it later" collapses the section and records `skipped`. The Claude key flow above is untouched.

**Acceptance criteria:** section hidden key is masked and never returned; a good fake test shows "Connected"; each error code above shows its message; skip collapses to the skipped line; Settings shows Remove; with no key `assets:make:mode` is `vector`.

### 3.8 A8 · Make a new asset in the same style

![](../desing_asset/images/A8-make-new-asset.png) Mockup `MakeNew.dc.html`.

**Purpose:** pick a few assets, describe a new one, get 2 or 4 versions in the same look, keep one.

**Owner & navigation:** module `assets`, A1 in selection mode. Sidebar: Assets.

**Layout:** under the tabs a **dark SelectionBar** (rounded 20, ink fill): "3 selected" 800 + "Pick a few that show the look you want", **Clear** (outline), orange "Make a new one like these". The filter row ends with "Done selecting" (butter) and "From". The grid has checkboxes; the right pane (380 px) is the **Make** panel: yellow `CardHeaderBand` "Make a new one like these" with "Same lines, colours and feel as the ones you picked"; "Based on" thumbnails with × (28 px round); "What should it be?" TextArea; row "Versions" `RadioPill`s "2" "4" + dark Button "Make 4"; divider; "Pick the one you like" 2 × 2 grid labelled 1 to 4 (selected: butter fill, orange offset shadow); "Name in chat" field (mono); buttons "Keep version 3" (primary) and "Try again" (secondary).

**Content & copy (exact):** as above; defaults: Versions "4", name prefilled from the request (`bunsen_burner_icon`), button labels follow the choice ("Make 2" / "Make 4", "Keep version {n}").

**Extra copy (new):** under "Make 4": "About 54 cents · Google bills this" (from `make:mode.perPictureUsd × versions`; hidden in vector mode) · vector mode lead "No picture maker connected, so Claude will draw this as a simple icon or diagram." with link "Add a picture maker" (Settings › AI) · when the request asks for a photo in vector mode, Callout "Photo-like pictures need the picture maker. Add one in Settings › AI, or try Find online." · while working: tiles show a shimmer and the line "Looking at your pictures…" then "Drawing…" · a failed version shows "Didn't work" with a small "Try this one again" · footnote "Pictures made with Nano Banana Pro carry an invisible Google watermark." · empty prompt: "Make 4" disabled · the ticked assets limit is 6 (the 7th shows Toast "Pick up to 6 so the look stays clear.").

**Data:** `assets:make:mode` → `{ mode: 'picture-maker' | 'vector' | 'unavailable', modelLabel, perPictureUsd }`; `assets:make:start({ basedOn, prompt, versions, kind? })` → `{ jobId }`; events `assets:make:progress` (`stage` describing → drawing → done, `versions[]` with `thumbDataUrl`, `styleDescription`); `assets:make:keep({ jobId, version, name, title?, kind? })`; `assets:make:cancel`.

**Behaviour:**
1. Ticking cards fills "Based on"; × on a thumbnail unticks it. **Make** starts a job (§5.6): Claude looks at the ticked assets (thumbnails) and writes a style description; the picture maker (or Claude's SVG drawing in vector mode) draws N versions in parallel (concurrency 2); versions appear as they finish.
2. A version is selected by click or its number; **Keep version 3** saves it as an asset (source `generated`, `basedOn`, the prompt; licence "Made for you"; credit line "Picture made with Nano Banana Pro (AI-generated)." or "Picture drawn by Claude." (new) with `inNotes: true`), kind = most common kind of the picked assets (else `picture`; changeable later in A1), then Toast "{name} added to Your assets" and the panel resets.
3. **Try again** discards the versions and starts a new job with the same inputs. Closing the page or "Done selecting" while a job runs cancels it (Toast "Stopped. Nothing was saved.").
4. The name is validated like every name (§2.2) before Keep; a taken name keeps the button disabled.

**Keyboard & a11y:** version tiles are a `radiogroup`; the panel announces "Version 3 selected"; Make and Keep are real buttons with disabled reasons in `aria-describedby`.

**Acceptance criteria:** ticking three assets shows "3 selected" and three thumbnails in "Based on"; with the fake maker, Make 4 produces four tiles, selecting 3 and Keep creates `bunsen_burner_icon` with `source.kind === 'generated'` and the library count rises by one; without a key the vector flow works and shows the vector copy.

### 3.9 A9 · Find images online

![](../desing_asset/images/A9-find-online.png) Mockup `FindOnline.dc.html`.

**Purpose:** search free image libraries, choose a few, keep their licences and credits.

**Owner & navigation:** module `assets`, tab "Find online" (intent `{ kind: 'online', query? }`). Sidebar: Assets.

**Layout:** below the tabs: a large search row (field 56 px with a search icon, dark "Search" button), a chips row (`ToggleChip` "Free to use in lessons" checked and mint, a vertical rule, `RadioPill`s "Any" "Photos" "Drawings" "Diagrams", and "48 results from free image libraries" right-aligned), the dark SelectionBar when something is ticked, then a 3-column grid of `OnlineResultCard`s and the 380 px detail pane.

**Content & copy (exact):** search "volcano diagram" (example) · "Search" · "Free to use in lessons" · "Any" "Photos" "Drawings" "Diagrams" · "48 results from free image libraries" ·
selection bar "3 selected" + "I'll name them and keep the credits for you" + "Clear" + "Add 3 to Your assets" ·
card: title, source ("Wikimedia Commons", "Openverse"), licence pill ("CC BY-SA", "CC BY", "Public domain", "CC0") ·
detail: title, preview, "Wikimedia Commons", pill "CC BY-SA 4.0", "1600 × 1200", Callout "This one needs a credit. I'll add it to the speaker notes of any slide that uses it.", "Name in chat" (`volcano_cross_section`), buttons "Add to Your assets", "Open source page ↗".

**Extra copy (new):** first visit EmptyState "Search free image libraries" / "Try “volcano diagram” or “cave painting”. Pictures are free to use in lessons unless you switch the filter off." · no credit needed: Callout "No credit needed for this one." · amber licence (filter off): Callout "This licence doesn't cover every use. Check it before you share your slides." · no results "Nothing found for “{query}”. Try fewer or simpler words." (+ "or untick Free to use in lessons." when it is on) · busy "The image libraries are busy. Try again in a minute." with "Try again" · one library down "{Openverse} didn't answer. Showing the others." · "Show more" button after the grid (up to 5 pages of 24) · after adding: Toast "{name} added to Your assets" + "Undo".

**Data:** `assets:online:search({ query, kind, freeToUse, page })` → `OnlineSearchResult` (`results` with data-URL thumbnails fetched by main, `total`, `hasMore`, `providers[]`); `assets:online:add({ items: [{ id, name? }], mode })`. Providers and limits: `agents/assets/PROVIDERS.md` (Wikimedia Commons and Openverse on; Pexels only with a key; Openverse anonymous limit 20 searches a minute, 200 a day, cached 10 minutes). The renderer is offline: only the query text goes out, from main (§7).

**Behaviour:** Enter or "Search" searches; changing a chip re-searches. One result selected (click) fills the pane; ticking checkboxes builds the selection. **"Add to Your assets"** in the pane saves that one now (`mode: 'direct'`: download with `downloadImage`, describe with Claude (cheap, §5.2) only if she left the name untouched, save with licence and credit). **"Add n to Your assets"** (several) creates a review batch of origin "online" and opens A2 (`mode: 'review'`), because names and descriptions are proposed by Claude and the README promises review for anything picked online (§10). "Open source page ↗" opens the page in the default browser.

**Acceptance criteria:** a fake search returns 48 results across two providers with correct licences; ticking three shows "3 selected"; the single add saves with `source.kind === 'online'`, the licence and the credit text; the several-add opens A2 with three candidates and origin "PICKED ONLINE"; an NC result shows the amber callout only when the filter is off.

### 3.10 A10 · Circle something → Add asset here

![](../desing_asset/images/A10-circle-add-asset.png) Mockup `RegionAction.dc.html`. Extends `design/screens/06-editor.md` §8.4.

**Purpose:** after circling an area, offer to put an asset there.

**Owner & navigation:** module `deck-builder` (`RegionOverlay`, new `RegionActionBar`). Circle tool active (C).

**Layout:** the loop (orange) with its `RegionLabel` "Region 1" (pill with a number badge) at its top-left; the **bar** is a white card (2px ink, radius 12, shadow) near the loop's bottom-right corner, clamped inside the stage: orange "Add asset here" (image icon), secondary "Ask Claude" (speech icon), × IconButton. The hint pill under the stage stays: "Circle it, then say what you want — the assistant does the rest." The composer has the region chip and the placeholder "Tell me what to do with region 1, or add an asset…".

**Content & copy (exact):** "Region 1" · "Add asset here" · "Ask Claude" · composer chip "1 Region on slide 3 ×" in the mockup (the existing spec's chip text is "{n} Slide {k} · circled"; **keep the existing chip text**, see §10 quirks) · placeholder "Tell me what to do with region 1, or add an asset…".

**Behaviour:**
1. The bar appears when the loop has snapped closed and been numbered (§8.4 step 4), attached to the **most recently drawn** region; clicking another loop or its label moves it there. Up to 9 regions as before.
2. **Add asset here** opens the A11 sheet for that region. **Ask Claude** just focuses the Composer (today's flow, no change). **×** hides the bar only; the region and its chip stay (she can still type), and the bar returns when she clicks the loop.
3. The bar never covers the loop's own label and never leaves the stage (flips above the loop near the bottom edge).
4. Esc while the bar is shown deselects the region's bar (not the region).

**Keyboard & a11y:** the bar is `role="toolbar"` with `aria-label="Region 1"`; Tab from the Composer chip reaches it; focus moves to "Add asset here" when the bar opens by keyboard (Enter on the region chip).

**Acceptance criteria:** drawing a loop shows the bar with the three controls; "Add asset here" opens the sheet titled "Add to region 1"; × hides only the bar; "Ask Claude" focuses the Composer.

### 3.11 A11 · Pick an asset, scaled to the circle

![](../desing_asset/images/A11-circle-asset-fitted.png) Mockup `RegionPicker.dc.html`.

**Purpose:** choose an asset for the circled area and see it fitted live before placing it.

**Owner & navigation:** module `deck-builder`; `AssetSheet` replaces the chat panel's content (the stage stays visible).

**Layout:** mint band header: back ‹ IconButton, title "Add to region 1" 800, subtitle "Pick an asset. I'll scale it to fit your circle.", orange round badge "1" at the right. Body: search "Search your assets…", pills "All" "Logos" "Icons" "Pictures" "Diagrams", section "SUGGESTED FOR THIS SLIDE" (3 tiles, first selected), "ALL ASSETS · 12" grid (3 columns), "How should it fit?" with `FitControl`, the Checkbox, footer "Cancel" (secondary) and "Place it" (primary orange).

**Content & copy (exact):** "Add to region 1" · "Pick an asset. I'll scale it to fit your circle." · "Search your assets…" · "SUGGESTED FOR THIS SLIDE" · "ALL ASSETS · 12" · "How should it fit?" · "Fit inside the circle" · "Fill the circle" · "Replace what’s underneath (Photo: leaf in sunlight)" · "Cancel" · "Place it" · on the slide: tag `leaf_cross_section · fitted to region 1`.
**Extra copy (new):** fill tag `leaf_cross_section · filling region 1` · low-resolution note "This picture is small, so it may look blurry at this size." · no assets "You don't have any assets yet." + "Find online" link · the checkbox label ends "(Photo: leaf in sunlight)" with the picture's `alt` or the spot's description, cut at 28 characters with "…"; the checkbox is hidden when nothing is under the circle.

**Data:** `assets:suggest({ lessonId, slideId, words? })` for the suggestions (local: name, tags, description and kind against the slide's text and the picture under the circle; no Claude call); `assets:list`; the live preview uses `resolvePlacement(slide, imageSize, target, fit)` (shared pure, §5.5); **Place it** calls `deck-builder:placeAsset` (§4.2).

**Behaviour:**
1. Picking a tile (click, Enter) selects it and draws the **preview** on the stage at once: the picture inside a dashed orange rectangle at the computed box, the replaced element hidden while "Replace" is ticked. Changing Fit / Fill or the checkbox updates the preview.
2. **Fit inside the circle** = the whole picture, never cropped, entirely inside the loop with a 6-unit inset (`fitIntoRegion(..., 'fit')`); **Fill the circle** = the loop's bounding box, cropped to it (`'fill'`, element `fit: 'cover'`).
3. **Replace what's underneath** is ticked by default when `underlyingPicture` finds an unlocked image or picture spot under the loop; it then **updates that element in place** (keeps its id and z) and a filled spot keeps its `placeholder`. Unticked, a new element is added on top.
4. **Place it** applies ONE ChangeSet ("Added {name} to slide 3" / "Replaced the photo on slide 3 with {name}"), adds the credit line to the slide's notes when needed, clears the region and its chip like a send, closes the sheet and posts a chat item "Added {{name}} to slide 3." with the ResultChip "Slide 3 changed" and Undo (no Claude call, free). The new element is selected.
5. **Cancel** or Esc closes the sheet and keeps the region.

**Keyboard & a11y:** grid arrows; Enter picks; Tab order: search, pills, tiles, fit, checkbox, Cancel, Place it; Ctrl+Enter = Place it; the sheet is `role="dialog"` non-modal with `aria-label="Add to region 1"`; focus returns to the region chip on close; the preview change is announced "leaf_cross_section fitted to region 1".

**Acceptance criteria:** with the A11 fixture the suggestions are `leaf_cross_section`, `leaf_icon`, `plant_cell_diagram` and the preview rectangle lies inside the loop; Fill gives the loop's bounding box; Place it with Replace ticked updates the placeholder image element (same id, `assetId` set) in one undo step; Undo restores the spot; a unit test of `fitIntoRegion` covers the same numbers.

### 3.12 A12 · Picture spots left by Claude

![](../desing_asset/images/A12-picture-spots.png) Mockup `SpotSlide.dc.html`.

**Purpose:** after generation, show where pictures would help, and make them easy to fill.

**Owner & navigation:** module `deck-builder` (SlideStage, Filmstrip, ChatPanel). Applies to every slide with an unfilled spot.

**Layout and copy (exact):** on the stage a spot is a dashed 2px box (radius 12, same frame as the picture it replaces) with a 32 px image icon, **"Picture spot"** (bold), the description ("A leaf in sunlight, close up", 12 px) and a small orange pill **"Fill this spot"**. Filmstrip: next to the slide number badge of every slide with spots, a dashed mini badge with an image icon and the count ("▣ 1"). Chat: assistant text "Done! 8 slides in your Science style. I used {{school_logo}} on the title slide and {{leaf_cross_section}} on slide 5." then "Where a picture would help and you don’t have one yet, I’ve left a **picture spot**. Click one to fill it." then ResultChip "8 slides added" + "Undo", then `SpotsCard`: image icon, **"3 picture spots to fill"**, orange pill **"Fill the first one"**. Composer placeholder "Paste learning objectives or ask for a change…".

**Extra copy (new):** all filled: the card turns mint "All picture spots are filled." · spot context menu "Fill this spot", "Remove this spot" · count wording "1 picture spot to fill" · export warning dialog (below).

**Behaviour:**
1. A spot is any image element where `isPictureSpot` is true (§2.3); `listPictureSpots` orders them by slide. The count on the card and the filmstrip badges are live (they drop as spots are filled or deleted, and undo brings them back).
2. Clicking a spot, its "Fill this spot" button, a filmstrip badge (opens the first spot of that slide) or "Fill the first one" opens A13 for that spot and selects its slide.
3. Spots are **editor-only**: not drawn in Present mode, thumbnails show a faint dashed box without text, nothing exports (§6). Select tool: the spot is an element (move, resize, Delete removes it like any element).
4. Generation (§5.4) writes the sentence about spots itself; if it leaves spots and forgets the sentence, main appends it, so the card is never the only hint.
5. **Export with empty spots:** `exportPptx` returns `{ status: 'spots', count, slides }` before saving; the editor shows a `ConfirmDialog` (new): title "3 picture spots are still empty" · body "They won't appear in the PowerPoint. Fill them first, or export without them." · buttons "Fill them first" (primary, opens A13 for the first) / "Export anyway" (calls `exportPptx` again with `ignoreSpots: true`).

**Keyboard & a11y:** the spot overlay button is a real `<button>` in the tab order of the stage with `aria-label="Fill picture spot: A leaf in sunlight, close up"`; the card button is reachable from the chat; the filmstrip badge is a button with `aria-label="Slide 3 has 1 picture spot"`.

**Acceptance criteria:** a deck with three spots on slides 3, 5 and 6 shows three dashed spots (one per slide), badges "1" on those thumbnails and the card "3 picture spots to fill"; clicking "Fill the first one" opens A13 "1 of 3"; filling one drops the count to 2; the export dialog appears with count 2 and "Export anyway" produces a file without them.

### 3.13 A13 · Fill a picture spot (assets · online · make one)

![](../desing_asset/images/A13-fill-picture-spot.png) Mockup `SpotPicker.dc.html`.

**Purpose:** fill the spot from her library, from free online pictures (already searched) or by making one, then move to the next spot.

**Owner & navigation:** module `deck-builder`; the same `AssetSheet` frame as A11, with three tabs.

**Layout and copy (exact):** header band: back ‹, title **"Fill this picture spot"**, subtitle "“A leaf in sunlight, close up” · slide 3 · 1 of 3". Tabs (segmented, full width) **"Your assets" · "Find online" · "Make one"**. *Find online tab:* search "leaf in sunlight close up" + "Search", chip "Free to use in lessons" (checked), a 3-column grid of results (title, `LicenceBadge`), the first selected, info Callout "It’ll also be saved to Your assets as `leaf_in_sunlight`, with its credit in the slide notes.", "How should it fit?" with **"Fit inside the spot"** and **"Fill the spot"** (selected in the mockup), footer **"Skip"** and **"Place it · next spot"**. On the stage the chosen picture fills the spot with a dashed orange outline.

**Extra copy (new):** *Your assets tab:* the A11 picker with "SUGGESTED FOR THIS SPOT" (ids from `placeholder.suggestedAssets`, then `assets:suggest` from the description) · *Make one tab:* "What should it be?" prefilled with the description, "Versions" 2 / 4, "Make 4", the 2 × 2 grid, name field and **"Use version 3"** (instead of Keep), same copy and vector fallback as A8; "Based on" is chosen by the app: up to three recent assets of the spot's `kind` (or the style's most common kind), shown as removable thumbnails · last spot: the primary reads **"Place it"** · after the last spot the sheet closes with Toast "All picture spots are filled." · a download error "Couldn't get that picture. Try another or search again." · the saved name is editable with a small pencil next to `leaf_in_sunlight` (inline field, same checks).

**Data:** `placeAsset({ source: { kind: 'online', resultId, name? } | { kind: 'library', assetId } | { kind: 'made', jobId, version, name? }, target: { kind: 'spot', elementId }, fit })`: main downloads or takes the made picture, saves it into the library (so it is "also saved to Your assets"), copies it to the lesson, fits it to the spot, builds the ops and the credit note, applies ONE ChangeSet.

**Behaviour:**
1. Opening a spot selects its slide, runs the online search once for `query ?? description` on first visit to the tab (cached 10 minutes), and shows the spot's kind in the filters when known.
2. Selecting a result previews it in the spot at once (live, same maths as A11 with the spot's box and no loop: Fit = contained and centred, Fill = covers the box).
3. The sheet works through a **snapshot** of the spots taken when it opens (so "1 of 3" stays "of 3" while the live count drops): "{k} of {N}" is the position in that snapshot. **Place it · next spot** places, then opens the next unfilled spot (`nextSpot(spots, index, 'filled')` on the live list, wrapping); **Skip** moves on without placing (`'skipped'`); on the last one **Skip** closes. Closing with × or Esc keeps the spot.
4. Credits: a picture that needs one adds its credit line to the slide's notes in the same ChangeSet; an AI-made one adds "Picture credit: Picture made with Nano Banana Pro (AI-generated)." (§6).
5. Undo of a fill returns the spot (the element keeps its `placeholder`), and the asset stays in her library.

**Acceptance criteria:** with fake providers, searching the spot's query shows six results; placing the first sets the spot element's `assetId`, saves `leaf_in_sunlight` to the library with its licence and credit, adds the credit to the slide notes and opens spot "2 of 3"; Skip leaves it empty and opens the next; the sheet closes after the last.

---

## 4. Contracts

### 4.1 The `assets` module (`src/shared/contracts/assets.ts`, written)

Module id `ASSETS = 'assets'`; `AssetsApi`, `AssetsEvents`, `ASSETS_METHODS`, `ASSETS_EVENTS` (checked against the interface with `keysOf`).
Channel names are module-local (the bus key is `assets:<name>`); areas use a prefix like `chat:` does in deck-builder. Handlers that fail
in ways the UI tells apart return `Result`. `names.ts` needed no change (it is generic).

| Method | Screens | Returns / notes |
|---|---|---|
| `list(query?)` | A1 A4 A8 A11 A13 | `AssetPage`: `items: AssetSummary[]` (thumbnail data URL included), `total`, `libraryCount`, `counts` per filter, `froms`, `cursor`, `pendingReview` (the banner). Query: `search`, `filter`, `from` (`anywhere`, `uploaded`, `online`, `made`, `style:<id>`), `sort` (`recent`, `name`, `most-used`), `limit` (60), `cursor` |
| `get({ assetId })` | A1 | `AssetDetail` (description, source, licence, credit, foundIn, bytes, 768 px preview) |
| `chips({ refs })` | A5 A6 A12 | `AssetChip[]`: current names for `{ assetId, name }` refs; deleted ones come back `removed: true` |
| `resolveNames({ names })` | A4 A5 | chips for typed `{{names}}`; unknown names are simply absent |
| `checkName({ name, assetId? })` | A1 A2 A8 A13 | `NameCheck` (live, sync, same function as the renderer's) |
| `rename({ assetId, name })` | A1 | `Result<{ asset }>`; `invalid-input` with the message |
| `update({ assetId, title?, description?, kind?, tags? })` | A1 | the "update tags" and detail edits |
| `replaceFile({ assetId })` | A1 | native dialog; `{ cancelled: true }` when dismissed |
| `remove` / `restore` | A1 | soft delete with a 7-day window |
| `usage({ assetId })` | A1 | `{ lessons: [{ lessonId, title, slideNumbers }], foundIn }` |
| `suggest({ lessonId, slideId, words?, limit? })` | A11 A13 | ranked `AssetSummary[]`, local, no Claude call |
| `'add:pick'()` / `'add:paths'({ paths })` | A1 A2 | starts a review batch: `AddedPictures { batchId, accepted, rejected[] }` |
| `'review:get'()` | A2 | `ReviewView` |
| `'review:edit'(ReviewEdit)` | A2 | name, title, kind, description, keep |
| `'review:accept'({ batchId? })` | A2 | saves the ticked candidates: `{ added: AssetSummary[] }` |
| `'review:dismiss'({ batchId })` | A2 | |
| `'online:search'(OnlineQuery)` | A9 A13 | `OnlineSearchResult` |
| `'online:add'({ items, mode })` | A9 | `direct` returns the assets, `review` returns a `batchId` |
| `'make:mode'()` | A7 A8 A13 | `{ mode: 'picture-maker' \| 'vector' \| 'unavailable', modelLabel, perPictureUsd }` |
| `'make:start'(MakeRequest)` / `'make:keep'` / `'make:cancel'` | A8 A13 | job with `make:progress` events |

Events: `changed { libraryCount }`, `'review:changed': ReviewView`, `'make:progress': MakeProgress`.
Error codes used: `not-found`, `invalid-input`, `too-large`, `io`, `cancelled` (dialog or job), and `AiErrorCode` for naming and make failures.

### 4.2 Amendments: `deck-builder` (`src/shared/contracts/deck-builder*.ts`)

```ts
// deck-builder.ts: EditorApi
import type { PlaceAssetArgs } from '../assets/place'
/** Places an asset (library, online or just made) as ONE ChangeSet; copies it into the lesson on first use (§2.4). */
placeAsset(args: PlaceAssetArgs): Result<{
  changeSet: ChangeSet
  history: HistoryState
  elementId: string
  placed: { x: number; y: number; w: number; h: number; fit: 'cover' | 'contain'; lowResolution: boolean }
  asset: AssetSummary                 // the library asset used or created (names, so the chat can say it)
  chat: ChatItem                      // "Added {{name}} to slide 3." with its ResultChip; already stored
}>
// codes: 'not-found' (lesson, slide, spot or asset gone), 'invalid-input' (target), 'io', 'cancelled', AiErrorCode for made/online sources

// ExportResult gains a variant, and exportPptx an option
export type ExportResult = … | { status: 'spots'; count: number; slides: number[] }
exportPptx(args: { lessonId: string; ignoreSpots?: boolean }): ExportResult
```

`PlaceAssetArgs` (`shared/assets/place.ts`): `{ lessonId, slideId, source: AssetSourceRef, target: PlaceTarget, fit: 'fit' | 'fill' }`,
`PlaceTarget` = `region { path, bbox, replaceElementId }` | `spot { elementId }` | `anchor { anchor, widthUnits? }` | `box { box }`.
Main's steps (all in one lessons-mutex turn): load deck → resolve the source to a library asset (download + save for `online`, take the
kept version for `made`; names proposed with `suggestAssetName`) → copy the file into the lesson (`addBytesWithId`) → `resolvePlacement`
→ `buildPlaceOps` (with `creditLine(asset)`) → validate and apply with `applyChangeSet` (by `'user'`, summary "Added {name} to slide {n}" /
"Replaced the photo on slide {n} with {name}") → journal, thumbnail, `lastUsedAt` on the asset → append the chat item. The renderer
draws its preview with the same `resolvePlacement` so what it shows is what main writes.

```ts
// deck-builder-chat.ts
interface ChatSendArgs { …; assetRefs: ChatAssetRef[] }          // §2.5; Send is disabled while a typed name is unknown
interface ChatItem { …; assets?: ChatAssetRef[]; showSpots?: boolean }   // chips in text; showSpots draws the SpotsCard under this message
```

Chat tools offered to Claude (`src/main/ai/chat/*`, strict schemas; see §5.4): `list_assets({ query?, kind? })` (names, kinds, titles,
descriptions, tags: no pictures) and `place_asset({ asset, slideId, where, widthUnits?, fit? })` where `where` is one of
`{ anchor }`, `{ box }`, `{ region: n }` (the circled region of THIS message) or `{ spot: elementId }`. Leaving a spot is an ordinary
`apply_changes` `addElement` of an image with `placeholder` (no new tool). Generation: the slide wire schema (`src/main/ai/schemas/slide.ts`,
one flat element object) gains `assetName: string` (empty = none) and, for spots, `spotKind: string` and `spotQuery: string` (empty = not set);
the mapper resolves `assetName` to an id (unknown names become a spot with the name as description), copies on use, and writes
`placeholder: { description, kind?, query?, suggestedAssets? }`.

Deck schema (`src/shared/deck/schemaParts.ts`, `types.ts`): `placeholder` becomes `pictureSpotSchema` / `PictureSpotInfo` from `shared/assets`
(old `{ description }` stays valid). `ElementBase.name` already exists; no other deck change. The exporter and `SlideView` change as in §6 and §2.3.

### 4.3 Amendments: `style-library` and the style profile

```ts
// shared/style/types.ts
interface StyleProfile { …; pictures?: PictureHabits }            // optional: old profiles still parse (add to styleProfileSchema)
// contracts/style-library.ts
interface StyleProfileView { …; pictureHabits: string[]           // §3.6: lines with {{name}} tokens
  assetsFound: { found: number; suggested: number; saved: number; batchId: string | null; preview: AssetChip[] } | null }
interface LearnProgress { …; stage: 'idle' | 'reading' | 'pictures' | 'synthesising' | 'done' | 'paused' }   // 'pictures' = cutting out and naming
```

**`FileAnalysis` is NOT extended** (§5.1): the real-API finding is that structured outputs reject large schemas ("The compiled
grammar is too large", HTTP 400; `agents/DECISIONS.md`), and `analyseStyleFile` is already the biggest call. Picture facts come from
the extraction service (local, no tokens) and are stored per file as `sources/<id>.pictures.json` (`PictureFactsFile`); the
habits are built by `buildPictureHabits` (local); only naming and describing need Claude, in their own small calls. The learn job gets
one more step per file after `analyseStyleFile` (the slide kinds are needed to know which slides are Do Now or title slides):
`extractAssets` → pictures facts → candidates into a review batch of origin `style` → `describeAssets` (batched, §5.2).
`synthesiseProfile` needs no new schema: `pictures` is attached by main after synthesis (so the two streamed synthesis calls keep
their size) and the profile prompt prefix includes it as plain text lines for generation (§5.4).

### 4.4 Amendments: `settings`

```ts
// contracts/settings.ts
interface PictureMakerStatus {
  hasKey: boolean; keyLast4: string | null
  model: 'gemini-3-pro-image' | 'gemini-nano-banana-2.1'
  lastTest: { result: 'connected' | AiErrorCode; at: string } | null
  skipped: boolean; encryptionAvailable: boolean
}
getPictureMakerStatus(): PictureMakerStatus
setPictureMakerKey(key: string): Result<{ keyLast4: string }>          // 'invalid-input' unless looksLikeGoogleKey; 'io' without encryption
testPictureMaker(): Result<{ model: string; latencyMs: number }>        // one tiny real request with the STORED key; AiErrorCode on failure
setPictureMakerModel(model: PictureMakerStatus['model']): void
removePictureMakerKey(): void
skipPictureMaker(): void
interface Preferences { …; assetsMenuUses: number }                     // the "New" pill (§3.3)
interface SettingsEvents { …; pictureMakerStatusChanged: PictureMakerStatus }
```

Main rules mirror the Claude key (02 §6): encrypted with `safeStorage` in a second file next to `secrets.bin`; only `keyLast4` crosses IPC;
the key is read in main only when making pictures; logged usage goes to `usage.jsonl` with the picture cost (`estimatePictureCost`).
Model ids and prices live in ONE place: `src/main/services/imageProviders/nanoBanana.ts`.

### 4.5 Amendments: lessons store, shell, dev seed

- `src/main/services/lessons/assets.ts`: `AssetStore.addBytesWithId(id, bytes, ext, displayName)` (idempotent: same id and same bytes is a no-op);
  `AssetKind` gains nothing; lesson copies stay `kind: 'image'`. Lesson duplicate already copies the folder.
- `src/main/services/deckBuilder/…`: `lessonsUsingAssets()` port for `usedIn` (§2.4) and a `getSharedAssets()` accessor like `getSharedStyles()` so the
  `assets` and `deck-builder` modules use ONE `AssetsService` instance in main.
- `src/main/dev/seed.ts`: seed name `assets` (§2.7). `src/main/ai/fake`: fixtures for the new calls (§5).
- CSP and offline: unchanged. No remote image URL is ever given to the renderer; thumbnails are data URLs made in main.

---

## 5. AI steps

All calls run in main behind `AiService` (`src/shared/ai/types.ts`). New methods are additions to the interface (amendment; WP5):

```ts
describeAssets(input: { images: Array<{ index: number; png: Uint8Array; hint: KindHint; nearbyText: string; fileNames: string[] }>;
                        taken: string[] }, opts?): Promise<Result<{ described: DescribedAsset[] }>>
describeStyleOfAssets(input: { images: Uint8Array[]; kinds: AssetKind[] }, opts?): Promise<Result<{ description: string }>>
drawSvg(input: { prompt: string; styleDescription: string; kind: AssetKind; versions: number }, opts?): Promise<Result<{ svgs: string[] }>>
// place_asset and list_assets are chat tools inside chatTurn, not separate methods

interface DescribedAsset { index: number; title: string; name: string; kind: AssetKind; description: string; tags: string[]
  maybePupils: boolean; blurry: boolean; olderVersionOf: number | null }          // olderVersionOf = index of the better copy, or -1/null
```

### 5.1 Pictures found while learning a style

1. **Extract (local, free).** After a file is read, `extractAssets({ name, bytes }, { onProgress })` (`src/main/import/assets`) returns every picture
   occurrence with slide/page, box (1920 × 1080), the file's own hashes, `repeatedOn`, nearby text and flags (`quality`, `maybePupils`,
   `duplicateOf`). `.pptx` pictures come out byte for byte; PDF pictures come from the embedded image operators, and the extractor
   falls back to nothing (a scanned PDF is `scanned: true`), never to a page render. `groupFindings(images)` merges occurrences across files into
   `FoundAsset[]` ("Found 12 · keeping 9") with `leftOut` reasons and `suggestedName`.
2. **Facts (local).** For each picture occurrence the learn job joins the slide's kind from `FileAnalysis.slideKinds` and writes
   `sources/<id>.pictures.json`: `slides[]` (every slide with its kind, picture or not) and `pictures[]` (`assetKey` = the finding's `perceptualHash` cluster id, box, kind hint).
   This is what `buildPictureHabits` needs; it is rebuilt without reading decks when files change.
3. **Name and describe (Claude, §5.2)** the candidates once the whole queue has been grouped (or every ≥ 12 new ones, so the review fills in while she watches).
4. **Review batch.** Candidates are written to `review/<batchId>/` (origin `{ kind: 'style', styleId, styleName }`) and shown in A2; A6 shows the count.
5. **Habits (local, §5.3).** Built from the facts of all learned files and the kept-or-suggested assets; stored in `StyleProfile.pictures`; rebuilt when files or accepted assets change.

**Why not extend `FileAnalysis`:** a vision-and-geometry list per picture would add a large nested array to the biggest structured-output
call; the API already refused a 7-way element union plus the profile as "compiled grammar too large". The facts the extractor reports are exact, free and
deterministic, so Claude is used only for what needs eyes (naming and describing), in separate calls with a small flat schema each.
**Limits:** at most 400 picture occurrences and 300 pages per file (`DEFAULT_LIMITS`); at most 60 candidates go to review per batch (the rest are
"left out: repeats"); full-page scans and slide backgrounds are never candidates.

**Cost (Sonnet 5.5, $2 / $10 per million tokens; Opus 5.5 $4 / $20):** extraction 0; facts 0; habits 0; naming ≈ $0.02 per batch of 12 pictures (see §5.2);
so a style of 10 decks with 60 reusable pictures ≈ $0.10 on top of today's learning cost.

### 5.2 Naming and describing (Claude vision, cheap, batched)

- **Model:** the cheaper one (`CHEAPER_MODEL` = `claude-sonnet-5-5`) whatever she chose for lessons; `effort: 'low'`; no thinking.
- **Input:** up to **12 pictures per call**, each a PNG thumbnail of at most 512 px on the long side (≈ 350 tokens), numbered, with the extractor's
  hints (kind hint, nearby text, file names, "on N slides"); the list of names already taken. Image blocks first, then the text instructions.
  ~4.5k input tokens per batch ≈ $0.01 in and ≈ $0.015 out: **≈ $0.025 per 12 pictures**.
- **Cache:** `describe-cache.json` keyed by `sha256` means a picture is described once, ever. Uploading the same logo again costs nothing.
- **Wire schema (flat, small; `src/main/ai/schemas/pictures.ts`)**: `{ items: Array<{ index: number; title: string; name: string; kind: <8 kinds>; description: string; tags: string[]; maybePupils: boolean; blurry: boolean; olderVersionOf: number }> }`,
  `olderVersionOf = -1` for none; no optionals, no unions, one nesting level, at most 12 items: well inside the grammar limit.
- **Instructions (stable, cached):** "You label pictures from a teacher's old slide decks so she can reuse them. For each numbered picture give: a `title` of 1 to 4 words (what it is, 'School logo'); a `name` in lower_snake_case, 2 to 32 characters, noun first then the kind as a suffix
  where natural (`beaker_icon`, `school_logo`, `do_now_banner`, `forest_photo`); a `kind` (logo, icon, picture = illustration or AI scene, photo = real photograph, diagram, banner, character, symbol-card = a word and a picture in a bordered card); a `description` of 1 to 2 plain sentences that another AI could use
  to decide where it fits, mentioning colours, subject and any text on it, and where it usually goes if the hints say so; up to 5 lower-case `tags`; `maybePupils` true if the picture shows people who could be children in a school; `blurry` true if it is clearly low quality; `olderVersionOf` the number of a clearly better copy of the same picture in this batch, else -1.
  British spelling. Never invent text you cannot read. Do not use any name from the `taken` list."
- **After the call (code):** `uniqueAssetName(name, taken ∪ batch)`, clamp lengths, `kind` falls back to the hint; `maybePupils` is OR-ed with the extractor's heuristic; a candidate with `maybePupils` is **never** ticked; `olderVersionOf` becomes `leftOut: older-version` with `ofName`.
  For an **uploaded single image** the same call runs with one image; for an online result with the user's name untouched, the call also supplies `description` and `tags` from the title and thumbnail (so online assets are searchable).
- **Failure:** a failed batch keeps the candidates with the extractor's `suggestedName` and an empty description, flagged "Not named yet" (new), and the review screen offers "Name these with Claude" (retry). The queue is never blocked by this call.

### 5.3 Picture habits (local; `buildPictureHabits`)

Input: `SlideFact[]` (every slide with its kind), `PictureFact[]` (every picture on a slide), the kept assets (`assetKey` → `assetId`). Output `PictureHabits`:
`slideKinds` (always, usually, sometimes or never use pictures per slide kind with at least 3 slides, and the median box of their content pictures),
`placements` (an asset seen in at least 2 decks on ≥ 60% of one slide kind's slides, or ≥ 60% of all slides → `every`), the median box turned into `anchor` (nine cells by thirds),
`widthUnits` (median width to the nearest 10) and `marginUnits` (distance to the nearest edges, 16 to 120), and `lines` (position and share of the slide for content pictures, the kinds she mostly uses, slide types with none).
Pure, deterministic and fully unit-tested (`habits.test.ts`). Claude is not called; the profile just carries the result (§2.6) and the correction call can edit it.

### 5.4 Generation and chat prompts

- **Catalogue.** A compact block is appended to the cached style prefix and to the chat turn context: one line per asset, `name · kind · title · description (cut to 120 characters) · tags`, at most **60 lines**, most-used first (a library over 60 offers `list_assets({ query })` instead of listing). Names are what Claude must use. Changes to the library change only this block, so the cache of the style profile prefix is not broken.
- **Placement rules from habits.** The prefix also carries `pictures.lines` and each placement as `school_logo: title slides, top-right, 240 units wide, 48 from the corner` and `slideKinds` as "Picture use: content slides usually, objectives never".
- **Generation rules (added to the planLesson and writeSlide instructions):** "Use the teacher's assets where they fit: put an asset on a slide with `assetName` set to its exact name; follow the placement rules; an asset marked `every slide` is placed on every slide. Never invent an asset name. Where a picture would help (the habits say pictures are usual on this slide type, or the content is visual) and no asset fits, leave a picture spot: an image element with no assetName and a `description` of what it should show (concrete, 4 to 12 words, e.g. 'A leaf in sunlight, close up') plus `spotKind` and `spotQuery` (search words). Do not put description text on the slide. Do not add spots to slide types where she never uses pictures. At most one spot per slide unless the content needs more."
- **After generation (code):** unknown `assetName` → a spot; assets copied into the lesson (§2.4); credit lines added to notes; the assistant message gets the sentence about spots when there are any (§3.12).
- **Chat turns:** `list_assets` and `place_asset` tools (§4.2). System text: "`{{name}}` in the teacher's message is an asset: use `place_asset` with that name, never recreate it as a shape or drawing. Place it where she says; if she names no place, use the style's placement rule for this slide type; if there is none, top-right, 240 units wide. A placed asset keeps its picture's shape (never stretch it). Follow-ups such as 'a bit smaller' change that element by its `name`."
  A circled region in the same message gives `where: { region: n }`: main applies the same maths as A11 ("fit inside", replacing a picture under the circle only if she says 'replace' or 'swap').
- **Spots in chat:** "Fill the first one" and similar words are UI actions; asking in chat ("use the leaf diagram for the spot on slide 3") is `place_asset` with `where: { spot: elementId }` after `list_assets`.

### 5.5 Placing: the "Add asset here" circle flow (pure maths, `src/shared/assets/fit.ts`)

All numbers are in slide units (1920 × 1080); the circle is `{ bbox, path }` from `src/shared/annotate` (a closed simplified polygon); the picture is `{ width, height, vector? }`.

```ts
fitIntoRegion(image, { bbox, path? }, 'fit' | 'fill') → { x, y, w, h, fit: 'contain' | 'cover', density, lowResolution }
```

- **fit** (default): the largest rectangle with the picture's own aspect ratio that lies entirely inside the polygon, with a `FIT_INSET` of 6 units (all four corners, 8 samples per edge, and no polygon vertex strictly inside the rectangle, so a dent in a loop is respected); centre chosen among the polygon centroid, the bounding-box centre and a 3 × 3 grid of centres (the largest wins); width found by a 24-step binary search. A loop that is degenerate or too thin falls back to "contained in the bounding box". Element `fit: 'contain'`, so the frame has the picture's shape (no letterbox).
- **fill:** the bounding box clamped to the slide; element `fit: 'cover'` (cropped to the box).
- **spot or box target** (no loop): fit = contained and centred in the box; fill = the box, covered.
- **anchor** (`anchoredBox`): the picture's shape, `widthUnits` wide (default 240), 48 from the edges, the missing axis centred.
- **low resolution:** `density` = source pixels per slide unit; below 0.5 (a 960 px picture across the whole slide) `lowResolution` is true and the sheet shows the note of A11; vectors are never flagged.
- **Replace what's underneath:** `underlyingPicture(slide, region)` = the best-covered unlocked image element under the loop (`targetElements` from the annotate overlap rules). `buildPlaceOps` then **updates it in place** (`updateElement`: frame, `fit`, `assetId`, `alt`, `name`; a spot keeps its `placeholder`), otherwise `addElement`. The credit line, if any, is added to the slide notes by `updateSlide` in the same ChangeSet.
Tests: `fit.test.ts`, `place.test.ts` (applies the ops to a real deck with `applyChangeSet`).

### 5.6 Make-new prompt (A8, A13 "Make one")

1. **Describe the look (Claude vision, once per job).** `describeStyleOfAssets({ images: thumbnails of the picked assets (≤ 6, 384 px), kinds })` with: "Describe the visual style shared by these pictures in one paragraph of at most 60 words, as instructions for an illustrator: line weight and colour, fill colours (name them and give hex codes if clear), shading or flat, corner shape, level of detail, background, and how realistic it is. Do not describe what the pictures show." ≈ $0.01.
2. **Compose (code).** `composeMakePrompt({ request, kind, styleDescription })` gives the picture maker's text: subject, "Match this style exactly: …", then "One clear subject, centred, with a generous margin. Flat, clean shapes… Plain white background. No text, letters, numbers or watermark unless the request asks for words. No real or recognisable people; no faces of children." (`photo` asks for natural lighting instead). Aspect ratio per kind: banner 21:9, diagram, picture, photo 4:3, the rest 1:1 (`aspectRatioFor`).
3. **Make.** `createNanoBananaMaker({ getKey, fetchFn, model }).makeImages({ prompt, aspect, size: '2K', count, references? })` (2K costs the same as 1K on Pro); `count` ∈ {2, 4}, concurrency 2; a version that fails is shown as failed and the rest still arrive. **Vector mode (no key):** `drawSvg` asks Claude for N complete SVGs (one call, structured `{ svgs: string[] }`), sanitised with `sanitiseSvg`, viewBox 0 0 400 400 (diagram 4:3), only shapes and paths, no text unless asked, using the described style; photo requests are refused with the A8 callout.
4. **Reference pictures.** Whether the picked assets themselves go to Google as references is an owner decision (§10, question 1). Default in code: **off**; `makeImages` is given `references` only when the setting `sendReferencesToPictureMaker` is true and then only for kinds logo, icon, diagram, banner, character, symbol-card, never `photo`, never anything with `maybePupils`.
5. **Keep.** Saves the picked version as an asset (§3.8 step 2), with `describe-cache` filled from the request and style description (no extra Claude call: title from the name, description = the request + 'Made in the style of {names}.').
**Cost:** one describe call ≈ $0.01; picture maker 2 versions ≈ $0.27, 4 versions ≈ $0.54 on Nano Banana Pro (`$0.134` per 1K or 2K picture, live prices in `PICTURE_PRICES_USD`); vector mode ≈ $0.02 to $0.06.

### 5.7 Defects found in the example test, to fix in this work

From the real run on `example/L1-Illustration and Meaning (Monday).pdf` and `L3- Regular Irregular Plurals (Wednesday).pdf` (pages in `.artifacts/example/`):

| # | Defect | Fix | WP |
|---|---|---|---|
| 1 | The profile has no concept of pictures | `StyleProfile.pictures`, picture facts, habits, review (§2.6, §5.1) | 6 |
| 2 | Picture placeholders print their description text over the slide | The picture spot of §2.3: dashed editor-only mark, no text in the slide render; exporter skips (§6) | 7 |
| 3 | One-off colour leaked into the structural `placeholder` colour token (orange boxes) | The `placeholder` token is structural and neutral: synthesis validation clamps it to a tint of `background` or `muted` (saturation ≤ 0.15, lightness 0.85 to 0.97) and rejects any hex used by a picture or by a one-off shape; spots do not use this token at all (they use editor chrome) | 6 |
| 4 | Dates are copied from the examples ("Monday 3 March") | Analysis and synthesis strip literal dates from habits, voice phrases, exemplars and test slides; a layout region named "date" is optional and filled only from the lesson brief (`meta.context`), otherwise omitted; a unit test with date-bearing fixtures | 6 |
| 5 | Kickers render in capitals though she writes "Input:" | `components.kicker.uppercase` is set only when the sampled kicker text is upper case in the examples (checked in code against the digest text, not left to the model); the renderer and exporter honour the flag (text keeps her case otherwise) | 6, 7 |
| 6 | The test slide is a hard-coded photosynthesis slide | Synthesis call 2 builds the test slide from her subjects and slide kinds (fixture fallback is a neutral "Key words" slide, never photosynthesis); the A6 slide in the mockup is "Lesson 1 · Cells / Key words" because her style there is Science | 6 |
| 7 | Exemplars are empty | `exemplarCandidates` become `Exemplar`s: digests of the real slides (pptx digest or PDF page read), including their picture elements with `assetName`; generation shows two exemplars | 6 |
| 8 | The school logo is never extracted | Extraction (exists) + review + a placement rule `every` or per kind, applied as an unlocked image element named `school_logo` on generated slides | 1, 6, 8 |
| 9 | Symbol cards (word + picture in a blue-bordered rounded card) have no home | Kind `symbol-card`; extractor `cropSymbolCards` (experimental) can split a sheet into single cards; their frame is part of the picture, so never re-frame them (`radius: 0`, no border added); a native "make symbol cards" plugin is out of scope (§10) | 2, 8 |
| 10 | Real web photographs and AI-looking scenes mixed with logos | Kinds `photo` and `picture`, licence "From your files", never auto-ticked as logos, no credit | 2 |

---

## 6. Export rules

`src/main/export/**` (WP7):
1. **Spots are skipped**, no placeholder shape and no caption: `isPictureSpot(element)` → nothing is written. The existing "tinted `roundRect` + caption" stays ONLY for an element whose `assetId` file cannot be read (a broken picture), with a warning in `ExportResult` (`missingAssets`, new optional field) as today.
2. **Warning first:** `exportPptx` returns `{ status: 'spots', count, slides }` unless `ignoreSpots` is true (§3.12). Nothing is saved, no file dialog opens, until she answers.
3. **Credits go in the speaker notes.** Each slide's notes = its own notes, plus, for every picture on the slide whose asset has `credit.inNotes`, one line `Picture credit: {credit.text}` (`notesWithCredits`, never twice). The line is written into `slide.notes` at placement time (so she sees and can edit it); the exporter re-adds a missing one as a safety net from the library asset when it still exists (the notes are the record if the asset was deleted).
   AI-made pictures say "Picture made with Nano Banana Pro (AI-generated)." (`attributionCredit`); her own and unknown-licence pictures give none; CC0 and public domain give none.
4. **Assets are embedded** from the lesson's `assets/` folder (copy-on-use, §2.4): JPEG/PNG/GIF/WebP as they are, SVG rasterised at 2× with resvg (existing `toRaster`). `fit: 'cover'` crops with the picture's source rect, `contain` draws it whole; the element frame is exactly what the editor shows.
5. **Present mode and thumbnails** never draw spots (thumbnails: faint dashed box, no text).
6. Nothing about the library is exported: no names, no tags, no descriptions (the element `alt` is the title; `name` is not written).

---

## 7. Cost, privacy and licence rules

**What leaves the PC, and where:**

| Data | To | When | Notes |
|---|---|---|---|
| PDF pages / pptx digest of her decks | Claude (Anthropic) | style learning (exists) | unchanged; `mayContainNames` flag stays |
| Thumbnails (≤ 512 px) of candidate pictures | Claude | naming (§5.2) | only candidates; **never** a picture flagged `maybePupils` (the app describes those from the extractor's text hints only and leaves them out by default) |
| Thumbnails of picked assets (≤ 384 px) | Claude | make-new style description (§5.6) | she picked them |
| The picked assets as references | Google | make-new, **off by default** (§10 question 1) | drawn kinds only, never photos or pupils |
| Search words | Openverse, Wikimedia Commons (and Pexels with a key) | A9, A13 | query text and paging only, from main, with a polite User-Agent; no account, no cookies |
| The make-new text prompt | Google | picture maker | style description + request |
| Her API keys | nowhere | | encrypted with `safeStorage`; never in IPC, logs or error text |

- **Pupil photos.** Detection is best effort (extractor heuristic + Claude's `maybePupils`). Such pictures are left out by default and need an explicit tick in A2; the review step is the safety net, and the A2 copy says so. No pupil picture is ever sent to Google or used as a style reference. Real photos she keeps stay in the data folder like her decks.
- **Review before saving.** Nothing found automatically (style learning, upload of a PDF or PowerPoint, several online picks) is saved without A2. A single picture she uploads or picks online and names herself is her OK.
- **Licence capture.** Every online asset stores provider, picture page, author, title, licence code and label, the ready credit line and `retrievedAt` (inside `credit`/`source.at`). "Free to use in lessons" is on by default; unticking it shows NC and ND pictures with an amber "Check licence" badge. CC BY-SA is shown as a share-alike licence; a slide deck that only shows the picture is generally a collection, but the app does not claim legal certainty (`agents/assets/PROVIDERS.md` §7).
- **Her own pictures** get licence "From your files" (`unknown`): no credit, no claim. Photographs taken from the web in her old decks are hers to keep using in her lessons; the app labels them and never offers them for sharing.
- **Cost summary** (planning numbers, Claude Console and Google console are the truth): extraction and habits 0; naming ≈ $0.025 per 12 pictures; style description ≈ $0.01; picture maker $0.134 per picture on Nano Banana Pro ($0.03 on Nano Banana 2.1); vector drawing ≈ $0.02 to $0.06; online search 0; credits and spots 0. `usage.jsonl` records each call so Settings › AI "This month: about $X" includes them.
- **Rate limits.** Openverse anonymous is 20 searches a minute and 200 a day (`PROVIDERS.md` §9); searches are cached 10 minutes and spaced; the friendly "busy" message is shown instead of an error.
- **Fake AI.** `SLIDE_PLANNER_FAKE_AI=1` returns fixture names, descriptions and tiny SVG "made" pictures, and fake providers return the A9 fixtures, so no test touches the network.

---

## 8. Build order: work packages

Parallel agents, each with exact file ownership. Ownership means: only edit these paths; list needs from other owners in the report; type errors elsewhere are someone else's work in progress (agents/EFFICIENCY.md). Unit tests (`*.test.ts`) and component tests (`*.test.tsx`) are part of every package.

| WP | Name | Owns (paths) | Depends on | Notes |
|---|---|---|---|---|
| 0 | Shared types, contract, this spec | `src/shared/assets/**`, `src/shared/contracts/assets.ts` (+ test), `agents/ASSETS.md` | none | **done** |
| 1 | Library store and `assets` module main | `src/main/services/assets/{store,library,thumbs,usage,suggest,service}.ts` (+tests), `src/modules/assets/{main.ts,shared.ts,main/**}`, `src/main/dev/seed.ts` (assets seed only) | 0 | store, atomic writes, rebuild, soft delete, thumbnails with `nativeImage` (SVG via resvg), `list/get/rename/update/replaceFile/remove/restore/usage/suggest/chips/resolveNames/checkName`, `getSharedAssets()` |
| 2 | Add files and review queue | `src/main/services/assets/review/**` (+tests), the `add:*` and `review:*` handlers in `src/modules/assets/main/` | 1, 5 | wires `extractAssets`, `groupFindings`, hashing, naming call, batch persistence, progress events, dedupe against the library |
| 3 | UI kit: assets | `src/renderer/src/ui/assets/**` | 0 | all components of §3.0 with tests; no IPC |
| 4 | Assets module UI | `src/modules/assets/{ui.tsx,ui/**}` | 3; 1/2/11/12 via fakes | A1, A2, A8 panel, A9, hooks, selection mode, deep links; component tests with `@test/*` fakes |
| 5 | AI calls | `src/main/ai/calls/pictures.ts`, `prompts/pictures.ts`, `schemas/pictures.ts` (+tests), `src/main/ai/fake/` fixtures for these calls, `src/shared/ai/types.ts` (the three new methods only) | 0 | `describeAssets`, `describeStyleOfAssets`, `drawSvg`; real-API smoke with `npm run test:live` (grammar size check) |
| 6 | Style learning integration | `src/main/services/styles/{pictures,habits}.ts` (new), `learnJob.ts`, `synthesis.ts`, `views.ts`, `src/shared/style/{types,schema}.ts` (the `pictures` field and the §5.7 fixes), `src/modules/style-library/**` (A6 cards) | 1, 2, 5 | defects 1, 3 to 7 |
| 7 | Deck model, rendering and export | `src/shared/deck/{schemaParts,types}.ts` (placeholder), `src/renderer/src/ui/slide/**` (spot drawing, image from assets), `src/main/export/**`, `src/main/render/**` | 0 | defects 2, 5; spot skipping; credits in notes |
| 8 | Deck-builder main | `src/main/services/{lessons,chat,generation}/**` (placeAsset, copy-on-use, tools, prompts), `src/main/ai/chat/**`, `src/main/ai/schemas/slide.ts`, `src/shared/contracts/deck-builder*.ts` | 0, 1, 5, 7 | `placeAsset`, `assetRefs`, `showSpots`, `spots` export status, `lessonsUsingAssets` |
| 9 | Editor UI | `src/modules/deck-builder/ui/**` (A3, A4, A5 chips, A10 to A13 sheets, spot overlays, filmstrip badges, export dialog) | 3, 7, 8 | the largest UI package; can start with fakes |
| 10 | Settings | `src/modules/settings/**`, `src/main/services/settingsModule/**`, `src/main/services/keyStore.ts`, `src/shared/contracts/settings.ts` | 0 | A7, the second secret, test call |
| 11 | Make-new service | `src/main/services/assets/make/**` (+tests), the `make:*` handlers | 1, 5, 10 | jobs, vector fallback, cost reporting |
| 12 | Online service | `src/main/services/assets/online/**` (+tests), the `online:*` handlers | 1, 2 | wraps `createSearchProviders`, `downloadImage`, thumbnails as data URLs, licence mapping (`licenceFromProviderCode`) |
| 13 | E2E, screenshots, docs | `scripts/e2e/assets.e2e.mjs`, `agents/{ASSETS,CHANGELOG,MODULES,TESTING}.md` updates, `design/` untouched | all | one flow (§9); `shot.mjs` per screen against `desing_asset/images` |

**Order:** 0 → {1, 3, 5, 7, 10} in parallel → {2, 4, 8, 11, 12} → {6, 9} → 13. WP4 and WP9 can start early with fake clients; they must not wait for main.
**Integration rule:** contracts only change by an amendment request to the WP0 owner (this document), so UI and main never drift.

---

## 9. Test strategy

| Layer | What | Where |
|---|---|---|
| Unit (pure, seconds) | names, tokens, fit and fill maths, spots, place ops (applied to a real deck), credits, habits, hash, library helpers, schemas, contract name lists | `src/shared/assets/*.test.ts`, `src/shared/contracts/assets.test.ts` (**done**, 87 + 9 tests) |
| Unit (main services, temp dirs, fake AI) | store write order and recovery from a corrupt index and a corrupt `meta.json`, soft delete and restore, name collisions on load, thumbnails, review batches (persist, edit, accept, dismiss), dedupe against the library, online add (direct and review) with fake providers, make jobs (progress, failure of one version), `placeAsset` for every target (region, spot, anchor, box) and source, copy-on-use idempotence, `lessonsUsingAssets`, exporter skipping spots and writing credits, prompts snapshot of the catalogue block | `src/main/services/assets/**`, lessons/chat/export tests |
| Component | every UI-kit piece (roles, labels, states, keyboard); A1 (select, edit name with error, tags, delete confirm, banner), A2 (counts, tick, name error, left-out pills), A8 panel, A9 (selection, add modes, licence callouts), A3 tile, A4 picker (insert, `{{` mode), chips in composer/messages, A10 bar, A11 sheet (suggestions, fit, replace, preview call), A12 spots card and badges and export dialog, A13 tabs and next-spot, A6 cards, A7 section | `*.test.tsx` next to each |
| Real-API (manual, `npm run test:live`) | the three new structured calls against the real API (grammar-size check, one picture batch), one Nano Banana request with a real key | `vitest.live.config.ts` |
| One e2e flow | `scripts/e2e/assets.e2e.mjs` (fake AI, fake providers, seeded decks, hidden window, ~10 s): learn a style from two seeded decks → picture habits and "12 found" appear → Review → Keep 9 → Assets page shows 9 → open a lesson → type `{{school_logo}}` chip + send → logo on slide (one undo step) → circle an area → Add asset here → Fit → Place it → generate with spots → export warning → fill one spot from fake online → export succeeds with credits in notes (open the .pptx and read the notes) |
| Visual | `node scripts/shot.mjs assets` with `--seed assets` and `--intent` for each of A1, A2, A8, A9; editor shots for A4 to A5 and A10 to A13 with a seeded lesson; compare each with `desing_asset/images/A<n>-*.png` once per screen | WP13 |

Per package: run `npm run -s check -- -f <fragment>` while working and the full `check` once at the end; `npm run typecheck`, `npm test` and `npm run smoke` must pass before it is done.

---

## 10. Decisions, open questions, quirks

**Decisions taken (in this spec):**
1. Picture spot = the existing `placeholder` extended with optional hints; filling keeps it as provenance (§2.3).
2. Copy-on-use with the library asset's own id in the lesson folder (§2.4).
3. Picture habits and placements are built locally from extraction facts, not by Claude; `FileAnalysis` is not extended (§4.3, §5.1, §5.3).
4. Naming and describing run on the cheaper model, 12 pictures per call, cached by `sha256` (§5.2).
5. A single picture added online goes straight in; several go through A2 (README choice 3, §3.9).
6. Credit lines are stored once (`AssetCredit.text`, built by `attributionCredit`) and written into the speaker notes at placement, re-added at export if missing (§6).
7. Spots and previews are editor-only; export warns first (§3.12, §6).
8. `{{name}}` is text with refs by id in chat history; assistant tokens are validated before they reach the screen (§2.5).
9. Placing from the sheets writes its own chat item with Undo and costs no Claude call (§3.11).
10. The picture maker model ids and prices live only in `imageProviders/nanoBanana.ts`; the shared code and this spec carry none.

**Open questions for the owner** (each with a recommendation):
1. Send the picked assets to Google as reference images when making a new one (A8)? Recommend **yes for drawn kinds** (icons, logos, diagrams, banners, characters), **never photos or pupils**, with one line under the key field in A7 ("Pictures you pick are sent to Google to match the look."). Without references "same lines, colours and feel" is only as good as a text description.
2. Should her school logo be placed **automatically on every generated slide** when her decks show it on most slides (a placement rule `every`)? Recommend **yes**, as an ordinary unlocked picture she can delete, and a line in Picture habits she can correct ("I don't want the logo on every slide").
3. Default picture maker: Nano Banana Pro ($0.13 a picture, best quality) or Nano Banana 2.1 ($0.03)? Recommend **Pro as the default**, with 2.1 as "faster and cheaper" in Settings.
4. The project contact for Wikimedia's required User-Agent, and whether to register an Openverse app (200 anonymous searches a day is tight on a heavy planning day). Recommend a project address or page and one registered Openverse client.
5. Symbol cards: build a "make symbol cards" tool (word + picture on a blue-bordered card) later? Recommend **defer**: v1 treats them as ordinary assets she can reuse and place.

**Concerns:** (a) the structured-output grammar limit: keep every new schema flat and small; (b) PDF picture extraction quality (embedded images only; no recovery for scans); (c) Openverse anonymous limits; (d) `nativeImage` cannot read SVG: resvg is needed for SVG thumbnails; (e) the amendments touch files other agents own right now (deck schema, lessons store, contracts): apply them in the order of §8 with the owner of each file; (f) A4's chip text "Slide 3 · circled" and A10's "Region on slide 3" differ: the existing 06 spec text is kept.

**Quirks:** the folder is spelled `desing_asset`; mockup variables such as `{{s.t}}`, `{{t.open}}`, `{{f.name}}` in the `.dc.html` files are template slots, not copy; "Pictures" in A1 includes photos; thumbnails reach the renderer as data URLs because it is offline; the Assets page and the review screen are one module so the deep link `{ kind: 'review' }` needs no new route; `Asset.usedIn` is a cache, `lastUsedAt` is the persisted fact.
