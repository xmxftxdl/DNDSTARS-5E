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

  it('在当前设备保存任务原始 PDF，并按战役隔离恢复', async () => {
    const repository = createMemoryPdfSourceRepositoryForTests()
    const source = new File(['pdf-content'], '冒险.pdf', { type: 'application/pdf', lastModified: 42 })
    await repository.saveJobFiles('campaign-a', 'job-1', [source])

    expect(await repository.loadJobFiles('campaign-b', 'job-1')).toBeNull()
    const restored = await repository.loadJobFiles('campaign-a', 'job-1')
    expect(restored).toHaveLength(1)
    expect(restored?.[0]?.name).toBe('冒险.pdf')
    expect(restored?.[0]?.lastModified).toBe(42)
    expect(await restored?.[0]?.text()).toBe('pdf-content')

    await repository.deleteJobFiles('job-1')
    expect(await repository.loadJobFiles('campaign-a', 'job-1')).toBeNull()
  })

  it('清除本机断点时删除全部任务 PDF 副本', async () => {
    const repository = createMemoryPdfSourceRepositoryForTests()
    await repository.saveJobFiles('campaign-a', 'job-1', [new File(['a'], 'a.pdf', { type: 'application/pdf' })])
    await repository.saveJobFiles('campaign-a', 'job-2', [new File(['b'], 'b.pdf', { type: 'application/pdf' })])
    await repository.clearJobFiles()
    expect(await repository.loadJobFiles('campaign-a', 'job-1')).toBeNull()
    expect(await repository.loadJobFiles('campaign-a', 'job-2')).toBeNull()
  })

  it('缺少 IndexedDB 时读取优雅降级，保存给调用方可捕获的错误', async () => {
    vi.stubGlobal('indexedDB', undefined)
    const repository = createIndexedDbPdfSourceRepository()
    expect(await repository.loadPage('missing', 1)).toBeNull()
    expect(await repository.loadJobFiles('campaign-a', 'missing')).toBeNull()
    await expect(repository.saveDocument(document(), [page()])).rejects.toThrow('pdf-source-repository-unavailable')
    await expect(repository.saveJobFiles('campaign-a', 'job-1', [new File(['a'], 'a.pdf')])).rejects.toThrow('pdf-source-repository-unavailable')
    await expect(repository.deleteDocument('missing')).resolves.toBeUndefined()
  })
})
