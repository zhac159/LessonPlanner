# Slide Planner design system · B "Classroom" · v1

Bold and friendly: thick ink outlines, hard offset shadows, pastel tiles and an orange accent. This is the spec coding agents build the app from. Tokens live in [`tokens.css`](tokens.css), and `src/renderer/src/styles/tokens.css` must mirror it.

**How to read this**
- Every px value is a CSS px at 100% zoom. The app uses `box-sizing: border-box` everywhere, so **every size here is the outer size, including the 2px border**. Where a mockup drew a content-box element (a 32px avatar plus a 2px border renders at 36px), the rendered size is the one given here.
- Component names in this doc are canonical. Use them as the React component names.
- "Mock" means the `.dc.html` source in `canvas/project/`. "(proposed)" marks something the mockups don't show and this spec adds.

**Screens covered**

| Screen | Mockup | Image | Sidebar |
|---|---|---|---|
| Welcome | `Welcome.dc.html` | `images/01-welcome.png` | none |
| Connect Claude | `ConnectClaude.dc.html` | `images/02-connect-claude.png` | none |
| Home | `Main.dc.html` | `images/03-home.png` | expanded |
| Create a style | `StyleBuilder.dc.html` | `images/04-create-style.png` | expanded |
| New lesson | `NewLesson.dc.html` | `images/05-new-lesson.png` | rail |
| Lesson editor | `Editor.dc.html` | `images/06-editor.png` | rail |
| Plugin sheet (editor state) | `PluginSheet.dc.html` | `images/07-plugin-sheet.png` | rail |

---

## 1. Principles

