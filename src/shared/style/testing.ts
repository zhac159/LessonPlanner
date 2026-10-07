/** Test-only builders for style data (imported by *.test.ts files, never by app code). */
import type { FileAnalysis } from '../ai/types'

/** A small realistic FileAnalysis; override any field. */
export function makeAnalysis(over: Partial<FileAnalysis> = {}): FileAnalysis {
  return {
    colors: [
      { hex: '#FFFFFF', role: 'background', evidence: 'slide fill', frequency: 'most' },
      { hex: '#12263A', role: 'text', evidence: 'body text', frequency: 'most' },
      { hex: '#0E7C7B', role: 'accent', evidence: 'left band', frequency: 'many' }
    ],
    fonts: [
      { family: 'Lexend', usedFor: 'title', sizePt: 40, weight: 700 },
      { family: 'Lexend', usedFor: 'body', sizePt: 20, weight: 400 }
    ],
    layouts: [
      { name: 'Text left, picture right', description: 'Two columns', regions: [], pages: [2, 3] }
    ],
    decorations: [{ description: 'Teal band down the left edge' }],
    slideKinds: [
      { page: 1, kind: 'title' },
      { page: 2, kind: 'content' },
      { page: 3, kind: 'plenary' }
    ],
    voice: {
      rules: ['Objectives start with "Today I will…"'],
      phrases: ['Have a go'],
      spelling: 'en-GB'
    },
    habits: ['Teal band on every slide'],
    exemplarCandidates: [{ page: 2, why: 'Typical content slide' }],
    ...over
  }
}
