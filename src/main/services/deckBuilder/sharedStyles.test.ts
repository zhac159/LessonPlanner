import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StyleProfileView } from '@shared/contracts/style-library'
import { fixtureStyle } from '@shared/deck/testing'
import { fail, ok } from '@shared/result'
import { createFakeAiService } from '../../ai/fake'
import { setContainer, type Container } from '../container'
import { setDataRoot } from '../paths'
import { tempDir } from '../lessons/testing'
import {
  createStyleLookup,
  disposeSharedStyles,
  getSharedStyles,
  setStyleEventEmitter
} from './sharedStyles'

afterEach(async () => {
  await disposeSharedStyles()
  setContainer(null)
})

describe('createStyleLookup', () => {
  const view = { name: 'Science KS3' } as unknown as StyleProfileView
  const lookup = createStyleLookup({
    getProfile: async (id) => (id === 'sty_1' ? fixtureStyle() : undefined),
    get: async (id) =>
      id === 'sty_1' ? ok({ style: { profile: view } as never }) : fail('not-found', 'no')
  })

  it('serves a profile by id and undefined for an unknown one', async () => {
    expect((await lookup.getProfile('sty_1'))?.name).toBe('Science KS3')
    expect(await lookup.getProfile('sty_x')).toBeUndefined()
  })

  it('serves the editor view; null for the plain style and for unknown styles', async () => {
    expect(await lookup.viewOf('sty_1')).toBe(view)
    expect(await lookup.viewOf(null)).toBeNull()
    expect(await lookup.viewOf('sty_x')).toBeNull()
  })
})

describe('getSharedStyles', () => {
  function useTempRoot(): void {
    setDataRoot(tempDir())
    setContainer({ ai: createFakeAiService() } as unknown as Container)
  }

  it('is ONE instance until disposed', async () => {
    useTempRoot()
    const first = getSharedStyles()
    expect(getSharedStyles()).toBe(first)
    await disposeSharedStyles()
    expect(getSharedStyles()).not.toBe(first)
  })

  it('forwards the styles events to the emitter the style-library module registers', async () => {
    useTempRoot()
    const seen = vi.fn()
    setStyleEventEmitter(seen)
    const styles = getSharedStyles()
    const { styleId } = await styles.create('Form time')
    expect(await styles.getProfile(styleId)).toMatchObject({ name: 'Form time' })
    expect(seen).toHaveBeenCalledWith('changed', expect.any(Array))
  })

  it('drops events quietly while nobody listens', async () => {
    useTempRoot()
    await expect(getSharedStyles().create('Quiet')).resolves.toHaveProperty('styleId')
  })
})
