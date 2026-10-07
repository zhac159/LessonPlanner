import { join } from 'node:path'
import { app } from 'electron'
import { defineMainModule, serveContract } from '@main/sdk'
import { createMakeApi } from '@main/services/assets/make'
import { createAppOnlineService, setSharedOnline } from '@main/services/assets/online'
import {
  createAppReviewService,
  createFileDescribeCache,
  setSharedReview
} from '@main/services/assets/review'
import { disposeSharedAssets, getSharedAssets } from '@main/services/assets/service'
import { getContainer } from '@main/services/container'
import { getSharedStyles } from '@main/services/deckBuilder/sharedStyles'
import { createAssetsApi } from './main/api'
import { createElectronAddPicker } from './main/addDialog'
import { createElectronReplaceDialog } from './main/dialog'
import { createReviewApi } from './main/review'
import type { AssetsFullApi } from './shared'

/**
 * Main half of the assets module: thin wiring from the app's ONE AssetsService (also read by the deck-builder), the
 * online service, the review queue (add files, A2), the make-new service and the native file dialogs to the contract.
 */
export default defineMainModule({
  id: 'assets',
  async activate(ctx) {
    const assets = getSharedAssets()
    assets.setStyleNames(async () => {
      const summaries = await getSharedStyles().listSummaries()
      return new Map(summaries.map((s) => [s.id, s.name]))
    })
    assets.onChanged((libraryCount) => ctx.emit('changed', { libraryCount }))
    const report = await assets.init()
    if (report.recovered > 0 || report.setAside > 0) {
      ctx.log.warn(`Library tidied: ${report.recovered} recovered, ${report.setAside} set aside.`)
    }

    const { ai } = getContainer()
    const log = { warn: (message: string) => ctx.log.warn(message) }
    const describeCache = createFileDescribeCache(ctx.dataDir)
    const review = createAppReviewService({
      assets,
      ai,
      dir: ctx.dataDir,
      cache: describeCache,
      emit: (view) => ctx.emit('review:changed', view),
      log
    })
    await review.init()
    setSharedReview(review)
    assets.setPendingReview(() => review.banner())

    const online = createAppOnlineService({
      assets,
      tools: assets.tools,
      dir: join(ctx.dataDir, 'online'),
      fake: process.env.SLIDE_PLANNER_FAKE_AI === '1',
      version: app.getVersion(),
      review,
      log
    })
    setSharedOnline(online)
    void online.prune()

    serveContract<AssetsFullApi>(
      ctx,
      createAssetsApi({
        assets,
        online,
        dialog: createElectronReplaceDialog(),
        review: createReviewApi(review, createElectronAddPicker()),
        make: createMakeApi({
          assets,
          ai,
          emit: (progress) => ctx.emit('make:progress', progress),
          settingsDir: getContainer().settingsDir,
          fake: process.env.SLIDE_PLANNER_FAKE_AI === '1',
          describeCache,
          log
        }),
        warn: log.warn
      })
    )
  },
  deactivate() {
    setSharedReview(null)
    setSharedOnline(null)
    disposeSharedAssets()
  }
})
