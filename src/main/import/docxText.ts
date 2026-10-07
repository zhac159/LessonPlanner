/** Plain text of a .docx (used for lesson-plan imports; mammoth runs locally). */
import { ImportError } from './errors'

/** Returns the raw text; throws ImportError('corrupt') when the file is not a readable Word document. */
export async function readDocxText(bytes: Uint8Array): Promise<string> {
  const { default: mammoth } = await import('mammoth') // loaded on first use
  try {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) })
    return value.trim()
  } catch {
    throw new ImportError('corrupt')
  }
}
