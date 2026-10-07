/**
 * Capped reading of the parts of a zip. The size a zip header claims can be forged, so the bytes are counted as
 * they come out of the inflater and the read is abandoned the moment a cap is passed.
 */
import type JSZip from 'jszip'
import { DEFAULT_ZIP_LIMITS, UnsafeFileError, type ZipLimits } from './limits'

/** One part is bigger than its own cap (the caller may skip just that part). */
export class EntryTooLarge extends UnsafeFileError {}

export interface ZipReader {
  /** The part as text, or undefined when it does not exist. Throws UnsafeFileError over the XML cap. */
  text(path: string): Promise<string | undefined>
  /** The part's bytes, or undefined when it does not exist. Throws EntryTooLarge over the media cap. */
  bytes(path: string): Promise<Uint8Array | undefined>
}

export function zipReader(zip: JSZip, limits: Partial<ZipLimits> = {}): ZipReader {
  const cap = { ...DEFAULT_ZIP_LIMITS, ...limits }
  let used = 0
  const read = async (path: string, max: number): Promise<Buffer | undefined> => {
    const file = zip.file(path)
    if (!file) return undefined
    const stream = file.nodeStream('nodebuffer') as NodeJS.ReadableStream & { destroy?: () => void }
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = []
      let size = 0
      let done = false
      const finish = (error?: Error): void => {
        if (done) return
        done = true
        if (error) {
          // Pausing the stream stops the inflater: nothing more is produced for this part.
          stream.pause()
          stream.destroy?.()
          reject(error)
        } else resolve(Buffer.concat(chunks))
      }
      stream.on('data', (chunk: Buffer) => {
        if (done) return
        size += chunk.length
        used += chunk.length
        if (used > cap.totalBytes) finish(new UnsafeFileError())
        else if (size > max) finish(new EntryTooLarge())
        else chunks.push(chunk)
      })
      stream.on('end', () => finish())
      stream.on('error', (error: Error) => finish(error))
    })
  }
  return {
    // An oversized XML part makes the whole deck unreadable (EntryTooLarge is an UnsafeFileError).
    text: async (path) => (await read(path, cap.xmlBytes))?.toString('utf8'),
    bytes: (path) => read(path, cap.mediaBytes)
  }
}
