import { describe, expect, it } from 'vitest'
import { DECK_BUILDER_METHODS } from '@shared/contracts/deck-builder'
import { serveContract } from '@main/sdk'
import { makeApiRig } from './testing'

describe('the deck-builder contract is fully implemented', () => {
  it('has a function for every method name, and nothing else', async () => {
    const { api } = await makeApiRig()
    const implemented = Object.entries(api)
      .filter(([, member]) => typeof member === 'function')
      .map(([name]) => name)
    expect(implemented.sort()).toEqual([...DECK_BUILDER_METHODS].sort())
  })

  it('registers one handler per method through serveContract (own properties only)', async () => {
    const { api } = await makeApiRig()
    const channels: string[] = []
    serveContract({ handle: (channel) => void channels.push(channel) }, api)
    expect(channels.sort()).toEqual([...DECK_BUILDER_METHODS].sort())
  })

  it('names the new restoreLesson method and keeps the chat: and plugins: prefixes', () => {
    expect(DECK_BUILDER_METHODS).toContain('restoreLesson')
    expect(DECK_BUILDER_METHODS).toContain('chat:send')
    expect(DECK_BUILDER_METHODS).toContain('plugins:run')
  })
})
