---
name: package-exe
description: Build the Planning App into a Windows .exe, either the NSIS installer or an unpacked app folder, and verify it runs. Use when the user asks for an exe, an installer, a release, or to share/distribute the app.
---

# Package the app as a Windows exe

Packaging uses electron-builder, configured in `electron-builder.yml`. Only `out/**` and `package.json` are shipped
(Vite has already bundled everything else), so the build must come first. The npm scripts do both.

## Steps

1. Make sure the working app passes `run-and-verify` (typecheck, tests, smoke).
2. Optionally bump `"version"` in `package.json`; the installer file name and the in-app footer use it.
3. Pick the target:
   ```powershell
   npm run package:dir    # fast: release/win-unpacked/Planning App.exe  (good for testing)
   npm run package        # installer: release/PlanningApp-Setup-<version>.exe
   ```
   The first run downloads electron-builder tooling (Electron zip, NSIS, icons); allow several minutes and network access.
4. **Verify the packaged app**, not just the build:
   ```powershell
   Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
   node scripts/smoke.mjs --exe "release/win-unpacked/Planning App.exe"
   ```
   All checks must pass. (The `win-unpacked` folder is produced by both targets.)
5. Do **not** run the installer on the user's machine, and do not install it, unless they ask: it installs software.
6. Tell the user where the file is and its size. Mention that it is unsigned.

## Facts (measured 2026-10-06, see DECISIONS.md D1, D10)

- Installer ~106 MB; unpacked folder ~370 MB (the Electron runtime dominates); the app code itself is < 1 MB (`app.asar`).
- The installer is **unsigned**: Windows SmartScreen may show "Windows protected your PC" (More info -> Run anyway). Signing needs a purchased certificate.
- Install mode: an assisted installer; the user chooses per-user (no admin) or all users.
- App data lives in `%APPDATA%\Planning App` and is **not** removed by uninstalling.
- The icon comes from `resources/icon.png` (regenerate with `powershell -File scripts/make-icon.ps1`; must stay >= 256 px square).
- `package.json` has no `author`; electron-builder prints a warning. Set it when the owner says what name to use.

## Done when

- The target file exists in `release/`, the packaged exe passed the smoke test, and the user was told the path, size and the unsigned caveat.

## Troubleshooting

Neither of the first two has happened on this machine; they are the usual suspects.

| Symptom | Fix |
|---|---|
| Build fails extracting `winCodeSign` with a symlink permission error (a known electron-builder issue on Windows without Developer Mode) | enable Windows Developer Mode, or run the terminal as administrator once |
| Packaged app shows a blank window | the renderer path or CSP probably broke: run it with redirected output and check that `out/renderer/index.html` exists and the preload is `out/preload/index.js` |
| Old files in the build | delete `out/` and `release/`, then package again |
