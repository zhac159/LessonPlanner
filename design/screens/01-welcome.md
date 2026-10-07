# 01 · Welcome (first run)

![](../images/01-welcome.png)

**Purpose:** the first thing a new teacher sees after the splash. It explains the app in one sentence and asks what to call her (and, optionally, what she teaches).

Mockup source: `../canvas/project/Welcome.dc.html` (board 1440×940).

---

## 2. Owner & navigation

| Item | Value |
|---|---|
| Owning module | `settings`, as step 1 of its first-run wizard view (e.g. `src/modules/settings/ui/firstRun/WelcomeStep.tsx`). Steps 1 and 2 are one wizard component; switching steps is local state, not shell navigation |
| Sidebar mode | **None.** TitleBar only, no Sidebar or rail (needs chrome mode `none`, README D-a) |
| How you get here | On launch, after the splash, the shell asks `settings:getProfile`. If `onboarding.step` is `'about'` (or no profile exists) the shell shows the settings first-run view instead of Home. The splash still plays first |
| Resuming | If the app was closed during setup, the next launch resumes at the saved step: `'about'` → this screen, `'connect'` → 02. Once `onboarding.step === 'done'`, this screen is never shown again |
| Back | None (first screen) |

| Control | Goes to |
|---|---|
| "Next: connect Claude" | Saves name and subject, sets `onboarding.step = 'connect'`, shows 02 Connect Claude (mockup: `ConnectClaude.dc.html`) |
| TitleBar close (X) | Closes the app. Nothing typed here is saved unless Next was pressed |

## 3. Layout

Window content area = window minus the 40px TitleBar. The content area scrolls vertically if it is too short; the TitleBar never scrolls.

```
┌──────────────────────── TitleBar 40px ──────────────────────────────┐
├─ Hero (yellow) ─────────────────────┬─ Form side (ground) ───────────┤
│ h1, lead, 3-step list               │        ┌── Welcome Card ──┐    │
│                                     │        │ SetupSteps       │    │
│                                     │        │ name, subject    │    │
│ (illustration, bottom)              │        │ Next, privacy    │    │
│                                     │        └──────────────────┘    │
└─────────────────────────────────────┴────────────────────────────────┘
```

