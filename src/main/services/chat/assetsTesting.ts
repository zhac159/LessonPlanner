/** Test-only: a real assets service on a temp folder with a small library, wrapped in the lessons' port. */
import { LICENCES } from '@shared/assets/credits'
import type { Asset, AssetCredit } from '@shared/assets/types'
import { fail, ok } from '@shared/result'
import { AssetsService } from '../assets/service'
import { addPicture, badgePng, photoPng, svgBytes, testService } from '../assets/testing'
import { createLessonAssetsPort, type LessonAssetsPort } from '../lessons/assetsPort'
import { tempDir } from '../lessons/testing'

export const ONLINE_CREDIT: AssetCredit = {
  text: 'Leaf in sunlight by Ada Green (CC BY 4.0) via Openverse',
  inNotes: true,
  provider: 'openverse',
  author: 'Ada Green',
  title: 'Leaf in sunlight',
  pageUrl: null,
  licenceUrl: null
}

export interface Library {
  service: AssetsService
  port: LessonAssetsPort
  /** A logo, a described leaf photo, a symbol card and an SVG diagram. */
  logo: Asset
  leaf: Asset
  card: Asset
  diagram: Asset
  /** Online result ids the fake online service can save: `res_leaf` (CC BY, needs a credit). */
  savedOnline: string[]
}

/** The assets of a small teacher's library, in the shape the spec's examples use. */
export async function makeLibrary(): Promise<Library> {
  const service = testService(tempDir())
  await service.init()
  const logo = await addPicture(service, 'school_logo', {
    kind: 'logo',
    title: 'School logo',
    description: 'Navy school crest with a gold star, used top-right on title slides.',
    tags: ['logo', 'school'],
    bytes: badgePng(256)
  })
  const leaf = await addPicture(service, 'leaf_photo', {
    kind: 'photo',
    title: 'Leaf photo',
    description: 'A green leaf in sunlight, close up.',
    tags: ['leaf', 'plant', 'photosynthesis'],
    bytes: photoPng(3, 120, 80)
  })
  const card = await addPicture(service, 'happy_card', {
    kind: 'symbol-card',
    title: 'Happy symbol card',
    description: 'A word card: happy, with a smiling face in a blue rounded border.',
    tags: ['symbol', 'feelings'],
    bytes: photoPng(9, 80, 80)
  })
  const diagram = await addPicture(service, 'water_cycle', {
    kind: 'diagram',
    title: 'Water cycle',
    description: 'A labelled diagram of the water cycle.',
    tags: ['water', 'diagram'],
    bytes: svgBytes('#2a6fb0', 200),
    ext: '.svg'
  })
  const savedOnline: string[] = []
  const port = createLessonAssetsPort({
    assets: service,
    online: () => ({
      async saveResult(resultId) {
        if (resultId !== 'res_leaf')
          return fail('not-found', 'That search result has expired. Search again.')
        savedOnline.push(resultId)
        const asset = await addPicture(service, 'sunlit_leaf', {
          kind: 'photo',
          title: 'Leaf in sunlight',
          description: 'A leaf in sunlight.',
          bytes: photoPng(21, 100, 70),
          licence: LICENCES['cc-by'],
          credit: ONLINE_CREDIT,
          source: { kind: 'online', provider: 'openverse', at: '2026-10-07T09:00:00.000Z' }
        })
        return ok({ asset, created: true })
      }
    })
  })
  return { service, port, logo, leaf, card, diagram, savedOnline }
}
