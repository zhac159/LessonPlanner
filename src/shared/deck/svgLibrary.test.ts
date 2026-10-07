import { describe, expect, it } from 'vitest'
import { LIBRARY_SVG, sanitiseSvg } from './svg'

function lib(svg: string) {
  const r = sanitiseSvg(svg, LIBRARY_SVG)
  if (!r.ok) throw new Error(`expected ok, got: ${r.error}`)
  return r
}

const ILLUSTRATOR = `<?xml version="1.0" encoding="utf-8"?>
<!-- Generator: Adobe Illustrator 27.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd" [
  <!ENTITY ns_extend "http://ns.adobe.com/Extensibility/1.0/">
  <!ENTITY ns_ai "http://ns.adobe.com/AdobeIllustrator/10.0/">
]>
<svg version="1.1" id="Layer_1" xmlns:x="&ns_extend;" xmlns:i="&ns_ai;" xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="120px" height="90px"
  style="enable-background:new 0 0 120 90;" xml:space="preserve">
<style type="text/css">
  .st0{fill:#E8112D;}
  .st1{fill:url(#SVGID_1_);}
  .st2{fill:none;stroke:#0A1F44;stroke-width:3;stroke-miterlimit:10;}
</style>
<switch>
  <foreignObject requiredExtensions="&ns_ai;" x="0" y="0" width="1" height="1">
    <i:pgfRef xlink:href="#adobe_illustrator_pgf"></i:pgfRef>
  </foreignObject>
  <g i:extraneous="self">
    <linearGradient id="SVGID_1_" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="120" y2="0">
      <stop offset="0" style="stop-color:#FFD200"/>
      <stop offset="1" style="stop-color:#F26B21"/>
    </linearGradient>
    <rect class="st1" width="120" height="40"/>
    <path class="st0" d="M0 50h60v40H0z"/>
    <circle class="st2" cx="90" cy="70" r="15"/>
  </g>
</switch>
</svg>`

const INKSCAPE = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:svg="http://www.w3.org/2000/svg" xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
  xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="210mm" height="297mm" viewBox="0 0 210 297"
  version="1.1" id="svg8" inkscape:version="1.2" sodipodi:docname="drawing.svg">
  <defs id="defs2">
    <clipPath id="clip1"><rect width="50" height="50" id="r1"/></clipPath>
    <g id="leaf"><path d="M0 0l10 10" style="fill:#2e7d32;stroke:none;-inkscape-font-specification:'Sans'"/></g>
  </defs>
  <sodipodi:namedview id="base" pagecolor="#ffffff" inkscape:zoom="0.35"/>
  <metadata id="metadata5"><rdf:RDF><dc:title>Leaf</dc:title></rdf:RDF></metadata>
  <g inkscape:label="Layer 1" inkscape:groupmode="layer" id="layer1" clip-path="url(#clip1)">
    <use xlink:href="#leaf" x="10" y="10" id="use1"/>
    <use xlink:href="#leaf" transform="translate(30)"/>
  </g>
