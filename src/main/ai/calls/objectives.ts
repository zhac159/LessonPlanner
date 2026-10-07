/** 4.4 extractObjectives: pasted text, a PDF or a .pptx digest -> title, year group and objectives. */
import { fail } from '@shared/result'
import type { CallOptions, ExtractedObjectives } from '@shared/ai/types'
import { AiCallError, aiError } from '../errors'
import { stableStringify } from '../json'
import { buildSystem } from '../prompts/context'
import { OBJECTIVES_TASK } from '../prompts/system'
import { objectivesWire, toObjectives } from '../schemas/lesson'
import type { ContentBlockParam } from '../sdk'
import { MAX_PDF_BYTES, pdfBlock, textBlock, type CallDeps } from './deps'

export interface ObjectivesInput {
  text?: string
  pdf?: Uint8Array
  pptxDigest?: unknown
}

export async function extractObjectives(
  { runner }: CallDeps,
  input: ObjectivesInput,
  opts: CallOptions = {}
): Promise<{ extracted: ExtractedObjectives }> {
  const content: ContentBlockParam[] = []
  if (input.pdf) {
    if (input.pdf.byteLength > MAX_PDF_BYTES) throw aiError('too-large')
    content.push(pdfBlock(input.pdf))
  }
  if (input.pptxDigest !== undefined) {
    content.push(
      textBlock(
        `PowerPoint digest (JSON, extracted locally):\n${stableStringify(input.pptxDigest)}`
      )
    )
  }
  if (input.text?.trim()) content.push(textBlock(`What the teacher wrote:\n${input.text}`))
  if (content.length === 0)
    throw new AiCallError(fail('invalid-input', 'There is nothing to read yet.'))
  content.push(textBlock(OBJECTIVES_TASK))

  const { data } = await runner.runStructured(
    {
      task: 'extractObjectives',
      system: buildSystem({
        instructions: ['You read teachers’ lesson documents and notes accurately.']
      }),
      messages: [{ role: 'user', content }],
      schema: objectivesWire,
      effort: 'low',
      maxTokens: 4000
    },
    opts
  )
  return { extracted: toObjectives(data) }
}
