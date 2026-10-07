import { Document, Packer, Paragraph } from 'docx'
import { describe, expect, it } from 'vitest'
import type { AiService } from '@shared/ai/types'
import type { DocumentReadResult } from '@shared/contracts/deck-builder'
import { ok, type Result } from '@shared/result'
import { writeTemp } from '../lessons/testing'
import { createLessonFromRequest } from './createLesson'
import { makeGenerationRig, type GenerationRig } from './testing'

async function docxWith(...lines: string[]): Promise<Uint8Array> {
  const doc = new Document({
    sections: [{ children: lines.map((text) => new Paragraph(text)) }]
  })
  return Packer.toBuffer(doc)
}

type Extraction = Parameters<AiService['extractObjectives']>[0]

function recorder(objectives = ['Describe where photosynthesis happens']) {
  const inputs: Extraction[] = []
  const ai: Partial<AiService> = {
    extractObjectives: async (input) => {
      inputs.push(input)
      return ok({
        extracted: { title: 'From the document', yearGroup: 'Y8', objectives, context: 'Set 3' }
      })
    }
  }
  return { inputs, ai }
}

async function importDoc(rig: GenerationRig, name: string, bytes: string | Uint8Array) {
  const imported = await rig.service.files.importLoDocument(await writeTemp(name, bytes))
  if (!imported.ok) throw new Error(imported.message)
  return imported.document.id
}

describe('reading a document (documentRead)', () => {
  it('sends Word text, a PDF as bytes and a PowerPoint digest to extractObjectives', async () => {
    const { inputs, ai } = recorder()
    const rig = await makeGenerationRig({ ai })
    const docx = await importDoc(rig, 'los.docx', await docxWith('LO1: Describe photosynthesis'))
    const pdf = await importDoc(rig, 'los.pdf', '%PDF-1.4 bytes')
    await rig.generation.documents.announce(docx)
    await rig.generation.documents.announce(pdf)
    expect(inputs[0].text).toContain('LO1: Describe photosynthesis')
    expect(Buffer.from(inputs[1].pdf ?? []).toString()).toBe('%PDF-1.4 bytes')
    expect(rig.of('documentRead')).toEqual([
      {
        documentId: docx,
        result: {
          ok: true,
          objectives: ['Describe where photosynthesis happens'],
          title: 'From the document',
          yearGroup: 'Y8'
        }
      },
      expect.objectContaining({ documentId: pdf })
    ])
  })

  it('asks Claude once per document, however often it is read', async () => {
    const { inputs, ai } = recorder()
    const rig = await makeGenerationRig({ ai })
    const id = await importDoc(rig, 'los.docx', await docxWith('x'))
    await rig.generation.documents.announce(id)
    await rig.generation.documents.read(id)
    await rig.generation.documents.read(id)
    expect(inputs).toHaveLength(1)
  })

  it('reports an unreadable Word file as a failed result, without calling Claude', async () => {
    const { inputs, ai } = recorder()
    const rig = await makeGenerationRig({ ai })
    const id = await importDoc(rig, 'broken.docx', 'not a zip')
    await rig.generation.documents.announce(id)
    expect(inputs).toHaveLength(0)
    const [event] = rig.of('documentRead') as Array<{ result: Result<DocumentReadResult> }>
    expect(event.result).toMatchObject({
      ok: false,
      code: 'invalid-input',
      message: 'This file is damaged'
    })
  })

  it('passes Claude’s failure on (no key yet) and does not cache it', async () => {
    const rig = await makeGenerationRig({ fake: { failWith: 'no-key' } })
    const id = await importDoc(rig, 'los.docx', await docxWith('LO1: x'))
    await rig.generation.documents.announce(id)
    const [event] = rig.of('documentRead') as Array<{ result: Result<DocumentReadResult> }>
    expect(event.result).toMatchObject({ ok: false, code: 'no-key' })
    expect(await rig.generation.documents.read(id)).toMatchObject({ ok: false, code: 'no-key' })
  })

  it('fails for a document that does not exist', async () => {
    const rig = await makeGenerationRig()
    expect(await rig.generation.documents.read('ast_nope')).toMatchObject({
      ok: false,
      code: 'not-found'
    })
  })
})

