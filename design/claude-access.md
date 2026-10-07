# Claude access — why it's an API key, not "Sign in with Claude"

## The request
"Sign in with Claude so it can use my Claude subscription for the AI."

## What Anthropic allows (checked 2026-10-06)
Anthropic's Claude Code legal and compliance page ("Authentication and credential use") says:
- **OAuth sign-in with a Claude account is for Claude's own apps.** Free, Pro, Max, Team and Enterprise subscription sign-in is meant for Claude Code and Anthropic's native apps.
- **Third-party developers may not offer Claude.ai login in their own apps, or route requests through Free, Pro or Max plan credentials on behalf of users.** Developers may not collect, store or pass on Claude.ai credentials or session tokens.
- **Developers building apps should use API key authentication** through the Claude Console (or a supported cloud provider).
- Anthropic has enforced this since early 2026; subscription tokens used outside its own apps are rejected.

Sources:
- [Claude Code docs — Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)
- [Feature request asking Anthropic to allow it (open, July 2026)](https://github.com/anthropics/claude-code/issues/82266)
- [News coverage of the February 2026 policy update](https://winbuzzer.com/2026/02/19/anthropic-bans-claude-subscription-oauth-in-third-party-apps-xcxwbn/)

So a "Sign in with Claude" button that uses a Pro/Max subscription **can't be built** for this app.

## Decision: Connect Claude with an API key
- First-run setup: **Welcome → Connect Claude → (optional) create your first style**. The same form lives in **Settings › AI**. Mockup: `images/02-connect-claude.png`; spec: `screens/02-connect-claude.md`.
- The key comes from the Claude Console (platform.claude.com). Billing is pay-per-use to whoever owns the key. The teacher, or whoever set the app up, can add credit and set a monthly spend limit there.
- **Storage:** encrypted on the PC with Electron `safeStorage` (Windows DPAPI), in the main process only. It's never sent to the renderer or logged, and the UI shows only the last 4 characters after saving.
- **Test connection:** a tiny real request (a few tokens) that confirms the key, the credit and the chosen model.
- **Cost:** see `ai-pipeline.md` §10. Rough planning numbers: about **$0.70 per generated lesson** and a few cents per edit with Claude Opus 5.5; creating a style from 20 decks is a one-off **$4–5**.
- The screen explains this in one honest line: "Can I use my Claude Pro or Max subscription? Not in other apps…"

## Alternatives we considered

| Option | Uses the subscription? | Why not (for now) |
|---|---|---|
| **A. API key** (chosen) | No (pay per use) | Allowed, simple, works offline-first apart from the Claude calls |
| **B. Build the features as a connector (MCP server) used inside the Claude app** | Yes, legitimately, because she'd be using Claude's own app | The chat would live in Claude, not in this app. Our custom slide stage, circle-to-edit and the B design would have to be rebuilt as an MCP App UI inside Claude. A different product; worth revisiting only if API costs become a problem |
| **C. Drive a locally installed Claude Code** with her own sign-in | Grey area | Embedding Claude Code in a product needs Anthropic's commercial terms; fragile and not designed for this. Not recommended |

If Anthropic ever offers an approved "Sign in with Claude" for third-party apps, it would slot into the same Connect Claude screen as a second button. The AI client factory (`ai-pipeline.md` §1) is the only place that would change.
