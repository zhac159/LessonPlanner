/** LIVE checks a, b, i: connection, objectives extraction, error mapping. Run: npm run test:live -- basic */
import { describe, expect, it } from 'vitest'
import { createLiveService, hasKey, saveArtifact, SKIP_MESSAGE, unwrap } from './harness'

describe.skipIf(!hasKey())('live: connection, objectives, errors', () => {
  if (!hasKey()) console.log(SKIP_MESSAGE)

  it('a) testConnection works', async () => {
    const ai = createLiveService()
    const result = unwrap(await ai.testConnection(), 'testConnection')
    expect(result.model).toBe('claude-sonnet-5-5')
    expect(result.latencyMs).toBeGreaterThan(0)
  })

  it('b) extractObjectives reads three pasted objectives', async () => {
    const ai = createLiveService()
    const { extracted } = unwrap(
      await ai.extractObjectives({
        text: [
          'Y8 Science: Photosynthesis (Biology), 50 minute lesson.',
          'LO1: Describe the word equation for photosynthesis.',
          'LO2: Explain why plants need light, carbon dioxide and water.',
          'LO3: Investigate how light intensity affects the rate of photosynthesis.',
          'Common misconception: plants get their food from the soil.'
        ].join('\n')
      }),
      'extractObjectives'
    )
    saveArtifact('b-objectives.json', extracted)
    expect(extracted.objectives).toHaveLength(3)
    expect(extracted.yearGroup ?? '').toMatch(/8/)
    expect(extracted.objectives[0]).toMatch(/word equation/i)
  })

  it('i) an invalid key maps to invalid-key with the friendly message', async () => {
    const ai = createLiveService({ apiKey: 'sk-ant-api03-this-is-a-fake-key-for-testing' })
    const result = await ai.testConnection()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('invalid-key')
      expect(result.message.length).toBeGreaterThan(10)
      console.log('[live] i) message:', result.message)
    }
  })
})
