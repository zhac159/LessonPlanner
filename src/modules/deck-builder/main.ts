import { app, dialog, shell } from 'electron'
import { defineMainModule, serveContract } from '@main/sdk'
import { readInstalledFonts } from '@main/export/installedFonts'
import { createSlideRendererPort, getSlideRenderer } from '@main/render'
import { getSharedOnline } from '@main/services/assets/online'
import { getSharedMake } from '@main/services/assets/make'
import { getSharedAssets } from '@main/services/assets/service'
import { getContainer } from '@main/services/container'
import { setCurrentDeckBuilder } from '@main/services/deckBuilder/current'
import {
  createDialogPort,
  createFullScreenPort,
  createOpenerPort,
  createTrashPort,
  fromElectronDialog
} from '@main/services/deckBuilder/electronPorts'
import {
  createDeckBuilderServices,
  type DeckBuilderServices
} from '@main/services/deckBuilder/services'
import { createStyleLookup, getSharedStyles } from '@main/services/deckBuilder/sharedStyles'
import { createMadeKeeper } from './main/keepMade'
import { createLessonAssetsPort } from '@main/services/lessons/assetsPort'
import type { EmitEvent } from '@main/services/lessons/types'
import { getMainWindow } from '@main/window'
import type { DeckBuilderApi } from '@shared/contracts/deck-builder'
import { createDeckBuilderApi } from './main/api'

let services: DeckBuilderServices | null = null

/**
 * Main half of the deck-builder module: lessons, generation, editing, chat, plugins and export. All behaviour
 * lives in `src/main/services/*`; this file only plugs Electron (dialogs, Recycle Bin, shell, the offscreen
 * slide renderer) and the shared styles into `createDeckBuilderApi` and serves it.
 */
export default defineMainModule({
  id: 'deck-builder',
  async activate(ctx) {
    const emit: EmitEvent = (name, payload) => ctx.emit(name, payload)
    const installedFonts = new Set<string>()
    // The registry query takes a moment; the export's missing-font warning uses whatever has arrived by then.
    void readInstalledFonts().then((fonts) => fonts?.forEach((f) => installedFonts.add(f)))

    // ONE assets service for the whole app: the deck-builder places, exports and generates with the same library.
    const sharedAssets = getSharedAssets()
    services = await createDeckBuilderServices({
      dir: ctx.dataDir,
      assets: createLessonAssetsPort({
        assets: sharedAssets,
        online: getSharedOnline,
        // "Make one" (placeAsset with a made picture) keeps the chosen version through the picture maker.
        keepMade: createMadeKeeper(getSharedMake, () =>
          sharedAssets.store.list().map((a) => a.name)
        )
      }),
      ai: getContainer().ai,
      styles: createStyleLookup(getSharedStyles()),
      dialogs: createDialogPort({
        dialog: fromElectronDialog(dialog),
        window: getMainWindow,
        documentsDir: () => app.getPath('documents')
      }),
      trash: createTrashPort(shell),
      renderer: createSlideRendererPort(getSlideRenderer()),
      emit,
      installedFonts,
      log: ctx.log
    })
    // Lessons deleted in an earlier run (a crash inside the undo window) go to the Recycle Bin now.
    void services.lessons.finalizeDeletes()
    // "Used in N lessons" and "Suggested for this slide" read the lessons through this small port.
    const { lessons } = services
    sharedAssets.setLessonsPort({
      lessonsUsingAssets: () => lessons.lessonsUsingAssets(),
      slideContext: (lessonId, slideId) => lessons.slideContext(lessonId, slideId)
    })
    serveContract<DeckBuilderApi>(
      ctx,
      createDeckBuilderApi({
        services,
        dir: ctx.dataDir,
        opener: createOpenerPort(shell),
        fullScreen: createFullScreenPort(getMainWindow)
      })
    )
    setCurrentDeckBuilder({ services, emit })
  },
  async deactivate() {
    setCurrentDeckBuilder(null)
    getSharedAssets().setLessonsPort(null)
    await services?.dispose()
    services = null
  }
})
