/**
 * Writes the two seed styles in the style-library module's own folder layout (profile.json, meta.json and one
 * analysis per learned deck), so the styles service loads them as saved, learned styles.
 */
import { join } from 'node:path'
import { makeAnalysis } from '@shared/style/testing'
import type { StyleProfile } from '@shared/style/types'
import { emptyMeta } from '../services/styles/metaSchema'
import { StyleStore } from '../services/styles/store'
import type { StyleMeta } from '../services/styles/types'
import { formStyle, scienceStyle } from './seedData'

/** `<dataRoot>/modules/style-library`: where StylesService keeps its styles. */
export const styleLibraryDir = (dataRoot: string): string =>
  join(dataRoot, 'modules', 'style-library')

function metaFor(profile: StyleProfile): StyleMeta {
  return {
    ...emptyMeta(),
    nameSource: 'user',
    saved: true,
    synthesised: true,
    hasSynthesis: true,
    files: Object.fromEntries(
      profile.sources.map((s) => [
        s.id,
        { fileName: s.fileName, kind: s.kind, addedAt: s.addedAt, hash: '', mayContainNames: false }
      ])
    )
  }
}

/** Saves "Science KS3" (default) and "Form time". Returns the styles that were written. */
export async function writeSeedStyles(
  dataRoot: string,
  scienceFixture: StyleProfile,
  now: Date
): Promise<StyleProfile[]> {
  const store = new StyleStore(styleLibraryDir(dataRoot), () => now.toISOString())
  const styles = [scienceStyle(scienceFixture, now), formStyle(scienceFixture, now)]
  for (const profile of styles) {
    await store.save({ profile, meta: metaFor(profile), analyses: new Map() })
    for (const source of profile.sources)
      await store.writeAnalysis(profile.id, source.id, makeAnalysis())
  }
  return styles
}
