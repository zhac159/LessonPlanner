/** The app's real review queue and library as the style's picture ports (loaded on demand: only the running app has them). */
import type { AssetsService } from '../assets/service'
import { NO_PORTS, type PictureAssetsPort, type PicturePorts } from './habits'

/** Adapts the assets service to what a style needs from the library. */
export function assetsPort(service: AssetsService): PictureAssetsPort {
  return {
    findBySha: (sha) => service.findBySha(sha),
    getAsset: (id) => service.getAsset(id),
    fromStyle: (styleId) =>
      service.store
        .list()
        .filter((a) => a.source.kind === 'extracted' && a.source.styleId === styleId),
    chips: (refs) => service.chips(refs)
  }
}

/** The running app's ports; none while the assets module has not set up the review queue (tests, startup). */
export async function defaultPorts(): Promise<PicturePorts> {
  const { getSharedReview } = await import('../assets/review')
  const review = getSharedReview()
  if (!review) return NO_PORTS
  const { getSharedAssets } = await import('../assets/service')
  return { review, assets: assetsPort(getSharedAssets()) }
}
