import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fixtureDeck } from '@shared/deck/testing'
import { makeRig, seedLesson, writeTemp } from './testing'

describe('LO documents (inbox)', () => {
  it('imports a dropped Word document with a generated id and keeps its name', async () => {
    const rig = makeRig()
    const path = await writeTemp('Photosynthesis LOs.docx', 'doc-bytes')
    const imported = await rig.service.files.importLoDocument(path)
    if (!imported.ok) throw new Error(imported.message)
    expect(imported.document).toMatchObject({
      name: 'Photosynthesis LOs.docx',
      kind: 'docx',
      sizeBytes: 9
    })
    expect(imported.document.id).toMatch(/^ast_/)
    const found = await rig.service.files.findDocument(imported.document.id)
    expect(Buffer.from(found?.bytes ?? []).toString()).toBe('doc-bytes')
  })

  it('rejects other kinds, pictures and missing files', async () => {
    const rig = makeRig()
    const txt = await rig.service.files.importLoDocument(await writeTemp('notes.txt'))
    expect(txt).toMatchObject({ ok: false, code: 'invalid-input' })
    const png = await rig.service.files.importLoDocument(await writeTemp('pic.png'))
    expect(png).toMatchObject({ ok: false, code: 'invalid-input' })
    expect(readdirSync(join(rig.dir, 'inbox')).filter((f) => f !== 'assets.json')).toEqual([])
    const gone = await rig.service.files.importLoDocument(join(rig.dir, 'nope.docx'))
    expect(gone).toMatchObject({ ok: false, code: 'not-found' })
  })

  it('pickLoDocument uses the Open dialog and reports a cancel as cancelled', async () => {
    const rig = makeRig()
    expect(await rig.service.files.pickLoDocument()).toEqual({ ok: true, cancelled: true })
    rig.dialogs.openPath = await writeTemp('lo.pdf')
    expect(await rig.service.files.pickLoDocument()).toMatchObject({
      ok: true,
      document: { kind: 'pdf' }
    })
  })

  it('moves attached documents into the lesson when it is created', async () => {
    const rig = makeRig()
    const doc = await rig.service.files.importLoDocument(await writeTemp('lo.docx', 'abc'))
    if (!doc.ok) throw new Error(doc.message)
    const lessonId = await seedLesson(rig, fixtureDeck())
    const adopted = await rig.service.files.adoptDocuments(lessonId, [
      doc.document.id,
      'ast_missing'
    ])
    expect(adopted).toEqual([{ id: doc.document.id, name: 'lo.docx', kind: 'docx', sizeBytes: 3 }])
    expect(readdirSync(join(rig.dir, 'inbox')).filter((f) => f.endsWith('.docx'))).toEqual([])
    const found = await rig.service.files.findDocument(doc.document.id, lessonId)
    expect(Buffer.from(found?.bytes ?? []).toString()).toBe('abc')
    expect(await rig.service.files.findDocument(doc.document.id)).toBeUndefined()
  })
})

describe('chat attachments and pictures', () => {
  it('attaches any accepted file to a lesson and reads it back', async () => {
    const rig = makeRig()
    const lessonId = await seedLesson(rig, fixtureDeck())
    const attached = await rig.service.files.attach(lessonId, await writeTemp('leaf.png', 'PNG!'))
    if (!attached.ok) throw new Error(attached.message)
    expect(attached.attachment).toMatchObject({ name: 'leaf.png', kind: 'image', sizeBytes: 4 })
    const id = attached.attachment.id
    expect(Buffer.from((await rig.service.files.readAsset(lessonId, id)) ?? []).toString()).toBe(
      'PNG!'
    )
    expect(await rig.service.files.attachment(lessonId, id)).toEqual(attached.attachment)
    const read = rig.service.files.assetReader(lessonId)
    expect(await read(id)).toBeDefined()
    expect(await read('ast_nope')).toBeUndefined()
  })

  it('never reads outside the assets folder', async () => {
    const rig = makeRig()
    const lessonId = await seedLesson(rig, fixtureDeck())
    expect(await rig.service.files.readAsset(lessonId, '../../deck')).toBeUndefined()
    expect(await rig.service.files.readAsset('../x', 'a')).toBeUndefined()
    expect(await rig.service.files.attach('../x', await writeTemp('a.png'))).toMatchObject({
      ok: false
    })
  })

  it('refuses unsupported types', async () => {
    const rig = makeRig()
    const lessonId = await seedLesson(rig, fixtureDeck())
    expect(await rig.service.files.attach(lessonId, await writeTemp('x.exe'))).toMatchObject({
      ok: false,
      code: 'invalid-input'
    })
  })

  it('pickAttachment uses the dialog', async () => {
    const rig = makeRig()
    const lessonId = await seedLesson(rig, fixtureDeck())
    expect(await rig.service.files.pickAttachment(lessonId)).toEqual({ ok: true, cancelled: true })
    rig.dialogs.openPath = await writeTemp('a.jpg')
    expect(await rig.service.files.pickAttachment(lessonId)).toMatchObject({ ok: true })
  })

  it('keeps every attachment when several are added at once', async () => {
    const rig = makeRig()
    const lessonId = await seedLesson(rig, fixtureDeck())
    const paths = await Promise.all([1, 2, 3].map((n) => writeTemp(`p${n}.png`)))
    await Promise.all(paths.map((p) => rig.service.files.attach(lessonId, p)))
    const manifest = JSON.parse(
      readFileSync(join(rig.dir, 'lessons', lessonId, 'assets', 'assets.json'), 'utf8')
    )
    expect(Object.keys(manifest)).toHaveLength(3)
  })
})

describe('plugin outputs', () => {
  it('saves a Word file under outputs/ with a safe name', async () => {
    const rig = makeRig()
    const lessonId = await seedLesson(rig, fixtureDeck())
    const saved = await rig.service.files.saveOutput(
      lessonId,
      'Quiz: cells?.docx',
      Buffer.from('zip')
    )
    if (!saved.ok) throw new Error(saved.message)
    expect(saved).toMatchObject({ name: 'Quiz cells.docx', kind: 'docx' })
    expect(saved.path).toBe(join(rig.dir, 'lessons', lessonId, 'outputs', 'Quiz cells.docx'))
    expect(readFileSync(saved.path, 'utf8')).toBe('zip')
  })

  it('numbers a name that is taken instead of overwriting', async () => {
    const rig = makeRig()
    const lessonId = await seedLesson(rig, fixtureDeck())
    const one = await rig.service.files.saveOutput(lessonId, 'Quiz.docx', Buffer.from('1'))
    const two = await rig.service.files.saveOutput(lessonId, 'Quiz.docx', Buffer.from('2'))
    expect(one.ok && two.ok && [one.name, two.name]).toEqual(['Quiz.docx', 'Quiz (2).docx'])
    expect(existsSync(join(rig.dir, 'lessons', lessonId, 'outputs', 'Quiz.docx'))).toBe(true)
  })

  it('refuses other file types and unsafe lesson ids', async () => {
    const rig = makeRig()
    const lessonId = await seedLesson(rig, fixtureDeck())
    expect(await rig.service.files.saveOutput(lessonId, 'run.exe', Buffer.from('x'))).toMatchObject(
      {
        ok: false,
        code: 'invalid-input'
      }
    )
    expect(await rig.service.files.saveOutput('../x', 'a.docx', Buffer.from('x'))).toMatchObject({
      ok: false,
      code: 'not-found'
    })
  })
})
