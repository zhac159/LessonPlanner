/** Test-only fake client for the style-library UI (component tests). */
import type { ContractImpl } from '@shared/contract'
import type { StyleDraftView } from '@shared/contracts/style-library'
import { ok } from '@shared/result'
import { fakeClient } from '@test/fakeClients'
import type { StyleLibraryFullApi } from '../shared'
import { makeSummary } from './testSupport'

/** A fake client whose `get` returns `view` and whose other calls succeed; override per test. */
export function fakeStyles(
  view: StyleDraftView | null,
  overrides: Partial<ContractImpl<StyleLibraryFullApi>> = {}
) {
  return fakeClient<StyleLibraryFullApi>({
    list: () => [],
    get: () =>
      view ? ok({ style: view }) : { ok: false, code: 'not-found', message: 'Style not found' },
    removeFile: () => ok(),
    restoreFile: () => ok(),
    retryFile: () => ok(),
    resume: () => ok(),
    addFiles: () => ok({ added: 1, rejected: [] }),
    pickFiles: () => ok({ cancelled: true as const }),
    update: () => (view ? ok({ style: view }) : { ok: false, code: 'not-found', message: 'x' }),
    save: () => ok({ style: makeSummary() }),
    deleteStyle: () => ok(),
    correct: () => ok({ message: 'Got it.', version: 2 }),
    ...overrides
  })
}
