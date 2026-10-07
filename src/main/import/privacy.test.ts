import { describe, expect, it } from 'vitest'
import { looksLikePersonalData } from './privacy'

describe('looksLikePersonalData', () => {
  it('detects emails, UK phone numbers and name lists', () => {
    expect(looksLikePersonalData(['email a.b@school.sch.uk'])).toBe(true)
    expect(looksLikePersonalData(['call 07700 900123'])).toBe(true)
    expect(looksLikePersonalData(['Amy Jones\nBen Smith\nCara Lee\nDev Patel'])).toBe(true)
  })

  it('leaves ordinary lesson text alone', () => {
    expect(looksLikePersonalData(['Photosynthesis\nKey words\nTeal band'])).toBe(false)
    expect(looksLikePersonalData(['Amy Jones\nBen Smith'])).toBe(false)
    expect(looksLikePersonalData([])).toBe(false)
  })
})
