/**
 * Small hand-made SVG pictures for the `assets` seed: the twelve of design A1, drawn with shapes only so they pass
 * `sanitiseSvg`. Colours are picture content (the school's navy and gold), not app chrome.
 */
const NAVY = '#1f3a6e'
const GOLD = '#f2b632'
const TEAL = '#2aa198'
const INK = '#16213d'
const GREEN = '#4caf50'

const svg = (inner: string, w = 120, h = 120): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${inner}</svg>`

const line = `fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"`

export const SEED_ART: Readonly<Record<string, string>> = {
  school_logo: svg(
    `<path d="M60 10 L104 24 V60 C104 86 84 104 60 112 C36 104 16 86 16 60 V24 Z" fill="${NAVY}"/>` +
      `<circle cx="60" cy="42" r="9" fill="${GOLD}"/>` +
      `<path d="M36 62 L60 82 L84 62" fill="none" stroke="${GOLD}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`
  ),
  do_now_banner: svg(
    `<rect x="6" y="30" width="228" height="60" rx="14" fill="${TEAL}" stroke="${INK}" stroke-width="4"/>` +
      `<text x="120" y="70" text-anchor="middle" font-size="30" font-weight="700" fill="#ffffff">DO NOW</text>`,
    240,
    120
  ),
  owl_mascot: svg(
    `<ellipse cx="60" cy="68" rx="38" ry="42" fill="#a0693d"/>` +
      `<ellipse cx="60" cy="76" rx="22" ry="28" fill="#f3d9b1"/>` +
      `<circle cx="44" cy="48" r="14" fill="#ffffff" stroke="${INK}" stroke-width="3"/>` +
      `<circle cx="76" cy="48" r="14" fill="#ffffff" stroke="${INK}" stroke-width="3"/>` +
      `<circle cx="44" cy="48" r="6" fill="${INK}"/><circle cx="76" cy="48" r="6" fill="${INK}"/>` +
      `<polygon points="54,58 66,58 60,70" fill="${GOLD}"/>`
  ),
  beaker_icon: svg(
    `<path d="M46 14 H74 M52 14 V46 L24 94 C20 102 26 108 34 108 H86 C94 108 100 102 96 94 L68 46 V14" ${line}/>` +
      `<path d="M36 82 H84 L92 96 C94 100 92 102 88 102 H32 C28 102 26 100 28 96 Z" fill="${TEAL}"/>`
  ),
  microscope_icon: svg(
    `<path d="M50 14 L70 22 L58 52 L38 44 Z" fill="#ffffff" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>` +
      `<path d="M62 56 C84 62 90 92 62 100 H30 M24 108 H96" ${line}/>`
  ),
  leaf_icon: svg(
    `<path d="M20 100 C16 50 50 16 104 16 C104 70 70 104 20 100 Z" fill="${GREEN}" stroke="${INK}" stroke-width="4"/>` +
      `<path d="M20 100 L74 46" ${line}/>`
  ),
  timer_icon: svg(
    `<circle cx="60" cy="68" r="38" fill="#ffffff" stroke="${INK}" stroke-width="5"/>` +
      `<path d="M60 68 V44 M60 68 L78 68 M50 14 H70 M60 14 V30" ${line}/>` +
      `<path d="M60 68 L60 36 A32 32 0 0 1 92 68 Z" fill="${GOLD}"/>`
  ),
  lightbulb_icon: svg(
    `<path d="M60 12 C36 12 24 32 28 52 C30 62 40 70 44 80 H76 C80 70 90 62 92 52 C96 32 84 12 60 12 Z" fill="${GOLD}" stroke="${INK}" stroke-width="4"/>` +
      `<path d="M46 92 H74 M50 104 H70" ${line}/>`
  ),
  mini_whiteboard_icon: svg(
    `<rect x="14" y="16" width="92" height="64" rx="6" fill="#ffffff" stroke="${INK}" stroke-width="5"/>` +
      `<path d="M28 36 H78 M28 50 H92 M28 64 H60" ${line}/>` +
      `<path d="M60 80 L46 106 M60 80 L74 106" ${line}/>`
  ),
  plant_cell_diagram: svg(
    `<rect x="12" y="20" width="96" height="80" rx="18" fill="#d6f0d3" stroke="${GREEN}" stroke-width="6"/>` +
      `<circle cx="66" cy="58" r="16" fill="#b9a2e8" stroke="${INK}" stroke-width="3"/>` +
      `<circle cx="66" cy="58" r="6" fill="${NAVY}"/>` +
      `<ellipse cx="34" cy="40" rx="9" ry="6" fill="${GREEN}"/><ellipse cx="38" cy="82" rx="9" ry="6" fill="${GREEN}"/>`
  ),
  leaf_cross_section: svg(
    `<rect x="14" y="14" width="92" height="12" rx="4" fill="${GREEN}"/>` +
      `<g fill="#8fd28f" stroke="${INK}" stroke-width="2">` +
      [22, 34, 46, 58, 70, 82]
        .map((x) => `<rect x="${x}" y="30" width="8" height="30" rx="3"/>`)
        .join('') +
      `</g><rect x="14" y="64" width="92" height="22" rx="6" fill="#cfe8c4" stroke="${INK}" stroke-width="2"/>` +
      `<rect x="14" y="92" width="92" height="12" rx="4" fill="${GREEN}"/>`
  ),
  forest_photo: svg(
    `<rect width="120" height="120" fill="#cfe6fa"/>` +
      `<circle cx="34" cy="34" r="12" fill="${GOLD}"/>` +
      `<polygon points="0,120 44,56 88,120" fill="#3f9f58"/><polygon points="50,120 90,66 120,110 120,120" fill="#2f8447"/>`
  )
}
