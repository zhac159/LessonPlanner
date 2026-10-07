import { describe, expect, it } from 'vitest'
import {
  ACTION_DURATION_MS,
  DEFAULT_DURATION_MS,
  MAX_TOASTS,
  createToast,
  pushToast,
  removeToast
} from './toastState'

describe('createToast', () => {
  it('uses the default duration without an action', () => {
    expect(createToast('a', { message: 'Saved' }).durationMs).toBe(DEFAULT_DURATION_MS)
  })

  it('gives toasts with an action longer', () => {
    const toast = createToast('a', { message: 'Removed', action: { label: 'Undo', onAction() {} } })
    expect(toast.durationMs).toBe(ACTION_DURATION_MS)
  })

  it('respects an explicit duration', () => {
    expect(createToast('a', { message: 'x', durationMs: 123 }).durationMs).toBe(123)
  })
})

describe('pushToast / removeToast', () => {
  it('keeps at most MAX_TOASTS, dropping the oldest', () => {
    let list = [] as ReturnType<typeof pushToast>
    for (let i = 0; i < MAX_TOASTS + 2; i++)
      list = pushToast(list, createToast(`t${i}`, { message: 'm' }))
    expect(list).toHaveLength(MAX_TOASTS)
    expect(list[0]!.id).toBe('t2')
    expect(list.at(-1)!.id).toBe(`t${MAX_TOASTS + 1}`)
  })

  it('does not mutate its input', () => {
    const list = [createToast('a', { message: 'm' })]
    pushToast(list, createToast('b', { message: 'm' }))
    expect(list).toHaveLength(1)
  })

  it('removes by id and ignores unknown ids', () => {
    const list = [createToast('a', { message: 'm' }), createToast('b', { message: 'm' })]
    expect(removeToast(list, 'a').map((t) => t.id)).toEqual(['b'])
    expect(removeToast(list, 'zzz')).toHaveLength(2)
  })
})