| Region | Size and behaviour (from the mockup) |
|---|---|
| Body | Row, `flex-wrap: wrap`, fills the content area |
| Hero section | `flex: 1 1 560px`, padding 48px 56px, background highlight yellow (#FFE36E), 2px ink right border. Column, gap 28px |
| Hero text block | max-width 560px, gap 14px. h1 56px / line-height 1.02, display font 800, letter-spacing −0.02em. Lead 18px / 1.5, colour ink-2 (#2E2745) |
| Hero step list | `ol`, gap 12px. Each item: 32px numbered circle (2px ink border, white fill, weight 800) + 16px / 600 text, gap 12px |
| Illustration | Decorative (`aria-hidden`), 230px tall, max-width 520px, pinned to the bottom (`margin-top: auto`). Two 300px-wide 16:9 slide cards with 2px ink borders, radius 10px, 5px offset shadow, rotated −7° and +4°; the front card shows a sample slide; an orange hand-drawn loop overlaps its right side |
| Form side | `flex: 1 1 480px`, centres its child both ways, padding 48px 24px |
| Welcome Card | width 100%, max-width 440px, padding 32px, gap 18px, 2px ink border, radius 24px, shadow 6px 6px 0 ink |

**Narrower windows.** Both sections fit side by side while the content area is ≥ 1040px wide (560 + 480), i.e. at the 1100px minimum and the default 1280px. Below 1040px they wrap: the hero goes full width on top and the card below. When wrapped, swap the hero's right border for a bottom border, reduce hero padding to 32px 40px and the h1 to 44px, and hide the illustration.

**Shorter windows.** At the default 800px height the card (~640px) is centred vertically. Hide the illustration when the content area is shorter than 700px so the hero never needs to scroll. If the card doesn't fit, it aligns to the top (24px padding) and the form side scrolls.

## 4. Components

| Component | Variant / notes |
|---|---|
| TitleBar | Standard: 22px orange logo tile, "Slide Planner", minimise / maximise (restore when maximised) / close |
| Card | Large (radius 24px, shadow 6px) |
| SetupSteps | Vertical, 3 items, gap 8px. Item: padding 10px 12px, radius 14px, 26px number badge. **Current:** 2px ink border, cream fill (#FFF4D6), orange badge with ink border, text 700. **Upcoming:** 2px soft-line border (#E4DFF7), muted text (#4E4766) 600, badge with #B9B1D9 border. **Done** (not visible here; same as ProgressPills done): green tint badge with a check. Display only, not interactive |
| TextField | Label above (14px / 700), input 52px tall, radius 14px, 2px ink border, 16px. Name input text 600 |
| Button | Primary, full width, 52px, radius 14px, shadow 3px 3px 0 ink, 16px / 800, trailing arrow icon |
| Callout | Note style (no box): 13px / 1.5 muted text with a leading 16px lock icon |

## 5. Content & copy

| Element | Text | Dynamic? |
|---|---|---|
| TitleBar | "Slide Planner" | App name (working title; README D-j) |
| Hero h1 | "Plan lessons in your own style." | — |
| Hero lead | "Show it the slides you’ve already made. Slide Planner learns how you teach, then builds new lessons from your learning objectives." | — |
| Hero step 1 | "Upload your old decks — PDF or PowerPoint" | — |
| Hero step 2 | "Paste your learning objectives" | — |
| Hero step 3 | "Refine by chatting — or just circle what to change" | — |
| Illustration (decorative) | Kicker "Lesson 3 · Photosynthesis" (rendered uppercase), title "What do plants need to make food?" with "make food?" in teal | — |
| Card heading (h2) | "Welcome!" | — |
| Card intro | "Let’s get you set up. It takes about two minutes." | — |
| SetupSteps (`aria-label` "Setup steps") | "About you" · "Connect Claude" · "Teach it your style" + " (optional)" (500 weight) | Current step = 1 |
| Name label | "What should I call you?" | — |
| Name value | "Alice" | Prefilled: `profile.name` if set, else `APP_CONFIG.userName` |
| Subject label | "What do you mostly teach?" | — |
| Subject placeholder | "e.g. KS3 Science" | — |
| Primary button | "Next: connect Claude" | — |
| Privacy note | "Everything stays on this computer. No account needed. Files go to Claude only when you ask it to learn your style or make slides." | Resolved 2026-10-06 |
| Name error **(new)** | "Add your name so I know what to call you." | Shown under the name field |
| Save error **(new)** | "Couldn’t save that. Try again." | Callout (error style) under the button |
| TitleBar buttons (`aria-label`) | "Minimise", "Maximise" / "Restore", "Close" | Maximise/Restore follows window state |

## 6. Data

**Reads**
```ts
'settings:getProfile' () → UserProfile
interface UserProfile {
  name: string | null              // null on a fresh install
  subject: string | null
  onboarding: { step: 'about' | 'connect' | 'done'; completedAt: string | null; skippedAi: boolean }
}
```

**Writes**
```ts
'settings:setProfile' (patch: { name?: string; subject?: string | null }) → UserProfile
'settings:setOnboardingStep' (step: 'about' | 'connect' | 'done') → void
```
- Stored by `settings` main in `ctx.dataDir/profile.json` (small JSON store, written atomically; README D-d / ROADMAP "persistent store").
- Validation in main: `name` trimmed, 1–40 characters; `subject` trimmed, 0–60 characters, empty → `null`.
- The saved `name` replaces `APP_CONFIG.userName` on the splash from the next launch, and is used by the Home greeting and the Sidebar user chip.
- `subject` is passed to Claude as context when planning lessons and analysing styles.
- No network, no Claude call on this screen.

## 7. States

| State | What it looks like |
|---|---|
| Default | As the image: name prefilled "Alice", subject empty with placeholder, step 1 current, Next enabled |
| Loading | `settings:getProfile` normally answers in < 50ms. Render the layout immediately with the name prefilled from `APP_CONFIG.userName`; replace it with `profile.name` if that differs and the field hasn't been touched |
| Empty name | Next is disabled: border #B9B1D9, text #6B6485, no shadow, `cursor: not-allowed`, `disabled` attribute. After the field loses focus while empty, show the name error under it in the error colour and set `aria-invalid="true"` |
| Saving | Next stays as is; if saving takes > 300ms show a spinner in place of the arrow and ignore further clicks |
| Save error | Values kept. Error Callout under the button; Next re-enabled |
| Resumed setup | If the saved step is `'connect'`, this screen is skipped and 02 opens directly |
| Long input | `maxlength` 40 (name) and 60 (subject). The text scrolls inside the input. Elsewhere a long name truncates with an ellipsis (Sidebar chip) or wraps (Home greeting) |
| Offline / no API key | Not applicable; nothing here needs the network |

## 8. Interactions & behaviour

1. **On show:** focus the name field and select its text, so typing replaces "Alice".
2. **Typing:** Next is enabled whenever `name.trim().length ≥ 1`. The subject is optional.
3. **Enter** in either field = press Next (if enabled).
4. **Next:**
   1. `settings:setProfile({ name: name.trim(), subject: subject.trim() || null })`
   2. `settings:setOnboardingStep('connect')`
   3. Show 02 Connect Claude (same wizard view; move focus to 02's heading).
5. **Tab order:** TitleBar buttons (Minimise, Maximise, Close) → name → subject → Next. The hero contains nothing focusable.
6. **Esc:** does nothing.
7. **Close (X):** closes the app. On the next launch the splash plays again (with `APP_CONFIG.userName`), then this screen.
8. **Reduced motion:** no animation on this screen except the standard focus ring; nothing to disable.

## 9. Acceptance criteria

- [ ] On a fresh install (empty user data) the app shows this screen after the splash, with no Sidebar and no rail.
- [ ] The name field is prefilled with `APP_CONFIG.userName` ("Alice"), focused, and its text selected.
- [ ] Clearing the name disables "Next: connect Claude"; typing one non-space character enables it.
- [ ] Leaving the name field empty shows "Add your name so I know what to call you." and `aria-invalid="true"`.
- [ ] Pressing Enter in the subject field with a valid name moves to Connect Claude.
- [ ] After Next, `profile.json` holds the trimmed name, the subject (or `null`) and `onboarding.step: "connect"`.
- [ ] Quitting on Connect Claude and relaunching opens Connect Claude, not Welcome.
- [ ] On the next launch after setup, the splash shows the saved name.
- [ ] At a 1100×800 window both halves sit side by side and the card is fully visible without scrolling.
- [ ] Below 1040px content width the hero stacks above the card and the illustration is hidden.
- [ ] Every text and control matches the image, including curly apostrophes and the em dashes in the step list.
- [ ] All controls are keyboard reachable with a visible focus ring; TitleBar buttons have accessible names.

## 10. Open questions

1. ~~**Privacy line is incomplete.**~~ Resolved 2026-10-06: the mockup now reads "Files go to Claude only when you ask it to learn your style or make slides." "Only the slides you work on are sent to Claude" is not true once she creates a style (her old decks are sent too). Suggest: "Everything stays on this computer. No account needed. Only the decks you teach it with and the lessons you work on are sent to Claude."
2. **Step names differ** between this SetupSteps list ("About you / Connect Claude / Teach it your style (optional)") and 02's ProgressPills ("You / Connect Claude / Your style"). Pick one set of names, or confirm the short pill labels are intentional.
3. **Splash before setup:** the very first splash says "Welcome Alice" before she has typed a name. Should it say just "Welcome" until a name is saved?
4. Where can she change name and subject later? Assumed: Settings › Profile (not designed yet).

> Implementation note (2026-10-06): the third SetupSteps item reads "Your style" + " (optional)" as in the image and the Connect Claude pills, not "Teach it your style" (open question 2).
