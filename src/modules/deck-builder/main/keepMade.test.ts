import { describe, expect, it, vi } from 'vitest'
import { fail, ok } from '@shared/result'
import { makeLibrary } from '@main/services/chat/assetsTesting'
import { addPicture, photoPng } from '@main/services/assets/testing'
import { createLessonAssetsPort } from '@main/services/lessons/assetsPort'
import { createMadeKeeper } from './keepMade'
import { makeApiRig, seedFixtureLesson } from './testing'

/** A picture maker whose "keep" saves the picture into the real library, like `MakeService.keepVersion`. */
async function rigWithMaker(maker: { present: boolean }) {
  const lib = await makeLibrary()
  const keepVersion = vi.fn(async (args: { jobId: string; version: number; name: string }) => {
    if (args.jobId !== 'job_1') return fail('not-found', 'That picture is gone. Make it again.')
    const asset = await addPicture(lib.service, args.name, {
      kind: 'diagram',
      title: 'Burner',
      bytes: photoPng(40, 90, 60)
    })
    return ok({ asset })
  })
  const port = createLessonAssetsPort({
    assets: lib.service,
    online: () => null,
    keepMade: createMadeKeeper(
      () => (maker.present ? { keepVersion } : null),
      () => lib.service.store.list().map((a) => a.name)
    )
  })
  const rig = await makeApiRig({ assets: port })
  const lessonId = await seedFixtureLesson(rig)
  return { lib, rig, lessonId, keepVersion }
}

const place = (lessonId: string, source: { jobId: string; version: number; name?: string }) => ({
  lessonId,
  slideId: 's3',
  source: { kind: 'made' as const, ...source },
  target: { kind: 'spot' as const, elementId: 's3-photo' },
  fit: 'fit' as const
})

describe('placeAsset with a made picture (the editor’s "Make one" tab)', () => {
  it('keeps the chosen version through the picture maker, then places it', async () => {
    const { lib, rig, lessonId, keepVersion } = await rigWithMaker({ present: true })
    const placed = await rig.api.placeAsset(
      place(lessonId, { jobId: 'job_1', version: 2, name: 'bunsen_burner' })
    )
    if (!placed.ok) throw new Error(placed.message)
    expect(keepVersion).toHaveBeenCalledWith({ jobId: 'job_1', version: 2, name: 'bunsen_burner' })
    expect(placed.asset.name).toBe('bunsen_burner')
    expect(placed.chat.text).toBe('Added {{bunsen_burner}} to slide 3.')
    expect(lib.service.store.list().some((a) => a.name === 'bunsen_burner')).toBe(true)
  })

  it('names the picture itself when the sheet sent no name', async () => {
    const { rig, lessonId, keepVersion } = await rigWithMaker({ present: true })
    const placed = await rig.api.placeAsset(place(lessonId, { jobId: 'job_1', version: 1 }))
    expect(placed).toMatchObject({ ok: true, asset: { name: 'made_picture' } })
    expect(keepVersion).toHaveBeenCalledWith(expect.objectContaining({ name: 'made_picture' }))
  })

  it('passes the maker’s refusal on in words', async () => {
    const { rig, lessonId } = await rigWithMaker({ present: true })
    expect(
      await rig.api.placeAsset(place(lessonId, { jobId: 'old', version: 1, name: 'x_y' }))
    ).toMatchObject({
      ok: false,
      code: 'not-found',
      message: 'That picture is gone. Make it again.'
    })
  })

  it('says the maker is not ready while the assets module has not started it', async () => {
    const { rig, lessonId } = await rigWithMaker({ present: false })
    expect(
      await rig.api.placeAsset(place(lessonId, { jobId: 'job_1', version: 1, name: 'x_y' }))
    ).toMatchObject({ ok: false, code: 'io' })
  })
})