describe('generating from documents', () => {
  it('merges the typed text and the documents, adopts the documents and shows them in the message', async () => {
    const { inputs, ai } = recorder(['Explain why photosynthesis is endothermic'])
    const rig = await makeGenerationRig({ ai })
    const id = await importDoc(rig, 'los.docx', await docxWith('LO1: x'))
    const started = await rig.generation.generate({
      lessonId: rig.lessonId,
      text: 'Year 8 photosynthesis',
      documentIds: [id],
      meta: {}
    })
    if (!started.ok) throw new Error(started.message)
    await rig.generation.whenDone(started.jobId)
    expect(inputs).toHaveLength(2)
    const opened = await rig.service.open(rig.lessonId)
    expect(opened.ok && opened.deck.meta.objectives).toEqual([
      'Explain why photosynthesis is endothermic'
    ])
    expect(opened.ok && opened.deck.meta.yearGroup).toBe('Y8')
    expect(opened.ok && opened.deck.meta.context).toBe('Set 3')
    expect(await rig.service.files.findDocument(id, rig.lessonId)).toBeDefined()
    expect(await rig.service.files.findDocument(id)).toBeUndefined()
    const [user] = await rig.store.read(rig.lessonId)
    expect(user.ui.attachments).toEqual([
      { id, name: 'los.docx', kind: 'docx', sizeBytes: expect.any(Number) }
    ])
  })

  it('stops with the reason when a document cannot be read', async () => {
    const rig = await makeGenerationRig()
    const id = await importDoc(rig, 'broken.docx', 'nope')
    const started = await rig.generation.generate({
      lessonId: rig.lessonId,
      text: '',
      documentIds: [id],
      meta: {}
    })
    if (!started.ok) throw new Error(started.message)
    await rig.generation.whenDone(started.jobId)
    expect(rig.of('ai:error')).toEqual([
      expect.objectContaining({ scope: 'generation', message: 'This file is damaged' })
    ])
    const opened = await rig.service.open(rig.lessonId)
    expect(opened.ok && opened.deck.slides).toHaveLength(0)
  })
})

describe('createLessonFromRequest', () => {
  const request = {
    objectivesText: 'Cells\nLO1: Name the parts of a cell',
    documentIds: [] as string[],
    styleId: 'sty_science_ks3',
    title: null,
    meta: { yearGroup: 'Y7' },
    startGeneration: true
  }

  it('creates the lesson and starts the generation', async () => {
    const rig = await makeGenerationRig()
    const created = await createLessonFromRequest(
      { lessons: rig.service, generation: rig.generation },
      request
    )
    if (!created.ok || !created.jobId) throw new Error('should start')
    await rig.generation.whenDone(created.jobId)
    expect(created.messageId).toMatch(/^msg_/)
    const opened = await rig.service.open(created.lessonId)
    expect(opened.ok && opened.deck.slides.length).toBeGreaterThan(3)
    expect(opened.ok && opened.deck.meta.yearGroup).toBe('Y7')
    expect(opened.ok && opened.deck.styleId).toBe('sty_science_ks3')
  })

  it('"Blank slide" makes one empty title slide and starts nothing', async () => {
    const rig = await makeGenerationRig()
    const created = await createLessonFromRequest(
      { lessons: rig.service, generation: rig.generation },
      { ...request, objectivesText: '', startGeneration: false, blankSlide: true }
    )
    if (!created.ok) throw new Error(created.message)
    expect(created).toMatchObject({ jobId: null, messageId: null })
    const opened = await rig.service.open(created.lessonId)
    expect(opened.ok && opened.deck.slides.map((s) => s.kind)).toEqual(['title'])
    expect(rig.service.jobs.running(created.lessonId)).toBeUndefined()
  })

  it('without generation it still moves the attached documents into the lesson', async () => {
    const rig = await makeGenerationRig()
    const id = await importDoc(rig, 'los.docx', 'x')
    const created = await createLessonFromRequest(
      { lessons: rig.service, generation: rig.generation },
      { ...request, documentIds: [id], startGeneration: false }
    )
    if (!created.ok) throw new Error(created.message)
    expect(await rig.service.files.findDocument(id, created.lessonId)).toBeDefined()
  })

  it('rejects too many documents and an empty generation before creating anything', async () => {
    const rig = await makeGenerationRig()
    const deps = { lessons: rig.service, generation: rig.generation }
    const before = (await rig.service.list()).length
    expect(
      await createLessonFromRequest(deps, { ...request, documentIds: ['a', 'b', 'c', 'd'] })
    ).toMatchObject({ ok: false, message: 'You can attach up to 3 documents.' })
    expect(await createLessonFromRequest(deps, { ...request, objectivesText: '  ' })).toMatchObject(
      {
        ok: false,
        code: 'invalid-input'
      }
    )
    expect(await rig.service.list()).toHaveLength(before)
  })

  it('passes on a bad style', async () => {
    const rig = await makeGenerationRig()
    expect(
      await createLessonFromRequest(
        { lessons: rig.service, generation: rig.generation },
        { ...request, styleId: 'sty_nope' }
      )
    ).toMatchObject({ ok: false, code: 'not-found' })
  })
})
