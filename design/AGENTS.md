# AGENTS.md — building from the design folder

For AI coding agents (and people) implementing the app. Code-side rules (modules, IPC, sandboxed renderer, tests, packaging) are in `agents/README.md`; **this folder decides what the app looks like and how it behaves.**

## Read in this order
1. `README.md`: screens, status and open decisions.
2. `product-brief.md`: what we're building and why.
3. `build-plan.md`: find the milestone you're on; it lists the docs you need.
4. `design-system.md` + `tokens.css`: before any UI.
5. `screens/<the screen>.md` + `images/<the screen>.png`: before building a screen.
6. `deck-model.md`, `style-profile.md`, `ai-pipeline.md`, `plugin-architecture.md`: before touching those areas.

## Rules
- **Match the images.** Compare your screen with `images/0N-*.png` side by side before calling it done. The `.dc.html` files and `mockups/*.html` are visual references (inline styles); rebuild them with the app's components and tokens, don't copy their markup.
- **Use tokens**, never one-off colours. If a value is missing from `tokens.css`, add it to the design system first.
- **Use the component names** from `design-system.md` (Button, ToggleChip, LessonCard, RegionChip, PluginTile…), so design and code use one vocabulary.
- **The teacher's slides only follow her style profile.** App colours and fonts never leak onto slide content.
- **AI changes go through deck operations** (`deck-model.md` §3): validated, one undo step each.
- **Claude runs only in the main process.** Invoke the `claude-api` skill before writing Claude code; it has the current model IDs and API details.
- **New features are plugins** (`plugin-architecture.md`), not new panels.
- **Accessibility:**
  - real buttons, links and inputs
  - labels on icon-only buttons
  - targets of 44px or more
  - visible focus
  - 4.5:1 text contrast
  - full keyboard use, including the circle tool's Esc and the menus' arrow keys

## When the design and reality disagree
Don't silently improvise. Add an **"Implementation note (date):"** line to the relevant doc saying what you did and why, and tell the owner. If it changes the look, the designer updates the canvas and images.

## Keeping this folder current (designer's job)
- After changing the canvas, regenerate the images and mockups (`tools/README.md`).
- Update the screen spec and add a row to the Status table in `README.md`.
