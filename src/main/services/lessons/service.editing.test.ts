import { appendFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fixtureDeck, makeChangeSet, makeSlide } from '@shared/deck/testing'
import type { Deck } from '@shared/deck/types'
import { makeRig, seedLesson } from './testing'

const rename = (title: string) => ({ op: 'setMeta' as const, title })

async function openDeck(rig: ReturnType<typeof makeRig>, id: string): Promise<Deck> {
  const opened = await rig.service.open(id)
  if (!opened.ok) throw new Error(opened.message)
  return opened.deck
}

describe('apply', () => {
  it('validates, saves deck.json and journals the change', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    const edited = await rig.service.apply(id, {
      by: 'user',
      summary: 'Retitled',
      ops: [rename('New title')]
    })
    if (!edited.ok) throw new Error(edited.message)
    expect(edited.deck.title).toBe('New title')
    expect(edited.changeSet).toMatchObject({ by: 'user', summary: 'Retitled' })
    expect(edited.history).toMatchObject({
      canUndo: true,
      undoChangeSetId: edited.changeSet.id,
      undoSummary: 'Retitled'
    })
    const onDisk = JSON.parse(readFileSync(join(rig.dir, 'lessons', id, 'deck.json'), 'utf8'))
    expect(onDisk.title).toBe('New title')
    const lines = readFileSync(join(rig.dir, 'lessons', id, 'changes.jsonl'), 'utf8')
      .trim()
      .split('\n')
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[1])).toMatchObject({
      kind: 'change',
      changeSet: { id: edited.changeSet.id }
    })
  })

  it('rejects invalid ops with every reason and changes nothing', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    const before = await openDeck(rig, id)
    const edited = await rig.service.apply(id, {
      by: 'ai',
      summary: 'Bad',
      ops: [
        { op: 'deleteSlides', slideIds: ['nope'] },
        { op: 'removeElement', slideId: 's1', elementId: 'ghost' }
      ]
    })
    expect(edited).toMatchObject({ ok: false, code: 'invalid-input' })
    expect(edited.ok ? '' : edited.message).toContain('ops[0]')
    expect(edited.ok ? '' : edited.message).toContain('ops[1]')
    expect(await openDeck(rig, id)).toEqual(before)
  })

  it('refuses to touch locked decorations unless allowed', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    const ops = [{ op: 'removeElement' as const, slideId: 's1', elementId: 's1-band' }]
    expect(await rig.service.apply(id, { by: 'ai', summary: 'x', ops })).toMatchObject({
      ok: false
    })
    expect(
      await rig.service.apply(id, { by: 'user', summary: 'x', ops }, { allowLocked: true })
    ).toMatchObject({ ok: true })
  })

  it('serialises concurrent edits: all of them land, none is lost', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        rig.service.apply(id, {
          by: 'user',
          summary: `Add ${i}`,
          ops: [{ op: 'insertSlides', afterSlideId: null, slides: [makeSlide(`x${i}`)] }]
        })
      )
    )
    expect(results.every((r) => r.ok)).toBe(true)
    expect((await openDeck(rig, id)).slides).toHaveLength(3 + 8)
  })

  it('fails for an unknown or unsafe lesson id', async () => {
    const rig = makeRig()
    const input = { by: 'user' as const, summary: 's', ops: [rename('x')] }
    expect(await rig.service.apply('les_nope', input)).toMatchObject({
      ok: false,
      code: 'not-found'
    })
    expect(await rig.service.apply('../x', input)).toMatchObject({ ok: false, code: 'not-found' })
  })

  it('refreshes the index and sends lessonsChanged', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    rig.changed.length = 0
    await rig.service.apply(id, { by: 'user', summary: 's', ops: [rename('Fresh')] })
    expect(rig.changed.at(-1)?.[0]).toMatchObject({ id, title: 'Fresh' })
  })
})

