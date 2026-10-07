import { suggestAssetName } from '@shared/assets/names'
import type { Asset } from '@shared/assets/types'
import { fail, type Result } from '@shared/result'
import type { MakeService } from '@main/services/assets/make/service'
import type { LessonAssetsPort } from '@main/services/lessons/assetsPort'

const NOT_READY = 'The picture maker isn’t ready yet. Try again in a moment.'

/**
 * `LessonAssetsPort.keepMade` over the picture maker: "Make one" in the editor's picture-spot and circle sheets
 * places the version she picked, so it is saved into the library first (agents/ASSETS.md §4.2).
 *
 * The maker is looked up on every call, because the assets module may start after the deck-builder.
 * Without a name (the sheet normally sends one) the picture gets `made_picture`, `made_picture_2`…
 */
export function createMadeKeeper(
  make: () => Pick<MakeService, 'keepVersion'> | null,
  takenNames: () => Iterable<string>
): NonNullable<LessonAssetsPort['keepMade']> {
  return async (jobId, version, name): Promise<Result<{ asset: Asset }>> => {
    const service = make()
    if (!service) return fail('io', NOT_READY)
    const kept = await service.keepVersion({
      jobId,
      version,
      name: name?.trim() || suggestAssetName('made picture', takenNames())
    })
    return kept.ok ? { ok: true, asset: kept.asset } : kept
  }
}
