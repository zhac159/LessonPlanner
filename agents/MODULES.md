# Writing a module

A **module** is one feature: a folder under `src/modules/<id>/`. Adding the folder is the whole registration step:
the app discovers it at build / dev start. This is the most common thing you will do here, so the quick path first.

## Quick path

```powershell
npm run new:module -- deck-builder "Deck Builder" --main
npm run typecheck
npm run dev            # or F5
```

`--main` also creates `main.ts` (with a `ping` handler) and `shared.ts`; without it you get only `ui.tsx` and `ui/<Name>View.tsx`. The generator ([`scripts/new-module.mjs`](../scripts/new-module.mjs))
refuses ids that are not lowercase kebab-case and folders that already exist. There is also the `add-module` skill.

## Anatomy

```
src/modules/<id>/
  ui.tsx      REQUIRED  renderer entry
  main.ts     optional  main-process entry
  shared.ts   optional  types + channel names shared by both (pure TypeScript)
  ui/         optional  components, hooks, CSS (renderer-only)
  main/       optional  helpers (main-only)
```

Stick to these names: the two TypeScript projects pick files up by these patterns (see ARCHITECTURE.md).
`src/modules/home/` is the reference implementation.

### `ui.tsx`: the page

```tsx
import { Sparkles } from 'lucide-react'
import { defineUiModule } from '@renderer/sdk'
import { DeckBuilderView } from './ui/DeckBuilderView'

export default defineUiModule({
  id: 'deck-builder',        // must equal the folder name; lowercase kebab-case
  title: 'Deck Builder',     // sidebar label
  icon: Sparkles,            // any lucide-react icon
  order: 20,                 // sidebar position, ascending (default 100; home is 0)
  component: DeckBuilderView
})
```

The component receives `ModuleViewProps` (`@renderer/sdk`):

| Prop | Meaning |
|---|---|
| `api.invoke<T>(channel, ...args)` | call a handler registered in this module's `main.ts` |
| `api.on(channel, listener)` | listen to events from `main.ts`; returns an unsubscribe function (use it in effect cleanup) |
| `active` | `true` while the module is the visible one |

`@renderer/sdk` also exports `useShell()` -> `{ modules, issues, activeId, navigate(id) }` for things like "open another module".

**Modules stay mounted** once opened (hidden when you navigate away), so React state survives. Use `active` to pause
timers or polling while hidden. For a heavy page or library, load it lazily inside your module:
`component: lazy(() => import('./ui/HeavyEditor'))` (the host already provides `Suspense`).

Import only from `@renderer/sdk`, `@shared/*`, your own folder, and npm packages. Do not reach into the shell's internals.

### `main.ts`: the privileged half

```ts
import { defineMainModule } from '@main/sdk'
import { CHANNELS, type ImportResult } from './shared'

export default defineMainModule({
  id: 'style-library',
  async activate(ctx) {
    ctx.handle(CHANNELS.importPdf, async (path: unknown): Promise<ImportResult> => {
      if (typeof path !== 'string') throw new Error('path must be a string')   // validate renderer input
      // ... read the file, store results under ctx.dataDir ...
      ctx.emit(CHANNELS.progress, { done: 1, total: 3 })                        // push to the UI
      return { ok: true }
    })
  },
  async deactivate() { /* optional: flush files, close handles (awaited at quit, 5 s limit) */ }
})
```

`MainModuleContext` (`@main/sdk`):

| Member | Use |
|---|---|
| `ctx.id` | the module id |
| `ctx.dataDir` | private persistent folder `<userData>/modules/<id>/` (created on first access) |
| `ctx.handle(channel, fn)` | register a request handler; sync or async; throwing rejects the UI's promise with the message |
| `ctx.emit(channel, payload)` | push an event to the UI; fire-and-forget, dropped if the window or a subscriber does not exist yet (use `invoke` for initial state) |
| `ctx.log` | scoped logger (`info` / `warn` / `error`) |

`activate` must finish within **5 seconds**; start slow work in the background instead of awaiting it.
Channel names: letters, digits, `: . _ -`, starting with a letter. Registering the same channel twice throws.
Import only from `electron`, Node, `@main/sdk`, `@shared/*`, your own folder, and npm packages.

### `shared.ts`: the contract between the halves

Put channel-name constants and request/response types here and import them on both sides, so a rename is one edit and
the compiler checks both ends. It must stay pure: **no Node, Electron or DOM imports**, because both TypeScript
projects compile it.

```ts
export const CHANNELS = { importPdf: 'importPdf', progress: 'progress' } as const
export interface ImportResult { ok: boolean }
```

## Rules and gotchas

- **id = folder name**, lowercase kebab-case. A mismatch makes the module load as an *issue* (shown on Home), not as a feature.
- **Switch a module off** by renaming its folder with a leading underscore (`_deck-builder`). No other change needed.
- A module that throws while loading, or has a malformed definition, is skipped and reported; it cannot break the app.
  **UI** problems are listed on Home under "Modules that failed to load". **Main-process** problems (bad id, throw on import, failed
  or timed-out `activate`, duplicate channel) are only logged to the main-process stderr, so a missing `ctx.handle` shows up as
  `No handler "..." registered by module` in the UI and as a `Failed to activate` line in the log (see run-and-verify).
- `deactivate()` runs at quit only for modules that activated successfully.
- **Never** do network, file-system or secret handling in `ui.tsx`/`ui/`. Put it in `main.ts` and call it with `api.invoke`.
- Validate every argument in `ctx.handle` callbacks. Values crossing IPC must be structured-clonable.
- Subscribe with `api.on` inside `useEffect` and return the unsubscribe function.
- Style with the tokens and primitives (`.page`, `.card`, `.btn`, ... in `base.css`) so the module looks native.
  Put module CSS in `ui/<name>.css` and import it from the component or `ui.tsx`.
- Add `data-testid` attributes to anything an end-to-end check will need.
- Cross-module calls do not exist yet. If you need one, read "Open questions" in [ROADMAP.md](ROADMAP.md) and record
  your design in [DECISIONS.md](DECISIONS.md) rather than importing another module's files.
- New runtime dependency? `npm install -D <pkg>` (Vite bundles it). Only a native or deliberately external package
  goes in `dependencies`. See CONVENTIONS.md.

## Checklist before you call a module done

- [ ] `npm run typecheck` is clean (both projects).
- [ ] Pure logic has unit tests (`*.test.ts` next to the code; Vitest picks up `src/**/*.test.ts`, and the node TypeScript project
      type-checks them, so they must not import `.tsx` or DOM-only code).
- [ ] `npm run smoke` passes and the new module shows in the sidebar; open it and take a screenshot
      (`.artifacts/smoke/` or your own Playwright step).
- [ ] No error cards, nothing under Home's "Modules that failed to load", and no `Skipped` / `Failed to activate` lines in the main-process log.
- [ ] Docs updated if you changed anything other agents rely on (`update-agents-docs` skill), plus a CHANGELOG line.
