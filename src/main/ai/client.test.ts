import { describe, expect, it, vi } from 'vitest'
import { createClientProvider, createSdkClient } from './client'
import type { ClaudeClient } from './sdk'

describe('createClientProvider', () => {
  it('reads the key on every acquire (never caches it)', async () => {
    const getApiKey = vi.fn().mockReturnValueOnce('sk-ant-one').mockReturnValueOnce('sk-ant-two')
    const created: string[] = []
    const provider = createClientProvider({
      getApiKey,
      getModel: () => 'claude-opus-5-5',
      createClient: (key) => {
        created.push(key)
        return {} as ClaudeClient
      }
    })
    await provider.acquire()
    await provider.acquire()
    expect(created).toEqual(['sk-ant-one', 'sk-ant-two'])
  })

  it('supports async key lookup and reports the current model each time', async () => {
    let model: 'claude-opus-5-5' | 'claude-sonnet-5-5' = 'claude-opus-5-5'
    const provider = createClientProvider({
      getApiKey: async () => 'sk-ant-x',
      getModel: () => model,
      createClient: () => ({}) as ClaudeClient
    })
    await expect(provider.acquire()).resolves.toBeDefined()
    expect(provider.model()).toBe('claude-opus-5-5')
    model = 'claude-sonnet-5-5'
    expect(provider.model()).toBe('claude-sonnet-5-5')
  })

  it('throws no-key when there is no key', async () => {
    const provider = createClientProvider({
      getApiKey: () => null,
      getModel: () => 'claude-opus-5-5'
    })
    await expect(provider.acquire()).rejects.toMatchObject({ failure: { code: 'no-key' } })
  })
})

describe('createSdkClient', () => {
  it('builds a real SDK client exposing the beta messages API', () => {
    const client = createSdkClient('sk-ant-test')
    expect(typeof client.beta.messages.create).toBe('function')
    expect(typeof client.beta.messages.stream).toBe('function')
  })
})
