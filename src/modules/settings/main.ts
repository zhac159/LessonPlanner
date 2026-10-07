import { defineMainModule, serveContract } from '@main/sdk'
import { getContainer } from '@main/services/container'
import { KeyStore, createSafeStorageEncryptor } from '@main/services/keyStore'
import { createPictureMakerApi } from '@main/services/settingsModule/createPictureMakerApi'
import { createSettingsApi } from '@main/services/settingsModule/createSettingsApi'
import { fakeGoogleFetch } from '@main/services/settingsModule/googleCheck'
import { createPictureMakerStore } from '@main/services/settingsModule/pictureMakerStore'
import { createPreferencesStore } from '@main/services/settingsModule/preferences'
import type { SettingsApi } from '@shared/contracts/settings'

/** Main half of the settings module: thin wiring from the shared container to `SettingsApi`. */
export default defineMainModule({
  id: 'settings',
  activate(ctx) {
    const { settings, keyStore, ai, usage, settingsDir } = getContainer()
    const fake = process.env.SLIDE_PLANNER_FAKE_AI === '1'
    serveContract<SettingsApi>(ctx, {
      ...createSettingsApi({
        settings,
        keyStore,
        ai,
        usage,
        preferences: createPreferencesStore(ctx.dataDir),
        emit: (status) => ctx.emit('aiStatusChanged', status)
      }),
      ...createPictureMakerApi({
        store: createPictureMakerStore(settingsDir),
        keyStore: new KeyStore({
          dataDir: settingsDir,
          encryptor: createSafeStorageEncryptor(),
          name: 'google'
        }),
        fetchFn: fake ? fakeGoogleFetch : (url, init) => fetch(url, init),
        emit: (status) => ctx.emit('pictureMakerStatusChanged', status)
      })
    })
  }
})
