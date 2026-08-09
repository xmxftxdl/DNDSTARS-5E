import { describe, expect, it } from 'vitest'
import { createPdfDocumentChunks } from './pdfDocumentChunker'

describe('PDF V2 结构分块', () => {
  it('优先保留页边界，并生成稳定 chunk ID 与有限 overlap', async () => {
    const input = {
      documentId: 'pdf_abc',
      documentName: '模组.pdf',
      pages: ['第一章\n\n' + '第一段内容。'.repeat(180), '第二章\n\n' + '第二段内容。'.repeat(180)],
      maximumCharacters: 1_000,
      overlapCharacters: 320,
    }
    const first = await createPdfDocumentChunks(input)
    const second = await createPdfDocumentChunks(input)
    expect(first.length).toBeGreaterThan(1)
    expect(first.map((chunk) => chunk.id)).toEqual(second.map((chunk) => chunk.id))
    expect(first.every((chunk) => chunk.text.trim().length > 0)).toBe(true)
    expect(first.every((chunk) => chunk.overlapCharacters <= 320)).toBe(true)
    expect(first[0]?.pageStart).toBe(1)
    expect(first.at(-1)?.pageEnd).toBe(2)
    expect(new Set(first.map((chunk) => chunk.id)).size).toBe(first.length)
  })

  it('长页优先按段落与句子拆分，不产生仅含 overlap 的空尾块', async () => {
    const chunks = await createPdfDocumentChunks({
      documentId: 'pdf_long',
      documentName: '长页.pdf',
      pages: [`第一章：抵达\n\n${'艾琳抵达暮钟旅馆。'.repeat(150)}\n\n${'赤烛会将在午夜行动！'.repeat(150)}`],
      maximumCharacters: 1_000,
      overlapCharacters: 400,
    })
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.pageStart === 1 && chunk.pageEnd === 1)).toBe(true)
    expect(chunks.every((chunk) => chunk.text.replace(/\[第 1 页\]/g, '').trim().length > chunk.overlapCharacters)).toBe(true)
    expect(chunks.every((chunk) => chunk.sourcePageNumbers.join(',') === '1')).toBe(true)
  })

  it('跳过空页并为跨页块记录准确页码', async () => {
    const chunks = await createPdfDocumentChunks({
      documentId: 'pdf_pages',
      documentName: '分页.pdf',
      pages: ['第一页短文。', '', '第三页短文。'],
      maximumCharacters: 2_000,
      overlapCharacters: 0,
    })
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toMatchObject({ pageStart: 1, pageEnd: 3, sourcePageNumbers: [1, 3] })
  })
})
