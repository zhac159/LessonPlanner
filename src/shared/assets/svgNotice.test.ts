import { describe, expect, it } from 'vitest'
import { leftOutParts, leftOutSentence } from './svgNotice'

describe('leftOutSentence', () => {
  it('says nothing when nothing was left out', () => {
    expect(leftOutSentence(undefined)).toBe('')
    expect(leftOutSentence([])).toBe('')
  })

  it('names each kind of loss once, in plain words', () => {
    expect(leftOutParts(['<image>', '@fill', 'style:filter', 'css:svg path'])).toEqual([
      'embedded pictures',
      'some colours or effects',
      'some styling'
    ])
    expect(leftOutSentence(['<image>', 'css:@media', '@fill'])).toBe(
      'embedded pictures, some styling and some colours or effects'
    )
    expect(leftOutSentence(['<foreignObject>'])).toBe('embedded web content')
    expect(leftOutSentence(['<marquee>'])).toBe('some effects')
  })
})
