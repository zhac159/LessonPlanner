import { Document, Packer, Paragraph, TextRun } from 'docx'
import { describe, expect, it } from 'vitest'
import { readDocxText } from './docxText'

describe('readDocxText', () => {
  it('returns the paragraphs as plain text', async () => {
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ children: [new TextRun('Learning objectives')] }),
            new Paragraph({ children: [new TextRun('Describe photosynthesis')] })
          ]
        }
      ]
    })
    const text = await readDocxText(await Packer.toBuffer(doc))
    expect(text).toContain('Learning objectives')
    expect(text).toContain('Describe photosynthesis')
  })

  it('reports damaged files', async () => {
    await expect(readDocxText(Buffer.from('nope'))).rejects.toMatchObject({ code: 'corrupt' })
  })
})
