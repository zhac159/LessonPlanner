/**
 * What the style-library module shares between its main and renderer halves, on top of the contract in
 * `@shared/contracts/style-library`. Pure types and constants: no Node, Electron or DOM.
 */
import type { StyleLibraryApi } from '@shared/contracts/style-library'
import { STYLE_LIBRARY } from '@shared/contracts/style-library'
import type { Result } from '@shared/result'

/** The module id (equals the folder name). */
export const MODULE_ID = STYLE_LIBRARY

/**
 * Calls the Styles list needs that the shared contract does not have yet. They are served next to the
 * contract by this module's main half; the lead can fold them into `StyleLibraryApi`.
 */
export interface StyleLibraryManageApi {
  /** Deletes a style and its files; another style becomes the default if this one was. */
  deleteStyle(args: { styleId: string }): Result
}

/** Everything the style-library module's main half serves. */
export type StyleLibraryFullApi = StyleLibraryApi & StyleLibraryManageApi

/** Most files a person can add to one style (04 §6). */
export const MAX_FILES_PER_STYLE = 50

/** Extensions the Create a style screen accepts. */
export const STYLE_FILE_EXTENSIONS = ['.pdf', '.pptx'] as const
