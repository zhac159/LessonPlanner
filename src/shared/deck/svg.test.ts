import { describe, expect, it } from 'vitest'
import { MAX_SVG_BYTES, sanitiseSvg, scopeSvgIds } from './svg'

const wrap = (inner: string, attrs = ''): string =>
  `<svg viewBox="0 0 100 100" ${attrs}>${inner}</svg>`

function ok(svg: string) {
  const r = sanitiseSvg(svg)
  if (!r.ok) throw new Error(`expected ok, got: ${r.error}`)
  return r
}

describe('sanitiseSvg: accepted content', () => {
  it('keeps whitelisted shapes and text, adds the xmlns', () => {
    const r = ok(
      wrap(
        '<g><rect x="1" y="2" width="3" height="4" fill="#0E7C7B"/><circle cx="5" cy="5" r="2"/>' +
          '<text x="1" y="1" text-anchor="middle">Leaf <tspan font-weight="700">cell</tspan></text></g>'
      )
    )
    expect(r.svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(r.svg).toContain('<rect x="1" y="2" width="3" height="4" fill="#0E7C7B"/>')
    expect(r.svg).toContain(
      '<text x="1" y="1" text-anchor="middle">Leaf <tspan font-weight="700">cell</tspan></text>'
    )
    expect(r.removed).toEqual([])
  })

  it('allows markers referenced by local url(#id)', () => {
    const r = ok(
      wrap(
        '<defs><marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0 0L6 3L0 6z"/></marker></defs>' +
          '<line x1="0" y1="0" x2="50" y2="50" stroke="#000" marker-end="url(#arrow)"/>'
      )
    )
    expect(r.svg).toContain('marker-end="url(#arrow)"')
    expect(r.svg).toContain('<marker id="arrow"')
  })

  it('normalises quoted local urls and the viewBox', () => {
    const r = ok(
      '<svg viewBox="0,0, 200 100"><rect width="1" height="1" fill="url( \'#g\' )"/></svg>'
    )
    expect(r.svg).toContain('viewBox="0 0 200 100"')
    expect(r.svg).toContain('fill="url(#g)"')
  })

  it('decodes and re-escapes text entities', () => {
    const r = ok(wrap('<text>R&amp;D &lt;b&gt; 5&deg; &#65; &nbsp;AT&T</text>'))
    expect(r.svg).toContain('R&amp;D &lt;b&gt; 5° A  AT&amp;T')
  })

  it('treats CDATA as escaped text and strips comments and the xml prolog', () => {
    const r = ok(
      '<?xml version="1.0"?><!-- hi --><svg viewBox="0 0 1 1"><text><![CDATA[a<b]]></text></svg>'
    )
    expect(r.svg).toContain('<text>a&lt;b</text>')
    expect(r.svg).not.toContain('hi')
    expect(r.svg).not.toContain('xml version')
  })

  it('is idempotent', () => {
    const first = ok(wrap('<text x="1">A &amp; B</text><path d="M0 0L5 5" stroke="red"/>'))
    expect(ok(first.svg).svg).toBe(first.svg)
  })

  it('keeps empty non-text elements self-closing and empty text elements open', () => {
    expect(ok(wrap('<g></g><text></text>')).svg).toContain('<g/><text></text>')
  })
})

describe('sanitiseSvg: hostile input is removed', () => {
  const dropped = (inner: string, attrs = '') => ok(wrap(inner, attrs))

  it('drops <script> with its content', () => {
    const r = dropped('<script>alert(1)</script><rect width="1" height="1"/>')
    expect(r.svg).not.toContain('alert')
    expect(r.svg).not.toContain('script')
    expect(r.removed).toContain('<script>')
  })

  it.each([
    'foreignObject',
    'image',
    'use',
    'a',
    'style',
    'iframe',
    'animate',
    'set',
    'SCRIPT',
    'svg:script'
  ])('drops <%s> and its subtree', (tag) => {
    const r = dropped(
      `<${tag} href="https://evil.test/x"><text>PAYLOAD</text></${tag}><rect width="1" height="1"/>`
    )
    expect(r.svg).not.toContain('PAYLOAD')
    expect(r.svg).not.toContain('evil')
    expect(r.svg).toContain('<rect')
  })

  it('drops event handler attributes; style and class are applied, never kept', () => {
    const r = dropped(
      '<rect width="1" height="1" onload="x()" onclick="y()" ONERROR="z()" style="fill:red" class="a"/>'
    )
    expect(r.svg).toContain('<rect width="1" height="1" fill="red"/>')
    expect(r.removed).toEqual(expect.arrayContaining(['@onload', '@onclick', '@ONERROR']))
    expect(r.removed).not.toContain('@style')
    expect(r.svg).not.toMatch(/style=|class=/)
  })

  it('drops external and javascript hrefs but keeps #id hrefs', () => {
    const r = dropped(
      '<text href="https://evil.test">a</text><text xlink:href="javascript:alert(1)">b</text><text href="#ok">c</text>'
    )
    expect(r.svg).not.toContain('evil')
    expect(r.svg).not.toContain('javascript')
    expect(r.svg).toContain('href="#ok"')
  })

  it.each([
    'url(https://evil.test/a.png)',
    "url('//evil.test/a.png')",
    'url(data:image/svg+xml;base64,AAAA)',
    'url(#ok) url(http://evil.test)',
    'u\\72l(http://evil.test)',
    'expression(alert(1))',
    'javascript:alert(1)'
  ])('drops an attribute value like %s', (value) => {
    const r = dropped(`<rect width="1" height="1" fill="${value}"/>`)
    expect(r.svg).toContain('<rect width="1" height="1"/>')
  })

  it('drops attributes that are not whitelisted and unsafe ids', () => {
    const r = dropped(
      '<rect width="1" height="1" data-x="1" onmouseover="x()" id="a b" xmlns:xlink="http://www.w3.org/1999/xlink"/>'
    )
    expect(r.svg).toContain('<rect width="1" height="1"/>')
  })

  it('does not echo quotes from attribute values into new attributes', () => {
    const r = dropped('<text fill="red&quot; onload=&quot;alert(1)">x</text>')
    expect(r.svg).not.toContain(' onload="')
    expect(r.svg).toContain('fill="red&quot; onload=&quot;alert(1)"')
  })

  it('removes text that sits in non-text containers', () => {
    expect(dropped('<g>stray</g>').svg).toContain('<g/>')
  })

  it('removes foreign root attributes such as xmlns:evil', () => {
    const r = ok('<svg viewBox="0 0 1 1" xmlns="http://evil.test/ns" onload="x()"/>')
    expect(r.svg).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>')
  })
})

describe('sanitiseSvg: rejected documents', () => {
  const errorOf = (svg: string): string => {
    const r = sanitiseSvg(svg)
    if (r.ok) throw new Error('expected an error')
    return r.error
  }

  it('requires a valid viewBox', () => {
    expect(errorOf('<svg><rect/></svg>')).toMatch(/viewBox/)
    expect(errorOf('<svg viewBox="0 0 0 10"/>')).toMatch(/viewBox/)
    expect(errorOf('<svg viewBox="a b c d"/>')).toMatch(/viewBox/)
    expect(errorOf('<svg viewBox="0 0 10"/>')).toMatch(/viewBox/)
  })

  it('requires an <svg> root', () => {
    expect(errorOf('<g viewBox="0 0 1 1"/>')).toMatch(/root element/)
    expect(errorOf('just text')).toMatch(/Text outside|No <svg>/)
    expect(errorOf('')).toMatch(/No <svg>/)
  })

  it('rejects DOCTYPE and entity declarations (billion-laughs)', () => {
    expect(errorOf('<!DOCTYPE svg [<!ENTITY a "x">]><svg viewBox="0 0 1 1"/>')).toMatch(/DOCTYPE/)
  })

  it('rejects malformed markup', () => {
    expect(errorOf('<svg viewBox="0 0 1 1"><g></svg>')).toMatch(/Mismatched/)
    expect(errorOf('<svg viewBox="0 0 1 1"')).toMatch(/Unterminated/)
    expect(errorOf('<svg viewBox=0>')).toMatch(/quoted/)
    expect(errorOf('<svg viewBox="0 0 1 1"/><svg viewBox="0 0 1 1"/>')).toMatch(/one root/)
    expect(errorOf('<svg viewBox="0 0 1 1"><g>')).toMatch(/Unclosed/)
    expect(errorOf('<svg viewBox="0 0 1 1"><!-- x</svg>')).toMatch(/comment/)
  })

  it('rejects documents over 200 KB', () => {
    const big = wrap(`<text>${'a'.repeat(MAX_SVG_BYTES)}</text>`)
    expect(errorOf(big)).toMatch(/200 KB/)
  })

  it('rejects runaway nesting and element counts', () => {
    expect(errorOf(wrap('<g>'.repeat(40) + '</g>'.repeat(40)))).toMatch(/nested/)
    expect(errorOf(wrap('<g/>'.repeat(6000)))).toMatch(/Too many/)
  })

  it('rejects non-strings', () => {
    expect(sanitiseSvg(42 as unknown as string).ok).toBe(false)
  })
})

describe('scopeSvgIds', () => {
  it('prefixes ids and every reference to them', () => {
    const { svg } = ok(
      wrap(
        '<defs><marker id="arrow" markerWidth="1" markerHeight="1"/></defs><line x1="0" y1="0" x2="1" y2="1" marker-end="url(#arrow)"/><text href="#arrow">t</text>'
      )
    )
    const scoped = scopeSvgIds(svg, 'd1-')
    expect(scoped).toContain('id="d1-arrow"')
    expect(scoped).toContain('marker-end="url(#d1-arrow)"')
    expect(scoped).toContain('href="#d1-arrow"')
  })
})
