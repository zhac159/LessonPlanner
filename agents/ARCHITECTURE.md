# Architecture

How the app is put together. For *why* it is built this way see [DECISIONS.md](DECISIONS.md).

## Three processes, one rule

```
┌─────────────────────────┐  window.api (contextBridge)  ┌──────────────────────────┐
│ Renderer (React)        │ ───────────────────────────► │ Main (Node / Electron)   │
│ src/renderer + modules' │ ◄─────────────────────────── │ src/main + modules'      │
│ ui.tsx   SANDBOXED      │   src/preload/index.ts       │ main.ts   FULL ACCESS    │
└─────────────────────────┘                              └──────────────────────────┘
```

- **Main process** (`src/main`): creates the window, owns the file system, network, secrets and every other
  privileged capability. Feature code that needs those lives in a module's `main.ts`.
- **Preload** (`src/preload/index.ts`): the only door between the two. It exposes `window.api`, whose contract is
  [`src/shared/api.ts`](../src/shared/api.ts). It is intentionally tiny and generic.
- **Renderer** (`src/renderer`, plus each module's `ui.tsx`): the React UI. It runs sandboxed with no Node access
  and a strict Content-Security-Policy (`connect-src 'self'`), so it **cannot** call external APIs. That is by design:
  API keys and network calls stay in the main process.

**The rule:** UI in the renderer, anything privileged in main, talk through module `invoke` / `emit`.

## Startup sequence

1. `src/main/index.ts` takes the single-instance lock (a second launch just focuses the first window).
2. On `app.whenReady`: set the Windows App User Model ID, remove the default menu, deny all web permission
   requests by default, register the core IPC handlers.
3. `loadMainModules()` ([`src/main/modules.ts`](../src/main/modules.ts)) discovers every `src/modules/*/main.ts`,
   validates it, and calls `activate(ctx)` **one module at a time** with a 5 second limit each (so a hung module can delay
   the window by up to 5 s; keep `activate` fast). A module that throws or hangs is logged and skipped, its handlers are
   removed, and its context refuses any later `ctx.handle` call.
4. `createMainWindow()` ([`src/main/window.ts`](../src/main/window.ts)): a **frameless** 1280x800 window, hidden until
   `ready-to-show` (shown anyway after 8 s so a failed page load cannot leave an invisible process holding the
   single-instance lock), sandboxed, `contextIsolation` on, `nodeIntegration` off. Load failures and renderer crashes are logged.
5. The renderer starts (`src/renderer/src/main.tsx` -> `App.tsx`). Two things happen at once:
   - `useUiModules()` lazily imports every `src/modules/*/ui.tsx` and validates them (see "Module discovery").
   - `<Splash>` plays the **"Welcome Alice"** animation. The app **shell is already mounted underneath**, invisible
     (`.app[data-phase='splash'] .shell { opacity: 0 }`), so the first module is loaded by the time the intro ends.
6. The splash finishes when **both** are true: its animation has played (3.2 s, or 1.2 s with reduced motion, or the
   user clicked / pressed a key after the first 0.8 s) **and** the UI modules are ready. It then fades out over
   0.6 s while the shell fades in. `App.tsx` tracks this as `phase`: `splash` -> `revealing` -> `app`.

The name on the splash comes from `APP_CONFIG.userName` in [`src/shared/appConfig.ts`](../src/shared/appConfig.ts).

## The window and the close (X) button

The window is frameless (`frame: false`), so the app draws its own title bar:
[`TitleBar.tsx`](../src/renderer/src/components/TitleBar.tsx). It is `position: fixed` at the top, 40 px tall
(`--titlebar-h`), and shows minimise, maximise/restore and the **close X in the top-right corner**. It floats
transparently over the splash so the X is always reachable.

- The bar is a drag region (`-webkit-app-region: drag`). **Anything clickable inside it must set
  `-webkit-app-region: no-drag`** or the click is swallowed by the OS. The `.titlebar__controls` wrapper does this.
- The buttons call `window.api.window.minimize() / toggleMaximize() / close()`, handled in
  [`src/main/ipc.ts`](../src/main/ipc.ts).
- The window is deliberately **not transparent** (transparent windows are slow and cannot be resized well).

## IPC

Core channels are listed in [`src/shared/ipc.ts`](../src/shared/ipc.ts): `app:info`, five `window:*` channels (four requests
plus the `window:maximized-changed` event), and two generic module channels. Features never add channels. They use:

| Direction | Renderer API (`ModuleApi`) | Main API (`MainModuleContext`) | Underlying channel |
|---|---|---|---|
| request / response | `api.invoke<T>(channel, ...args)` | `ctx.handle(channel, fn)` | `modules:invoke` |
| push from main | `api.on(channel, listener)` -> unsubscribe | `ctx.emit(channel, payload)` | `modules:event` |

Details that matter:

- Every handler is registered under `moduleId:channel` in [`moduleBus.ts`](../src/main/moduleBus.ts). Only registered
  handlers are reachable; anything else resolves to an error.
- The main process answers with an envelope `{ ok: true, value } | { ok: false, error }`; the preload unwraps it, so
  in the renderer `invoke` simply resolves or rejects with `new Error(message)`.
- **Arguments come from the renderer. Validate them in the handler.** Values must be structured-clonable
  (no functions, class instances or DOM nodes).
- Every core handler (and so every module call) rejects any sender that is not the **top frame of the main window showing the
  app's own page** (`isTrusted()` in `src/main/ipc.ts` checks `webContents`, `mainFrame` and `isAppUrl`).
- `ctx.emit` is fire-and-forget: it is dropped if the window does not exist yet (e.g. during `activate()`) or if the UI has not
  subscribed. Have the UI `invoke` for initial state and use events only for later updates.
- In the preload, all `api.on` subscriptions share one `ipcRenderer` listener (no listener-count warnings).
- If a module's `activate()` throws, every handler it already registered is removed.

## Module system (summary)

One folder per feature under `src/modules/<id>/`. Full guide: [MODULES.md](MODULES.md).

```
src/modules/<id>/
  ui.tsx      renderer entry: default-exports defineUiModule({ id, title, icon, order, component })
  main.ts     optional main-process entry: default-exports defineMainModule({ id, activate(ctx) })
  shared.ts   optional types and channel names used by both sides (pure: no Node, no DOM)
  ui/         renderer-only components, hooks, CSS
  main/       main-only code
```

### Module discovery

Both sides use `import.meta.glob` with **lazy** loaders, then
[`loadModules()`](../src/shared/registry.ts) imports and validates each file independently:

- `src/main/modules.ts` globs `../modules/*/main.ts`.
- `src/renderer/src/core/loadUiModules.ts` globs `../../../modules/*/ui.tsx`.
- A folder whose name starts with `_` is ignored (rename `foo` to `_foo` to switch a module off).
- A module is **skipped, not fatal**, if its file throws on import, has no default export, has an `id` that is not
  lowercase kebab-case or does not equal its folder name, or (UI) lacks `title`, `icon` or `component`.
  Skipped **UI** modules are listed on the Home page ("Modules that failed to load"). Skipped or failed **main** modules are only
  logged to the main-process stderr (`Skipped "<id>" ...` / `Failed to activate "<id>" ...`), so read that log too.
- UI modules are sorted by `order` (default 100), then by id.

### Module host behaviour

[`ModuleHost.tsx`](../src/renderer/src/components/ModuleHost.tsx) mounts a module the **first time it is opened and
keeps it mounted** (hidden with the `hidden` attribute) afterwards, so state such as an in-progress chat survives
navigation. Each module is wrapped in an error boundary and `Suspense`: a crash shows an error card inside that module
and the rest of the app keeps working. The `active` prop tells a module whether it is currently visible.

## Security model

- Renderer: `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, CSP in
  [`index.html`](../src/renderer/index.html).
- Navigation is locked to the app's own page: `isAppUrl()` in `src/main/window.ts` accepts only the built `index.html` (or the
  dev server's origin), checked in `will-navigate`, `will-frame-navigate` and `will-redirect`. `window.open` is denied; `http(s)`
  links open in the user's browser via `shell.openExternal`, nothing else does.
- All web permission requests (camera, notifications, ...) are denied by default in `src/main/index.ts`, except
  `clipboard-sanitized-write` (copy buttons). Grant others deliberately if a feature needs them.
- The CSP also sets `base-uri 'self'` and `form-action 'none'`.
- Secrets (the Anthropic API key, when it arrives) must live in the main process, encrypted with Electron's
  `safeStorage`, and never be sent to the renderer.
- Treat renderer-supplied IPC arguments as untrusted.

## Styling

- Design tokens in [`styles/tokens.css`](../src/renderer/src/styles/tokens.css) (colours, radii, layout sizes, font,
  easing, plus the "atmosphere" values: splash glows, title-bar glass, active-nav background, splash name gradient). Use
  `var(--...)`, not hard-coded colours. The theme is dark only and **provisional** until the owner picks a design direction; a
  re-skin should only touch `tokens.css`, `APP_CONFIG.windowBackground` (src/shared/appConfig.ts, the pre-paint window colour)
  and the bundled font. The logo SVG and `resources/icon.png` carry the brand colours.
- Reusable primitives in [`styles/base.css`](../src/renderer/src/styles/base.css): `.page`, `.page__header`, `.eyebrow`,
  `.section-title`, `.card`, `.grid`, `.chip`, `.btn` (+ `.btn--primary`), `.sr-only`.
- Component CSS sits next to the component and is imported by it. Module CSS lives in the module (`ui/*.css`).
- Font: Inter Variable, bundled (works offline). Icons: lucide-react.
- The splash is pure CSS animation (transform / opacity), with a `prefers-reduced-motion` fallback.

## Data on disk

`ctx.dataDir` (main side) is a private folder per module: `<userData>/modules/<id>/`, created on first access.
`userData` is Electron's per-user app folder, `%APPDATA%\Planning App` on Windows. Modules own whatever they store there. The smoke test
uses a throwaway `--user-data-dir`, so it never touches real data.

## Build and run pipeline

- `electron-vite build` produces `out/main/index.js` (+ chunks, one per module `main.ts`), `out/preload/index.js`
  and `out/renderer/` (one lazy chunk per module `ui.tsx`). The renderer is minified (set explicitly in
  `electron.vite.config.ts`).
- `package.json` `"main": "./out/main/index.js"`, so `electron .` runs the build. `package.json` has no
  `"type": "module"`: main and preload are CommonJS (a sandboxed preload cannot be ESM).
- F5 (`.vscode/launch.json`): the pre-launch task `Build app` runs `scripts/ensure-deps.mjs` then
  `npm run build:debug`; the debugger then starts `node_modules/.bin/electron.cmd .`. Two other configurations
  exist: hot-reload dev (`electron-vite dev`) and `npm start` in a terminal.
- Path aliases (`@shared`, `@main`, `@renderer`, `@modules`) are defined in `electron.vite.config.ts` and `vitest.config.ts` (all
  four) and mirrored as `paths` in the tsconfigs (`tsconfig.node.json`: shared, main, modules; `tsconfig.web.json`: renderer,
  shared, modules). Add a new alias in all four files.
- Two TypeScript projects: `tsconfig.node.json` (main, preload, shared, modules' `main.ts`/`main/`/`shared.ts`) and
  `tsconfig.web.json` (renderer, shared, modules' `ui.tsx`/`ui/`/`shared.ts`). `tsconfig.json` just references both.
  A file outside both `include` lists is not type-checked at all (the build ignores types), so keep to the module file layout.
  `src/**/*.test.ts` is type-checked by the node project (and excluded from the web one).
- Shutdown: on quit the app holds `before-quit`, awaits every activated module's `deactivate()` (5 s limit each), then quits.
- Packaging: `electron-builder.yml`; only `out/**` and `package.json` ship (everything else is bundled by Vite, which
  is why libraries live in `devDependencies`).
