# 02 · Connect Claude (first run + Settings › AI)

![](../images/02-connect-claude.png)

**Purpose:** get a working Claude API key onto this PC (stored encrypted in the main process), prove it works with a tiny real request, and pick the model. Why it's a key and not a subscription sign-in: `../claude-access.md`.

Mockup source: `../canvas/project/ConnectClaude.dc.html` (board 1440×980).

---

## 2. Owner & navigation

| Item | Value |
|---|---|
| Owning module | `settings`. The form is one component (e.g. `ApiKeyForm`) used in two places: first-run step 2 (this image) and the Settings › AI page |
| Sidebar mode | First run: **none** (TitleBar only). Settings › AI: full Sidebar, Settings active (Settings page itself is not designed yet) |
| How you get here | Welcome "Next: connect Claude"; relaunch while `onboarding.step === 'connect'`; Sidebar Settings › AI; any "Connect Claude" prompt or "Open Settings" error action anywhere in the app (navigate to `settings` with intent `{ kind: 'ai' }`) |

| Control | Goes to / does |
|---|---|
| ProgressPills "You" (done) | Back to 01 Welcome (values kept). **Should**; not drawn as interactive, see Open questions |
| "platform.claude.com ↗" | Opens `https://platform.claude.com/` in the default browser (core opens http(s) links with `shell.openExternal`; in-app navigation is locked) |
| "Skip for now" | `settings:completeOnboarding({ skippedAi: true })` → 03 Home (mockup: `Main.dc.html`). An unsaved typed key is discarded |
| "Next: your style" | See §8 step 6, then `settings:completeOnboarding({ skippedAi: false })` → 04 Create a style with intent `{ kind: 'new-style', firstRun: true }` (mockup: `StyleBuilder.dc.html`) |

First run ends here: once she leaves this screen by Skip or Next, `onboarding.step = 'done'` and the next launch opens Home.

## 3. Layout

