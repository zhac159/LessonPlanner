/**
 * The style-library module's implementation of its contract, built from injected parts so tests need no
 * Electron: a `StylesPort` (the StylesService) and a `StyleDialogPort` (the native file picker).
 * Everything that arrives from the renderer is checked here before it reaches the service.
 */
import type { ContractImpl } from '@shared/contract'
import type { AddedFiles } from '@shared/contracts/style-library'
import { fail, ok, type Result } from '@shared/result'
import type { StylesService } from '@main/services/styles/service'
import type { StyleLibraryFullApi } from '../shared'
import { cleanPaths, isId } from './paths'

/** The part of StylesService this module calls. */
export type StylesPort = Pick<
  StylesService,
  | 'listSummaries'
  | 'get'
  | 'createDraft'
  | 'addFiles'
  | 'removeFile'
  | 'restoreFile'
  | 'retryFile'
  | 'resume'
  | 'update'
  | 'correct'
  | 'save'
  | 'delete'
>

/** The native "add files" dialog (Electron `dialog`), injected so tests can answer it. */
export interface StyleDialogPort {
  /** The chosen paths, or undefined (or an empty list) when she cancelled. */
  pickFiles(): Promise<string[] | undefined>
}

export interface StyleLibraryDeps {
  styles: StylesPort
  dialog: StyleDialogPort
}

const BAD_REQUEST = fail('invalid-input', 'That request was not understood.')
const NO_FILES = fail('invalid-input', 'None of those files can be added')

const isStyleArgs = (args: unknown): args is { styleId: string } =>
  typeof args === 'object' && args !== null && isId((args as { styleId?: unknown }).styleId)

const isFileArgs = (args: unknown): args is { styleId: string; fileId: string } =>
  isStyleArgs(args) && isId((args as { fileId?: unknown }).fileId)

/** Adds the paths that were not even paths to the rejections the service reports. */
const withInvalid = (
  result: Result<AddedFiles>,
  invalid: AddedFiles['rejected']
): Result<AddedFiles> =>
  result.ok ? ok({ added: result.added, rejected: [...invalid, ...result.rejected] }) : result

/** Builds the served API. */
export function createStyleLibraryApi({
  styles,
  dialog
}: StyleLibraryDeps): ContractImpl<StyleLibraryFullApi> {
  const addPaths = async (styleId: string, input: unknown): Promise<Result<AddedFiles>> => {
    const cleaned = cleanPaths(input)
    if (!cleaned) return BAD_REQUEST
    if (cleaned.paths.length === 0) return ok({ added: 0, rejected: cleaned.invalid })
    return withInvalid(await styles.addFiles(styleId, cleaned.paths), cleaned.invalid)
  }

  const draftFrom = async (input: unknown): Promise<Result<AddedFiles & { styleId: string }>> => {
    const cleaned = cleanPaths(input)
    if (!cleaned) return BAD_REQUEST
    if (cleaned.paths.length === 0) return NO_FILES
    const made = await styles.createDraft(cleaned.paths)
    return made.ok ? ok({ ...made, rejected: [...cleaned.invalid, ...made.rejected] }) : made
  }

  const choose = async (): Promise<string[] | undefined> => {
    const picked = await dialog.pickFiles()
    return picked && picked.length > 0 ? picked : undefined
  }

  return {
    list: () => styles.listSummaries(),

    createDraft: (args) => draftFrom((args as { paths?: unknown } | null)?.paths),

    async pickAndCreateDraft() {
      const picked = await choose()
      return picked ? draftFrom(picked) : ok({ cancelled: true as const })
    },

    get: (args) => (isStyleArgs(args) ? styles.get(args.styleId) : BAD_REQUEST),

    async pickFiles(args) {
      if (!isStyleArgs(args)) return BAD_REQUEST
      const picked = await choose()
      return picked ? addPaths(args.styleId, picked) : ok({ cancelled: true as const })
    },

    addFiles: (args) =>
      isStyleArgs(args) ? addPaths(args.styleId, (args as { paths?: unknown }).paths) : BAD_REQUEST,

    async removeFile(args) {
      if (!isFileArgs(args)) return BAD_REQUEST
      const removed = await styles.removeFile(args.styleId, args.fileId)
      return removed.ok ? ok() : removed
    },

    restoreFile: (args) =>
      isFileArgs(args) ? styles.restoreFile(args.styleId, args.fileId) : BAD_REQUEST,

    retryFile: (args) =>
      isFileArgs(args) ? styles.retryFile(args.styleId, args.fileId) : BAD_REQUEST,

    resume: (args) => (isStyleArgs(args) ? styles.resume(args.styleId) : BAD_REQUEST),

    update(args) {
      if (!isStyleArgs(args)) return BAD_REQUEST
      const { name, isDefault } = args as { name?: unknown; isDefault?: unknown }
      if (name !== undefined && typeof name !== 'string') return BAD_REQUEST
      if (isDefault !== undefined && typeof isDefault !== 'boolean') return BAD_REQUEST
      return styles.update(args.styleId, { name, isDefault })
    },

    correct(args) {
      const text = (args as { text?: unknown } | null)?.text
      if (!isStyleArgs(args) || typeof text !== 'string') return BAD_REQUEST
      return styles.correct(args.styleId, text)
    },

    save: (args) => (isStyleArgs(args) ? styles.save(args.styleId) : BAD_REQUEST),

    deleteStyle: (args) => (isStyleArgs(args) ? styles.delete(args.styleId) : BAD_REQUEST)
  }
}
