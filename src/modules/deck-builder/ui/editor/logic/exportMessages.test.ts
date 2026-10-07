import { describe, expect, it } from 'vitest'
import { exportOutcome, missingFontsLine } from './exportMessages'

describe('missingFontsLine', () => {
  it('is empty without fonts', () => {
    expect(missingFontsLine([])).toBe('')
  })

  it('says one font in the singular', () => {
    expect(missingFontsLine(['Lexend'])).toBe(
      'Lexend isn’t installed on this PC, so PowerPoint will swap it.'
    )
  })

  it('lists several fonts', () => {
    expect(missingFontsLine(['Lexend', 'Nunito'])).toBe(
      'Lexend and Nunito aren’t installed on this PC, so PowerPoint will swap them.'
    )
    expect(missingFontsLine(['A', 'B', 'C'])).toContain('A, B and C aren’t')
  })
})

describe('exportOutcome', () => {
  it('says nothing when the dialog was cancelled', () => {
    expect(exportOutcome({ status: 'cancelled' })).toBeNull()
  })

  it('reports the saved file', () => {
    expect(
      exportOutcome({
        status: 'saved',
        path: 'C:/docs/Lesson.pptx',
        fileName: 'Lesson.pptx',
        missingFonts: []
      })
    ).toEqual({ kind: 'saved', path: 'C:/docs/Lesson.pptx', message: 'Saved Lesson.pptx' })
  })

  it('adds the missing-font line to the saved message', () => {
    const outcome = exportOutcome({
      status: 'saved',
      path: 'C:/docs/Lesson.pptx',
      fileName: 'Lesson.pptx',
      missingFonts: ['Lexend']
    })
    expect(outcome?.message).toBe(
      'Saved Lesson.pptx. Lexend isn’t installed on this PC, so PowerPoint will swap it.'
    )
  })

  it('uses the locked-file copy, or the generic one', () => {
    const locked = exportOutcome({ status: 'error', code: 'file-locked', message: '' })
    expect(locked).toEqual({
      kind: 'error',
      message: 'Close the file in PowerPoint, then try again.'
    })
    const other = exportOutcome({ status: 'error', code: 'io', message: 'x' })
    expect(other).toEqual({ kind: 'error', message: 'Couldn’t save the file. Try another folder.' })
  })
})
