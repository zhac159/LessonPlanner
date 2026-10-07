/** A correction may edit her picture habits ("I never use the owl on title slides" removes a placement rule). */
import { describe, expect, it } from 'vitest'
import { fixtureProfile } from '../fake/fixtures'
import { createRig, jsonMessage } from '../testing'
import { defaultDeps, type CallDeps } from './deps'
import { applyStyleCorrection } from './styleProfile'

const depsFor = (script: Parameters<typeof createRig>[0]): CallDeps => ({
  ...defaultDeps(createRig(script).runner),
  now: () => new Date('2026-10-07T10:00:00Z'),
  newId: (prefix) => `${prefix}_x`
})

const withPictures = () => ({
  ...fixtureProfile(),
  pictures: {
    lines: ['A picture on the right of most content slides'],
    slideKinds: [],
    placements: [
      {
        assetId: 'ast_owl',
        slideKind: 'title' as const,
        anchor: 'top-right' as const,
        widthUnits: 200,
        marginUnits: 32,
        decks: 3
      },
      {
        assetId: 'ast_logo',
        slideKind: 'every' as const,
        anchor: 'top-left' as const,
        widthUnits: 160,
        marginUnits: 32,
        decks: 3
      }
    ]
  }
})

describe('applyStyleCorrection and picture habits', () => {
  it('removes one placement rule and keeps the other', async () => {
    const profile = withPictures()
    const deps = depsFor([
      jsonMessage({
        patch: [{ op: 'remove', path: '/pictures/placements/0', valueJson: '' }],
        message: 'No owl on title slides.'
      })
    ])
    const result = await applyStyleCorrection(deps, {
      profile,
      correction: 'I never use the owl on title slides'
    })
    expect(result.profile.pictures?.placements.map((p) => p.assetId)).toEqual(['ast_logo'])
    expect(result.profile.pictures?.lines).toEqual(profile.pictures.lines)
  })

  it('still refuses the profile’s identity and sources', async () => {
    const deps = depsFor([
      jsonMessage({
        patch: [{ op: 'replace', path: '/sources', valueJson: '[]' }],
        message: 'x'
      })
    ])
    await expect(
      applyStyleCorrection(deps, { profile: withPictures(), correction: 'x' })
    ).rejects.toMatchObject({ failure: { code: 'invalid-input' } })
  })
})
