import { describe, expect, it } from 'vitest'
import { makeAnalysis } from '@shared/style/testing'
import { groupAndFacts, pagePictures, type FileFindings } from './pictures'
import { fakeImage, logoOn, photoOn } from './picturesTesting'

const analysis = makeAnalysis({
  slideKinds: [
    { page: 1, kind: 'title' },
    { page: 2, kind: 'content' },
    { page: 3, kind: 'content' }
  ]
})

const file = (
  over: Partial<FileFindings> & Pick<FileFindings, 'sourceId' | 'fileName'>
): FileFindings => ({
  units: 3,
  images: [],
  analysis,
  planPages: [],
  ...over
})

describe('groupAndFacts', () => {
  it('keys every picture by its group so a logo in two decks is one asset, with one fact per slide', () => {
    const a = file({
      sourceId: 'src_a',
      fileName: 'a.pdf',
      images: [...logoOn('a.pdf', 3), photoOn('a.pdf', 2)]
    })
    const b = file({ sourceId: 'src_b', fileName: 'b.pdf', images: logoOn('b.pdf', 3) })
    const { findings, facts } = groupAndFacts([a, b])
    expect(findings.assets).toHaveLength(2)
    const logoKey = 'a'.repeat(16)
    for (const id of ['src_a', 'src_b']) {
      const logos = facts.get(id)!.pictures.filter((p) => p.assetKey === logoKey)
      expect(logos.map((p) => p.slideNumber)).toEqual([1, 2, 3])
      expect(logos[0]).toMatchObject({ kind: 'logo', slideKind: 'title', box: { x: 1640, y: 30 } })
    }
    expect(facts.get('src_a')!.slides).toEqual([
      { sourceId: 'src_a', slideNumber: 1, slideKind: 'title' },
      { sourceId: 'src_a', slideNumber: 2, slideKind: 'content' },
      { sourceId: 'src_a', slideNumber: 3, slideKind: 'content' }
    ])
  })

  it('counts a logo on the slide master on every slide that shows it', () => {
    const master = fakeImage({
      id: 'm#1.logo',
      fileName: 'm.pptx',
      hash: 'c'.repeat(64),
      origin: 'master',
      repeatedOn: [1, 2, 3],
      kindHint: 'logo'
    })
    const { facts } = groupAndFacts([file({ sourceId: 's', fileName: 'm.pptx', images: [master] })])
    expect(facts.get('s')!.pictures.map((p) => p.slideNumber)).toEqual([1, 2, 3])
  })

  it('never counts slide backgrounds or tiny decorations, and a source-plan page is no slide', () => {
    const background = fakeImage({
      id: 'x#1.bg',
      fileName: 'x.pdf',
      hash: 'd'.repeat(64),
      origin: 'background'
    })
    const speck = fakeImage({
      id: 'x#2.speck',
      fileName: 'x.pdf',
      hash: 'e'.repeat(64),
      quality: {
        tooSmall: true,
        thin: false,
        lowResolution: false,
        blurry: false,
        blurScore: null,
        fullPage: false,
        unreadable: false
      }
    })
    const onPlan = photoOn('x.pdf', 1)
    const { facts } = groupAndFacts([
      file({
        sourceId: 's',
        fileName: 'x.pdf',
        images: [background, speck, onPlan, photoOn('x.pdf', 2)],
        planPages: [1]
      })
    ])
    const stored = facts.get('s')!
    expect(stored.pictures.map((p) => p.slideNumber)).toEqual([2])
    expect(stored.slides.map((s) => s.slideNumber)).toEqual([2, 3])
  })

  it('a file with no pictures still reports its slides', () => {
    const { facts, findings } = groupAndFacts([file({ sourceId: 's', fileName: 'z.pdf' })])
    expect(findings.assets).toEqual([])
    expect(facts.get('s')).toMatchObject({ schemaVersion: 1, pictures: [] })
    expect(facts.get('s')!.slides).toHaveLength(3)
  })

  it('names the pictures of a page for exemplars from their group', () => {
    const a = file({
      sourceId: 's',
      fileName: 'a.pdf',
      images: [...logoOn('a.pdf', 3), photoOn('a.pdf', 2)]
    })
    const { nameOf } = groupAndFacts([a])
    const pictures = pagePictures(a, nameOf).filter((p) => p.page === 2)
    expect(pictures.map((p) => p.name)).toContain('school_logo')
    expect(pictures).toHaveLength(2)
  })
})
