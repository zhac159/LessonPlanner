import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isPluginOutput, mayOpen } from './outputAccess'

const dir = join('C:', 'data', 'modules', 'deck-builder')

describe('isPluginOutput', () => {
  it('accepts a file directly inside a lesson outputs folder', () => {
    expect(isPluginOutput(dir, join(dir, 'lessons', 'les_1', 'outputs', 'Quiz.docx'))).toBe(true)
  })

  it.each([
    ['another folder of the lesson', join(dir, 'lessons', 'les_1', 'assets', 'a.pdf')],
    ['a deeper folder', join(dir, 'lessons', 'les_1', 'outputs', 'x', 'a.docx')],
    ['the outputs folder itself', join(dir, 'lessons', 'les_1', 'outputs')],
    ['outside the lessons folder', join('C:', 'Windows', 'notepad.exe')],
    [
      'a traversal out of outputs',
      join(dir, 'lessons', 'les_1', 'outputs', '..', '..', '..', 'x.docx')
    ]
  ])('refuses %s', (_name, path) => {
    expect(isPluginOutput(dir, path)).toBe(false)
  })
})

describe('mayOpen', () => {
  const rules = { dir, wasExported: (p: string) => p === 'C:\\out\\Lesson.pptx' }

  it('allows an exported file and a plugin output', () => {
    expect(mayOpen('C:\\out\\Lesson.pptx', rules)).toBe(true)
    expect(mayOpen(join(dir, 'lessons', 'les_1', 'outputs', 'a.pdf'), rules)).toBe(true)
  })

  it('refuses anything else, including values that are not strings', () => {
    expect(mayOpen('C:\\out\\other.pptx', rules)).toBe(false)
    expect(mayOpen(undefined, rules)).toBe(false)
    expect(mayOpen({ path: 'x' }, rules)).toBe(false)
  })
})