describe('undo and redo', () => {
  it('undoes and redoes with the matching history state', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    await rig.service.apply(id, { by: 'user', summary: 'Retitled', ops: [rename('B')] })
    const undone = await rig.service.undo(id)
    if (!undone.ok) throw new Error(undone.message)
    expect(undone.deck.title).toBe('Y8 Science — Photosynthesis')
    expect(undone.history).toMatchObject({ canRedo: true, redoSummary: 'Retitled' })
    const redone = await rig.service.redo(id)
    expect(redone.ok && redone.deck.title).toBe('B')
  })

  it('says so when there is nothing to undo or redo', async () => {
    const rig = makeRig()
    const created = await rig.service.create({ styleId: null, meta: {} })
    if (!created.ok) throw new Error('create failed')
    expect(await rig.service.undo(created.lessonId)).toMatchObject({
      ok: false,
      message: 'Nothing to undo.'
    })
    expect(await rig.service.redo(created.lessonId)).toMatchObject({
      ok: false,
      message: 'Nothing to redo.'
    })
  })

  it('a new change clears the redo stack', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    await rig.service.apply(id, { by: 'user', summary: 'A', ops: [rename('A')] })
    await rig.service.undo(id)
    const next = await rig.service.apply(id, { by: 'user', summary: 'C', ops: [rename('C')] })
    expect(next.ok && next.history.canRedo).toBe(false)
  })

  it('works across a restart, redo included', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    await rig.service.apply(id, { by: 'user', summary: 'A', ops: [rename('A')] })
    await rig.service.apply(id, { by: 'user', summary: 'B', ops: [rename('B')] })
    await rig.service.undo(id)

    const restarted = makeRig({ dir: rig.dir })
    const opened = await restarted.service.open(id)
    expect(opened).toMatchObject({
      ok: true,
      history: { canUndo: true, canRedo: true, undoSummary: 'A', redoSummary: 'B' }
    })
    const redone = await restarted.service.redo(id)
    expect(redone.ok && redone.deck.title).toBe('B')
    await restarted.service.undo(id)
    const undone = await restarted.service.undo(id)
    expect(undone.ok && undone.deck.title).toBe('Y8 Science — Photosynthesis')
    expect((await restarted.service.undo(id)).ok).toBe(true) // the seed insert
    expect((await openDeck(restarted, id)).slides).toHaveLength(0)
  })

  it('only undoes a specific change while it is the latest', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    const first = await rig.service.apply(id, { by: 'ai', summary: 'A', ops: [rename('A')] })
    const second = await rig.service.apply(id, { by: 'ai', summary: 'B', ops: [rename('B')] })
    if (!first.ok || !second.ok) throw new Error('apply failed')
    const refused = await rig.service.undo(id, first.changeSet.id)
    expect(refused).toMatchObject({ ok: false, message: 'Undo the later changes first.' })
    expect((await rig.service.undo(id, second.changeSet.id)).ok).toBe(true)
    expect((await rig.service.undo(id, first.changeSet.id)).ok).toBe(true)
    expect(await rig.service.redo(id, second.changeSet.id)).toMatchObject({
      ok: false,
      message: 'Redo the earlier changes first.'
    })
    expect((await rig.service.redo(id, first.changeSet.id)).ok).toBe(true)
  })

  it('reports a journal that does not match the deck instead of corrupting it', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    const line = JSON.stringify({
      v: 1,
      kind: 'change',
      changeSet: makeChangeSet([rename('Ghost')]),
      patches: [],
      inversePatches: [{ op: 'replace', path: ['slides', 99, 'id'], value: 'x' }]
    })
    appendFileSync(
      join(rig.dir, 'lessons', id, 'changes.jsonl'),
      `${line}
`
    )
    const restarted = makeRig({ dir: rig.dir })
    const before = await openDeck(restarted, id)
    expect(await restarted.service.undo(id)).toMatchObject({ ok: false, code: 'io' })
    expect(await openDeck(restarted, id)).toEqual(before)
  })
})

describe('applyGroup', () => {
  it('commits many ChangeSets as ONE undo step', async () => {
    const rig = makeRig()
    const created = await rig.service.create({ styleId: null, meta: {}, title: null })
    if (!created.ok) throw new Error('create failed')
    const sets = ['a', 'b', 'c'].map((id, i) =>
      makeChangeSet([
        {
          op: 'insertSlides',
          afterSlideId: i === 0 ? null : ['a', 'b', 'c'][i - 1],
          slides: [makeSlide(id)]
        }
      ])
    )
    const grouped = await rig.service.applyGroup(created.lessonId, sets, {
      summary: '3 slides added'
    })
    if (!grouped.ok) throw new Error(grouped.message)
    expect(grouped.deck.slides.map((s) => s.id)).toEqual(['a', 'b', 'c'])
    expect(grouped.changeSet).toMatchObject({ summary: '3 slides added' })
    expect(grouped.changeSet.ops).toHaveLength(3)
    expect(grouped.history.undoSummary).toBe('3 slides added')

    const undone = await rig.service.undo(created.lessonId)
    expect(undone.ok && undone.deck.slides).toHaveLength(0)
    expect(undone.ok && undone.history.canUndo).toBe(false)

    const restarted = makeRig({ dir: rig.dir })
    await restarted.service.open(created.lessonId)
    expect((await restarted.service.redo(created.lessonId)).ok).toBe(true)
    expect((await openDeck(restarted, created.lessonId)).slides).toHaveLength(3)
  })

  it('is all or nothing when one ChangeSet is invalid', async () => {
    const rig = makeRig()
    const created = await rig.service.create({ styleId: null, meta: {}, title: null })
    if (!created.ok) throw new Error('create failed')
    const good = makeChangeSet([
      { op: 'insertSlides', afterSlideId: null, slides: [makeSlide('a')] }
    ])
    const bad = makeChangeSet([{ op: 'deleteSlides', slideIds: ['ghost'] }])
    expect(
      await rig.service.applyGroup(created.lessonId, [good, bad], { summary: 'x' })
    ).toMatchObject({ ok: false })
    expect((await openDeck(rig, created.lessonId)).slides).toHaveLength(0)
  })
})

describe('changes', () => {
  it('tells whether each change is applied or undone, and ignores unknown ids', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    const a = await rig.service.apply(id, { by: 'ai', summary: 'A', ops: [rename('A')] })
    if (!a.ok) throw new Error('apply failed')
    let found = await rig.service.changes(id, [a.changeSet.id, 'chg_unknown'])
    expect([...found.keys()]).toEqual([a.changeSet.id])
    expect(found.get(a.changeSet.id)?.undone).toBe(false)
    await rig.service.undo(id)
    found = await rig.service.changes(id, [a.changeSet.id])
    expect(found.get(a.changeSet.id)).toMatchObject({ undone: true, changeSet: { summary: 'A' } })
    expect((await rig.service.changes('les_nope', ['x'])).size).toBe(0)
  })
})

describe('generation record', () => {
  it('is saved, read back and cleared', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    expect(await rig.service.getGenerationRecord(id)).toBeUndefined()
    const record = {
      state: 'partial' as const,
      plan: { title: 'T', summary: 's', slides: [] },
      brief: { objectives: ['x'] },
      slideIds: [null],
      stoppedBy: 'cancelled' as const
    }
    await rig.service.setGenerationRecord(id, record)
    expect(await rig.service.getGenerationRecord(id)).toEqual(record)
    await rig.service.setGenerationRecord(id, null)
    expect(await rig.service.getGenerationRecord(id)).toBeUndefined()
  })
})
