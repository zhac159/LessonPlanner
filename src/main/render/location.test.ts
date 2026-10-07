import { describe, expect, it } from 'vitest'
import { isAllowedRenderUrl, renderPageUrl } from './location'

describe('renderPageUrl', () => {
  it('is the dev server page in development, whatever the trailing slash', () => {
    expect(renderPageUrl({ devServerUrl: 'http://localhost:5173', rendererDir: 'x' })).toBe(
      'http://localhost:5173/render.html'
    )
    expect(renderPageUrl({ devServerUrl: 'http://localhost:5173/', rendererDir: 'x' })).toBe(
      'http://localhost:5173/render.html'
    )
  })

  it('is the built file otherwise', () => {
    const url = renderPageUrl({ rendererDir: 'C:/app/out/renderer' })
    expect(url.startsWith('file:///')).toBe(true)
    expect(url.endsWith('/out/renderer/render.html')).toBe(true)
  })
})

describe('isAllowedRenderUrl', () => {
  const filePage = 'file:///C:/app/out/renderer/render.html'
  const devPage = 'http://localhost:5173/render.html'

  it('allows the page, its own files, and data/blob pictures', () => {
    expect(isAllowedRenderUrl(filePage, filePage)).toBe(true)
    expect(isAllowedRenderUrl('file:///C:/app/out/renderer/assets/render-1.js', filePage)).toBe(
      true
    )
    expect(isAllowedRenderUrl('data:image/png;base64,AAAA', filePage)).toBe(true)
    expect(isAllowedRenderUrl('blob:null/1234', filePage)).toBe(true)
  })

  it('refuses the network and other local files', () => {
    expect(isAllowedRenderUrl('https://example.com/a.png', filePage)).toBe(false)
    expect(isAllowedRenderUrl('http://localhost:5173/render.html', filePage)).toBe(false)
    expect(isAllowedRenderUrl('file:///C:/Users/teacher/secret.png', filePage)).toBe(false)
    expect(isAllowedRenderUrl('file:///C:/app/out/main/index.js', filePage)).toBe(false)
  })

  it('allows only the dev server origin in development', () => {
    expect(isAllowedRenderUrl('http://localhost:5173/src/render/main.tsx', devPage)).toBe(true)
    expect(isAllowedRenderUrl('http://localhost:9999/x.js', devPage)).toBe(false)
    expect(isAllowedRenderUrl('https://example.com/', devPage)).toBe(false)
    expect(isAllowedRenderUrl('file:///C:/x.png', devPage)).toBe(false)
  })

  it('refuses anything that is not a URL', () => {
    expect(isAllowedRenderUrl('not a url', filePage)).toBe(false)
    expect(isAllowedRenderUrl(filePage, 'nonsense')).toBe(false)
  })
})
