/** Default SVG to PNG rasteriser (resvg, no browser needed, so it works in the main process). */

/** Widest PNG we will produce; keeps memory sane for huge diagrams. */
const MAX_WIDTH_PX = 4096

/** Renders SVG markup to a PNG of the given pixel width (aspect ratio preserved, transparent background). */
export async function rasteriseSvg(svg: string, widthPx: number): Promise<Uint8Array> {
  const { Resvg } = await import('@resvg/resvg-js')
  const width = Math.min(Math.max(Math.round(widthPx), 1), MAX_WIDTH_PX)
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: { loadSystemFonts: true, defaultFontFamily: 'Arial' }
  })
  return new Uint8Array(resvg.render().asPng())
}
