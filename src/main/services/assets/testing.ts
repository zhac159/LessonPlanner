/** Test-only helpers for the assets services: temp folders, small pictures, a ready service. */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LICENCES } from '@shared/assets/credits'
import type { Asset, AssetKind } from '@shared/assets/types'
import { badgeRaster, photoRaster, pngOf } from '../../import/assets/testRasters'
import { AssetsService, type AssetsServiceDeps } from './service'
import type { NewAsset } from './store'
import { createPureImageTools } from './thumbs'

const made: string[] = []

/** A fresh temp folder, removed by `cleanTemp()` (call it in `afterEach`). */
export async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'assets-'))
  made.push(dir)
  return dir
}

export async function cleanTemp(): Promise<void> {
  await Promise.all(made.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
}

/** A busy picture (distinct per seed) as PNG bytes. */
export const photoPng = (seed: number, width = 80, height = 60): Uint8Array =>
  pngOf(photoRaster(width, height, seed))

/** A logo-like badge on a transparent background. */
export const badgePng = (size = 64): Uint8Array => pngOf(badgeRaster(size))

export const svgBytes = (color = '#1a2f6b', size = 100): Uint8Array =>
  new TextEncoder().encode(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size / 2}"><rect width="${size}" height="${size / 2}" fill="${color}"/></svg>`
  )

export function newAssetInput(name: string, over: Partial<NewAsset> = {}): NewAsset {
  return {
    bytes: photoPng([...name].reduce((n, c) => (n * 31 + c.charCodeAt(0)) | 0, 7)),
    ext: '.png',
    name,
    title: name.replace(/_/g, ' '),
    kind: 'picture' as AssetKind,
    description: '',
    source: { kind: 'uploaded', fileName: `${name}.png`, at: '2026-10-07T09:00:00.000Z' },
    licence: LICENCES.unknown,
    ...over
  }
}

/** An assets service in `dir` with the plain-JS image tools and a steady clock (one second per call). */
export function testService(dir: string, over: Partial<AssetsServiceDeps> = {}): AssetsService {
  let tick = Date.parse('2026-10-07T09:00:00.000Z')
  return new AssetsService({
    dir,
    tools: createPureImageTools(),
    now: () => new Date((tick += 1000)),
    ...over
  })
}

export async function addPicture(
  service: AssetsService,
  name: string,
  over: Partial<NewAsset> = {}
): Promise<Asset> {
  return service.add(newAssetInput(name, over))
}

/** An asset record without any file behind it, for the pure helpers (library lists, suggestions). */
export function fakeAsset(name: string, over: Partial<Asset> = {}): Asset {
  const at = '2026-10-07T09:00:00.000Z'
  return {
    id: `ast_${name}`,
    name,
    title: name.replace(/_/g, ' '),
    kind: 'picture',
    description: '',
    tags: [],
    source: { kind: 'uploaded', fileName: `${name}.png`, at },
    licence: LICENCES.unknown,
    credit: null,
    file: {
      ext: '.png',
      width: 100,
      height: 100,
      bytes: 1000,
      sha256: 'a'.repeat(64),
      phash: null,
      vector: false
    },
    foundIn: [],
    usedIn: [],
    lastUsedAt: null,
    createdAt: at,
    updatedAt: at,
    ...over
  }
}
