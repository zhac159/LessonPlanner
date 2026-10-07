/** What every call needs: the runner plus the two sources of nondeterminism (time, ids), injectable for tests. */
import { newId } from '@shared/ids'
import type { ContentBlockParam } from '../sdk'
import type { Runner } from '../runner'

export interface CallDeps {
  runner: Runner
  now: () => Date
  newId: (prefix: string) => string
}

export const defaultDeps = (runner: Runner): CallDeps => ({ runner, now: () => new Date(), newId })

export const textBlock = (text: string): ContentBlockParam => ({ type: 'text', text })

/** Anthropic's request limit is 32 MB; base64 inflates by 4/3, so refuse anything above ~24 MB of raw bytes. */
export const MAX_PDF_BYTES = 24 * 1024 * 1024

/** A PDF as a `document` content block (base64). */
export const pdfBlock = (pdf: Uint8Array): ContentBlockParam => ({
  type: 'document',
  source: {
    type: 'base64',
    media_type: 'application/pdf',
    data: Buffer.from(pdf).toString('base64')
  }
})

/** A PNG as an `image` content block (base64). */
export const pngBlock = (png: Uint8Array): ContentBlockParam => ({
  type: 'image',
  source: { type: 'base64', media_type: 'image/png', data: Buffer.from(png).toString('base64') }
})
