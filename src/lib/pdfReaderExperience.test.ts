import { describe, expect, it, vi } from 'vitest'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { normalizePdfReadingState, normalizedPdfCrop, parsePdfPageLink, searchPdf, pdfOutline } from './pdfReaderExperience'
vi.mock('./pdfSourceRepository', () => ({ pdfSourceRepository: { loadPage: vi.fn(async () => ({ text: '扫描线索：银色钥匙' })) } }))
describe('PDF reader navigation and sharing', () => {
  it('clamps corrupt persisted locations and deduplicates navigation', () => {
    expect(normalizePdfReadingState({ page: 999, zoom: 99, fraction: -1, offset: 8, bookmarks: [2, 2, 999], recent: [NaN, 3] }, 20)).toEqual({ page: 20, zoom: 2, fraction: 0, left: 0, offset: 8, bookmarks: [2, 20], recent: [3] })
  })
  it('links physical pages independently of printed page offsets', () => {
    expect(parsePdfPageLink('#pdf=book%3A1&page=12')).toEqual({ documentId: 'book:1', page: 12 })
    for (const hash of ['#pdf=x&page=-1', '#pdf=x&page=NaN', '#pdf=x&page=1.2', '#page=2']) expect(parsePdfPageLink(hash)).toBeNull()
  })
  it('clips reversed crop drags at the page boundary', () => {
    expect(normalizedPdfCrop({ x: .8, y: .7 }, { x: -.2, y: 1.3 })).toEqual({ x: 0, y: .7, width: .8, height: .30000000000000004 })
  })
  it('searches all pages and falls back to stored OCR', async () => {
    const pdf = { numPages: 2, getPage: async (n: number) => ({ getTextContent: async () => ({ items: n === 1 ? [{ str: '银色钥匙藏在门后' }] : [] }) }) } as unknown as PDFDocumentProxy
    const result = await searchPdf(pdf, 'book', '银色钥匙', new AbortController().signal)
    expect(result.hits.map(hit => hit.page)).toEqual([1, 2])
    const controller = new AbortController(); controller.abort()
    await expect(searchPdf(pdf, 'book', '钥匙', controller.signal)).rejects.toThrow()
  })
  it('resolves nested named and explicit outline destinations', async () => {
    const pdf = { getOutline: async () => [{ title: '城堡', dest: 'castle', items: [{ title: '地窖', dest: [3], items: [] }] }], getDestination: async () => [{ num: 1 }], getPageIndex: async () => 1 } as unknown as PDFDocumentProxy
    expect((await pdfOutline(pdf)).map(hit => hit.page)).toEqual([2, 4])
  })
})