1. **Her slides are never restyled by the app.** Slide content renders in an isolated layer, with fonts and colours from her Style Profile only. App tokens, fonts and resets must not cascade into it. App chrome may sit *on top* of a slide (region circles, labels, selection), but never inside it.
2. **Ink outline plus offset shadow means "this is a thing you can use".** A 2px ink outline marks a control or a card. A hard offset shadow means raised: a primary action, a page card, a panel. No blur, no gradients, no hairlines.
3. **Colour carries meaning, never on its own.** Orange = the primary action or the active item. Yellow = the planning buddy. Butter = "drop or add something here". Lilac = the teacher's own words and helpful info. Pastels = categories. Every coloured state also has a word, an icon, a border or a shape change.
4. **One orange hero per region.** A region gets at most one orange primary button. A screen gets at most one orange card (Home's "Make a new lesson").
5. **Friendly, plain, British.** Short sentences, sentence case, British spelling. The buddy talks in the first person ("I'll build the slides in your style"), and the app calls the teacher "you".
6. **Big and forgiving.** Hit areas of at least 44px, 2px outlines, generous spacing, and a circle that always closes even if she doesn't quite finish it.
7. **Calm chrome, a few moments of delight.** Every control has the same press physics. Bigger motion is saved for generating slides and circling things, and it respects reduced motion.

---

## 2. Colour

### 2.1 Palette tokens

| Token | Hex | Usage |
|---|---|---|
| `--ink` | `#1B1530` | All text, every outline (2px), every hard shadow, dark buttons, pressed ToggleChip, "Default" badge |
| `--ground` | `#F1EEFF` | Page background (`--bg-0`). Sunken tiles: FontSample tile, TestSlidePreview card, Home search field |
| `--white` | `#FFFFFF` | Surfaces (`--surface`): cards, panels, fields, title bar, sidebar, secondary buttons, the slide stage frame |
| `--orange` | `#FF6B3D` | Primary buttons, active nav item, active ToolButton, checked RadioPill, current ProgressPill, open "+" button, number discs, the region circle, Home's accent card. **Ink text only.** |
| `--orange-tint-1` | `#FFB199` | Progress dot 2 (decorative) |
| `--orange-tint-2` | `#FFD9CC` | Progress dot 3 (decorative) |
| `--yellow` | `#FFE36E` | The planning buddy: chat header band, "What I've learned" band. Welcome hero panel, EmptyState icon tile, Connect key tile, field focus halo, text selection |
| `--butter` | `#FFF4D6` | Invitations: Dropzones, current SetupStep, checked RadioCard, tip Callout |
| `--lilac` | `#E9E3FF` | The teacher's voice (MessageUser bubble), info Callout, hover fill for ghost controls (`--surface-hover`) |
| `--purple-soft` | `#EAD9FF` | Category. Avatar fill |
| `--peach` | `#FFD6C9` | Category. Error fill (proposed) |
| `--sky` | `#D7E8FF` | Category |
| `--mint-soft` | `#DFF5D8` | Category. Success fill |
| `--butter-2` | `#FFF0B8` | Category. "Working" fill |
| `--teal-soft` | `#D6F0EE` | Category. The active/default style (style SelectChip, default StyleCard) |
| `--divider` | `#E4DFF7` | Soft 2px dividers (sidebar profile, sheet footer, Connect footer, ToolRail separator). Borders of inactive list rows (file rows, upcoming SetupSteps) |
| `--line-muted` | `#B9B1D9` | Disabled borders, upcoming ProgressPills and their connectors, upcoming step rings, skeleton slots |
| `--text-muted` | `#4E4766` | Secondary text on white, ground and pastels: meta, help text, subtitles, Sort label |
| `--text-muted-2` | `#3A3352` | Secondary text on yellow, peach, butter and teal-soft (band subtitles, Dropzone sub-text, StyleCard meta), the Connect description, empty-state body, dark-button hover fill |
| `--text-placeholder` | `#6B6485` | Placeholder text and disabled text. **On white or ground only** (fails on pastels, see §3) |
| `--danger-text` | `#B42318` | Error message text (proposed). 6.57:1 on white |
| `--win-close` / `--win-close-pressed` | `#E81123` / `#C50F1F` | TitleBar close button hover/pressed, with a white icon (Windows convention) |

Rationalised: the Welcome lead paragraph uses `#2E2745` in the mock. Use `--text-muted-2` instead (9.27:1 on yellow), so there's no extra token.

**Not app tokens.** These are the sample teacher's slide and style colours, and they only ever come from a Style Profile: `#0E7C7B` teal, `#12263A` navy, `#E3F2F1`, `#0B5E5D`, `#E6EEEC`, `#4A5A5F`, `#E3E7EA`, `#7A3E9D`, `#F2B134`, `#2E2A3A`, `#F7F2E8`.

### 2.2 Semantic tokens and legacy mapping

The existing code reads these names. Re-skin by swapping their values.

| Legacy name | New value | Note |
|---|---|---|
| `--bg-0` | `--ground` | Page background. Drop the dark radial gradients from `base.css` |
| `--bg-1` | `--white` | Chrome: title bar, sidebar |
| `--bg-2` | `--lilac` | Tinted surface |
| `--surface` | `--white` | |
| `--surface-hover` | `--lilac` | Ghost controls on hover |
| `--border` / `--border-strong` | `--ink` | Always 2px (`--border-w`). Replace every `1px solid var(--border)` with `var(--border-ink)` |
| `--text` | `--ink` | |
| `--text-dim` | `--text-muted` | |
| `--text-faint` | `--text-placeholder` | |
| `--accent` | `--orange` | Text on it is always ink |
| `--accent-2` | `--yellow` | **Fill only.** `.eyebrow { color: var(--accent-2) }` in `base.css` must change to `--text-muted` |
| `--accent-3` | `--lilac` | Fill only |
| `--success` / `--warning` / `--danger` | `--mint-soft` / `--butter-2` / `--peach` | Status **fills**. Text and icons on them are ink. Red text uses `--danger-text` |
| `--radius-sm` / `--radius` / `--radius-lg` | 8 / 14 / 20 | |
| `--font` | Figtree stack | See §4 |
| `--ease`, `--titlebar-h`, `--sidebar-w` | unchanged | |

New semantic names: `--surface-pressed` (divider), `--surface-sunken` (ground), `--surface-invite` (butter), `--surface-assistant` (yellow), `--border-soft`, `--border-muted`, `--text-on-dark` (white), `--text-on-accent` (ink), `--info` (lilac).

### 2.3 Category palette (pastels)

Pastels code *kind*, not quality. They're always drawn with ink text, a 2px ink border and a text label, so colour is never the only cue. A pastel means one thing within a screen. The same pastel can mean different things on different screens (Year 9 and Quiz are both peach).

| Pastel | Year group | File type | Status | Plugin tile | Elsewhere in the mocks |
|---|---|---|---|---|---|
| `--sky` `#D7E8FF` | Year 7 | PPTX | | Differentiate | Slide-type tag "Title", "Practical method". How-to step 2 |
| `--mint-soft` `#DFF5D8` | Year 8 | DOCX (proposed) | Learned, Connected, "8 slides added", done step | Worksheet | Tag "Learning objectives". How-to step 3 |
| `--peach` `#FFD6C9` | Year 9 | PDF | Error (proposed) | Quiz (and its sheet band) | Tags "Do Now", "Exit ticket". How-to step 1 |
| `--butter-2` `#FFF0B8` | Year 10 (proposed) | | Reading…, Learning… | Speaker notes | Tag "Key words" |
| `--purple-soft` `#EAD9FF` | Form time | | Waiting | Starter & plenary | Tag "Mini-whiteboard question". Avatar |
| `--teal-soft` `#D6F0EE` | Year 11 (proposed) | | | (next plugin) | Active/default style |
| `--lilac` `#E9E3FF` | Sixth form (proposed) | | | | Reserved: user bubble, info |

- **Plugin tone:** each plugin declares a `tone` from this list. `tone` is a manifest field (`plugin-architecture.md` §2). If a plugin doesn't declare one, assign the tones in the order sky, mint, peach, butter-2, purple-soft, teal-soft by registration order. The PluginSheet header band uses the same tone.
- **Slide-type tags** (Create a style) cycle sky, peach, mint, butter-2, purple-soft in the order the types are listed.
- **File types not listed:** white badge.

### 2.4 Other colour rules

- **Selection:** `::selection { background: var(--yellow); color: var(--ink) }`.
- **Scrollbars:** 10px wide, thumb `--line-muted` with a 3px transparent border (`background-clip: content-box`), radius pill, hover thumb `--text-muted`, track transparent. This replaces the dark-theme scrollbars in `base.css`.
- **Never:** white text on orange, orange text on anything, yellow text, placeholder grey on pastels.

---

## 3. Contrast (WCAG 2.2, computed)

Text needs 4.5:1 (all app text is under 24px regular or 18.66px bold, apart from display titles, and those are ink anyway). Non-text (component boundaries, state indicators, focus) needs 3:1.

### 3.1 Text pairs used in the mockups

| Foreground | Background | Ratio | Result | Where |
|---|---|---|---|---|
| ink | white | 17.55 | Pass | Everything on cards |
| ink | ground | 15.39 | Pass | Page titles, editor header |
| ink | orange | **6.20** | Pass | Primary buttons, Home accent card copy (16px), active nav, checked RadioPill, number discs |
| ink | yellow | 13.76 | Pass | Chat band, Welcome hero |
| ink | butter | 16.02 | Pass | Dropzones, current step, checked RadioCard |
| ink | lilac | 14.12 | Pass | User bubble, info Callout |
| ink | purple-soft | 13.26 | Pass | Form chip, Waiting, Starter tile, avatar |
| ink | peach | 13.13 | Pass | PDF, Year 9, Quiz, sheet band |
| ink | sky | 14.10 | Pass | PPTX, Year 7, Differentiate |
| ink | mint-soft | 15.20 | Pass | Year 8, Learned, Connected |
| ink | butter-2 | 15.38 | Pass | Reading…, Speaker notes, Learning pill |
| ink | teal-soft | 14.67 | Pass | Style chip, default StyleCard |
| white | ink | 17.55 | Pass | Dark buttons, pressed ToggleChip, "Default" badge |
| text-muted `#4E4766` | white | 8.69 | Pass | Meta, help, upcoming steps |
| text-muted | ground | 7.62 | Pass | Home subtitle, Sort label, upcoming ProgressPill |
| text-muted | butter | 7.93 | Pass | Dropzone meta (12px) |
| text-muted | lilac | 6.99 | Pass | (allowed) |
| text-muted-2 `#3A3352` | white | 11.83 | Pass | Connect description, empty-state body |
| text-muted-2 | yellow | 9.27 | Pass | Band subtitles ("Knows your Science style") |
| text-muted-2 | peach | 8.85 | Pass | Sheet subtitle |
| text-muted-2 | butter | 10.79 | Pass | Dropzone sub-text, checked RadioCard description |
| text-muted-2 | teal-soft | 9.89 | Pass | StyleCard meta |
| `#2E2745` (Welcome lead) | yellow | 11.03 | Pass | Replace with text-muted-2 (9.27) |
| text-placeholder `#6B6485` | white | 5.55 | Pass | Field placeholders |
| text-placeholder | ground | 4.86 | Pass | Search placeholder, title field, disabled header buttons |
| white | `#E81123` | 4.63 | Pass | TitleBar close hover icon |
| white | `#C50F1F` | 6.07 | Pass | Close pressed |
| danger-text `#B42318` | white / ground / peach / butter | 6.57 / 5.76 / 4.92 / 6.00 | Pass | Error messages (proposed) |

**No body-text pair in the mockups is under 4.5:1.**

### 3.2 Pairs that fail. Don't use them.

| Pair | Ratio | Fix |
|---|---|---|
| white on orange | 2.83 | Text on orange is always ink (6.20) |
| text-muted on orange | 3.07 | Use ink on orange. No secondary grey inside the orange card |
| text-muted-2 on orange | 4.18 | Same as above |
| text-placeholder on lilac / sky / mint / yellow / purple-soft / peach | 4.46 / 4.46 / 4.80* / 4.35 / 4.19 / 4.15 | Placeholder and disabled grey only on white or ground. On pastels use text-muted (6.5 or more). *Mint passes but keep the rule simple |
| text-placeholder on orange | 1.96 | Never |
| orange as text on white | 2.83 | Never use orange for text or for thin icons |

### 3.3 Non-text contrast (3:1)

| Element | Ratio | Result | Fix |
|---|---|---|---|
| Ink outline against any surface | 6.20 or more | Pass | |
| Orange fill vs white / ground | 2.83 / 2.48 | **Fail as a lone cue** | Orange must never be the only state signal. In the mocks it's always paired: active nav item gains an ink border and shadow; active ToolButton gains an ink border; checked RadioPill shows the radio dot and bolder text; current ProgressPill has an ink border (upcoming pills have muted borders); the open "+" button has the menu itself |
| Active SlideThumb: orange shadow vs ground | 2.48 | **Fail** | Use `--shadow-accent` (orange slab plus a 2px ink rim, 15.39:1) and set `aria-current="true"` |
| Composer focus: yellow halo vs white | 1.28 | **Fail** | Use `--focus-field`: a 4px yellow halo plus a 2px ink rim outside it |
| "Untitled lesson" field: dashed `#B9B1D9` vs ground | 1.78 | **Fail** (it's the only cue that the title is editable) | Dashed border in `--text-placeholder` (4.86:1), plus a trailing `pencil` icon 16px. Solid ink on hover and focus |
| ProgressBar fill: orange vs white track | 2.83 | Pass via the ink edge | The fill keeps its 2px ink right border, and the label states the value |
| Upcoming step borders `#B9B1D9` / `#E4DFF7` | 2.03 / 1.30 | Allowed | Not interactive, and the text label carries the meaning |
| Disabled borders `#B9B1D9` | 1.78 to 2.03 | Exempt | Disabled controls are exempt |
| Progress dots | decorative | Exempt | `aria-hidden`. The adjacent text states the progress |

---

## 4. Typography

### 4.1 Families

| Role | Family | Weights | Package (bundled) | CSS family name |
|---|---|---|---|---|
| Display (titles, wordmark, panel titles) | Bricolage Grotesque | 700, 800 | `@fontsource-variable/bricolage-grotesque` | `'Bricolage Grotesque Variable'` |
| UI (everything else) | Figtree | 400, 500, 600, 700, 800 | `@fontsource-variable/figtree` | `'Figtree Variable'` |

- **Bundle the fonts. Don't link Google Fonts.** The renderer runs offline under the CSP `default-src 'self'; font-src 'self' data:; connect-src 'self'`, so a Google Fonts `<link>` is blocked. Install both packages, import them in `src/renderer/src/main.tsx` in place of `@fontsource-variable/inter`, and Vite bundles the woff2 files as local assets.
- **Bricolage axes:** the mock loads the `opsz` axis (12–96), so big titles get the display cut. Prefer the package's all-axes stylesheet if the installed version ships one (check `node_modules/@fontsource-variable/bricolage-grotesque/` for `opsz.css` or `full.css`). The default entry (weight axis only) is an acceptable fallback. Leave `font-optical-sizing: auto`.
- **Figtree 800:** the brief said 400–700, but the mockups use Figtree 800 for primary CTA labels, legends, prominent labels, number discs, file badges and the stepper value. The variable font covers it.
- **Fallbacks:** `'Segoe UI Variable Text'` / `'Segoe UI Variable Display'`, then `'Segoe UI'`, then `system-ui`. See `--font` and `--font-display`.
- **Lexend is not an app font.** It only appears because the sample teacher's slides use it. Slide fonts come from the Style Profile and are loaded by the slide renderer, never from the app bundle. If a profile font isn't installed, the FontSample shows a warning (§7). Never fall back silently to Figtree inside a slide.
- Base: `body { font: var(--type-body) }` (15px). The current `base.css` uses 14px, so change it. Set `<html lang="en-GB">`.

### 4.2 Type scale

Use the `--type-*` tokens as `font:` shorthands and add `letter-spacing` where listed.

| Token | Role | Family | Size | Weight | Line-height | Letter-spacing | Used for |
|---|---|---|---|---|---|---|---|
| `--type-hero` | Hero | Display | 56 | 800 | 1.02 | −0.02em | Welcome "Plan lessons in your own style." |
| `--type-page-title` | Page title | Display | 44 | 800 | 1.05 | −0.02em | Home "Good morning, Alice!" |
| `--type-dialog-title` | Onboarding title | Display | 32 | 800 | 1.1 | −0.01em | "Welcome!", "Connect Claude" (mock 34, rationalised to 32) |
| `--type-card-title` | Card title | Display | 30 | 800 | 1.1 | −0.01em | "Make a new lesson" |
| `--type-section-lg` | Section title L | Display | 28 | 800 | 1.15 | 0 | "Past lessons", EmptyState title |
| `--type-section-md` | Section title M | Display | 24 | 800 | 1.15 | 0 | "Your styles" |
| `--type-section-sm` | Section title S | Display | 22 | 800 | 1.2 | 0 | "Your files", "What I've learned so far", `bar` PageHeader title |
| `--type-chat-title` | Chat heading | Display | 20 | 800 | 1.25 | 0 | "What are we teaching?" |
| `--type-panel-title` | Panel title | Display | 18 | 800 | 1.25 | 0 | "Your planning buddy", PluginSheet title (mock 19) |
| `--type-lesson-title` | Lesson title | Display | 18 | 700 | 1.25 | 0 | Editor header title, "Untitled lesson" field |
| `--type-menu-title` | Menu title | Display | 16 | 800 | 1.25 | 0 | "What shall we make?" |
| `--type-wordmark` | Wordmark | Display | 14 | 800 | 1 | 0 | TitleBar "Slide Planner" |
| `--type-lead` | Lead | UI | 18 | 400 | 1.5 | 0 | Welcome intro paragraph |
| `--type-subtitle` | Subtitle | UI | 17 | 400 | 1.4 | 0 | Home subtitle. Also at 800: large Dropzone title, NumberStepper value |
| `--type-body-lg` | Body L | UI | 16 | 400 | 1.5 | 0 | Card copy, onboarding copy, field values, LessonCard title (700), StyleCard name (700) |
| `--type-body` | Body (base) | UI | 15 | 400 | 1.5 | 0 | Default text, chat messages, list rows |
| `--type-heading-ui` | UI heading | UI | 16 | 800 | 1.3 | 0 | Inner card h3 ("Colours"), CorrectionBox label |
| `--type-label` | Field label | UI | 14 | 700 | 1.3 | 0 | Field labels (Welcome, Create a style) |
| `--type-label-strong` | Prominent label / legend | UI | 15 | 800 | 1.3 | 0 | Connect "Claude API key", "Model". PluginSheet legends. Callout title |
| `--type-button` | Button md | UI | 15 | 700 | 1.2 | 0 | md buttons, nav items (600 when inactive) |
| `--type-button-lg` | Button lg / xl | UI | 16 | 800 | 1.2 | 0 | Primary lg/xl CTAs (dark lg uses 700) |
| `--type-small` | Small | UI | 14 | 400 | 1.5 | 0 | Callout body, inner-card text, link text (700), chips sm (700) |
| `--type-caption` | Caption | UI | 13 | 400 | 1.4 | 0 | Meta, band subtitles, help text, RegionChip/RegionLabel (700), tags (700) |
| `--type-micro` | Micro | UI | 12 | 700 | 1.3 | 0 | StatusPill sm, year chip, slide number. File size and profile status at 400 |
| `--type-badge` | Badge | UI | 11 | 800 | 1 | +0.04em, uppercase | FileTypeBadge |

**Weights in UI text:** 400 body; 500 the "(optional)" suffix only; 600 inactive nav items, inactive chips, identity field values, file names; 700 buttons, labels, active chips, emphasis; 800 lg/xl CTAs, legends, prominent labels, number discs, badges.

---

## 5. Spacing, radii, borders, shadows

### 5.1 Spacing

The core steps are multiples of 4. The 2px half-steps (6, 10, 14, 18, 22) exist because the mockups use them inside components. Use them only where a component spec says so.

| Token | px | Typical use |
|---|---|---|
| `--space-2` | 2 | Hairline nudges (radio margin-top) |
| `--space-4` | 4 | Dot gaps, chip inner padding |
| `--space-6` | 6 | Label to field, title to subtitle, nav item gap, ToolRail gap, filmstrip number gap |
| `--space-8` | 8 | Chip and tile gaps, list gaps, button icon gap, composer gaps |
| `--space-10` | 10 | Row gaps (StyleCard parts, avatar to name), hero action row |
| `--space-12` | 12 | Grid gaps (how-to cards, nav icon gap, Filmstrip gap, plugin grid padding) |
| `--space-14` | 14 | Header padding-block, card gap (Your files), field padding-inline |
| `--space-16` | 16 | Inner card padding, card gaps, stage column gap |
| `--space-18` | 18 | Chat body padding, Welcome card gap |
| `--space-20` | 20 | Editor gutters and gaps, lesson grid gap, sheet form gap |
| `--space-22` | 22 | Create-a-style card padding |
| `--space-24` | 24 | Page padding-inline, Home card padding, main grid gap |
| `--space-28` | 28 | Home accent card padding, Welcome hero gap |
| `--space-32` | 32 | Onboarding card padding, Home page padding-top |
| `--space-36` | 36 | Gap between Home sections |
| `--space-48` | 48 | Welcome panel padding-block, Connect bottom padding |
| `--space-56` | 56 | Welcome hero padding-inline, Home bottom padding |

### 5.2 Radii

Nested rule: an element flush inside a bordered parent uses parent radius − 2 (a band in a 22 panel gets 20 on its top corners, and in a 24 card gets 22).

| Token | px | Components |
|---|---|---|
| `--radius-6` | 6 | SlideThumb number badge, app mark (mock 7), custom Checkbox |
| `--radius-8` | 8 | FileTypeBadge, ColourRole swatch, AttachmentCard icon tile, TestSlidePreview frame, Tooltip |
| `--radius-10` | 10 | SlideThumb, Filmstrip "Add slide", "Untitled lesson" field, ghost IconButton, SelectChip options |
| `--radius-12` | 12 | Button md (rect), TextField lg (48), Select sm (40), Sidebar nav item, ToolButton, NumberStepper, square IconButton, AttachmentCard, FontSample tile, sheet icon tile |
| `--radius-14` (`--radius`) | 14 | Button lg/xl (rect), TextField xl (52), Select lg, SetupSteps rows, file rows, PluginTile, RadioCard, SlideStage, stage EmptyState, MessageProgress, Home accent-card icon tile |
| `--radius-16` | 16 | Inner Card, Dropzone, Callout (bordered), StyleCard, hero TextArea, how-to step cards, CorrectionBox, TestSlidePreview card, SelectChip popover, Connect icon tile |
| `--radius-18` | 18 | LessonCard, ToolRail, Composer, MessageUser (18 18 4 18) |
| `--radius-20` | 20 | PluginMenu, EmptyState icon tile |
| `--radius-22` | 22 | ChatPanel, PluginSheet |
| `--radius-24` | 24 | Page cards (Welcome, Connect, Home, Create a style) |
| `--radius-pill` | 999 | Pills: chips, StatusPill, ProgressPills, pill buttons, search field, ProgressBar, RegionChip, RegionLabel, tip Callout |

### 5.3 Borders

| Token | Value | Use |
|---|---|---|
| `--border-ink` | 2px solid ink | Every control, card, panel, tile, badge, chip and disc. Also the TitleBar bottom and sidebar right edge |
| `--border-dashed` | 2px dashed ink | Things that invite you to add: Dropzones, the stage EmptyState, "More plugins" tile, "Add slide", MessageProgress, CorrectionBox, tip Callout |
| `--border-placeholder` | 2px dashed `--line-muted` | Decorative skeleton slots (empty filmstrip) |
| `--border-divider` | 2px solid `--divider` | Soft dividers and inactive list rows |
| `--border-disabled` | 2px solid `--line-muted` | Disabled controls, upcoming ProgressPills |

There are no 1px borders anywhere. Ghost controls keep a 2px transparent border so they line up with outlined ones.

### 5.4 Shadows (hard offset only)

| Token | Value | When |
|---|---|---|
| `--shadow-xs` | `2px 2px 0 ink` | Active Sidebar nav item. Hover on flat controls |
| `--shadow-sm` | `3px 3px 0 ink` | Primary buttons. Checked RadioCard |
| `--shadow-md` | `4px 4px 0 ink` | LessonCard, ToolRail, EmptyState icon tile, SelectChip popover |
| `--shadow-lg` | `6px 6px 0 ink` | Page cards, ChatPanel, PluginSheet, SlideStage, PluginMenu. The Welcome illustration cards (mock 5px) use this too |
| `--shadow-accent` | `4px 4px 0 0 orange, 4px 4px 0 2px ink` | Active SlideThumb |

- **Rule:** only one level of shadow per stack. Cards inside a shadowed card are flat. Buttons and checked states inside them may still carry their own small shadow.
- **Press physics** (all shadowed controls): hover lifts the control 1px up-left and grows the shadow 1px, so the shadow's far edge stays put. Pressed sinks the control 2px down-right and shrinks the shadow 2px (a 3px shadow becomes 1px; a 2px shadow is removed). Full recipes are in §7.0.

---

## 6. Layout

### 6.1 Window

| Item | Value |
|---|---|
| Default size | 1280 × 800 |
| Minimum (`BrowserWindow` `minWidth` / `minHeight`) | 1100 × 700 |
| Layout must still hold down to | 960 × 600 CSS px. Windows display scaling at 125–150% and Ctrl+zoom can shrink the CSS viewport below the minimum |
| Frame | Frameless, with the custom TitleBar. The window and body never scroll; each screen's content region scrolls |

### 6.2 Shell

```
┌──────────────────────── TitleBar 40px (white, 2px ink bottom) ──────────────┐
│ Sidebar │  Content region (scrolls vertically)                              │
│ 224 /72 │  bg --ground                                                      │
└─────────┴───────────────────────────────────────────────────────────────────┘
```

| Screen | Sidebar | Content |
|---|---|---|
| Welcome, Connect Claude | none (first run) | Full width under the TitleBar |
| Home, Create a style, Plugins, Settings | expanded, 224 | Centred column |
| New lesson, Lesson editor (incl. Plugin sheet) | rail, 72 ("focus mode") | Full-bleed editor grid |

### 6.3 Page layouts

| Screen | Layout |
|---|---|
| Welcome | Two panels, wrapping. Left hero: `flex: 1 1 560px`, yellow, 2px ink right border, padding 48 56, gap 28, content max 560. Right: `flex: 1 1 480px`, padding 48 24, card centred, max-width 440 |
| Connect Claude | `steps` PageHeader (padding 14 24), then a card centred, max-width 760, padding around it 16 24 48 |
| Home | `<main>` max-width `--content-max` 1280, margin auto, padding 32 24 56, gap 36 between sections. Card row: accent card `flex: 3 1 560px` and styles card `flex: 2 1 380px`, gap 24, wrapping (side by side from about 1236px window width). Lesson grid: `repeat(auto-fill, minmax(260px, 1fr))`, gap 20 |
| Create a style | `bar` PageHeader. `<main>` max-width `--content-max-wide` 1320, padding 28 24 48, gap 24, wrapping. **Change from the mock:** files card `flex: 1 1 340px` and learned card `flex: 2 1 560px` (mock 380 / 620), so the columns sit side by side at the default 1280 window. The mock's bases wrap below 1296px. Inner grid: `repeat(auto-fit, minmax(280px, 1fr))`, gap 16 |
| New lesson / Lesson editor | See §6.4 |

### 6.4 Editor layout (New lesson, Lesson editor, Plugin sheet)

```
┌rail┐┌ PageHeader editor: [‹ My lessons]   Lesson title   [Style ▾][Present][Export] ┐
│ 72 ││┌Tool┐ ┌──────── SlideStage (16:9, ≤900) ────────┐  ┌── ChatPanel 400 ──────┐│
│    │││rail│ │                                         │  │ band (yellow)         ││
│    │││ 68 │ └─────────────────────────────────────────┘  │ messages (scroll)     ││
│    │││    │   tip Callout (circle hint)                  │                       ││
│    ││└────┘ ▢ ▢ ▢ ▢ ▢ ▢ ▢ ▢ [+]  Filmstrip (scroll-x)    │ Composer              ││
└────┘└──────────────────────────────────────────────────────┴───────────────────────┘
```

- **Body:** padding 4 20 20 (`--editor-pad-x`), column gap 20 (`--editor-gap`). Row heights: PageHeader 72, then the body fills the rest. The page itself never scrolls at 700px height or more.
- **Columns:** `[ToolRail auto] [stage column minmax(--stage-min-w 520, 1fr)] [ChatPanel --chat-w 400]`, with a gap of 20 between all three. ToolRail is 68 wide (48 + 2×8 padding + 2×2 border).
- **Stage column:** centred, gap 16: SlideStage, then the tip Callout, then the Filmstrip. Stage width = min(900, column width, available height × 16/9), where available height = body height − callout (≈38) − filmstrip (≈110) − 2 gaps (32). Size it with a ResizeObserver or container query so the stage never forces vertical scroll.
- **ChatPanel:** stretches to the full body height. Only its message list scrolls.
- **Breakpoints** (window width):

| Window | Behaviour |
|---|---|
| ≥ 1240 | Three columns, chat 400 |
| 1100–1239 | Chat narrows to `--chat-w-min` 360. Stage keeps ≥ 520 |
| < 1100 (zoom/scaling only) | ChatPanel wraps below the stage column at full width (min-height 420). ToolRail turns horizontal (`aria-orientation="horizontal"`) above the stage. The page scrolls vertically |
| < 760 | PageHeader wraps: the title takes its own row. The header buttons stay at 44 |

The mock does this with `flex-wrap` (`main: flex 999 1 600px`, `aside: flex 1 1 400px`), which wraps the chat below at about 1132px. Use the explicit grid above so the chat stays beside the stage down to the 1100 minimum.

---

## 7. Components

### 7.0 Shared state recipes

Each component below says which recipe it uses, plus its own extra states (checked, current, expanded and so on).

| Recipe | Rest | Hover | Pressed (`:active`) | Disabled |
|---|---|---|---|---|
| **raised** (rest shadow S = 2–3px) | shadow S | `translate(-1px,-1px)`, shadow S+1 | `translate(2px,2px)`, shadow max(S−2, 0) | see *disabled* |
| **raised-card** (S = 4px) | `--shadow-md` | `translate(-2px,-2px)`, 6px shadow | `translate(2px,2px)`, 2px shadow | n/a |
| **flat** (ink outline, no shadow) | no shadow | `--shadow-xs` appears, no movement | `translate(2px,2px)`, no shadow | see *disabled* |
| **ink-fill** (dark button, pressed ToggleChip) | ink fill | fill `--text-muted-2` | `translate(1px,1px)` | see *disabled* |
| **ghost** (no visible border) | transparent | fill `--surface-hover` | fill `--surface-pressed` | icon and text `--line-muted` |
| **field** | 2px ink, white | none (cursor `text`) | — | border `--line-muted`, fill `--ground`, text `--text-placeholder` |
| **static** | — | — | — | — |

- **disabled** (raised, flat, ink-fill): border `--line-muted`, fill transparent, text and icons `--text-placeholder`, `--shadow-none`, `cursor: not-allowed`, no hover or press. Use the `disabled` attribute. Use `aria-disabled="true"` instead when the control must stay focusable to explain itself in a Tooltip ("Add some slides first").
- **focus-visible** (everything interactive except fields): `outline: var(--focus-ring); outline-offset: var(--focus-ring-offset)`, i.e. 3px ink at a 2px offset. Inside clipped containers use `outline-offset: var(--focus-ring-inset-offset)` (−5px). Fields use `box-shadow: var(--focus-field)` on `:focus` (§8).
- **loading** (actions): `aria-busy="true"`, width locked, clicks ignored, the leading icon is replaced by `loader-circle` (spinning, 1s linear, static under reduced motion), and the label switches to the progress wording ("Making quiz…").
- **Transitions:** `transform`, `box-shadow`, `background-color` over `--dur-fast` with `--ease`. The `:active` press-in uses `--dur-press`.

### Shared atoms

Small pieces several components use.

- **NumberDisc:** a circle with a 2px ink border and an 800-weight centred numeral. Sizes (rendered, including the border): 30 (13px), 32 (13px), 36 (15px). Fills: orange (current), white, a pastel, or transparent with a `--line-muted` ring (upcoming). Region discs are 20/22, orange with no border.
- **Avatar:** 36 circle, 2px ink, `--purple-soft`, initial in 800 15px. aria-label is the name.
- **SwatchDot:** 16 circle (12 + 2px border), ink border, filled with the profile's primary colour.
- **ProgressDots:** three dots in `--orange`, `--orange-tint-1`, `--orange-tint-2`. 8px with a 4px gap in chat, 7px with a 3px gap in pills. `aria-hidden`. Animation in §9.
- **Tooltip** (proposed): ink fill, white text in 700 13px, padding 6 10, radius 8, no border or shadow. Shows after 400ms of hover, immediately on keyboard focus. Esc dismisses. Placement: right of the rail, otherwise above. Offset 8px. `role="tooltip"`.

### TitleBar
- **Used on:** every screen.
- **Anatomy:** app mark · wordmark · drag area · Minimise · Maximise/Restore · Close.
- **Sizes:** height `--titlebar-h` 40 (border-box, including the 2px ink bottom border), white, padding-left 14, gap 10. App mark: 22×22, 2px ink, radius 6, orange, `pencil` 12px at stroke 2.8. Wordmark: `--type-wordmark`. Window buttons: 46 wide × the full inner height (38), transparent, icons 14 (`minus`, `square` 13 / `copy` 13 when maximised, `x`) at stroke 2.2.
- **Variants:** default; floating (over the splash: transparent, no border, brand hidden, as the code does now).
- **States:** hover = Minimise and Maximise get `--surface-hover`; Close gets `--win-close` with a white icon. Pressed = `--surface-pressed` / `--win-close-pressed`. focus-visible = inset ring (`--focus-ring-inset-offset`, −5px). Window inactive = wordmark and icons turn `--text-muted`. Disabled and loading n/a.
- **A11y:** labels "Minimise", "Maximise" / "Restore", "Close". Everything except the buttons is `-webkit-app-region: drag`. No other content in v1. The caption buttons are 46×38, an OS-convention exception to the 44px rule.

### Sidebar (expanded / rail)
- **Used on:** expanded on Home, Create a style, Plugins and Settings. Rail on New lesson, the Lesson editor and the Plugin sheet.
- **Anatomy:** `<nav aria-label="Main">`: Home (`house`), Styles (`palette`), Plugins (`blocks`), spacer, Settings (`sliders-horizontal`), profile.
- **Expanded:** width 224, padding 16 12, gap 6, white, 2px ink right border.
  - Nav item: height 44, padding 0 12, gap 12, radius 12, 2px transparent border, 600 15px, icon 20 at stroke 2.
  - Profile row: padding 10 12, gap 10, 2px `--divider` top border; Avatar 36; name 700 15; status 400 12 `--text-muted` ("Claude connected" / "Claude isn't connected").
- **Rail:** width 72, padding 14 0, gap 8, items centred, nav items 44×44 icon-only, Avatar 36 (mock 38). Every item has an `aria-label` and a Tooltip on the right.
- **States:** inactive item = *ghost* recipe. Current item = orange fill, 2px ink border, `--shadow-xs`, 700, `aria-current="page"`; pressing it sinks it (translate 2px, shadow 0). focus-visible = ring. Disabled and loading n/a.
- **Rail rule:** in focus mode the parent section stays highlighted (Home, since lessons live there) with `aria-current="true"`, not `"page"`.

### PageHeader
- **Used on:** all screens except Welcome.
- **Variants:**

| Variant | Screen | Spec |
|---|---|---|
| `greeting` | Home | No bar. Row with wrap, gap 14. Title block `flex: 1 1 320px`, gap 6: h1 `--type-page-title` −0.02em, subtitle `--type-subtitle` `--text-muted`. Right: search TextField (`flex: 0 1 360px`, min-width 200), then primary Button md "New lesson" (`plus` 18) |
| `bar` | Create a style, Plugins, Settings | White, 2px ink bottom border, padding 14 24, gap 14, wrap. Back Button (secondary pill md, `chevron-left` 16, label = destination, e.g. "Home"), h1 `--type-section-sm`, spacer, optional StatusPill lg, primary Button md (radius 12) |
| `editor` | New lesson, Lesson editor | Transparent on ground, padding 14 20, gap 14, wrap. Back pill "My lessons". Centre: lesson title (`flex: 1`, min-width 200, centred, `--type-lesson-title`), or the `title` TextField while untitled. Right: style SelectChip md (teal-soft, SwatchDot), secondary Button md "Present" (`play` 16, radius 12), primary Button md "Export to PowerPoint" (`arrow-down-to-line` 16, radius 12). Present and Export are disabled until the deck has slides |
| `steps` | Connect Claude | Padding 14 24, ProgressPills right-aligned |

- **Sizes:** the `bar` and `editor` rows are 72 tall (14 + 44 + 14); `bar` adds its 2px border.
- **States:** the header itself is static. Its children follow their own recipes.

### Button
- **Used on:** every screen.
- **Variants:**

| Variant | Fill | Border | Text | Rest shadow | Recipe | Use |
|---|---|---|---|---|---|---|
| `primary` | orange | 2px ink | ink | `--shadow-sm` | raised | The main action in a region, at most one: New lesson, Save style, Export to PowerPoint, Next…, Make my slides, Make quiz |
| `dark` | ink | 2px ink | white | none | ink-fill | The commit inside an orange card or right beside a field (Create lesson, Tell me), and Send in the Composer |
| `secondary` | white | 2px ink | ink | none | flat | Everything else: Present, Test connection, Show, Upload LO document, Cancel, back pills, empty-state suggestions |
| `ghost` | transparent | 2px transparent | ink | none | ghost | Low emphasis in dense rows |

- **Sizes:**

| Size | Height | Padding-inline | Gap | Icon | Label | Rect radius | Used for |
|---|---|---|---|---|---|---|---|
| `sm` | 32 (hit area 44) | 12 | 6 | 14 | 700 13px | pill only | ResultChip actions ("Undo") |
| `md` | 44 | 16 (18 for primary with an icon) | 8 | 16 (18 for `plus` and `arrow-right`) | `--type-button` | 12 | Most buttons |
| `lg` | 48 | 20 (22 for dark with an icon) | 8–10 | 18 | primary 800 16px, others 700 16px | 14 (12 when beside a 48 field) | Create lesson, Make quiz, Tell me |
| `xl` | 52 | 24 | 10 | 18 | `--type-button-lg` | 14 | Onboarding CTAs, the "Show" toggle beside a 52 field |

- **Shape:** rectangles for page, header and form actions. Pills (999) for actions in the ChatPanel and Composer, the PluginSheet footer, back navigation, empty-state suggestions, and secondary actions inside the Home accent card.
- **Icons:** arrows for going forward sit trailing (Next…, Create lesson, Make my slides, Send, Make quiz, all `arrow-right`). Action icons sit leading (`plus`, `paperclip`, `play`, `arrow-down-to-line`, `check`, `refresh-cw`).
- **States:** hover and pressed = the variant's recipe. focus-visible = ring. Disabled = *disabled* (header Present/Export in New lesson). Loading = spinner plus progress label.
- **On orange surfaces:** no primary buttons (orange on orange). Use dark for the commit and secondary for the rest, as the mock does.
- **Text link** (not a Button): ink, 700, underline at a 2px offset; hover colour `--text-muted`. For example "Skip for now", "Manage", "browse files", "platform.claude.com ↗" (`arrow-up-right` 14).

### IconButton (round / square)
- **Used on:** Composer (plus, attach), PluginSheet (back), file rows (remove), TitleBar (its own spec).
- **Variants:**

| Variant | Size | Shape | Look | Icon |
|---|---|---|---|---|
| `round` | 44 | circle | 2px ink, white | 20: `plus` at stroke 2.4, `paperclip` at 2. Back `chevron-left` 18 at 2.4 |
| `square` | 44 | radius 12 | 2px ink, white | 20–22 |
| `ghost` | 36 visual, 44 hit | radius 10 | no border, transparent, icon `--text-muted` | `x` 16 at 2.2 |

- **States:** round and square use *flat*; ghost uses *ghost* (and its icon turns ink on hover). Expanded or toggled (`aria-expanded="true"` / `aria-pressed="true"`) = orange fill, e.g. the "+" while PluginMenu is open. focus-visible = ring. Disabled = recipe. Loading n/a.
- **A11y:** always an `aria-label`, plus a Tooltip with the label and any shortcut.

### ToggleChip
- **Used on:** Home (Past lessons filter: All, Year 7, Year 8, Year 9, Form time).
- **Anatomy and sizes:** `<button aria-pressed>` 40 high (hit area 44 via `::before { inset: -2px }`), padding 0 16, radius pill, 2px ink, white, 600 15px. Group: `role="group"` with an `aria-label` ("Filter by year group"), gap 8, wrapping.
- **Variants:** off; on (`aria-pressed="true"`) = ink fill, white text, 700.
- **States:** off uses *flat*; on uses *ink-fill*. focus-visible = ring. Disabled = recipe. Loading n/a.
- **Behaviour:** single-select filter. "All" clears the others.

### SelectChip
- **Used on:** Home accent card (style, lesson length), editor PageHeader (style), New lesson chat (Year 8, 50 min, Mixed ability, About 8 slides).
- **Anatomy:** [optional leading SwatchDot or icon] label [`chevron-down`]. Opens a listbox popover.
- **Sizes:** md = 44 high, padding 0 14 (0 16 in the header), gap 8, 600 15px, chevron 16 at stroke 2.2. sm = 40 high (hit area 44), padding 0 12, gap 6, 700 14px, chevron 14 at stroke 2.4. Radius pill, 2px ink. Label max-width 240, then ellipsis (full value in the Tooltip).
- **Variants:** white (default); category fill when the value has one (Year 8 → `--year-8`; style → `--tone-style` with a SwatchDot in the profile's primary colour); leading icon (`timer` 16 for length). The header style chip has no chevron in the mock. Add it for consistency.
- **Popover:** white, 2px ink, radius 16, `--shadow-md`, padding 6, min-width = chip width, 8px below (flips above when there's no room). Options: 40 high (hit 44), padding 0 12, radius 10, 600 15px. Hover `--surface-hover`. Selected = butter fill plus a trailing `check` 16 at 2.4. Pop animation (§9).
- **States:** *flat*. Expanded = `--shadow-xs` stays on and the chevron rotates 180°. focus-visible = ring. Disabled = recipe. Loading n/a.
- **A11y:** `aria-haspopup="listbox"` and `aria-expanded`. The name includes the setting: "Style: Science KS3. Change style". Keyboard: listbox pattern (Up/Down, Home/End, Enter to select, Esc to close, type-ahead).

### TextField
- **Used on:** Welcome (name, subject), Connect Claude (API key), Home (search), Create a style (style name, correction), New lesson (title).
- **Anatomy:** label above (gap 6), field, help or error text below (gap 6).
- **Sizes:**

| Size | Height | Radius | Text | Where |
|---|---|---|---|---|
| `xl` | 52 | 14 | 16 | Onboarding |
| `lg` | 48 | 12 | 16 (15 in CorrectionBox) | Forms inside cards |
| `md` | 44 | pill | 15 | Search |

  Padding-inline 14. Value weight 600 for short identity values (your name, style name), 400 for free text. Placeholder 400 `--text-placeholder`. Label `--type-label` (14/700), or `--type-label-strong` (15/800) for a prominent single field. Help text 13px `--text-muted`, linked with `aria-describedby`.
- **Variants:**
  - `default`: 2px ink, white.
  - `search`: pill 44, fill `--surface-sunken` (it reads as transparent on ground), leading `search` 18, gap 8, visually hidden label "Search lessons and styles".
  - `password`: masked value with letter-spacing `--ls-masked`. Trailing secondary Button xl "Show" / "Hide" outside the field (gap 8, `aria-pressed`).
  - `title`: "Untitled lesson". 320 wide (max 100%), 40 high, transparent, 2px dashed `--text-placeholder` (contrast fix; mock `#B9B1D9`), radius 10, centred `--type-lesson-title`, trailing `pencil` 16. Hover = dashed ink. Focus = solid ink plus `--focus-field`.
- **States:** default and hover = *field*. Focus = `box-shadow: var(--focus-field)` (yellow halo plus ink rim). Pressed n/a. Disabled = *field* disabled. Error = `--field-error` at rest and `--focus-field-error` on focus, `aria-invalid="true"`, and a message in 700 13px `--danger-text` with `circle-alert` 16. Loading (async validation) = trailing `loader-circle` 16.

### TextArea
- **Used on:** Home accent card (learning objectives). The Composer textarea is specced under Composer.
- **Sizes:** min 4 rows, padding 14 16, radius 16, 2px ink, white, 15px at line-height 1.5, `resize: vertical`. Visually hidden label "Learning objectives". A multi-line example placeholder is allowed.
- **States:** same as TextField: field, `--focus-field`, error, disabled. Loading n/a.

### Select
- **Used on:** Connect Claude (Model), Home (Sort).
- **Anatomy:** a native `<select>` with `appearance: none` and a `chevron-down` 16 icon 12 from the right. Padding 0 40 0 12, 2px ink, white, 600 15px.
- **Sizes:** lg = 48 (radius matches the form's fields: 14 on Connect); sm = 40 (radius 12, hit area 44).
- **Label:** above (`--type-label-strong`), or inline-left ("Sort", 600 14px `--text-muted`, gap 12).
- **States:** hover = `--shadow-xs`. Focus = `--focus-field`. Pressed n/a. Disabled = *field* disabled. Loading n/a. The option list uses the OS popup in v1.

### Checkbox
- **Used on:** Create a style ("Make this my default style"), PluginSheet (Question types).
- **Anatomy:** v1 uses a native `<input type="checkbox">` at 22×22 with `accent-color: var(--ink)` and margin 0 (checked = ink fill and white tick), inside a `<label>`. A custom drawing is allowed if it matches: 22px, 2px ink border, radius 6, white; checked = ink fill with a white `check` 16 at stroke 3; indeterminate = ink fill with a white `minus`.
- **Sizes:** row min-height 44 (mock 40), gap 12, 15px 400. The "default style" variant: 48 high (to align with the field beside it), gap 10, 600. Group: `<fieldset>`, `<legend>` in `--type-label-strong` with margin-bottom 8, rows gap 6.
- **States:** hover = box border ink and a `--surface-hover` fill (custom only). focus-visible = ring around the box. Pressed n/a. Disabled = border `--line-muted`, label `--text-placeholder`. Loading n/a.

### RadioPill
- **Used on:** PluginSheet ("Which slides?", "Difficulty").
- **Anatomy:** `<label>` pill containing a native radio (`accent-color: ink`, margin 0) followed by the text.
- **Sizes:** 40 high (hit area 44), padding 0 14, gap 8, radius pill, 2px ink, white, 600 14px. Group: fieldset and legend, wrapping, gap 8.
- **States:** unchecked = *flat*. Checked = orange fill, 700, with the radio dot visible. Checked hover = `--shadow-xs`. Pressed = sink. focus-visible = ring on the pill (`label:has(:focus-visible)`). Disabled = recipe. Loading n/a.
- **Keyboard:** native radio-group arrow keys.

### RadioCard
- **Used on:** PluginSheet ("Where should it go?").
- **Anatomy:** `<label>` card: native radio 20×20 (margin-top 2), then a column (gap 2) with the title in 700 15px and an optional description in 13px.
- **Sizes:** padding 12 14, gap 12, top-aligned, radius 14, 2px ink. Stack gap 8.
- **States:** unchecked = white, description `--text-muted`, recipe *flat*. Checked = butter fill, `--shadow-sm`, description `--text-muted-2`. Pressed = sink. focus-visible = ring via `:has(:focus-visible)`. Disabled = recipe. Loading n/a.

### NumberStepper
- **Used on:** PluginSheet ("How many questions?").
- **Anatomy:** label (`flex: 1`, `--type-label-strong`) · group [minus button | number input | plus button].
- **Sizes:** group 2px ink, radius 12, overflow hidden, 48 high in total. Buttons 44×44, white, separated from the input by 2px ink borders, icons `minus` / `plus` 18 at stroke 2.4 (the mock uses "−" and "+" text glyphs; use icons). Input 56×44, centred, 800 17px, native spin buttons hidden. Default 10, min 3, max 30 for the Quiz plugin.
- **States:** buttons hover `--surface-hover`, pressed `--surface-pressed`, disabled at min or max (icon `--line-muted`, `cursor: not-allowed`). Input focus = `--focus-field` on the group (`:focus-within`). Button focus-visible = inset ring (−5px). Loading n/a.
- **A11y and keyboard:** a native number input (`role` spinbutton). Button labels name the quantity: "Fewer questions", "More questions". Up/Down ±1, PageUp/PageDown ±5, Home/End = min/max.

### StatusPill
- **Used on:** Connect Claude (Connected), Create a style (file status, header progress, slide-type tags), Home (Default badge, year chips), Lesson editor (via ResultChip).
- **Static**: no hover, press or focus. Use `role="status"` only when the value changes live ("Connected").
- **Sizes:**

| Size | Spec | Example |
|---|---|---|
| `sm` | padding 3 10, 2px ink, radius pill, 700 12px | File status "Learned" |
| `xs` (year chip) | padding 2 8, 700 12px | "Year 8" on LessonCard |
| `md` | padding 4 12, 700 13px. With an icon: padding 6 12, gap 8, 700 14px, icon 16 | Tags; "Connected" (`check` at stroke 3) |
| `lg` | height 40, padding 0 14, gap 8, 700 14px | Header "Learning · 6 of 8 files" with ProgressDots (7px) |

- **Tones:** done = mint ("Learned", "Connected"); working = butter-2 with ProgressDots ("Reading…", "Learning…"); waiting = purple-soft ("Waiting"); error = peach with `circle-alert` ("Couldn't read this file", proposed); neutral = white; inverse = ink fill, white text, no border, padding 3 10 ("Default"); tag = category pastel.
- **States:** loading = the working tone. Disabled n/a.
- **Rule:** always a word, never just a colour.

### FileTypeBadge
- **Used on:** Create a style (file rows).
- **Sizes:** 48×40 rendered (mock 44×36 plus border), 2px ink, radius 8, `--type-badge` (11/800, +0.04em, uppercase), centred.
- **Variants:** PDF = peach; PPTX = sky; DOCX = mint (proposed); other files = white with "FILE".
- **States:** static.

### ProgressBar
- **Used on:** Create a style ("6 of 8 learned").
- **Anatomy:** a label row (space-between, gap 6 below it): label 700 14px left, estimate 600 14px `--text-muted` right ("About a minute left"). Then the track.
- **Sizes:** track 18 high in total (14 inner plus 2px ink border), radius pill, white, overflow hidden. Fill: orange with a 2px ink right border (dropped at 0% and 100%), width transitions over `--dur-slower` with `--ease`.
- **States:** static. Indeterminate: use ProgressDots and text instead.
- **A11y:** `role="progressbar"`, `aria-valuemin="0"`, `aria-valuemax` = the total, `aria-valuenow`, `aria-valuetext="6 of 8 files learned"`.

### ProgressPills
- **Used on:** Connect Claude (and the onboarding steps after it).
- **Anatomy:** an `<ol aria-label="Setup progress: step 2 of 3">`: pills joined by 24×2 connectors, gap 8.
- **Sizes:** pill padding 4 12, radius pill, 2px border, 700 14px. Done pills add a `check` 14 at stroke 3 with gap 6.
- **Variants:** done = mint, ink border; current = orange, ink border, `aria-current="step"`; upcoming = transparent, `--line-muted` border, `--text-muted` text. Connector = ink after a done pill, `--line-muted` before an upcoming one.
- **States:** done pills are buttons that go back to that step (*flat* recipe, ring on focus). Current and upcoming are static. Disabled and loading n/a.

### SetupSteps
- **Used on:** Welcome (card checklist and hero list), Connect Claude (how-to cards).
- **Variants:**

| Variant | Spec |
|---|---|
| `checklist` (Welcome card) | `<ol aria-label="Setup steps">`, gap 8. Row: padding 10 12, gap 10, radius 14, 15px. Current: 2px ink, butter, 700, NumberDisc 30 orange, `aria-current="step"`. Upcoming: 2px `--divider`, 600, `--text-muted`, NumberDisc 30 transparent with a `--line-muted` ring. Done (proposed): 2px ink, white, 600 ink, mint NumberDisc with `check` 14. Suffix "(optional)" in 500 |
| `hero` (Welcome left panel) | `<ol>`, gap 12. Item 600 16px, gap 12. NumberDisc 36 white |
| `cards` (Connect how-to) | Grid `repeat(auto-fit, minmax(180px, 1fr))`, gap 12. Each item is an inner Card (padding 14, gap 8, radius 16, 2px ink, no shadow) with a NumberDisc 32 in peach / sky / mint, a 700 15px title, and a 14px `--text-muted` detail or a Text link |

- **States:** static.

### Card (shadow sm / md / lg)
- **Used on:** every screen.
- **Base:** white, 2px ink.
- **Variants:**

| Variant | Radius | Padding | Shadow | Gap | Use |
|---|---|---|---|---|---|
| `page` (lg) | 24 | 32 (onboarding), 28 (Home accent), 24 (Your styles), 22 (Create a style) | `--shadow-lg` | 18–20 / 16 / 12 / 14 | Welcome, Connect, Home, Create a style |
| `panel` (lg) | 22 | 0 (band plus body) | `--shadow-lg` | — | ChatPanel, PluginSheet |
| `raised` (md) | 18 | per component | `--shadow-md` | — | LessonCard, ToolRail |
| `selected` (sm) | 14 | 12 14 | `--shadow-sm` | — | Checked RadioCard |
| `inner` (none) | 16 | 16 (14 for how-to cards) | none | 10–12 | Cards inside cards: Colours, Fonts, Layout habits… |

- **Tones:** white (default); `accent` = orange (Home "Make a new lesson", one per screen, ink text only, dark and secondary buttons inside); `sunken` = ground (TestSlidePreview); `tone-style` = teal-soft (default StyleCard).
- **Optional icon tile** left of the title: 52 (48 plus border), radius 14, white, 2px ink, icon 24 (e.g. `monitor` on the accent card). The Connect variant is 60, radius 16, yellow, `key` 26.
- **States:** static. When the whole card is a link (LessonCard, StyleCard) it uses that component's recipe.

### CardHeaderBand (yellow / peach)
- **Used on:** ChatPanel and Create a style (yellow), PluginSheet (the plugin's tone, peach for Quiz).
- **Anatomy:** leading element · title and subtitle · trailing element. 2px ink bottom border. Top corners use the parent radius − 2 (20 in a panel, 22 in a page card).
- **Sizes:**

| Where | Padding | Leading | Title | Subtitle / trailing |
|---|---|---|---|---|
| ChatPanel | 16 18, gap 12 | Avatar-style disc 44 (40 plus border), white, `pencil` 20 at 2.2 | `--type-panel-title` "Your planning buddy" | 13px `--text-muted-2` "Knows your Science style" |
| Create a style | 16 22, gap 12, wrap | — | `--type-section-sm` "What I've learned so far" | trailing 14px `--text-muted-2` "Updates as each file is read" |
| PluginSheet | 14 16, gap 12 | round IconButton back | `--type-panel-title` (plugin name) | 13px `--text-muted-2` (plugin description); trailing icon tile 44, radius 12, white, 2px ink, plugin icon 22 (decorative) |

- **Variants:** `yellow` = the planning buddy and what it has learned. `tone` = a plugin's options.
- **States:** static (the back button has its own states).

### Callout (info = lilac, tip = butter)
- **Used on:** Connect Claude (info), Create a style (info, soft), Lesson editor (tip).
- **Variants:**

| Variant | Spec | Example |
|---|---|---|
| `info` bordered | lilac, 2px ink, radius 16, padding 14 16, gap 6. Title `--type-label-strong`, body 14px at line-height 1.5 | "Can I use my Claude Pro or Max subscription?" |
| `info` soft | lilac, no border, radius 14, padding 12 14, 14px at 1.5, with a bold lead-in | "**Tip:** 10 or more decks gives the closest match…" |
| `tip` | butter, 2px **dashed** ink, radius pill, padding 8 14, gap 10, 600 14px, leading icon 18 | `lasso` "Circle it, then say what you want — …" |

- **Meaning:** info = something to read and know (facts, advice, explanations). Tip = a hint about the tool in front of her. Don't put a butter tip right next to a butter Dropzone.
- **States:** static, `role="note"`. Dismissible tip (proposed): trailing ghost IconButton `x` 16 (hit 44). Hide the circle hint for good once she has circled twice.
- **Never use a Callout for errors.**
- Implementation note (2026-10-06): screens 01, 03, 04 and 07 specify error, warning and action Callouts, so `Callout` (`@ui/atoms`) has `info`, `soft`, `tip`, `action`, `warning` and `error` variants. Error is peach with `role="alert"`; the rule above still holds for inline field errors.

### Dropzone (large / compact)
- **Used on:** Home (large), Create a style (compact), New lesson chat (`chat`).
- **Base:** a `<button>` (click or Enter/Space opens the file picker) that also accepts drag and drop. 2px dashed ink, radius 16, butter.
- **Variants:**

| Variant | Layout | Icon | Text |
|---|---|---|---|
| `large` | Column, centred, gap 8, padding 18, min-height 150, fills its column | Disc 52 (48 plus border), orange, `arrow-up-from-line` 22 at 2.2 | Title 800 17px "Create a new style". Body 14px `--text-muted-2` with an inline "browse files" (700, underlined). Meta 12px `--text-muted` ".pdf and .pptx · up to 50 files" |
| `compact` | Row, left-aligned, gap 12, padding 14 | Disc 44, orange, icon 18 | Title 700 15px "Add more PDFs or PowerPoints". Sub 13px `--text-muted-2` "Drop files here, or browse" |
| `chat` | Column, centred, gap 6, padding 22 16 | `file-up` 26 at 2 (no disc) | Title 800 15px "Drop your learning objectives". Sub 13px `--text-muted-2` "Word, PDF or PowerPoint · or click to browse" |

- **States:** hover = `--shadow-xs`. Pressed = sink. focus-visible = ring. Drag-over (valid) = border turns solid ink, fill yellow, `--shadow-md`, title "Drop to add 3 files" (announced with `aria-live="polite"`). Drag-over (not accepted) = peach fill, title "Only .pdf and .pptx files". Disabled (limit reached) = dashed `--line-muted`, ground fill, `--text-placeholder`, not-allowed. Loading = the disc icon becomes `loader-circle` and the title reads "Adding 3 files…".

### EmptyState
- **Used on:** New lesson (stage). Proposed for empty lists too.
- **Stage variant:** 16:9, max-width 900, 2px **dashed** ink, radius 14, white, padding 24, column centred, gap 14. Icon tile 76 (72 plus border), radius 20, yellow, 2px ink, `--shadow-md`, `monitor` 34 at 2. Title `--type-section-lg` "Your slides will appear here". Body 16px at 1.5, `--text-muted-2`, max-width 440. Actions: secondary pill md buttons, gap 10, margin-top 6 ("Start from a past lesson", "Blank slide").
- **List variant (proposed):** inside a dashed inner Card. Tile 56, title `--type-section-sm`, body 15px.
- **States:** static. Its buttons have their own recipes.
- **Copy:** say what will appear here, plus one way to start.

### SwatchStack
- **Used on:** Home (StyleCard).
- **Sizes:** circles 26 (22 plus border), 2px ink, overlapping by −6px (container padding-left 6). At most 4; beyond that add "+N" in 700 12px.
- **Fill:** profile colours, most important first.
- **States:** static, `aria-hidden` (the meta text describes the style).

### StyleCard
- **Used on:** Home ("Your styles"), the Styles list.
- **Anatomy:** SwatchStack · text column (`flex: 1`, min-width 0): name 700 16px, meta 13px ("Lexend · learned from 24 decks") · trailing StatusPill.
- **Sizes:** padding 12 14, gap 12, radius 16, 2px ink. List gap 12.
- **Variants:** default style = teal-soft, meta `--text-muted-2`, trailing inverse pill "Default". Other styles = white, meta `--text-muted`.
- **States:** *flat* (the whole card links to the style). focus-visible = ring. Disabled n/a. Loading = trailing working pill "Learning…" in place of "Default".

### LessonCard
- **Used on:** Home (Past lessons grid).
- **Anatomy:** a link card. Thumbnail area (16:9, 2px ink bottom border, the card's SlideThumb of slide 1) on top. Body below: padding 12 14 14, gap 6, title 700 16px, then a meta row (gap 8, 13px `--text-muted`): year chip (StatusPill xs in the year colour), "8 slides", spacer, "Today".
- **Sizes:** radius 18, 2px ink, white, `--shadow-md`, overflow hidden. Grid min width 260.
- **States:** *raised-card*. focus-visible = ring (it follows the radius). Disabled n/a. Loading (still generating) = skeleton thumbnail and a working StatusPill "Building…".

### SlideThumb
- **Used on:** Filmstrip (editor, New lesson), LessonCard.
- **Anatomy (filmstrip):** a `<button>` (`flex: 0 0 132px`, column, gap 6, no padding, transparent) containing the preview and a number badge.
  - Preview: 16:9, white, 2px ink, radius 10, overflow hidden. It renders the real slide scaled down with the profile's fonts, never app fonts.
  - Number badge: min-width 24, height 24 (20 plus border), padding 0 4, radius 6, 2px ink, 700 12px, white.
- **Variants:** `filmstrip`; `card` (fills LessonCard, no own border or radius); `placeholder` (`--border-placeholder`, radius 10, no badge); `generating` (placeholder plus a pulse).
- **States:** active = preview gets `--shadow-accent`, badge goes orange, `aria-current="true"`. Hover = preview gets `--shadow-xs`. Pressed = sink. focus-visible = ring around the whole button. Disabled n/a. Loading = `generating`.
- **A11y:** `aria-label="Slide 3: What do plants need?"`.

### Filmstrip
- **Used on:** New lesson, Lesson editor, Plugin sheet.
- **Anatomy:** `<nav aria-label="Slides">` containing SlideThumbs and an "Add slide" button.
- **Sizes:** row, gap 12, `overflow-x: auto`, width 100%, max-width = stage width. Padding 6 8 12 6 (mock 4 6 10 2, enlarged so focus rings and shadows aren't clipped).
- **"Add slide" button:** 76 wide × the preview height, 2px dashed ink, radius 10, transparent, `plus` 22 at 2.2, `aria-label="Add slide"`. Hover = white fill plus `--shadow-xs`. Pressed = sink. focus-visible = ring.
- **Keyboard:** roving tabindex. Left/Right move, Home/End jump, Enter/Space opens the slide, and the active thumb scrolls into view.
- **States:** empty = four placeholders. Generating = see §9.

### SlideStage
- **Used on:** Lesson editor, Plugin sheet. (New lesson shows EmptyState in its place.)
- **Sizes:** 16:9, width per §6.4 (max 900), white, 2px ink, radius 14, `--shadow-lg`, overflow hidden, `container-type: inline-size` (slide content scales in `cqw`).
- **Layers:** the slide renderer (teacher's style only, in an isolated scope such as a shadow root, with no app tokens or fonts), then an annotation layer above it (RegionOverlay, RegionLabel, sticky notes, selection handles).
- **States:** the cursor follows the tool (crosshair for circle and draw, I-beam for text). Loading = ground skeleton with a pulse while slides generate. Elements on the slide are focusable in Select mode and get the 3px ink ring, drawn in the annotation layer. The stage itself isn't focusable.

### ToolRail + ToolButton
- **Used on:** Lesson editor, Plugin sheet.
- **ToolRail:** `role="toolbar"`, `aria-label="Canvas tools"`, `aria-orientation="vertical"`. Padding 8, gap 6, 2px ink, radius 18, white, `--shadow-md`. Divider: 2px `--divider`, margin 4 6. It turns horizontal when narrow (§6.4).
- **ToolButton:** 48×48, radius 12, 2px transparent border, icon 22 at 2.
- **Tools, in order:** Select (`mouse-pointer-2`, V), Circle to edit (`lasso`, C), Draw (`pen-line`, D), Text (`type`, T), Sticky note (`sticky-note`, N), divider, Undo (`undo-2`, Ctrl+Z), Redo (`redo-2`, Ctrl+Y or Ctrl+Shift+Z).
- **States:** inactive = *ghost*. Active tool (`aria-pressed="true"`, only one at a time) = orange fill and a 2px ink border. Pressed = `translate(1px,1px)`. focus-visible = ring. Disabled (Undo or Redo with nothing to do) = icon `--line-muted`, not-allowed. Loading n/a.
- **Keyboard:** roving focus with arrows, Home/End. Single-key shortcuts only when focus isn't in a text field. Esc returns to Select (and cancels a drawing in progress). Tooltips sit on the right: "Circle to edit (C)".

### RegionOverlay + RegionLabel
- **Used on:** Lesson editor (annotation layer).
- **RegionOverlay:** an SVG over the whole stage. The path follows the pointer: stroke orange, 5px, `vector-effect: non-scaling-stroke`, round caps and joins, no fill. Store each region as normalised 0–1 coordinates plus the slide id. Regions are numbered 1, 2, 3 per draft message. `aria-hidden`: the RegionChip is the accessible version.
- **RegionLabel:** a pill pinned above the region's top-left corner (its bottom edge 6px above the bbox top, left at bbox left − 2% of stage width, clamped inside the stage). Padding 4 10 4 4, gap 6, 2px ink, white, Figtree 700 13px ink. Number disc 22, orange, no border, 800 13px.
- **Label text:** "Circled" while drafting. After sending, a summary of the request in 4 words or fewer ("Swap for a diagram"). While the buddy works on it, ProgressDots follow the text. When the change lands, the circle and label fade out.
- **States:** label hover = `--shadow-xs` and a remove `x` appears (hit 44). Linked highlight (when its RegionChip is hovered or focused) = the stroke animates from 5 to 7px and the label gains `--shadow-xs`. focus-visible = ring on the label's remove button. Disabled n/a. Loading = ProgressDots.

### RegionChip
- **Used on:** Composer (staged), MessageUser (sent).
- **Anatomy:** a `<button>` pill: padding 3 10 3 3, gap 6, 2px ink, white, 700 13px. Disc 20, orange, no border, 800 12px. Text "Slide 3 · circled". The staged version adds a trailing remove `x` 14 (hit 44, `aria-label="Remove region 1"`).
- **Behaviour:** click jumps to the slide and pulses the region. In a MessageUser it's `align-self: flex-start`.
- **States:** *flat*. focus-visible = ring. Disabled (its slide was deleted) = dashed `--line-muted` border, `--text-placeholder` text, "Slide 3 · removed". Loading n/a.
- **A11y name:** "Region 1 on slide 3: photo of a leaf".

### ChatPanel
- **Used on:** New lesson, Lesson editor. The PluginSheet replaces its contents in the same box.
- **Anatomy:** `<aside aria-label="Your planning buddy">` with a CardHeaderBand (yellow), the message list, and a footer holding the Composer.
- **Sizes:** `--chat-w` 400 (min 360), full body height, column, 2px ink, radius 22, white, `--shadow-lg`. Message list: padding 18, gap 16, `overflow-y: auto`, `role="log"`, `aria-live="polite"`. Footer: padding 14 18 18, `position: relative` (it anchors the PluginMenu).
- **Behaviour:** auto-scrolls to the newest message, unless she has scrolled up. In that case show a "New messages" secondary pill sm at the bottom (proposed).
- **States:** busy (generating) = Send becomes "Stop". Disabled (no API key) = the list shows an info Callout "Connect Claude to start" plus a primary Button "Connect Claude", and the Composer is disabled. Static otherwise.

### MessageUser
- **Used on:** ChatPanel.
- **Sizes:** `align-self: flex-end`, max-width 88%, column, gap 10 (8 when it only holds a chip and text), padding 12 14, 2px ink, radius 18 18 4 18, lilac, 15px at 1.5.
- **Contents:** AttachmentCard(s) and RegionChip(s) first, then the text.
- **States:** static, text selectable. Error (not sent, proposed) = a trailing error StatusPill "Not sent" and a secondary sm "Try again".

### MessageAssistant
- **Used on:** ChatPanel.
- **Sizes:** no bubble, max-width 92%, column, gap 10, 15px at 1.5 ink. Optional heading `--type-chat-title` ("What are we teaching?").
- **Contents:** paragraphs, lists and bold, followed by ResultChip and/or AttachmentCard(s).
- **States:** static. A MessageProgress shows until the first text streams in. Error = text explaining what happened, plus a secondary sm "Try again".

### MessageProgress
- **Used on:** ChatPanel.
- **Sizes:** padding 10 12, gap 10, 2px dashed ink, radius 14, white, 600 15px. ProgressDots at 8px.
- **Copy:** a present participle plus "…" ("Drawing your leaf diagram…").
- **Variants:** `simple`; `steps` (plugins): a step list underneath in 600 13px. Done steps get a `check` 14 at stroke 3, the current step gets dots, upcoming steps are `--text-muted`.
- **States:** `role="status"`. Optional trailing ghost sm "Stop" (proposed). When finished it crossfades into the MessageAssistant over `--dur-base`.

### AttachmentCard
- **Used on:** MessageUser (her upload), MessageAssistant (a file a plugin made).
- **Anatomy:** icon tile 32, radius 8, no border, filled with the file-type colour, icon 18 at 2 (`file`, or `file-text` for worksheets). Then a column: name 700 14px (ellipsis) and type 12px `--text-muted` ("Word document").
- **Sizes:** padding 8 10, gap 10, 2px ink, radius 12, white. The mock tints the `.docx` tile sky; per §2.3, DOCX becomes mint.
- **States:** static when it's her upload. When the buddy made the file it's a button that opens it, with *flat* recipe and ring on focus (proposed actions: "Open", "Save as…" as secondary sm pills). Loading = the type line reads "Uploading…" with dots. Error = error StatusPill.

### ResultChip
- **Used on:** MessageAssistant (after any change).
- **Anatomy:** a wrapping row, gap 8: an outcome pill (mint, padding 4 10, 2px ink, 700 13px, "8 slides added"), then action buttons (secondary sm pills, 32 high with a 44 hit area: "Undo", "Refine in chat").
- **States:** the actions follow Button sm secondary. After Undo, the outcome pill turns neutral white "Undone" and the action becomes "Redo". Loading = the action shows a spinner.

### Composer
- **Used on:** ChatPanel (New lesson, Lesson editor).
- **Anatomy:** a container (column, gap 8, padding 10, 2px ink, radius 18, white) holding: staged items (RegionChips and AttachmentCards, wrapping, gap 6), a textarea, and an action row.
- **Textarea:** borderless, transparent, padding 4 6, 15px at 1.5. Visually hidden label "Message your planning buddy". Placeholder "Paste learning objectives or ask for a change…". 2 rows minimum, auto-grows to 10 rows (about 240px) and then scrolls. In New lesson it opens at 7 rows.
- **Action row:** gap 8. IconButton round "+" (`aria-label="Plugins"`, `aria-haspopup="menu"`, `aria-expanded`). IconButton round paperclip ("Attach a file"). Spacer. Then the send button: Button dark pill md "Send" with `arrow-right` 18 at 2.2, or Button primary pill md "Make my slides" (800) when this message will generate a new lesson.
- **States:** focus (`:focus-within`) = `box-shadow: var(--focus-field)` (the mock's yellow halo plus the ink rim). Empty = Send disabled. Busy = Send is replaced by a secondary pill "Stop" (`square` 14). Disabled (no key) = textarea fill ground, placeholder "Connect Claude to start chatting". Hover and pressed n/a on the container.
- **Keyboard:** Enter sends, Shift+Enter adds a new line. `/` at the start opens the PluginMenu filtered by what follows. Pasting a file stages an AttachmentCard. Esc closes the menu.

### PluginMenu
- **Used on:** Lesson editor and New lesson (from the Composer "+").
- **Anatomy:** a `role="menu"` popover: a header (Bricolage `--type-menu-title` "What shall we make?" plus a Text link "Manage" at 13px, which is the last item in arrow order and has `role="menuitem"`), then a 2-column grid of PluginTiles.
- **Sizes:** absolute; left 18, right 18 (the full composer width); bottom `calc(100% - 6px)`, so it opens upward and slightly overlaps the composer area. Padding 14, gap 10, 2px ink, radius 20, white, `--shadow-lg`. Grid: `repeat(2, minmax(0, 1fr))`, gap 8. Max-height min(420px, panel height − 120px), after which the grid scrolls.
- **Scaling (proposed):** with more than 8 plugins, add a search field at the top (TextField md pill, "Find a plugin"). When plugins of more than one scope are present, group them under headings in 700 13px `--text-muted`: "Whole lesson", "This slide", "Circled area".
- **Keyboard:** "+", Enter, Space or ArrowUp opens it and focuses the first tile. Left/Right move ±1, Up/Down move ±2 (between rows), Home/End jump. Enter/Space runs the plugin. Typing a letter jumps to the next matching name. Esc closes and returns focus to "+". Tab closes and moves focus on. A click outside closes.
- **States:** open/closed (§9). Its tiles carry their own states.

### PluginTile
- **Used on:** PluginMenu.
- **Anatomy:** `role="menuitem"`. A column (start-aligned, gap 6): icon 22 at 2 in ink, then the name in 700 15px. In list mode or the Tooltip, an optional one-line description (13px `--text-muted-2`, 45 characters or fewer).
- **Sizes:** min-height 76, padding 12, radius 14, 2px ink, plugin tone fill.
- **Mockup tones:** Quiz = peach `list-checks`; Differentiate = sky `users`; Worksheet = mint `file-text`; Speaker notes = butter-2 `notebook-text`; Starter & plenary = purple-soft `timer`. "More plugins" = white, **dashed** border, `plus`, opens the Plugins manager.
- **States:** *flat*. focus-visible = ring (roving focus). Disabled (a region plugin with nothing circled) = dashed `--line-muted` border, white fill, `--text-placeholder`, `aria-disabled="true"`, Tooltip "Circle something first". Loading n/a (progress shows in the chat).

### PluginSheet
- **Used on:** Lesson editor (the Quiz plugin in the mock). It's the only place a plugin gets UI (`plugin-architecture.md`).
- **Anatomy:** it takes over the ChatPanel box (same size, border, radius 22, `--shadow-lg`): a CardHeaderBand in the plugin's tone, then a `<form>`, then a footer.
  - Form: padding 18, gap 20, `overflow-y: auto`. Fieldsets with legends in `--type-label-strong` (margin-bottom 8), built only from standard controls: RadioPill, NumberStepper, Checkbox, RadioCard, TextField, Select.
  - Footer: padding 14 18 18, 2px `--divider` top border, gap 10. Secondary pill md "Cancel", spacer, primary pill lg named after the plugin's verb ("Make quiz", 800 16px, padding 0 20, `--shadow-sm`, `arrow-right` 18).
- **Behaviour:** a dialog-like panel: `role="dialog"`, `aria-modal="false"`, `aria-labelledby` the title. It doesn't trap focus, so the stage stays usable (choosing "Just slide 3" while she looks at the slide is valid). On open, focus goes to the first control. Esc or Cancel or back returns to the chat and puts focus back on the "+". Ctrl+Enter submits. On submit the sheet closes and a MessageProgress (steps) appears in the chat.
- **States:** the primary button follows its own states (loading "Making quiz…" before the sheet closes). Disabled = primary disabled until the form is valid.

### ColourRole
- **Used on:** Create a style ("Colours" card).
- **Anatomy:** a row (gap 10, centred): a swatch (36 rendered, radius 8, 2px ink, filled with the profile hex; white still shows thanks to the border), then text in 14px: the name in 700, " · ", the role in 400 ("**Teal** · titles, accents, left band").
- **States:** static in v1. Proposed: the row becomes a button that opens a colour editor (*flat*). The hex value goes in the Tooltip.

### FontSample
- **Used on:** Create a style ("Fonts" card).
- **Anatomy:** a row (gap 14): a tile (68 rendered, radius 12, 2px ink, `--surface-sunken`) showing "Aa" at 30px in the profile font and weight and the profile text colour. Then text in 14px: name in 700 ("Lexend Bold"), usage in `--text-muted` ("Titles · 40–44 pt").
- **Variants:** missing font (proposed) = the tile shows the fallback, plus an error StatusPill sm "Not installed".
- **States:** static. The font comes from the profile or the system and is never bundled with the app.

### TestSlidePreview
- **Used on:** Create a style.
- **Anatomy:** an inner Card in the `sunken` tone (ground, 2px ink, radius 16, padding 16, gap 10) with an h3 `--type-heading-ui` "Test slide in this style", then a preview: 16:9, white, 2px ink, radius 8, overflow hidden, `container-type: inline-size`, rendered by the same slide renderer as the stage.
- **States:** updates live as the profile changes (crossfade `--dur-base`). Loading = a ground pulse skeleton. Static otherwise.

### CorrectionBox
- **Used on:** Create a style.
- **Anatomy:** a 2px dashed ink box, radius 16, padding 16, gap 8. Label `--type-heading-ui` "Anything I got wrong?". Then a wrapping row (gap 10): a TextField lg (`flex: 1 1 280px`, radius 12, 15px, placeholder "e.g. I never use yellow on title slides") and a Button dark lg "Tell me" (radius 12, padding 0 20).
- **States:** "Tell me" is disabled while the field is empty, and shows "Updating…" while loading. On success the field clears, a mint StatusPill "Got it — updated" shows for 4s (`aria-live`), and the matching card updates.

---

## 8. Focus and accessibility

### 8.1 Focus ring

| Context | Spec | Why |
|---|---|---|
| Buttons, links, chips, tiles, cards, thumbs, nav | `:focus-visible { outline: 3px solid var(--ink); outline-offset: 2px }` | Ink contrasts at least 6.2:1 with every surface (orange 6.20, yellow 13.76, pastels 13.1 or more, white 17.55). The 2px gap shows the surface colour between the element's own ink border and the ring, so it reads as a double outline that no rest state looks like |
| Fields, Select, Composer, NumberStepper | `:focus` / `:focus-within { box-shadow: var(--focus-field) }`: a 4px yellow halo plus a 2px ink rim | Keeps the mock's yellow "you're typing here" halo. The ink rim supplies the 3:1 contrast the halo lacks (1.28:1) |
| Clipped containers (stepper buttons, title-bar buttons) | `outline-offset: -5px` (inset) | An outside ring would be clipped |
| On an ink fill (none in v1) | `outline-color: var(--yellow)` (13.76:1) | |

- Never set `outline: none` without one of these in its place.
- Scroll containers that hold focusable items need at least 6px of padding so rings aren't clipped (Filmstrip, ChatPanel list, PluginMenu grid).
- **Forced colours** (Windows High Contrast): shadows and fills disappear. Mark current and checked items with `outline: 3px solid Highlight` under `@media (forced-colors: active)`: the active SlideThumb, the active ToolButton, the current nav item, pressed ToggleChips.

### 8.2 Targets

- The minimum hit area is 44×44 (`--target-min`). Visual sizes below 44 extend their hit area with an invisible `::before`: ToggleChip, RadioPill, SelectChip sm and Select sm (40, `inset: -2px`); ghost IconButton (36, `inset: -4px`); Button sm in ResultChip (32, `inset: -6px -4px`); remove buttons inside chips.
- Checkbox rows: min-height 44.
- The only exception is the TitleBar caption buttons (46×38, OS convention).
- Neighbouring hit areas must not overlap. A gap of 8 or more allows the 2px extension.

### 8.3 Keyboard

| Area | Behaviour |
|---|---|
| Global | Tab order follows the visual order. F6 / Shift+F6 cycle regions: Sidebar, PageHeader, canvas (tools, stage, filmstrip), ChatPanel |
| Sidebar | Tab through items. Enter activates |
| PluginMenu | ARIA `menu`. Opens from "+" (Enter, Space, ArrowUp) or `/` in the Composer. 2-D arrow keys (±1 horizontally, ±2 vertically), Home/End, type-ahead, Enter/Space runs, Esc closes and returns focus to "+", Tab closes and moves on |
| PluginSheet | Dialog-like, non-modal (no focus trap). Focus goes to the first control. Esc = Cancel. Ctrl+Enter = primary. Focus returns to "+" |
| SelectChip popover | Listbox: Up/Down, Home/End, Enter, Esc, type-ahead |
| ToolRail | Toolbar with roving focus and arrows. Shortcuts V, C, D, T, N, Ctrl+Z, Ctrl+Y (not while typing). Esc goes back to Select |
| Filmstrip | Roving focus, Left/Right, Home/End, Enter opens |
| Circle to edit, no mouse | In Select mode, Tab moves between slide elements and C circles the focused one (the region is its bounds plus 8px), creating a RegionChip |
| Composer | Enter sends, Shift+Enter adds a new line, `/` opens plugins |
| Radio groups, stepper | Native arrow keys. Stepper adds PageUp/PageDown and Home/End |
| Dropzone | Enter/Space opens the picker |

### 8.4 Screen readers

- **Landmarks:** `nav` "Main", `main`, `aside` "Your planning buddy", `nav` "Slides", `toolbar` "Canvas tools".
- **Live regions:** the chat log (`role="log"`, polite); MessageProgress (`role="status"`); "Connected"; Dropzone drag messages; CorrectionBox confirmation.
- **`aria-current`:** `page` for the current nav item, `true` for the parent section in the rail and for the active SlideThumb, `step` in ProgressPills and SetupSteps.
- **Names:** every icon-only button has an `aria-label`. Decorative icons are `aria-hidden` (lucide's default). Swatches and dots are `aria-hidden`, and the adjacent text says the same thing.

### 8.5 Reduced motion and zoom

- `@media (prefers-reduced-motion: reduce)`: no translate or scale animations beyond the 2px press (the tokens file zeroes `--lift`, `--lift-card`, `--stagger` and the longer `--dur-*` values, and swaps `--ease-spring` for `--ease`). Opacity fades of 120ms or less are allowed. ProgressDots stop (all three shown, still). Generated slides appear without staggering. The circle closes instantly.
- Support Ctrl+= / Ctrl+− zoom from 80% to 150%. The §6.4 breakpoints cover the narrower CSS viewport.

---

## 9. Motion

| Token | Value | Use |
|---|---|---|
| `--ease` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Default for enters, moves, resizes (kept from the framework) |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Exits |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Small overshoot: menu pop, thumbnail reveal, circle snap, label pop |
| `--dur-press` | 80ms | Press in |
| `--dur-fast` | 120ms | Hover, press out, colour changes, exits |
| `--dur-base` | 180ms | Menus, popovers, crossfades |
| `--dur-slow` | 260ms | Sheet slide-in, each thumbnail reveal |
| `--dur-slower` | 400ms | ProgressBar fill |
| `--dur-loop` | 1200ms | ProgressDots cycle |
| `--stagger` | 90ms | Between items in a reveal |

| Moment | Spec |
|---|---|
| **Button press** | `:active` translates `--press` (2px) and shrinks the shadow by 2px in `--dur-press`. Releasing returns in `--dur-fast` with `--ease`. Hover lifts `--lift` (−1px) and grows the shadow 1px. Cards lift `--lift-card` (−2px) |
| **Menu pop** (PluginMenu, SelectChip popover) | `transform-origin` is the centre of the trigger, computed from the trigger's bounding rect when the menu opens. For the PluginMenu that's the "+" button: in the mock layout, about 34px from the menu's left edge and about 100px below its bottom edge (≈ `34px calc(100% + 100px)`). Open: opacity 0 → 1, `scale(0.92) translateY(6px)` → `none`, over `--dur-base` with `--ease-spring`. Close: to opacity 0 and `scale(0.96)` over `--dur-fast` with `--ease-in`. The "+" turns orange immediately and its icon rotates 45° (so it reads as "×") over `--dur-base` |
| **Sheet slide-in** (PluginSheet) | Chat contents fade out over `--dur-fast`. The sheet enters from `translateX(24px)` at opacity 0 over `--dur-slow` with `--ease`. The band colour arrives with the sheet, no colour tween. Back: the sheet exits to `translateX(24px)` at opacity 0 over `--dur-base` with `--ease-in`, then the chat fades in over `--dur-fast` |
| **Slide generation reveal** | As soon as generation starts, the Filmstrip shows N placeholder slots (dashed `--line-muted`, opacity pulsing 0.5 ↔ 1 over 1.2s). As each slide arrives (streamed, or every `--stagger` when a batch arrives at once), its placeholder becomes a SlideThumb: opacity 0 → 1, `scale(0.96) translateY(4px)` → `none`, over `--dur-slow` with `--ease-spring`. The stage crossfades to slide 1 when it's ready (`--dur-base`). The ResultChip appears after the last thumbnail |
| **Circle drawing** | While the pointer is down, the stroke follows it with no lag (render raw points and apply light Chaikin smoothing per frame). On release the path "snaps" closed: the gap between the end and the start shrinks to nothing over 160ms with `--ease-spring`, closing even if she stopped short (it's always forgiving). Then the RegionLabel pops in: `scale(0.8)` → 1 and opacity 0 → 1 over `--dur-base` with `--ease-spring`. A shape smaller than 24px in both dimensions is discarded (a click, not a circle). Esc mid-draw cancels with a fade over `--dur-fast` |
| **ProgressDots** | Each dot cycles through orange → tint-1 → tint-2 → orange over `--dur-loop` (steps, not tweens), offset 0 / 150 / 300ms, so the colour travels along the row |
| **ProgressBar** | Width moves over `--dur-slower` with `--ease` |
| **Toggles and chips** | Fill and colour change over `--dur-fast`, no movement |
| **Reduced motion** | See §8.5 |

---

## 10. Iconography

- **Set:** `lucide-react` stroke icons only, never emoji. Colour `currentColor` (ink). Ghost remove icons are `--text-muted`. Icons describing her style may use the profile's colour (the Layout habits checks).
- **Imports:** use the `…Icon` suffix (`TypeIcon`, `FileIcon`) so names don't clash with DOM or TypeScript.
- **Sizes:** 14 (micro checks, chevrons in sm chips), 16 (in md buttons and chips), 18 (lg buttons, search, arrows), 20 (nav, Composer IconButtons, avatar), 22 (ToolButtons, PluginTiles, Add slide). Hero tiles use 24–34.
- **Stroke:** 2 by default (`--icon-stroke`). 2.4 for arrows, chevrons, plus and minus at 14–20px (`--icon-stroke-bold`, matching the mock's heavier small glyphs). 3 for status checks in pills. 1.8 in dense 12–13px rows (`--icon-stroke-dense`).
- **Accessibility:** decorative icons stay `aria-hidden`. Icon-only buttons get an `aria-label`.

| Lucide name (React) | Where | Size / stroke |
|---|---|---|
| `pencil` (`Pencil`) | App mark; planning-buddy avatar; trailing cue on the "Untitled lesson" field | 12 / 2.8; 20 / 2.2; 16 / 2 |
| `minus` (`Minus`) | TitleBar Minimise; NumberStepper | 14 / 2.2; 18 / 2.4 |
| `square` (`Square`) | TitleBar Maximise; Composer "Stop" | 13 / 2.2; 14 / 2.4 |
| `copy` (`Copy`) | TitleBar Restore (when maximised) | 13 / 2.2 |
| `x` (`X`) | TitleBar Close; file remove; chip remove; dismiss | 14 / 2.2; 16 / 2.2; 14 / 2.4 |
| `house` (`House`) | Sidebar Home | 20 / 2 |
| `palette` (`Palette`) | Sidebar Styles | 20 / 2 |
| `blocks` (`Blocks`) | Sidebar Plugins (the mock glyph is 3 squares and a plus) | 20 / 2 |
| `sliders-horizontal` (`SlidersHorizontal`) | Sidebar Settings | 20 / 2 |
| `search` (`Search`) | Home search | 18 / 2 |
| `plus` (`Plus`) | New lesson; Composer "+"; Add slide; More plugins; stepper | 18 / 2.4; 20 / 2.4; 22 / 2.2; 22 / 2; 18 / 2.4 |
| `monitor` (`Monitor`) | Home accent-card tile; stage EmptyState | 24 / 2; 34 / 2 |
| `paperclip` (`Paperclip`) | Upload LO document; Composer attach | 18 / 2; 20 / 2 |
| `chevron-down` (`ChevronDown`) | SelectChip md / sm; Select | 16 / 2.2; 14 / 2.4; 16 / 2.2 |
| `chevron-left` (`ChevronLeft`) | Back pills; PluginSheet back | 16 / 2.2; 18 / 2.4 |
| `timer` (`Timer`) | Lesson-length chip; Starter & plenary tile | 16 / 2; 22 / 2 |
| `arrow-right` (`ArrowRight`) | Next…, Create lesson, Make my slides, Make quiz, Send | 18 / 2.4 (Send 2.2) |
| `arrow-up-from-line` (`ArrowUpFromLine`) | Dropzones (the mock's "upload" glyph) | 22 / 2.2; 18 / 2.2 |
| `file-up` (`FileUp`) | Chat Dropzone | 26 / 2 |
| `arrow-down-to-line` (`ArrowDownToLine`) | Export to PowerPoint (the mock's "download" glyph) | 16 / 2.2 |
| `lock` (`Lock`) | Welcome privacy note | 16 / 2 |
| `key` (`Key`) | Connect Claude tile (`key-round` is acceptable) | 26 / 2 |
| `arrow-up-right` (`ArrowUpRight`) | External link "platform.claude.com" | 14 / 2.2 |
| `refresh-cw` (`RefreshCw`) | Test connection | 16 / 2.2 |
| `check` (`Check`) | Connected pill; done ProgressPill; Save style; Layout habits; selected option; custom Checkbox | 16 / 3; 14 / 3; 18 / 2.4; 18 / 2.6; 16 / 2.4; 16 / 3 |
| `play` (`Play`) | Present | 16 / 2.2 |
| `mouse-pointer-2` (`MousePointer2`) | Select tool | 22 / 2 |
| `lasso` (`Lasso`) | Circle to edit tool; editor tip Callout | 22 / 2; 18 / 2 |
| `pen-line` (`PenLine`) | Draw tool | 22 / 2 |
| `type` (`TypeIcon`) | Text tool | 22 / 2 |
| `sticky-note` (`StickyNote`) | Sticky note tool | 22 / 2 |
| `undo-2` / `redo-2` (`Undo2` / `Redo2`) | Undo / Redo | 22 / 2 |
| `file` (`FileIcon`) | AttachmentCard (documents) | 18 / 2 |
| `file-text` (`FileText`) | Worksheet tile; worksheet attachments | 22 / 2; 18 / 2 |
| `list-checks` (`ListChecks`) | Quiz tile; Quiz sheet icon | 22 / 2 |
| `users` (`Users`) | Differentiate tile | 22 / 2 |
| `notebook-text` (`NotebookText`) | Speaker notes tile | 22 / 2 |
| `loader-circle` (`LoaderCircle`) | Loading state (proposed) | 16 / 2.4 |
| `circle-alert` (`CircleAlert`) | Errors (proposed) | 16 / 2 |
| `eye` / `eye-off` | Optional on the API key "Show" toggle (the mock uses text) | 18 / 2 |

The mock draws one pen glyph for the app mark, the buddy avatar and the Draw tool. This spec splits them, `pencil` for the brand and `pen-line` for the tool, so the tool doesn't look like the logo. `mail` isn't used in the mockups.

---

## 11. Dark mode

Out of scope for v1. `tokens.css` sets `color-scheme: light`, and the app doesn't follow `prefers-color-scheme`. Components must only use semantic tokens (`--surface`, `--text`, `--border`, `--bg-0`…) so that a later `[data-theme="dark"]` block can override values without touching component CSS. The slide stage always shows the teacher's own slide colours, whatever the theme.

---

## 12. Voice and copy

- **Tone:** friendly, plain and brief, like a helpful colleague. The buddy speaks in the first person ("I'll build the slides in your style", "What I've learned so far", "Anything I got wrong?"). The teacher is "you" ("Your styles", "Your planning buddy").
- **British English:** colour, favourite, minimise / maximise, organise, centre, practise (verb), licence (noun). Use "learned", as the mockups do. School terms as teachers say them: Year 8, KS3, form time, Do Now, starter, plenary, mini-whiteboards, learning objectives (and "LO" where teachers use it, e.g. "Upload LO document").
- **Sentence case everywhere:** titles, buttons, menu items, chips. Capitalise proper nouns: Claude, PowerPoint, Word, PDF.
- **Punctuation:** curly quotes and apostrophes (’ “ ”); the single ellipsis character "…" for progress and truncation; an en dash for ranges ("Slides 3–7", "40–44 pt"); a spaced em dash in sentences ("Upload your old decks — PDF or PowerPoint"). No full stops on buttons, labels, chips or titles. Full stops in sentences.
- **Numbers:** numerals, and pluralise properly ("8 slides", "1 slide", "50 min"). Relative dates ("Today", "Yesterday", "3 days ago", "Last week"), otherwise "6 October 2026".
- **Buttons:** start with a verb and say what happens: "Make my slides", "Make quiz", "Save style", "Test connection", "Export to PowerPoint", "Next: connect Claude".
- **Labels as questions** where it feels natural: "What should I call you?", "What do you mostly teach?", "Which slides?", "How many questions?", "Where should it go?", "What shall we make?"
- **Progress:** a present participle plus "…": "Reading…", "Drawing your leaf diagram…", "Learning · 6 of 8 files", "About a minute left".
- **Results:** lead with the outcome, then offer a way back: "Done! 8 slides in your Science style — Do Now, tick-box objectives, key word chips and your yellow mini-whiteboard prompts." plus "8 slides added" and "Undo".
- **Reassurance and honesty:** "Everything stays on this computer. No account needed. Only the slides you work on are sent to Claude." / "Usage is billed to whoever owns the key."
- **Errors:** say what happened and what to do, without blame or codes up front: "That key didn't work. Check you copied all of it, then test the connection again." Technical detail goes behind "Details".
- **Exclamation marks:** at most one per screen ("Good morning, Alice!", "Welcome!", "Done!"). No emoji.
- **Consistent nouns:** *lesson* (what she makes), *decks* (her old files), *style* (never theme or template), *planning buddy* (in the chat UI), *Claude* (the connection and billing), *plugins*. Fix the mock's tip copy "…the assistant does the rest" → "Circle it, then tell your planning buddy what to change."
- **Plugin names:** a short verb or noun under 3 words. Description 45 characters or fewer ("Quick-check questions in your format"). The CTA is the plugin's verb ("Make quiz").
