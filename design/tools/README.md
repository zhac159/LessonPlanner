# Design tools

## `render-mockups.mjs` — regenerate the images and static mockups
Turns the canvas artboards (`canvas/project/*.dc.html`) into static HTML pages (`mockups/`) and PNG screenshots (`images/`) using the installed Chrome. Node built-ins only; Google Fonts need internet.

```bash
node design/tools/render-mockups.mjs --in design/canvas/project --html-out design/mockups --png-out design/images
```

Options:
- `--only Main.dc.html,Editor.dc.html`: render just some screens.
- `--scale 2`: retina images.
- `--chrome <path>`: Chrome location if it isn't in the default place.

After running it:
- Rename the outputs to the numbered names used in the docs (`01-welcome.png` … `07-plugin-sheet.png`; `Main` → `03-home.png` and `Home.html`).
- In `mockups/*.html`, change links from `X.dc.html` to `X.html` so click-through works.

Frame sizes come from `canvas/project/canvas.json`.