</svg>`

describe('sanitiseSvg: pictures from drawing programs keep their colours', () => {
  it('turns Illustrator CSS classes, gradients and stop styles into attributes and reports nothing lost', () => {
    const r = lib(ILLUSTRATOR)
    expect(r.svg).toContain('fill="#E8112D"')
    expect(r.svg).toContain('<linearGradient id="SVGID_1_"')
    expect(r.svg).toContain('stop-color="#FFD200"')
    expect(r.svg).toContain('stop-color="#F26B21"')
    expect(r.svg).toContain('fill="url(#SVGID_1_)"')
    expect(r.svg).toContain('stroke="#0A1F44"')
    expect(r.svg).toContain('stroke-width="3"')
    expect(r.svg).toContain('viewBox="0 0 120 90"')
    expect(r.svg).not.toMatch(/style=|class=|<style|foreignObject|DOCTYPE|ENTITY/)
    expect(r.lost).toEqual([])
  })

  it('keeps Inkscape defs, clip paths and same-document <use> and drops only editor data', () => {
    const r = lib(INKSCAPE)
    expect(r.svg).toContain('<clipPath id="clip1">')
    expect(r.svg).toContain('clip-path="url(#clip1)"')
    expect(r.svg).toContain('<use href="#leaf" x="10" y="10" id="use1"/>')
    expect(r.svg).toContain('fill="#2e7d32"')
    expect(r.svg).not.toMatch(/inkscape|sodipodi|rdf|metadata/)
    expect(r.lost).toEqual([])
    expect(r.removed.length).toBeGreaterThan(0)
  })

  it('is idempotent on both', () => {
    for (const source of [ILLUSTRATOR, INKSCAPE]) {
      const first = lib(source)
      expect(lib(first.svg).svg).toBe(first.svg)
    }
  })

  it('refuses the same files in strict mode (DOCTYPE, no viewBox): that is for AI diagrams', () => {
    expect(sanitiseSvg(ILLUSTRATOR)).toMatchObject({ ok: false })
    expect(sanitiseSvg(ILLUSTRATOR.replace(/<!DOCTYPE[\s\S]*?\]>/, ''))).toMatchObject({
      ok: false,
      error: expect.stringContaining('viewBox')
    })
  })

  it('makes a viewBox from width and height in any unit, but never from percentages', () => {
    expect(lib('<svg width="10cm" height="5cm"/>').svg).toContain('viewBox="0 0 377.953 188.976"')
    expect(lib('<svg width="24pt" height="12"/>').svg).toContain('viewBox="0 0 32 12"')
    expect(sanitiseSvg('<svg width="100%" height="100%"/>', LIBRARY_SVG)).toMatchObject({
      ok: false
    })
  })

  it('applies CSS the way a browser does: specificity, then source order, then the style attribute', () => {
    const r = lib(
      '<svg viewBox="0 0 9 9"><style>rect{fill:red}.a{fill:blue}#x{fill:green} .b{fill:pink}</style>' +
        '<rect id="x" class="a" width="1" height="1"/>' +
        '<rect class="a b" width="1" height="1"/>' +
        '<rect class="a" style="fill:orange !important" width="1" height="1" fill="black"/>' +
        '<circle class="a" r="1"/></svg>'
    )
    expect(r.svg).toContain('<rect id="x" width="1" height="1" fill="green"/>')
    expect(r.svg).toContain('<rect width="1" height="1" fill="pink"/>')
    expect(r.svg).toContain('<rect width="1" height="1" fill="orange"/>')
    expect(r.svg).toContain('<circle r="1" fill="blue"/>')
  })

  it('reports what it could not keep so the library can warn', () => {
    const r = lib(
      '<svg viewBox="0 0 9 9"><style>svg path:hover{fill:red} @media print{.a{fill:blue}}</style>' +
        '<image href="https://evil.test/a.png" width="1" height="1"/>' +
        '<rect width="1" height="1" fill="url(https://evil.test/p.svg#a)" style="mix-blend-mode:multiply;mask:url(//evil/m)"/>' +
        '<foreignObject><div>hi</div></foreignObject></svg>'
    )
    expect(r.lost).toEqual(
      expect.arrayContaining([
        'css:svg path:hover',
        'css:@media',
        '<image>',
        '@fill',
        'style:mask',
        '<foreignObject>'
      ])
    )
    expect(r.svg).toContain('mix-blend-mode="multiply"')
    expect(r.svg).not.toContain('evil')
  })
})

describe('sanitiseSvg: the wider allowlist stays safe', () => {
  const hostile = (inner: string) => lib(`<svg viewBox="0 0 9 9">${inner}</svg>`)

  it('never lets an external or script reference through style attributes or <style> blocks', () => {
    const r = hostile(
      '<style>@import url(http://evil.test/a.css); rect{fill:url(http://evil.test/x);stroke:red}' +
        'circle{background:url(//evil/a);fill:expression(alert(1))}</style>' +
        '<rect style="fill:url(data:image/svg+xml;base64,AAAA);stroke:javascript:alert(1)" width="1" height="1"/>' +
        '<circle r="1" style="clip-path:url(&quot;https://evil.test/c.svg#c&quot;)"/>'
    )
    expect(r.svg).not.toMatch(/evil|javascript|expression|data:|import/i)
    expect(r.svg).toContain('stroke="red"')
  })

  it('keeps <use> to the same document and ignores anything written inside it', () => {
    const r = hostile(
      '<g id="a"><rect width="1" height="1"/></g>' +
        '<use href="https://evil.test/x.svg#a"/><use xlink:href="data:image/svg+xml,&lt;svg onload=x()/&gt;"/>' +
        '<use href="#a"><script>alert(1)</script><text>PAYLOAD</text></use>'
    )
    expect(r.svg).not.toMatch(/evil|data:|script|PAYLOAD|alert/)
    expect(r.svg).toContain('<use href="#a"/>')
  })

  it('drops scripts, handlers and nested documents even inside <switch>, <pattern> and <mask>', () => {
    const r = hostile(
      '<switch><script>alert(1)</script><foreignObject><iframe src="x"/></foreignObject>' +
        '<g onload="x()"><rect width="1" height="1"/></g></switch>' +
        '<pattern id="p" width="1" height="1"><image href="data:image/svg+xml;base64,PHN2Zy8+" width="1" height="1"/></pattern>' +
        '<mask id="m" onclick="x()"><rect width="9" height="9" fill="#fff"/></mask>' +
        '<animate attributeName="x"/><set to="1"/>'
    )
    expect(r.svg).not.toMatch(/script|iframe|onload|onclick|data:|animate|<set|<image/)
    expect(r.svg).toContain('<mask id="m">')
    expect(r.svg).toContain('<pattern id="p"')
  })

  it('skips a DOCTYPE with entities without ever expanding them', () => {
    const r = lib(
      '<!DOCTYPE svg [<!ENTITY a "&b;&b;&b;"><!ENTITY b "<script>alert(1)</script>"><!ENTITY x SYSTEM "file:///c:/secret.txt">]>' +
        '<svg viewBox="0 0 9 9"><text fill="&a;">&x;&a;</text></svg>'
    )
    expect(r.svg).not.toMatch(/script|secret|file:/)
    expect(r.svg).toContain('&amp;x;&amp;a;')
  })

  it('still refuses a DOCTYPE after the root element or one that never ends', () => {
    expect(sanitiseSvg('<svg viewBox="0 0 1 1"><!DOCTYPE x></svg>', LIBRARY_SVG).ok).toBe(false)
    expect(
      sanitiseSvg('<!DOCTYPE svg [<!ENTITY a "b"><svg viewBox="0 0 1 1"/>', LIBRARY_SVG).ok
    ).toBe(false)
  })

  it('refuses a <use> chain that would expand to billions of shapes, and survives a cycle', () => {
    let chain = '<g id="g0"><rect width="1" height="1"/></g>'
    for (let i = 1; i < 40; i++)
      chain += `<g id="g${i}"><use href="#g${i - 1}"/><use href="#g${i - 1}"/></g>`
    const bomb = sanitiseSvg(`<svg viewBox="0 0 9 9">${chain}<use href="#g39"/></svg>`, LIBRARY_SVG)
    expect(bomb).toMatchObject({ ok: false, error: expect.stringContaining('<use>') })
    const loop = hostile(
      '<g id="a"><use href="#b"/></g><g id="b"><use href="#a"/></g><use href="#a"/>'
    )
    expect(loop.svg).toContain('<use href="#a"/>')
  })

  it('refuses a very long chain of references without overflowing the stack', () => {
    let chain = '<rect id="r0" width="1" height="1"/>'
    for (let i = 1; i < 20_000; i++) chain += `<use id="r${i}" href="#r${i - 1}"/>`
    expect(
      sanitiseSvg(`<svg viewBox="0 0 9 9">${chain}</svg>`, { ...LIBRARY_SVG, maxNodes: 30_000 }).ok
    ).toBe(false)
  })

  it('keeps the size limits: strict mode is 200 KB, the library mode allows more but not unlimited', () => {
    const big = `<svg viewBox="0 0 9 9"><path d="${'M0 0'.repeat(60_000)}"/></svg>`
    expect(sanitiseSvg(big).ok).toBe(false)
    expect(sanitiseSvg(big, LIBRARY_SVG).ok).toBe(true)
    expect(sanitiseSvg(big, { ...LIBRARY_SVG, maxBytes: 1000 }).ok).toBe(false)
  })

  it('keeps filter primitives but not feImage', () => {
    const r = hostile(
      '<filter id="f"><feGaussianBlur stdDeviation="2"/><feImage href="https://evil.test/x.png"/></filter><rect width="1" height="1" filter="url(#f)"/>'
    )
    expect(r.svg).toContain('<feGaussianBlur stdDeviation="2"/>')
    expect(r.svg).toContain('filter="url(#f)"')
    expect(r.svg).not.toMatch(/feImage|evil/)
    expect(r.lost).toContain('<feImage>')
  })
})
