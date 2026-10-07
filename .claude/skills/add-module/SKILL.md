---
name: add-module
description: Add a new feature module to the Planning App (a folder under src/modules/<id> with ui.tsx and optionally main.ts). Use whenever the user asks for a new feature, page, screen, tool or capability in the app, or wants to extend it.
---

# Add a module

Every feature in this app is a module. Do **not** edit the shell to add one; it is discovered automatically.

## Steps

1. **Read** `agents/MODULES.md` (contract, rules, checklist). If the feature touches the Claude API, PDFs or `.pptx`
   files, also read `agents/ROADMAP.md` first: the plan may already describe it, and the `claude-api` skill must be
   consulted before writing API code.
2. **Choose the id**: lowercase kebab-case, e.g. `style-library`. It becomes the folder name.
3. **Scaffold**, with `--main` if the feature needs the file system, network, secrets or any Node API:
   ```powershell
   npm run new:module -- <id> "Sidebar Title" --main
   ```
4. **Implement**
   - Put privileged work in `main.ts` (`ctx.handle`, `ctx.emit`, `ctx.dataDir`), UI in `ui/`, shared channel names and
     types in `shared.ts`. Validate every handler argument.
   - Choose a lucide icon and an `order` in `ui.tsx`.
   - Use the design tokens and `.page` / `.card` / `.btn` primitives. Add `data-testid` to anything tests need.
5. **Verify** with the `run-and-verify` skill: `npm run typecheck`, `npm test`, `npm run smoke`. Open the new module
   in the app (a short Playwright step, see that skill) and read a screenshot. Check Home for "Modules that failed to load" (UI side) and the main-process log for `Skipped` / `Failed to activate` (main side).
6. **Test** pure logic with a `*.test.ts` next to it.
7. **Document** with the `update-agents-docs` skill: ROADMAP status, CHANGELOG line, the `data-testid` list in
   CONVENTIONS.md if you added shared ones, and DECISIONS.md if you made a design choice other modules must follow.

## Done when

- The module appears in the sidebar and works in the real app (not only compiled).
- typecheck, unit tests and the smoke test pass; no error cards, nothing listed under "Modules that failed to load", no `Skipped` / `Failed to activate` log lines.
- Docs and CHANGELOG are updated.

## Common mistakes

- `id` differs from the folder name: the module is skipped (listed as an issue on Home).
- Doing `fetch`, file or key handling in `ui.tsx`. The renderer is sandboxed and its CSP blocks external requests.
- Importing Node or Electron in `shared.ts`, or putting a main-only file where the web TypeScript project includes it.
- Forgetting the `useEffect` cleanup for `api.on(...)`.
