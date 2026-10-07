# Implementing the design (Slide Planner, direction B "Classroom")

Read this before touching code for the product. It is the build-side companion of `design/` (what to build) and
`agents/ARCHITECTURE.md` (how the shell works). Owner decisions (2026-10-06): **implement direction B only; no sign-in;
single local app, no backend; everything is stored in the app's own folder; tested with component tests plus a few
integration tests; code stays clean, modular and scalable.**

## Ground rules

1. **Design rules the look and behaviour.** Per screen read only `design/screens/<NN>-*.md` and its image
   `design/images/<NN>-*.png`; for components `node scripts/spec.mjs design-system <Name>` (never read design-system.md whole).
   Strings in specs are exact (British English, curly quotes). Deviations: add an "Implementation note (date):" line to the doc.
2. **App name: "Slide Planner"** (`APP_CONFIG.appName`). The user's name is data (Settings), not code.
3. **Everything local, in the app folder.** `dataRoot()` (`src/main/services/paths.ts`): `$SLIDE_PLANNER_DATA_DIR`, else
   `--user-data-dir`, else `<folder of the .exe>/data` when packaged, else `<repo>/data` in development. A module's
   `ctx.dataDir` is `<dataRoot>/modules/<id>`. No cloud, no accounts. The API key is encrypted with `safeStorage` and stays in main.
4. **Claude only in main**, behind the `AiService` interface (`src/shared/ai/types.ts`). Feature code never imports the SDK.
   For tests and demos set `SLIDE_PLANNER_FAKE_AI=1`: `src/main/ai/fake.ts` returns deterministic fixture-based answers.
5. **AI changes decks only through `DeckOp` ChangeSets** (`src/shared/deck`), validated with zod, one undo step each.
6. **Slides never use app colours or fonts**; they use the StyleProfile only.

## Layering (keep it clean)

```
src/shared/            pure TS: types, zod schemas, deck ops, style helpers, contracts, Result   (no Node/DOM/React)
src/main/services/     plain classes/functions with injected deps (dir, ai, clock): repos, jobs, stores   (unit-tested)
src/main/ai|export|import/   Claude layer, pptx export, file digests (pdf/pptx/docx)                    (unit-tested)
src/modules/<id>/main.ts     THIN wiring only: `serveContract(ctx, impl)` where impl calls services
src/modules/<id>/ui/         screens + hooks; compose `@ui` components; call main through typed clients  (component-tested)
src/renderer/src/ui/   the UI kit (alias `@ui`): presentational, props-driven, no IPC, one folder per area (component-tested)
```

- **Typed IPC contracts**: describe a module's API once in `src/shared/contracts/<module>.ts` (an interface of methods +
  an event map). Main: `serveContract<Api>(ctx, impl)` (`@main/sdk`). Renderer: `useClient<Api>(MODULE_ID)` (`@renderer/sdk`).
  Handlers that can fail in ways the UI distinguishes return `Result<…>` (`@shared/result`). Any module's UI may call any contract
  (that is the sanctioned cross-module read path: Home reads lessons, styles and settings this way).
- **Hooks own data fetching** (`useLessons()`, `useStyles()`…), components stay presentational and receive props. That keeps
  component tests free of IPC: pass props, or wrap with the fake client provider from `@test/render`.
- Files stay small (target < 250 lines; split by responsibility). One component per file with a co-located `.css` and
  `.test.tsx`. No barrel files deeper than one level per UI-kit area (`@ui/atoms`, `@ui/forms`, …).
- Tokens only (`var(--…)`, `design/tokens.css`); never hard-code a colour in chrome UI.

## Testing (details: `agents/TESTING.md`)

| Layer | Tool | Where | Rule |
|---|---|---|---|
| Unit | Vitest, node | `*.test.ts` next to code | all pure logic and main services; temp dirs for files; fake AI |
| Component | Vitest + happy-dom + Testing Library | `*.test.tsx` next to component | every component and screen: roles/labels, states, keyboard, callbacks; no snapshots |
| Integration (E2E) | Playwright driving the real Electron app | `scripts/e2e/*.e2e.mjs` | **few and slow**: max ~5 flows total, fake AI, one launch per flow |
| Visual | `node scripts/shot.mjs` + Read the PNG next to `design/images/*.png` | manual, by the agent | for every screen before calling it done |

Run `npm run -s check` (types + unit + component, ~4 lines of output when green). Details, filters and the token-saving
playbook are in `agents/TESTING.md` and `agents/EFFICIENCY.md`.

## Token-saving rules for agents (see agents/EFFICIENCY.md for the full list)

- Read specs by section: `node scripts/spec.mjs <file> <heading>`. Read code with `Read offset/limit` or `Grep -n`.
- Never paste or print big outputs. Use `npm run -s check` and its filters (`-f path`, `-t name`); never run raw `vitest`/`tsc`
  and read their output.
- Do not re-read files you just wrote. Do not re-run the whole check after every edit: run the narrow filter, then the full one once.
- Reuse before writing: search `src/shared`, `src/renderer/src/ui`, `src/main/services` first.

## Ownership during parallel work

Each agent owns a set of paths and must not edit files outside it (put cross-cutting requests in the final report). Type
errors in files you do not own are someone else's work in progress: ignore them and re-check at the end.
