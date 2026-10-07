/** 4.1 analyseStyleFile: one imported deck (PDF bytes or a local .pptx digest) -> FileAnalysis. */
import type { CallOptions, FileAnalysis, StyleFileInput } from '@shared/ai/types'
import { stableStringify } from '../json'
import { buildSystem } from '../prompts/context'
import { ANALYSE_TASK, STYLE_ANALYST } from '../prompts/system'
import { aiError } from '../errors'
import { analysisWire, toFileAnalysis } from '../schemas/lesson'
import type { ContentBlockParam } from '../sdk'
import { MAX_PDF_BYTES, pdfBlock, textBlock, type CallDeps } from './deps'

export async function analyseStyleFile(
  { runner }: CallDeps,
  input: StyleFileInput,
  opts: CallOptions = {}
): Promise<{ analysis: FileAnalysis }> {
  const content: ContentBlockParam[] = []
  if (input.kind === 'pdf') {
    if (input.pdf.byteLength > MAX_PDF_BYTES) throw aiError('too-large')
    content.push(pdfBlock(input.pdf), textBlock(`File name: ${input.fileName}\n\n${ANALYSE_TASK}`))
  } else {
    content.push(
      textBlock(
        `File name: ${input.fileName}\nPowerPoint digest (JSON, extracted locally):\n${stableStringify(input.digest)}\n\n${ANALYSE_TASK}`
      )
    )
  }
  const { data } = await runner.runStructured(
    {
      task: 'analyseStyleFile',
      system: buildSystem({ instructions: [STYLE_ANALYST] }),
      messages: [{ role: 'user', content }],
      schema: analysisWire,
      effort: 'medium',
      maxTokens: 16_000
    },
    opts
  )
  return { analysis: toFileAnalysis(data) }
}
