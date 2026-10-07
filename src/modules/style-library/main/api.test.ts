import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it, vi } from 'vitest'
import { fail, ok } from '@shared/result'
import { createStyleLibraryApi, type StylesPort } from './api'

const dir = tmpdir()
const pdf = join(dir, 'a.pdf')
const pptx = join(dir, 'b.pptx')

function setup(picked?: string[]) {
  const styles = {
    listSummaries: vi.fn(async () => []),
    get: vi.fn(async () => fail('not-found', 'Style not found')),
    createDraft: vi.fn(async (paths: string[]) =>
      ok({ styleId: 'sty_1', added: paths.length, rejected: [] })
    ),
    addFiles: vi.fn(async (_id: string, paths: string[]) =>
      ok({ added: paths.length, rejected: [] })
    ),
    removeFile: vi.fn(async () => ok({ undoToken: 'f1' })),
    restoreFile: vi.fn(async () => ok()),
    retryFile: vi.fn(async () => ok()),
    resume: vi.fn(async () => ok()),
    update: vi.fn(async () => fail('not-found', 'Style not found')),
    correct: vi.fn(async () => ok({ message: 'Got it', version: 2 })),
    save: vi.fn(async () => fail('invalid-input', 'Learn at least one file first')),
    delete: vi.fn(async () => ok())
  } satisfies StylesPort
  const dialog = { pickFiles: vi.fn(async () => picked) }
  return { styles, dialog, api: createStyleLibraryApi({ styles, dialog }) }
}

describe('pickFiles', () => {
  it('reports a cancelled dialog and adds nothing', async () => {
    const { api, styles } = setup(undefined)
    expect(await api.pickFiles({ styleId: 's1' })).toEqual({ ok: true, cancelled: true })
    expect(styles.addFiles).not.toHaveBeenCalled()
  })

  it('treats an empty selection as cancelled', async () => {
    const { api } = setup([])
    expect(await api.pickFiles({ styleId: 's1' })).toEqual({ ok: true, cancelled: true })
  })

  it('adds the chosen files', async () => {
    const { api, styles } = setup([pdf, pptx])
    expect(await api.pickFiles({ styleId: 's1' })).toEqual({ ok: true, added: 2, rejected: [] })
    expect(styles.addFiles).toHaveBeenCalledWith('s1', [pdf, pptx])
  })
})

describe('pickAndCreateDraft', () => {
  it('creates nothing when the dialog is cancelled', async () => {
    const { api, styles } = setup(undefined)
    expect(await api.pickAndCreateDraft()).toEqual({ ok: true, cancelled: true })
    expect(styles.createDraft).not.toHaveBeenCalled()
  })

  it('creates a draft from the chosen files', async () => {
    const { api } = setup([pdf])
    expect(await api.pickAndCreateDraft()).toMatchObject({ ok: true, styleId: 'sty_1', added: 1 })
  })
})

describe('addFiles and createDraft path checks', () => {
  it('refuses something that is not a list of paths', async () => {
    const { api, styles } = setup()
    const result = await api.addFiles({ styleId: 's1', paths: 'C:\\x.pdf' as unknown as string[] })
    expect(result).toMatchObject({ ok: false, code: 'invalid-input' })
    expect(styles.addFiles).not.toHaveBeenCalled()
  })

  it('rejects relative and non-string entries and passes the good ones on', async () => {
    const { api, styles } = setup()
    const result = await api.addFiles({
      styleId: 's1',
      paths: [pdf, 'relative/deck.pdf', 42 as unknown as string, pdf]
    })
    expect(styles.addFiles).toHaveBeenCalledWith('s1', [pdf])
    expect(result).toEqual({
      ok: true,
      added: 1,
      rejected: [
        { name: 'deck.pdf', reason: 'type' },
        { name: '', reason: 'type' }
      ]
    })
  })

  it('does not call the service when every path is invalid', async () => {
    const { api, styles } = setup()
    const result = await api.addFiles({ styleId: 's1', paths: ['nope.pdf'] })
    expect(result).toEqual({ ok: true, added: 0, rejected: [{ name: 'nope.pdf', reason: 'type' }] })
    expect(styles.addFiles).not.toHaveBeenCalled()
  })

  it('refuses a huge list', async () => {
    const { api } = setup()
    const paths = Array.from({ length: 501 }, (_, i) => join(dir, `f${i}.pdf`))
    expect(await api.addFiles({ styleId: 's1', paths })).toMatchObject({ ok: false })
  })

  it('fails createDraft without valid paths and creates nothing', async () => {
    const { api, styles } = setup()
    expect(await api.createDraft({ paths: ['x.pdf'] })).toMatchObject({
      ok: false,
      code: 'invalid-input'
    })
    expect(styles.createDraft).not.toHaveBeenCalled()
  })

  it('creates a draft from valid dropped paths', async () => {
    const { api, styles } = setup()
    expect(await api.createDraft({ paths: [pptx] })).toMatchObject({ ok: true, styleId: 'sty_1' })
    expect(styles.createDraft).toHaveBeenCalledWith([pptx])
  })
})

