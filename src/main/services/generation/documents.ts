/**
 * Reading the teacher's learning-objective documents (ai-pipeline.md §4.4): Word text, a PDF as bytes or a
 * PowerPoint digest goes to `extractObjectives`. A document is read once; the answer is kept for the generation.
 */
import type { AiService, CallOptions, ExtractedObjectives } from '@shared/ai/types'
import type { DocumentReadResult } from '@shared/contracts/deck-builder'
import { fail, ok, type Result } from '@shared/result'
import { readDocxText } from '../../import/docxText'
import { isImportError } from '../../import/errors'
import type { FoundDocument } from '../lessons/lessonFiles'
import type { LessonsService } from '../lessons/service'
import type { EmitEvent } from '../lessons/types'

type Extraction = Parameters<AiService['extractObjectives']>[0]

/** What `extractObjectives` takes for a stored document. */
export async function extractionInput(
  found: FoundDocument
): Promise<Result<{ input: Extraction }>> {
  try {
    switch (found.record.kind) {
      case 'docx':
        return ok({ input: { text: await readDocxText(found.bytes) } })
      case 'pdf':
        return ok({ input: { pdf: found.bytes } })
      case 'pptx':
        return ok({
          input: {
            pptxDigest: await (await import('../../import/pptxDigest')).digestPptx(found.bytes)
          }
        })
      default:
        return fail('invalid-input', 'Attach a Word, PDF or PowerPoint document.')
    }
  } catch (error) {
    return fail(
      'invalid-input',
      isImportError(error) ? error.message : 'That document can’t be read.'
    )
  }
}

/** The part of an extraction the UI shows under an attached document. */
export const toReadResult = (extracted: ExtractedObjectives): DocumentReadResult => ({
  objectives: extracted.objectives,
  ...(extracted.title ? { title: extracted.title } : {}),
  ...(extracted.yearGroup ? { yearGroup: extracted.yearGroup } : {})
})

export class DocumentReader {
  private readonly cache = new Map<string, ExtractedObjectives>()

  constructor(private readonly deps: { lessons: LessonsService; ai: AiService; emit: EmitEvent }) {}

  /** The objectives in a document (asks Claude once per document). */
  async read(
    documentId: string,
    lessonId?: string,
    opts?: CallOptions
  ): Promise<Result<{ extracted: ExtractedObjectives }>> {
    const cached = this.cache.get(documentId)
    if (cached) return ok({ extracted: cached })
    const found = await this.deps.lessons.files.findDocument(documentId, lessonId)
    if (!found) return fail('not-found', 'That document can’t be found.')
    const prepared = await extractionInput(found)
    if (!prepared.ok) return prepared
    const result = await this.deps.ai.extractObjectives(prepared.input, opts)
    if (result.ok) this.cache.set(documentId, result.extracted)
    return result
  }

  /** Reads a freshly attached document and tells the UI (`documentRead`): its card shows "{n} objectives found". */
  async announce(documentId: string): Promise<void> {
    const result = await this.read(documentId)
    this.deps.emit('documentRead', {
      documentId,
      result: result.ok ? ok(toReadResult(result.extracted)) : result
    })
  }
}
