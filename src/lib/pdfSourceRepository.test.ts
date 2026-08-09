import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PdfDocumentRecordV2, PdfSourcePageV2 } from './pdfCampaignAnalysisV2'
import { createIndexedDbPdfSourceRepository, createMemoryPdfSourceRepositoryForTests } from './pdfSourceRepository'

const document = (id = 'pdf_a'): PdfDocumentRecordV2 => ({
  id, name: `${id}.pdf`, mimeType: 'application/pdf', sha256: 'a'.repeat(64), sizeBytes: 10,
  pageCount: 1, extractedCharacters: 12, scannedPages: [],
})

const page = (id = 'pdf_a'): PdfSourcePageV2 => ({
  documentId: id, documentSha256: 'a'.repeat(64), documentName: `${id}.pdf`, page: 1,
  text: '可验证的原文。', normalizedText: '可验证的原文.', textSha256: 'b'.repeat(64), extractionMethod: 'pdf-text',
})

describe('PDF Source Repository', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('幂等保存、读取并级联删除文档页', async () => {
    const repository = createMemoryPdfSourceRepositoryForTests()
    await repository.saveDocument(document(), [page()])
    await repository.saveDocument(document(), [page()])
    expect(await repository.loadDocument('pdf_a')).toEqual(document())
    expect(await repository.loadPage('pdf_a', 1)).toEqual(page())
    await repository.deleteDocument('pdf_a')
    expect(await repository.loadDocument('pdf_a')).toBeNull()
    expect(await repository.loadPage('pdf_a', 1)).toBeNull()
  })

  it('prune 保留最近访问的文档', async () => {
    const repository = createMemoryPdfSourceRepositoryForTests({ maxDocuments: 2 })
    vi.spyOn(Date, 'now').mockReturnValueOnce(1).mockReturnValueOnce(2).mockReturnValueOnce(3)
    await repository.saveDocument(document('pdf_a'), [page('pdf_a')])
    await repository.saveDocument(document('pdf_b'), [page('pdf_b')])
    await repository.loadDocument('pdf_a')
    await repository.saveDocument(document('pdf_c'), [page('pdf_c')])
    expect(await repository.loadDocument('pdf_a')).not.toBeNull()
    expect(await repository.loadDocument('pdf_c')).not.toBeNull()
    expect(await repository.loadDocument('pdf_b')).toBeNull()
  })

  it('缺少 IndexedDB 时读取优雅降级，保存给调用方可捕获的错误', async () => {
    vi.stubGlobal('indexedDB', undefined)
    const repository = createIndexedDbPdfSourceRepository()
    expect(await repository.loadPage('missing', 1)).toBeNull()
    await expect(repository.saveDocument(document(), [page()])).rejects.toThrow('pdf-source-repository-unavailable')
    await expect(repository.deleteDocument('missing')).resolves.toBeUndefined()
  })
})