| Region | Size and behaviour (from the mockup) |
|---|---|
| TitleBar | 40px |
| Header | Row, padding 14px 24px; ProgressPills pushed to the right by a flex spacer. Wraps if needed |
| Main | Centres the Card horizontally; padding 16px 24px 48px |
| Card | width 100%, max-width 760px, padding 32px, column gap 20px, 2px ink border, radius 24px, shadow 6px 6px 0 ink |
| Title row | 56px icon tile (highlight yellow, 2px ink, radius 16px, key icon 26px) + text column (gap 6px): h1 34px display 800, letter-spacing −0.01em; lead 16px / 1.5, ink-2 (#3A3352) |
| Subscription Callout | padding 14px 16px, 2px ink border, radius 16px, lilac fill (#E9E3FF); title 800, body 14px / 1.5 |
| Steps grid | `grid-template-columns: repeat(auto-fit, minmax(180px, 1fr))`, gap 12px. Each step: padding 14px, 2px ink border, radius 16px, column gap 8px; 28px number badge tinted peach / sky / mint (#FFD6C9 / #D7E8FF / #DFF5D8) |
| API key field | Label 800; row with the input (`flex: 1`, 52px, radius 14px, 16px text, letter-spacing 0.08em) and the Show Button (52px, radius 14px, 700); helper 13px muted below |
| Test row | Row, wraps, gap 12px: Test connection Button (44px, radius 12px, refresh icon) + StatusPill |
| Model field | Label 800; Select 48px, radius 14px, 600 |
| Footer | Row, wraps, gap 12px, padding-top 8px, 2px soft-line top border (#E4DFF7): "Skip for now" (left) · spacer · primary Button "Next: your style" (52px, padding 0 24px, radius 14px, 16px / 800, shadow 3px) |

**Narrower windows.** The Card is `min(760px, window − 48px)` wide, so at ≥ 1100px nothing changes. The steps grid keeps 3 columns while the Card's inner width is ≥ 564px, then drops to 2 and 1. The footer wraps with "Next" under "Skip for now" only if it can't fit (not at supported widths).

**Shorter windows.** At the default 800px height the Card (~830px) is taller than the content area, so the page scrolls. Make the **footer sticky** to the bottom of the viewport (`position: sticky; bottom: 0`, white background, keeps its top border) so "Next: your style" is always visible. Not drawn, because the board is 980px tall.

**Settings › AI variant.** No header pills, no title-row icon change; the Card sits in the Settings page content column (max-width 760px). Footer content changes (see §8 step 9).

## 4. Components

| Component | Variant / notes |
|---|---|
| TitleBar | Standard |
| ProgressPills | 3 pills joined by 24×2px connectors. **Done:** green tint (#DFF5D8), 2px ink border, check icon. **Current:** orange fill, ink border. **Upcoming:** #B9B1D9 border, muted text. Connector after a done pill is ink; before an upcoming pill #B9B1D9. `aria-label` "Setup progress: step 2 of 3" |
| Card | Large |
| Callout | Info style (lilac fill, ink border) with a bold title line |
| Card (small) ×3 | The three "how to get a key" steps |
| TextField | Password variant with a trailing Button (Show/Hide); also a read-only "saved key" display (§7) |
| Button | Secondary (white, ink border) for Show/Hide, Test connection, Replace. Primary for Next. Link style (`button` styled as an underlined link) for Skip for now |
| StatusPill | Result of the test: Checking / Connected / error variants (§5) |
| Select | Model |

## 5. Content & copy

| Element | Text | Dynamic? |
|---|---|---|
| ProgressPills | "You" · "Connect Claude" · "Your style" | Current = 2 |
| h1 | "Connect Claude" | — |
| Lead | "Slide Planner uses Claude to read your old decks and write new lessons. Add a Claude API key once to switch it on. If someone set this up for you, they can add it in Settings instead." | — |
| Callout title | "Can I use my Claude Pro or Max subscription?" | — |
| Callout body | "Not in other apps. Anthropic only allows subscription sign-in inside its own apps, so apps like this one connect with an API key. Usage is billed to whoever owns the key." | — |
| Step 1 | "Open the Claude Console" + link "platform.claude.com ↗" | — |
| Step 2 | "Create an API key" + "Add credit and set a monthly limit there too" | — |
| Step 3 | "Paste it below" + "Then test the connection" | — |
| Key label | "Claude API key" | — |
| Show button | "Show" / "Hide" | Toggles; `aria-pressed` |
| Key helper | "Stored encrypted on this computer and never shown again. You can replace it any time in Settings." | — |
| Saved key display **(new)** | "Saved key ending in {last4}" + Button "Replace" | `keyLast4` |
| Replace mode link **(new)** | "Keep the saved key" | Shown under the helper while replacing |
| Test button | "Test connection" / while running "Testing…" **(new)** | — |
| Model label | "Model" | — |
| Model options | "Claude Opus 5.5 — best quality (recommended)" · "Claude Sonnet 5.5 — faster and cheaper" | Default Opus |
| Footer | "Skip for now" · "Next: your style" | — |
| Next after a non-blocking error **(new)** | "Continue anyway" | §8 step 6 |

**Test result StatusPill and helper line** (helper is 13px muted, under the test row, `aria-live="polite"`). Pills other than Connected/Checking use the error style: peach fill (#FFD6C9), ink border, alert icon. All **(new)** except "Connected".

| Result | Pill | Helper line |
|---|---|---|
| running | "Checking…" (butter fill, spinner) | — |
| `connected` | "Connected" (green fill, check) | — |
| `invalid-key` | "Key not recognised" | "Check you copied the whole key. It starts with sk-ant-." |
| `no-credit` | "No credit on this account" | "Add credit in the Claude Console, then test again." + link "platform.claude.com ↗" |
| `network` | "Can’t reach Claude" | "Check your internet connection, then test again." |
| `rate-limited` | "Too many requests" | "Wait a minute, then test again." |
| `overloaded` | "Claude is busy" | "Claude is very busy right now. Try again in a minute." |
| `model-unavailable` | "Can’t use this model" | "This key can’t use {model name}. Choose the other model or check your Claude Console." |
| `permission` | "Not allowed" | "This key isn’t allowed to use Claude. Check its workspace in the Claude Console." |
| `refused`, `unknown` | "Something went wrong" | "Try again. If it keeps happening, create a new key." |

**Key format errors** (shown under the field in the error colour, `aria-invalid`; **new**):
- Not starting with `sk-ant-`: "Claude API keys start with sk-ant-."
- Starting with `sk-ant-admin`: "That’s an Admin key. Create a normal API key instead."
- `safeStorage` unavailable: "This computer can’t store the key securely, so it wasn’t saved."

## 6. Data

```ts
type ModelChoice = 'opus-5.5' | 'sonnet-5.5'
// Resolved to API model IDs in ONE table in settings main: 'opus-5.5' → 'claude-opus-5-5', 'sonnet-5.5' → 'claude-sonnet-5-5'
// (confirmed with the claude-api skill on 2026-10-06; re-check with the skill before shipping).

interface AiStatus {
  hasKey: boolean
  keyLast4: string | null           // the only part of the key that ever reaches the renderer
  model: ModelChoice
  lastTest: { result: 'connected' | AiErrorCode; at: string } | null
  encryptionAvailable: boolean      // safeStorage.isEncryptionAvailable()
}

'settings:getAiStatus' () → AiStatus
'settings:setApiKey' (key: string) → Result<{ keyLast4: string }>      // codes: 'invalid-input' (format/admin), 'io' (encryption unavailable)
'settings:testConnection' () → Result<{ model: ModelChoice; latencyMs: number }>   // tests the STORED key with the stored model
'settings:setModel' (model: ModelChoice) → void
'settings:removeApiKey' () → void                                       // Settings › AI only
'settings:completeOnboarding' (opts: { skippedAi: boolean }) → void     // sets onboarding.step = 'done', completedAt
'settings:aiStatusChanged' (event) → AiStatus                           // Sidebar user chip, Home callout, editors listen
```

**Main-process rules**
- The key is encrypted with Electron `safeStorage` and written to `ctx.dataDir/secrets.bin`. `keyLast4`, `model` and `lastTest` live in `profile.json`. The key is decrypted only when building the shared AI client (`../ai-pipeline.md` §1) and is **never** returned over IPC, emitted, logged or included in error messages.
- `setApiKey` trims the value, removes inner whitespace, checks the format (above), stores it, clears `lastTest`, emits `aiStatusChanged`.
- `testConnection` sends one minimal Messages request with the chosen model: a one-word prompt, `max_tokens` ≈ 16, effort `low`, SDK retries off (`maxRetries: 0`), 15 s timeout (`../ai-pipeline.md` §4.9). It confirms the key, the credit and access to the model in one go. Map failures to `AiErrorCode` with the SDK's typed errors (README › Results and errors). Log usage to `usage.jsonl` like any call. Store the result in `lastTest`, emit `aiStatusChanged`.
- The renderer holds the typed key only until `setApiKey` succeeds, then clears its state.

## 7. States

| State | What it looks like |
|---|---|
| Default (no key) | Empty password field, focused, "Show" button. Test connection disabled. No pill. Next disabled. Skip enabled |
| Key typed | Dots in the field; Show/Hide works; Test connection and Next enabled |
| Testing | Test button disabled with spinning icon and "Testing…"; pill "Checking…"; Next disabled; Model select disabled |
| Connected | As the image: green "Connected" pill. The field becomes the saved-key display |
| Saved key | Instead of the input: a 52px read-only box (same border and radius) showing "Saved key ending in {last4}", and the trailing button reads "Replace". Show/Hide is gone: the renderer no longer has the key |
| Replacing | Empty password input + Show, focused; "Keep the saved key" link under the helper restores the saved display. The old key stays stored until a new one is saved |
| Test error | Error pill + helper line (table §5). Field keeps the saved-key display (or the typed value if saving itself failed) |
| Format error | Error text under the field, `aria-invalid="true"`, nothing saved, no test run |
| Encryption unavailable | Field disabled with the `io` message under it; Test and Next disabled; Skip enabled |
| Offline | `navigator.onLine === false`: Test still runs and returns `network`; no special banner |
| Settings › AI | Same states. Footer shows "Remove key" (when a key exists) and the usage line (§8 step 9) |
| Long content | The lead wraps; nothing truncates. The key input scrolls horizontally inside itself |

## 8. Interactions & behaviour

1. **On show:** `settings:getAiStatus`. If `hasKey`, show the saved-key display and the last test result pill (if any); otherwise focus the empty key input.
2. **Paste / type:** paste is trimmed. The value is never echoed anywhere else on screen.
3. **Show / Hide:** toggles the input between `type="password"` and `type="text"`; label and `aria-pressed` follow. Resets to hidden when the key is saved.
4. **Test connection** (Enter in the key input does the same):
   1. If the input has a value: `settings:setApiKey(value)`. On a format/`io` error, show it and stop. On success, clear the input state and show the saved-key display.
   2. `settings:testConnection()`. Show "Checking…" until it returns, then the result pill + helper.
5. **Model:** `settings:setModel(choice)` immediately. If a key is saved, clear the pill and re-run Test connection automatically.
6. **Next: your style:**
   - Disabled when the input is empty **and** no key is saved.
   - If the input has an unsaved value, run step 4 first.
   - `connected` → continue.
   - `invalid-key`, `permission` or a format error → stay; nothing else happens.
   - Any other error (`no-credit`, `network`, `rate-limited`, `overloaded`, `model-unavailable`, `unknown`) → stay, show the error, and relabel the button "Continue anyway". Pressing it continues with the key saved.
   - Saved key whose last test was `connected` → continue immediately.
   - Continue = `settings:completeOnboarding({ skippedAi: false })`, then navigate to Create a style.
7. **Skip for now:** `settings:completeOnboarding({ skippedAi: true })` → Home. Afterwards every AI action shows the "Connect Claude" prompt (README), the Sidebar chip says "Claude not connected", and Home shows its not-connected Callout (03).
8. **Keyboard:** Tab order: ProgressPills "You" → platform link → key input → Show/Replace → Test connection → Model → Skip for now → Next. Enter in the key input = Test connection. Esc in replace mode = "Keep the saved key".
9. **Settings › AI reuse:** same component with `mode: 'settings'`:
   - No ProgressPills, no Skip/Next.
   - Footer: Button (danger link style) "Remove key" **(new)** → ConfirmDialog "Remove your API key?" / "Slide Planner won’t be able to make or change slides until you add a key again." / "Cancel" · "Remove key" → `settings:removeApiKey`.
   - Usage line **(new)**: "This month: about ${amount}" from `usage.jsonl` (`../ai-pipeline.md` §10; product brief F8).
   - Changing the key or model saves immediately; there is no separate Save button.

## 9. Acceptance criteria

- [ ] Pasting a valid key and pressing Test connection shows "Checking…" then "Connected" within ~15 s.
- [ ] A revoked or mistyped key shows "Key not recognised" and the helper line; Next stays on this screen.
- [ ] A key on an account with no credit shows "No credit on this account" with the Console link; Next becomes "Continue anyway".
- [ ] With the network unplugged, Test shows "Can’t reach Claude" without hanging longer than 15 s.
- [ ] A value not starting with `sk-ant-` is rejected before any network call.
- [ ] After saving, the field shows "Saved key ending in {last4}" and nothing in the renderer (React state, DevTools, IPC traffic, logs) contains the full key.
- [ ] `secrets.bin` is not readable as plain text; `profile.json` contains only the last 4 characters.
- [ ] Show/Hide toggles visibility of a typed key and has `aria-pressed`; it is not offered for a saved key.
- [ ] Changing the model to Claude Sonnet 5.5 saves it and re-runs the test.
- [ ] "Skip for now" lands on Home, the Sidebar chip reads "Claude not connected", and pressing "Create lesson" shows the Connect Claude prompt instead of calling Claude.
- [ ] "Next: your style" opens Create a style; relaunching afterwards opens Home, not the wizard.
- [ ] The platform.claude.com link opens the default browser, not an in-app window.
- [ ] At 1280×800 the sticky footer keeps "Next: your style" visible while the page scrolls.
- [ ] Settings › AI shows the same form with "Remove key"; removing asks for confirmation and then clears `hasKey`.

## 10. Open questions

1. Should the done "You" pill be clickable to go back to Welcome? There is no back control drawn on this screen.
2. Step names differ from Welcome's SetupSteps (see `01-welcome.md`).
3. Should a failed test block Next for `no-credit`? The spec lets her continue (she may add credit later) but generation will fail until she does.
4. The Settings page that hosts Settings › AI isn't designed (`../README.md` open decision 3). The spec assumes the same Card in a 760px column.
5. Who pays (`../README.md` open decision 2): if the builder adds the key for her, should the first-run step say so or be skippable by default?

> Implementation note (2026-10-06): the progress pills read "About you" · "Connect Claude" · "Your style (optional)" as in the image (same names as the Welcome SetupSteps), not "You" · "Connect Claude" · "Your style" (open question 2).
