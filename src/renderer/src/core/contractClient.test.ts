import { describe, expect, it, vi } from 'vitest'
import { contractClient } from './contractClient'

interface DemoApi {
  greet(name: string): { text: string }
  'jobs:cancel'(id: string): void
}

describe('contractClient', () => {
  it('turns method calls into invoke(channel, ...args) and returns its promise', async () => {
    const invoke = vi.fn(async () => ({ text: 'Hi Ada' }))
    const client = contractClient<DemoApi>({ invoke: invoke as never })
    await expect(client.greet('Ada')).resolves.toEqual({ text: 'Hi Ada' })
    expect(invoke).toHaveBeenCalledWith('greet', 'Ada')
  })

  it('supports colon channel names', async () => {
    const invoke = vi.fn(async () => undefined)
    const client = contractClient<DemoApi>({ invoke: invoke as never })
    await client['jobs:cancel']('j1')
    expect(invoke).toHaveBeenCalledWith('jobs:cancel', 'j1')
  })

  it('propagates rejections', async () => {
    const client = contractClient<DemoApi>({
      invoke: (async () => {
        throw new Error('No handler')
      }) as never
    })
    await expect(client.greet('x')).rejects.toThrow('No handler')
  })

  it('returns the same function for the same method (stable identity)', () => {
    const client = contractClient<DemoApi>({ invoke: vi.fn() as never })
    expect(client.greet).toBe(client.greet)
  })

  it('is not thenable and ignores symbols', async () => {
    const client = contractClient<DemoApi>({ invoke: vi.fn() as never })
    expect((client as unknown as { then?: unknown }).then).toBeUndefined()
    expect((client as unknown as Record<symbol, unknown>)[Symbol.iterator]).toBeUndefined()
    expect(await Promise.resolve(client)).toBe(client)
    expect('then' in client).toBe(false)
  })
})