describe('argument checks', () => {
  it('refuses calls without a style id', async () => {
    const { api, styles } = setup()
    const bad = { styleId: '' }
    for (const result of [
      await api.get(bad),
      await api.save(bad),
      await api.resume(bad),
      await api.deleteStyle(bad),
      await api.removeFile({ ...bad, fileId: 'f' }),
      await api.pickFiles(bad)
    ]) {
      expect(result).toMatchObject({ ok: false, code: 'invalid-input' })
    }
    expect(styles.get).not.toHaveBeenCalled()
    expect(styles.delete).not.toHaveBeenCalled()
  })

  it('refuses a file call without a file id', async () => {
    const { api, styles } = setup()
    const args = { styleId: 's1' } as { styleId: string; fileId: string }
    expect(await api.restoreFile(args)).toMatchObject({ ok: false })
    expect(await api.retryFile(args)).toMatchObject({ ok: false })
    expect(styles.restoreFile).not.toHaveBeenCalled()
  })

  it('refuses a rename that is not text and a default flag that is not a boolean', async () => {
    const { api, styles } = setup()
    expect(await api.update({ styleId: 's1', name: 5 as unknown as string })).toMatchObject({
      ok: false
    })
    expect(
      await api.update({ styleId: 's1', isDefault: 'yes' as unknown as boolean })
    ).toMatchObject({ ok: false })
    expect(styles.update).not.toHaveBeenCalled()
  })

  it('refuses a correction that is not text', async () => {
    const { api, styles } = setup()
    expect(await api.correct({ styleId: 's1', text: 1 as unknown as string })).toMatchObject({
      ok: false
    })
    expect(styles.correct).not.toHaveBeenCalled()
  })
})

describe('pass-through', () => {
  it('forwards valid calls to the service', async () => {
    const { api, styles } = setup()
    await api.get({ styleId: 's1' })
    await api.update({ styleId: 's1', name: 'Maths', isDefault: true })
    await api.correct({ styleId: 's1', text: 'less yellow' })
    await api.retryFile({ styleId: 's1', fileId: 'f1' })
    await api.restoreFile({ styleId: 's1', fileId: 'f1' })
    await api.resume({ styleId: 's1' })
    await api.deleteStyle({ styleId: 's1' })
    expect(styles.update).toHaveBeenCalledWith('s1', { name: 'Maths', isDefault: true })
    expect(styles.correct).toHaveBeenCalledWith('s1', 'less yellow')
    expect(styles.retryFile).toHaveBeenCalledWith('s1', 'f1')
    expect(styles.delete).toHaveBeenCalledWith('s1')
  })

  it('removeFile drops the undo token (the file id is the token)', async () => {
    const { api } = setup()
    expect(await api.removeFile({ styleId: 's1', fileId: 'f1' })).toEqual({ ok: true })
  })

  it('lists styles', async () => {
    const { api } = setup()
    expect(await api.list()).toEqual([])
  })
})
