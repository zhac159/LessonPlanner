# 04 · Create a style

![](../images/04-create-style.png)

**Purpose:** teach the app her style from her old decks. She drops PDFs/PowerPoints, watches each file being read, sees what was learned (colours, fonts, habits, slide types, voice, a test slide), fixes mistakes in plain words, names the style and saves it.

Mockup source: `../canvas/project/StyleBuilder.dc.html` (board 1440×1300). Pipeline and data: `../style-profile.md`. Claude calls: `../ai-pipeline.md` §4.1–4.3.

---

## 2. Owner & navigation

| Item | Value |
|---|---|
| Owning module | `style-library` (main does import, digest, Claude calls, storage; `../style-profile.md`) |
| Sidebar mode | Full Sidebar (224px), **Styles** active. Also in first run (see Open questions) |
| Modes | **New** (a draft style, title "Create a style") and **Edit** (an existing style, title "Edit style" **(new)**) |

| How you get here | Mode | Intent |
|---|---|---|
| Connect Claude "Next: your style" (first run step 3) | New, empty draft | `{ kind: 'new-style', firstRun: true }` |
| Home Dropzone (drop or "browse files") | New, files queued | `{ kind: 'new-style', styleId }` (draft already created by Home) |
| Home style SelectChip "Create a new style…" | New, empty draft | `{ kind: 'new-style' }` |
| Home StyleCard, Styles list StyleCard | Edit | `{ kind: 'edit-style', styleId }` |
| Sidebar Styles when she has no styles | New, empty draft | — |
| Sidebar Styles when she has styles | Styles list (not designed; interim: full-width "Your styles" card from Home: StyleCards + Dropzone) | — |

| Control | Goes to / does | Mockup href |
|---|---|---|
| "Home" back button | 03 Home. Nothing is lost: a new style stays as a draft (StyleCard with "Draft" pill) and learning continues in main | `Main.dc.html` |
| "Save style" | Saves (§8) → 03 Home with a toast. In first run this is the end of setup | `Main.dc.html` |
| Sidebar items | As on Home; leaving keeps the draft | — |

## 3. Layout

