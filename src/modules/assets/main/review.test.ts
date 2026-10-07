import { describe, expect, it, vi } from 'vitest'
import { fail, ok } from '@shared/result'
import { cleanReviewEdit, createReviewApi, type ReviewPort } from './review'

function setup(paths?: string[]) {
  const review: ReviewPort = {
    view: vi.fn(() => ({
      batches: [],
      candidates: [],
      found: 0,
      keeping: 0,
      leftOut: 0,
      stillReading: 0
    })),
    addPaths: vi.fn(async () => ok({ batchId: 'b1', accepted: 1, rejected: [] })),
    edit: vi.fn(async () => fail('not-found', 'gone')),
    accept: vi.fn(async () => ok({ added: [] })),
    dismiss: vi.fn(async () => ok()),
    retryFile: vi.fn(() => ok())
  }
  const api = createReviewApi(review, { pickPaths: async () => paths })
  return { review, api }
}

describe('cleanReviewEdit', () => {
  it('keeps only fields of the right type', () => {
    expect(
      cleanReviewEdit({ candidateId: 'c1', name: 'owl', kind: 'icon', keep: true, extra: 1 })
    ).toEqual({ candidateId: 'c1', name: 'owl', kind: 'icon', keep: true })
  })

  it.each([
    null,
    {},
    { candidateId: '' },
    { candidateId: 'c1', name: 3 },
    { candidateId: 'c1', kind: 'sticker' },
    { candidateId: 'c1', keep: 'yes' }
  ])('refuses %j', (raw) => {
    expect(cleanReviewEdit(raw)).toBeNull()
  })
})

describe('the add and review handlers', () => {
  it('does nothing when the file dialog is cancelled', async () => {
    const { api, review } = setup(undefined)
    expect(await api['add:pick']()).toEqual({ ok: true, cancelled: true })
    expect(review.addPaths).not.toHaveBeenCalled()
  })

  it('adds the files she chose or dropped', async () => {
    const { api, review } = setup(['C:\\a.pdf'])
    expect(await api['add:pick']()).toMatchObject({ ok: true, batchId: 'b1' })
    expect(await api['add:paths']({ paths: ['C:\\b.png'] })).toMatchObject({ ok: true })
    expect(vi.mocked(review.addPaths).mock.calls).toEqual([[['C:\\a.pdf']], [['C:\\b.png']]])
  })

  it('refuses a request that is not a list of paths', async () => {
    const { api, review } = setup()
    for (const bad of [undefined, {}, { paths: [] }, { paths: [3] }, { paths: [''] }]) {
      expect(await api['add:paths'](bad as never)).toMatchObject({
        ok: false,
        code: 'invalid-input'
      })
    }
    expect(review.addPaths).not.toHaveBeenCalled()
  })

  it('passes edits, accept and dismiss on, checking the request first', async () => {
    const { api, review } = setup()
    expect(api['review:get']()).toMatchObject({ found: 0 })
    expect(await api['review:edit']({ candidateId: 'c1', keep: false })).toMatchObject({
      ok: false
    })
    expect(review.edit).toHaveBeenCalledWith({ candidateId: 'c1', keep: false })
    expect(await api['review:edit']({} as never)).toMatchObject({ code: 'invalid-input' })

    await api['review:accept']({})
    await api['review:accept']({ batchId: 'b1' })
    expect(vi.mocked(review.accept).mock.calls).toEqual([[undefined], ['b1']])
    expect(await api['review:accept']({ batchId: 5 } as never)).toMatchObject({ ok: false })

    expect(await api['review:dismiss']({ batchId: 'b1' })).toMatchObject({ ok: true })
    expect(await api['review:dismiss']({} as never)).toMatchObject({ code: 'invalid-input' })
    expect(await api['review:retry']({ batchId: 'b1', fileId: 'f1' })).toMatchObject({ ok: true })
    expect(review.retryFile).toHaveBeenCalledWith('b1', 'f1')
    expect(await api['review:retry']({ batchId: 'b1' } as never)).toMatchObject({
      code: 'invalid-input'
    })
    expect(await api['review:retry'](undefined as never)).toMatchObject({ code: 'invalid-input' })
  })
})
