/**
 * What the assets module shares between its main and renderer halves, on top of the contract in
 * `@shared/contracts/assets`. Pure types and constants: no Node, Electron or DOM.
 */
import type { AssetsApi } from '@shared/contracts/assets'
import { ASSETS } from '@shared/contracts/assets'

/** The module id (equals the folder name). */
export const MODULE_ID = ASSETS

/**
 * Calls the Assets page needs that the shared contract does not have yet. They are served next to the
 * contract by this module's main half; the lead can fold them into `AssetsApi` (see the work package report).
 */
export interface AssetsExtraApi {
  /**
   * What loading the library had to repair, once: `null` when nothing. The page shows "Your library was tidied up.
   * {recovered} assets recovered." (and "{setAside} could not be read and were set aside.").
   */
  'library:tidied'(): { recovered: number; setAside: number } | null
}

/** Everything the assets module's main half serves. */
export type AssetsFullApi = AssetsApi & AssetsExtraApi

/** Pictures she can pick for Replace file and Upload (the native dialog's filter). */
export const PICTURE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] as const
