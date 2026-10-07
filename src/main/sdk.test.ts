import { describe, expect, it, vi } from 'vitest'
import type { ContractImpl } from '@shared/contract'
import { serveContract } from './sdk'

interface DemoApi {
  greet(name: string): { text: string }
  slow(n: number): number
  'jobs:cancel'(id: string): void
}

function fakeCtx() {
  const handlers = new Map<string, (...args: unknown[]) => unknown>()
  return {
    handlers,
    ctx: {
      handle: (channel: string, handler: (...args: never[]) => unknown) => {
        handlers.set(channel, handler as (...args: unknown[]) => unknown)
      }
    }
  }
}

describe('serveContract', () => {
  it('registers one handler per method, named after the method', () => {
    const { ctx, handlers } = fakeCtx()
    serveContract<DemoApi>(ctx, {
      greet: (name) => ({ text: `Hi ${name}` }),
      slow: async (n) => n * 2,
      'jobs:cancel': () => undefined
    })
    expect([...handlers.keys()].sort()).toEqual(['greet', 'jobs:cancel', 'slow'])
    expect(handlers.get('greet')?.('Ada')).toEqual({ text: 'Hi Ada' })
  })

  it('passes every argument through and keeps async results', async () => {
    const { ctx, handlers } = fakeCtx()
    const slow = vi.fn(async (n: number) => n * 2)
    serveContract<Pick<DemoApi, 'slow'>>(ctx, { slow })
    await expect(handlers.get('slow')?.(21)).resolves.toBe(42)
    expect(slow).toHaveBeenCalledWith(21)
  })

  it('calls methods with this bound to the implementation', () => {
    const { ctx, handlers } = fakeCtx()
    const impl: ContractImpl<Pick<DemoApi, 'greet'>> & { prefix: string } = {
      prefix: 'Hello',
      greet(this: { prefix: string }, name: string) {
        return { text: `${this.prefix} ${name}` }
      }
    }
    serveContract<Pick<DemoApi, 'greet'>>(ctx, impl)
    expect(handlers.get('greet')?.('Ada')).toEqual({ text: 'Hello Ada' })
  })

  it('skips non-function members and inherited helpers', () => {
    const { ctx, handlers } = fakeCtx()
    class Impl {
      greet = (name: string) => ({ text: name })
      helper(): void {}
    }
    serveContract<Pick<DemoApi, 'greet'>>(ctx, new Impl())
    expect([...handlers.keys()]).toEqual(['greet'])
  })

  it('lets a registration error propagate (duplicate channel)', () => {
    const ctx = {
      handle: () => {
        throw new Error('already registered')
      }
    }
    expect(() => serveContract<Pick<DemoApi, 'slow'>>(ctx, { slow: (n) => n })).toThrow(
      'already registered'
    )
  })
})
