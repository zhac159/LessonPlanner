import { defineMainModule, serveContract } from '@main/sdk'
import {
  disposeSharedStyles,
  getSharedStyles,
  setStyleEventEmitter
} from '@main/services/deckBuilder/sharedStyles'
import { createStyleLibraryApi } from './main/api'
import { createElectronStyleDialog } from './main/dialog'
import type { StyleLibraryFullApi } from './shared'

/**
 * Main half of the style-library module: thin wiring from the app's ONE shared StylesService (also read by
 * the deck-builder) and the native file dialog to the contract. Learning carries on in the background (and
 * is resumed at start-up).
 */
export default defineMainModule({
  id: 'style-library',
  activate(ctx) {
    setStyleEventEmitter((name, payload) => ctx.emit(name, payload))
    const styles = getSharedStyles()
    serveContract<StyleLibraryFullApi>(
      ctx,
      createStyleLibraryApi({ styles, dialog: createElectronStyleDialog() })
    )
    void styles.resumePending().catch((error: unknown) => ctx.log.error(String(error)))
  },
  deactivate: () => disposeSharedStyles()
})
