/** LIVE probe: does the structured-output endpoint accept each wire schema? (cheap: grammar errors cost nothing) */
import { describe, expect, it } from 'vitest'
import { analysisWire, objectivesWire, patchWire, planWire } from '../schemas/lesson'
import { slideWire } from '../schemas/slide'
import { styleCore, styleLayouts } from '../schemas/styleDraft'
import { hasKey, probeSchema, SKIP_MESSAGE } from './harness'

const schemas = {
  objectivesWire,
  analysisWire,
  planWire,
  patchWire,
  slideWire,
  styleCore,
  styleLayouts
}

describe.skipIf(!hasKey())('live: structured-output schemas are accepted', () => {
  if (!hasKey()) console.log(SKIP_MESSAGE)
  for (const [name, schema] of Object.entries(schemas)) {
    it(`${name} compiles`, async () => {
      expect(await probeSchema(schema)).toBe('ok')
    })
  }
})
