import { describe, expect, it, vi } from 'vitest'
import { normalizePdfOcrResult, resolvePdfPageText } from './pdfOcrPipeline'
import type { PdfOcrProviderV1 } from './pdfCampaignAnalysisV2'

describe('PDF 文字层与 OCR 分流', () => {
  it('文字层足够时不渲染页面，也不调用 OCR', async () => {
    const renderPage = vi.fn()
    const recognizePage = vi.fn()
    const result = await resolvePdfPageText({
      documentId: 'pdf_native',
      page: 1,
      pdfText: '这是一段来自 PDF.js 文字层、长度足够且可以直接建立证据的正文。',
      renderPage,
      ocrProvider: { id: 'test-ocr', recognizePage } as PdfOcrProviderV1,
    })
    expect(result).toMatchObject({ extractionMethod: 'pdf-text', scanned: false, unresolved: false })
    expect(renderPage).not.toHaveBeenCalled()
    expect(recognizePage).not.toHaveBeenCalled()
  })

  it('只有扫描页调用 OCR，并保留归一化坐标与置信度', async () => {
    const recognizePage = vi.fn().mockResolvedValue({
      text: '艾琳在鹿灯驿馆发现了足以证明伪信来源的关键证据。',
      confidence: 0.91,
      blocks: [{ text: '艾琳在鹿灯驿馆', bbox: [100, 50, 500, 150], confidence: 0.88 }],
    })
    const result = await resolvePdfPageText({
      documentId: 'pdf_scan',
      page: 4,
      pdfText: '',
      renderPage: async () => ({ image: new Blob(['png'], { type: 'image/png' }), width: 1_000, height: 500 }),
      ocrProvider: { id: 'rapidocr', recognizePage },
    })
    expect(recognizePage).toHaveBeenCalledOnce()
    expect(result).toMatchObject({ extractionMethod: 'ocr', scanned: true, unresolved: false, extractionConfidence: 0.91 })
    expect(result.textBlocks).toEqual([{
      text: '艾琳在鹿灯驿馆', bbox: [0.1, 0.1, 0.5, 0.3], confidence: 0.88,
    }])
  })

  it('OCR 未配置或输出过短时 fail closed，不把扫描页交给模型', async () => {
    const renderPage = vi.fn()
    const unavailable = await resolvePdfPageText({
      documentId: 'pdf_scan', page: 2, pdfText: '', renderPage,
    })
    expect(unavailable).toMatchObject({ scanned: true, unresolved: true })
    expect(renderPage).not.toHaveBeenCalled()

    const weak = await resolvePdfPageText({
      documentId: 'pdf_scan',
      page: 3,
      pdfText: '',
      renderPage: async () => ({ image: new Blob(['png'], { type: 'image/png' }), width: 100, height: 100 }),
      ocrProvider: { id: 'rapidocr', recognizePage: async () => ({ text: '噪点' }) },
    })
    expect(weak).toMatchObject({ scanned: true, unresolved: true })
    expect(weak.warning).toContain('阻止该页进入模型分析')
  })

  it('没有栅格图像的短标题页不误触发 OCR', async () => {
    const renderPage = vi.fn()
    const recognizePage = vi.fn()
    const result = await resolvePdfPageText({
      documentId: 'pdf_title',
      page: 1,
      pdfText: '第一章',
      hasRasterImage: false,
      renderPage,
      ocrProvider: { id: 'rapidocr', recognizePage } as PdfOcrProviderV1,
    })
    expect(result).toMatchObject({ text: '第一章', scanned: false, unresolved: false })
    expect(renderPage).not.toHaveBeenCalled()
    expect(recognizePage).not.toHaveBeenCalled()
  })

  it('拒绝越界坐标和非法置信度', () => {
    const normalized = normalizePdfOcrResult({
      text: '这是一段长度足够、能够被保留的扫描页识别文本。',
      confidence: 3,
      blocks: [
        { text: '合法', bbox: [0, 0, 50, 50], confidence: 0.75 },
        { text: '倒置', bbox: [80, 20, 10, 40], confidence: 0.5 },
      ],
    }, 100, 100)
    expect(normalized?.confidence).toBeUndefined()
    expect(normalized?.textBlocks).toEqual([{ text: '合法', bbox: [0, 0, 0.5, 0.5], confidence: 0.75 }])
  })
})