| Region | Size and behaviour (from the mockup) |
|---|---|
| Sidebar | As Home (03 §3), Styles active |
| PageHeader | White, 2px ink bottom border, padding 14px 24px, row, wraps, gap 14px: back Button (44px pill, chevron + "Home"), h1 22px display 800, spacer, StatusPill (40px, butter #FFF0B8, 2px ink, three 7px dots in orange shades + text 14px / 700), primary Button "Save style" (44px, radius 12px, check icon). **Sticky** to the top of the scrolling content so Save is always reachable (the page is ~1300px tall) |
| Main | max-width 1320px, centred, padding 28px 24px 48px, row, wraps, gap 24px, `align-items: flex-start` |
| Your files Card | `flex: 1 1 380px` in the mockup (**use 340px**, see below), padding 22px, column gap 14px, white, 2px ink, radius 24px, shadow 6px. Contents top to bottom: title row (h2 22px + "8 files" 14px muted, baseline-aligned), Dropzone (compact), progress block, file list (gap 8px), Tip Callout, privacy note |
| Progress block | Row "6 of 8 learned" (14px / 700) ↔ "About a minute left" (600 muted); ProgressBar 14px tall, 2px ink, pill, white track, orange fill with a 2px ink right edge |
| File row | padding 8px 8px 8px 10px, 2px soft-line border (#E4DFF7), radius 14px, gap 12px: FileTypeBadge 44×36 · name (14px / 600, one line, ellipsis) over size (12px muted) · StatusPill (12px / 700) · remove IconButton (36px drawn, 44px hit area) |
| Learned panel Card | `flex: 2 1 620px`, white, 2px ink, radius 24px, shadow 6px, no padding. CardHeaderBand: highlight yellow, 2px ink bottom border, radius 22px 22px 0 0, padding 16px 22px: h2 22px + spacer + "Updates as each file is read" 14px. Body: padding 22px, column gap 20px |
| Name row | Row, wraps, `align-items: flex-end`, gap 16px: TextField "Style name" (`flex: 1 1 280px`, 48px, radius 12px, 16px / 600) + Checkbox "Make this my default style" (22px box, 48px row) |
| Profile grid | `grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))`, gap 16px. Six sub-Cards (padding 16px, 2px ink, radius 16px, h3 16px / 800): Colours, Fonts, Layout habits, Slide types you use, How you write, Test slide in this style (ground fill #F1EEFF) |
| CorrectionBox | padding 16px, 2px dashed ink, radius 16px: label 16px / 800; row (wraps, gap 10px): TextField (`flex: 1 1 280px`, 48px) + dark Button "Tell me" (48px) |

**Narrower windows.** With the mockup's 380px basis the two Cards need 1024px of content, i.e. a window ≥ ~1300px, so at the **default 1280px window they would stack**. Implementation: give Your files `flex: 1 1 340px` so they sit side by side down to ~1250px (record an "Implementation note" in this file when done). Below that they stack: Your files full width on top, and its file list shows at most 5 rows with a "Show all {n} files" **(new)** toggle so the learned panel stays near the top. The profile grid shows 2 columns while the panel body is ≥ 576px wide, otherwise 1. The PageHeader wraps the StatusPill and Save under the title when needed.

## 4. Components

| Component | Variant / notes |
|---|---|
| Sidebar | Full, Styles active |
| PageHeader | Toolbar variant (white, ink rule, sticky) |
| Button | Back (secondary pill with chevron), primary ("Save style"), dark ("Tell me") |
| StatusPill | Header: "Learning…" with animated dots (butter), "Finishing up…", "Learned from {n} files" (mint with check). File statuses: Waiting (lilac #EAD9FF), Reading… (butter #FFF0B8), Learned (mint #DFF5D8), Couldn’t read (peach #FFD6C9, new). Slide-type tags (tints cycle sky, peach, mint, butter, lilac) |
| Card | Large (both columns); small (profile sub-cards) |
| CardHeaderBand | Yellow |
| Dropzone | Compact: a `button` with dashed 2px ink, radius 16px, cream fill, padding 14px; 40px orange circle with upload icon; title 700 + line 13px. The whole page is also a drop target |
| ProgressBar | 14px, ink outline |
| FileTypeBadge | 44×36, 2px ink, radius 8px, 11px / 800, letter-spacing 0.04em: "PPTX" sky #D7E8FF, "PDF" peach #FFD6C9 |
| IconButton | Remove (×) per file; Retry per failed file **(new)** |
| Callout | Tip (lilac, no border, radius 14px); privacy note **(new)**; pupil-names warning **(new)**; account error **(new)** |
| TextField | Style name; correction input |
| Checkbox | Default style |
| ColourRole | 32px swatch (2px ink, radius 8px) + "**{label}** · {usage}" 14px |
| FontSample | 64px "Aa" tile (2px ink, radius 12px, ground fill, the font at 30px in the profile's text colour) + "**{family} {weight}**" / "{use} · {range} pt" |
| TestSlidePreview | 16:9 SlideView of the test slide, 2px ink, radius 8px |
| CorrectionBox | As above, plus confirmation line and "Your corrections" disclosure **(new)** |
| Toast | Removed file (with Undo), skipped files, saved |

## 5. Content & copy

| Element | Text | Dynamic? |
|---|---|---|
| Back button | "Home" | — |
| h1 | "Create a style" | Edit mode: "Edit style" **(new)** |
| Header StatusPill | "Learning · 6 of 8 files" | "Learning · {learned} of {total} files"; during synthesis "Finishing up…" **(new)**; done "Learned from {learned} files" **(new)**; paused "Paused" **(new)**; hidden when there are no files |
| Save button | "Save style" | Edit mode: "Save changes" **(new)** |
| Files h2 + count | "Your files" + "8 files" | "{total} files" |
| Dropzone | "Add more PDFs or PowerPoints" / "Drop files here, or browse" | With no files yet: "Add your PDFs or PowerPoints" **(new)** |
| Progress | "6 of 8 learned" ↔ "About a minute left" | "{learned} of {total} learned"; ETA: "Less than a minute left" / "About a minute left" / "About {n} minutes left" / during synthesis "Putting it all together…" / done: nothing |
| File rows | "Y8 Photosynthesis.pptx" / "14 slides" / "Learned" (etc.) | Name; "{n} slides" (pptx) or "{n} pages" (pdf), blank until counted; status "Waiting", "Reading…", "Learned", "Couldn’t read" **(new)** |
| Remove button | `aria-label` "Remove Y8 Photosynthesis.pptx" | "Remove {file name}" |
| Tip | "**Tip:** 10 or more decks gives the closest match. Mix recent favourites with a few older lessons." | — |
| Panel title | "What I’ve learned so far" | — |
| Panel subtitle | "Updates as each file is read" | — |
| Name label / value | "Style name" / "Science KS3" | Initial value: her subject from Welcome, else "My style"; placeholder "Name this style" **(new)** |
| Default checkbox | "Make this my default style" | Checked by default when she has no other saved style |
| Colours h3 + rows | "Colours"; "Teal · titles, accents, left band", "Navy · body text", "Yellow · mini-whiteboard boxes", "Mint · key word chips", "White · slide background" | From the profile; label bold |
| Fonts h3 + rows | "Fonts"; "Lexend Bold" / "Titles · 40–44 pt"; "Lexend Regular" / "Body text · 20–24 pt" | From the profile. Font not available offline: extra line "Not installed — shown in {fallback}" **(new)** |
| Layout habits h3 + rows | "Layout habits"; "Two-colour titles: the last words in teal", "A teal band down the left edge", "Objectives as tick-boxes", "Text left, picture right on content slides", "A yellow question box at the bottom" | `profile.habits` |
| Slide types h3 + tags | "Slide types you use"; "Title", "Do Now", "Learning objectives", "Key words", "Mini-whiteboard question", "Practical method", "Exit ticket" | `profile.slideTypes[].name` |
| How you write h3 + rows | "How you write"; "• Short, direct questions to the class", "• Objectives start with “Today I will…”", "• Key words in bold, defined on their own slide", "• British spelling, no full stops in bullets" | `profile.voice.rules` |
| Test slide h3 | "Test slide in this style" | — |
| Test slide content | Kicker "Lesson 1 · Cells", title "Key words" ("words" in accent), chips "nucleus", "cell membrane", "cytoplasm", callout "**Mini-whiteboards:** Which part controls the cell?" | Slide content, not app copy (§8) |
| Correction label | "Anything I got wrong?" | — |
| Correction placeholder | "e.g. I never use yellow on title slides" | — |
| Correction button | "Tell me"; while working "Updating…" **(new)** | — |

**State copy (all new):**

| State | Copy |
|---|---|
| Privacy note (always, under the Tip) | Lock icon + "Each file is sent to Claude to learn your style. A copy is kept on this computer." |
| Pupil-names warning (`../style-profile.md` §2.2) | Callout (warning): "Some slides may contain pupil names. They’ll be sent to Claude to learn your style. Remove the file if you’d rather not." Affected rows show a warning icon with tooltip "May contain pupil names" |
| Empty draft, panel | EmptyState inside the panel body (name row still shown): "Add a few of your decks and I’ll show you what I learn here." |
| Before the first file is learned | Sub-cards show 3 skeleton rows each; test slide area: "Your test slide appears after the first file." |
| Failed file reasons (replace the size line, error ink) | "Password protected" · "This PDF is scanned images only" · "This file is damaged" · "No slides found" · "Over 50 MB" · "Couldn’t reach Claude" (retryable) · "Claude was busy" (retryable) |
| Retry button | `aria-label` "Try {file name} again" |
| Account error, queue paused | Callout (error) at the top of Your files with the README AI error copy and action, e.g. "Your Claude account is out of credit." + "Open platform.claude.com ↗"; after fixing: Button "Carry on" |
| Correction confirmation | "Got it: title slides won’t use the yellow box." (Claude's one-line message) |
| Corrections disclosure | "Your corrections ({n})" → list of past corrections, newest first |
| Name empty on Save | "Give this style a name." under the name field |
| Toasts | "Removed {file name}" + "Undo"; "Skipped {n} files that aren’t PDF or PowerPoint."; "{file name} is already in this style."; "Only 50 files per style. I skipped {n}."; "Saved “{name}”"; "Saved “{name}”. I’ll keep learning from the other {n} files." |

## 6. Data

```ts
'style-library:get' (args: { styleId: string }) → StyleDraftView
interface StyleDraftView {
  id: string
  name: string; nameSource: 'auto' | 'user'
  isDefault: boolean
  status: 'draft' | 'learning' | 'ready' | 'failed'     // StyleProfile.status
  files: StyleFile[]                                    // in queue order
  progress: LearnProgress
  profile: StyleProfileView | null                      // null until the first file is learned
  corrections: Array<{ text: string; at: string }>
}
interface StyleFile {                                   // projection of SourceRef (style-profile.md §1)
  id: string; name: string; kind: 'pdf' | 'pptx'
  units: number | null                                  // pages (pdf) or slides (pptx)
  status: 'waiting' | 'reading' | 'learned' | 'failed'
  error?: { code: 'password' | 'scanned' | 'corrupt' | 'empty' | 'too-large' | AiErrorCode; message: string; retryable: boolean }
  mayContainNames: boolean
}
interface LearnProgress {
  learned: number; failed: number; total: number
  stage: 'idle' | 'reading' | 'synthesising' | 'done' | 'paused'
  pausedFor?: AiErrorCode                               // no-key, invalid-key, no-credit pause the whole queue
  etaSeconds: number | null                             // remaining files × moving average per file (initial guess 30 s)
}
interface StyleProfileView {                            // display projection of StyleProfile; no exemplars, no sources
  colours: Array<{ token: string; hex: string; label: string; usage: string }>
  fonts: Array<{ use: 'title' | 'body' | 'accent'; family: string; weight: number; sizeRangePt: [number, number] | null; available: boolean; fallbackStack: string }>
  habits: string[]
  slideTypes: string[]
  voiceRules: string[]
  tokens: StyleProfile['tokens']; components: StyleProfile['components']   // what SlideView needs to draw the test slide
  testSlide: Slide | null                               // from synthesis; null → provisional template (§8)
  version: number
}

'style-library:pickFiles' (args: { styleId }) → Result<{ added: number; rejected: RejectedFile[] } | { cancelled: true }>  // native dialog, .pdf/.pptx, multi
'style-library:addFiles' (args: { styleId; paths: string[] }) → Result<{ added: number; rejected: RejectedFile[] }>      // drop (README D-f)
'style-library:removeFile' (args: { styleId; fileId }) → Result
'style-library:restoreFile' (args: { styleId; fileId }) → Result                     // toast Undo; reuses the cached analysis, no new Claude call
'style-library:retryFile' (args: { styleId; fileId }) → Result
'style-library:resume' (args: { styleId }) → Result                                  // "Carry on" after an account error
'style-library:update' (args: { styleId; name?: string; isDefault?: boolean }) → Result<{ style: StyleDraftView }>
'style-library:correct' (args: { styleId; text: string }) → Result<{ message: string; version: number }>   // ai-pipeline.md §4.3
'style-library:save' (args: { styleId }) → Result<{ style: StyleSummary }>
'style-library:progress' (event) → { styleId; file?: StyleFile; progress: LearnProgress; partialProfile?: StyleProfileView; name?: string }
'style-library:changed' (event) → StyleSummary[]                                     // Home and the editor style chip listen
```

- Storage: `styles/<styleId>/profile.json`, `history/`, `sources/` (`../style-profile.md` §4). Drafts are real styles with `status: 'draft'`, so nothing is lost on navigation or restart.
- Main validates paths, extensions, size (≤ 50 MB), count (≤ 50 per style) and duplicates (content hash) before copying.
- `update` writes immediately (rename and default are local edits, no Claude). Setting `isDefault` clears it on every other style.
- `save` sets `status` to `ready` (or `learning` if files are still being read) and emits `changed`.

## 7. States

| State | What it looks like |
|---|---|
| Default (learning) | As the image: 6 Learned, 1 Reading…, 1 Waiting; header pill "Learning · 6 of 8 files"; panel filled; Save enabled |
| Empty draft (first run, or "Create a new style…") | Your files: title + "0 files" hidden, the Dropzone reads "Add your PDFs or PowerPoints" and is taller (min-height 120px), no progress block, Tip and privacy note shown. Panel: name row + EmptyState. Header pill hidden. Save disabled |
| Files queued, none learned yet | Progress block shows "0 of {n} learned"; panel sub-cards show skeleton rows; test slide placeholder text; Save disabled |
| Reading | At most 2 rows show "Reading…" at once (`../style-profile.md` §2.1); the others "Waiting" in order |
| First file learned | Panel fills from the local merge; changed rows flash butter for 1.2 s (no flash with reduced motion); test slide shows the provisional template |
| Synthesising | All files processed; header pill "Finishing up…", ETA slot "Putting it all together…"; panel stays interactive |
| Done | Header pill "Learned from {n} files" (mint, check); ETA hidden; ProgressBar full |
| Partial (some failed) | Failed rows: peach "Couldn’t read" pill, reason in place of the size, Retry button when `retryable`. Progress counts failed files as processed: "6 of 8 learned"; done pill "Learned from 6 files" and, under the progress bar, "2 files couldn’t be read" **(new)** |
| All failed | Save disabled; panel keeps its EmptyState; Callout: "I couldn’t read any of these files. Try PowerPoint files or PDFs exported from PowerPoint." **(new)** |
| Paused (account error) | Remaining files stay "Waiting"; error Callout at the top of Your files with the README copy and its action; header pill "Paused" |
| No API key | Files can be added (digest runs locally) but nothing is sent: the queue is paused with `pausedFor: 'no-key'` and the README "Connect Claude" prompt replaces the error Callout |
| Offline | Files fail one by one as "Couldn’t reach Claude" (retryable); the queue pauses after 2 consecutive network failures with the network Callout + "Carry on" |
| Correcting | CorrectionBox input disabled, button "Updating…"; on success the panel and test slide update, the confirmation line shows, the input clears; on error the README AI error copy appears under the box and the text is kept |
| Pupil names found | Warning Callout above the file list; flagged rows show the warning icon |
| Edit mode | Title "Edit style", header pill "Learned from {n} files", Save reads "Save changes" and is enabled only when name or default changed. Adding files learns them and re-synthesises automatically |
| Long content | File names ellipsis (full name in `title`); more than 6 colours / 6 habits / 5 rules show the first ones plus "Show all" **(new)**; long style names (max 40 characters) wrap in the header h1 only in edit mode (h1 shows the static title in new mode) |

Implementation note (2026-10-06): a failed file row puts its status pill under the name, beside the reason, instead of at the row end: in the 340px Your files column a row-end pill left the name about 90px.

## 8. Interactions & behaviour

**Adding files**
1. Click or Enter on the Dropzone → `style-library:pickFiles` (native dialog, "Slides (*.pdf, *.pptx)", multi-select).
2. Dropping files anywhere on the page → `style-library:addFiles` with their paths. While dragging over the page, the Dropzone shows its active state (solid border, #FFF0B8).
3. **Queue order:** files are processed in the order added; within one batch, sorted by file name (A–Z, numeric). New batches join the end. Up to 2 files are read at once.
4. Each file goes Waiting → Reading… → Learned or Couldn’t read. Main pushes `style-library:progress` on every change; the UI never polls.

**Removing a file** (× on the row; no confirmation)
- Waiting: leaves the queue. Reading: its request is cancelled. Learned: its analysis is dropped and the panel recomputes from the remaining files (local merge); synthesis re-runs 10 s after the last removal (debounced) if it had already run. Failed: just removed.
- A toast "Removed {file name}" with "Undo" (6 s) → `style-library:restoreFile` (no new Claude call).
- If no learned files remain, Save is disabled again.

**What I've learned so far**
- Fills in from `partialProfile` after each learned file (local merge, no AI), then from the synthesised profile (`../style-profile.md` §2.3–2.4).
- Screen readers: a polite live region announces "Learned from {file name}" for each file, not each row.

**Style name and default**
- The name starts as her subject (from Welcome) or "My style" with `nameSource: 'auto'`; if synthesis suggests a better name it replaces it **only while** `nameSource` is `'auto'`. Typing sets `'user'`. Saved with `style-library:update` 500ms after typing stops. Max 40 characters.
- The default Checkbox saves immediately.

**Test slide**
- Until synthesis has produced `testSlide`, show a **provisional** slide built locally from a fixed template (kicker "Lesson 1 · {topic}", two-tone title "Key words", three chips, mini-whiteboard callout) drawn with the current tokens and components. No AI call.
- Replace it with Claude's test slide when synthesis finishes, and re-render after every correction. Crossfade 200ms (none with reduced motion).

**CorrectionBox**
1. Disabled until at least one file is learned.
2. "Tell me" is enabled when the input has non-space text. Enter = Tell me.
3. `style-library:correct({ styleId, text })` → Claude returns JSON Patch ops + a one-line message (`../ai-pipeline.md` §4.3); main applies them, bumps `version`, appends the correction, emits progress with the new profile.
4. Show the message as the confirmation line under the box until the next correction; add the text to "Your corrections".

**Save style**
- Enabled when ≥ 1 file is learned. If the name is empty: focus it, show "Give this style a name.", don't save.
- `style-library:save` → navigate to Home → toast. If files are still waiting or reading, they keep learning in the background; Home's StyleCard shows "Learning · {learned} of {total} files".
- In first run, saving is the last step of setup.

**Leaving without saving** (back button, Sidebar): no dialog. A new style stays a draft (Home StyleCard shows "Draft"); learning continues; coming back resumes exactly here.

**Keyboard:** Tab order: back → Save → Dropzone → file rows (Retry, remove) → Tip/notes → name → default → each sub-card's "Show all" (if any) → correction input → Tell me. Ctrl+O opens the file dialog **(new)**.

## 9. Acceptance criteria

- [ ] At 1440×1300 the screen matches `04-create-style.png` side by side.
- [ ] At 1280×800 the two Cards sit side by side (340px basis); at 1100px they stack and the file list shows 5 rows with "Show all".
- [ ] Dropping 8 mixed PDF/PPTX files lists them in name order, all "Waiting", then at most 2 "Reading…" at a time.
- [ ] Each status change appears without a refresh, and the panel fills in before all files finish.
- [ ] A password-protected PDF shows "Couldn’t read" with "Password protected"; the others carry on.
- [ ] Removing a learned file updates the colours/habits without a new Claude call; Undo brings it back.
- [ ] "6 of 8 learned", the ProgressBar width and the header pill always agree.
- [ ] Save style is disabled until one file is learned, then saves and returns Home with the new StyleCard.
- [ ] Ticking "Make this my default style" makes it the only default (Home shows the "Default" pill on it).
- [ ] "I never use yellow on title slides" → "Updating…", then a confirmation line, a changed profile version and a re-rendered test slide.
- [ ] With no API key, files are listed but none is sent to Claude, and the Connect Claude prompt is shown.
- [ ] A slide text containing pupil-like names shows the warning Callout.
- [ ] Leaving mid-learning and coming back shows the same progress; the files kept learning meanwhile.
- [ ] The test slide uses only the profile's fonts and colours (no app colours or fonts).

## 10. Open questions

1. **First run with a sidebar:** the image draws step 3 with the full Sidebar and a "Home" back button, while the rest of first run has no sidebar. The spec follows the image (first run ends on Connect Claude). Should step 3 instead hide the Sidebar and show the ProgressPills?
2. **Files card width:** OK to use a 340px basis (instead of 380px) so the two columns fit the default 1280px window?
3. **Pupil names:** should flagged files pause before anything is sent ("Check first" with "Send anyway / Remove"), rather than just warning? The current pipeline digests and then sends straight away.
4. **Discarding a draft:** no control is drawn. The spec keeps drafts; deleting a style would live in the (undesigned) Styles list.
5. **Removing a correction:** should past corrections be removable? The spec lists them read-only.
6. The Styles list page behind the Sidebar "Styles" item and Home's "Manage" isn't designed.
