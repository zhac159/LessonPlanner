/** The design fixtures the fake AI answers from (design/fixtures/). Parsed and validated once, cloned per use. */
import type { Deck, Slide } from '@shared/deck/types'
import { parseStyleProfile } from '@shared/style/schema'
import type { StyleProfile } from '@shared/style/types'
import deckJson from '../../../../design/fixtures/deck.photosynthesis.json'
import profileJson from '../../../../design/fixtures/style-profile.science-ks3.json'

let profile: StyleProfile | undefined

/** A fresh copy of the "Science KS3" fixture profile. */
export function fixtureProfile(): StyleProfile {
  profile ??= parseStyleProfile(profileJson)
  return structuredClone(profile)
}

/** A fresh copy of the "Y8 Photosynthesis" fixture deck. */
export const fixtureDeck = (): Deck => structuredClone(deckJson) as unknown as Deck

/** A fresh copy of fixture slide `index` (0-based). */
export const fixtureSlide = (index: number): Slide => fixtureDeck().slides[index]
