import { describe, expect, it } from 'vitest'
import {
  createPdfDocumentIdentity,
  expandShortPdfEvidenceQuote,
  normalizePdfEvidenceText,
  verifyPdfEvidenceCandidate,
} from './pdfSourceEvidence'
import type { PdfSourcePageV2 } from './pdfCampaignAnalysisV2'

async function page(text: string, pageNumber = 1): Promise<PdfSourcePageV2> {
  const documentIdentity = await createPdfDocumentIdentity(new TextEncoder().encode('same-pdf'))
  return {
    documentId: documentIdentity.id,
    documentSha256: documentIdentity.sha256,
    documentName: '测试模组.pdf',
    page: pageNumber,
    text,
    normalizedText: normalizePdfEvidenceText(text),
    textSha256: documentIdentity.sha256,
    extractionMethod: 'pdf-text',
  }
}

describe('PDF V2 原文证据', () => {
  it('仅在短引能唯一匹配页面原文时扩展为可验证的连续引用', () => {
    const source = '冒险者抵达鹿灯驿馆，并从掌柜处得知翠羽城商路已经中断。'
    const expanded = expandShortPdfEvidenceQuote(source, '鹿灯驿馆')
    expect(expanded?.length).toBeGreaterThanOrEqual(8)
    expect(source).toContain(expanded)
    expect(expanded).toContain('鹿灯驿馆')
    expect(expandShortPdfEvidenceQuote('鹿灯驿馆位于城南，鹿灯驿馆夜间闭门。', '鹿灯驿馆')).toBeNull()
    expect(expandShortPdfEvidenceQuote(source, '翠羽王宫')).toBeNull()
  })

  it('接受中文连续原文并生成稳定 evidence ID', async () => {
    const source = await page('艾琳在暮钟旅馆为赤烛会收集情报。')
    const candidate = {
      documentId: source.documentId,
      documentName: source.documentName,
      page: 1,
      quote: '艾琳在暮钟旅馆为赤烛会收集情报。',
    }
    const first = await verifyPdfEvidenceCandidate({ candidate, page: source, chunkId: 'chunk-a' })
    const second = await verifyPdfEvidenceCandidate({ candidate, page: source, chunkId: 'chunk-a' })
    expect(first).toMatchObject({ verification: 'exact', documentId: source.documentId })
    expect(second?.id).toBe(first?.id)
  })

  it('只允许有限格式规范化，不接受语义相近的改写', async () => {
    const source = await page('一封盖有赤蜡印的信\n揭示赤烛会将在午夜行动。')
    const normalized = await verifyPdfEvidenceCandidate({
      candidate: {
        documentId: source.documentId,
        documentName: source.documentName,
        page: 1,
        quote: '一封盖有赤蜡印的信 揭示赤烛会将在午夜行动。',
      },
      page: source,
      chunkId: 'chunk-a',
    })
    const paraphrase = await verifyPdfEvidenceCandidate({
      candidate: {
        documentId: source.documentId,
        documentName: source.documentName,
        page: 1,
        quote: '赤烛会计划在深夜展开秘密行动。',
      },
      page: source,
      chunkId: 'chunk-a',
    })
    expect(normalized?.verification).toBe('normalized')
    expect(paraphrase).toBeNull()
  })

  it('同字节不同文件名得到相同文档 ID，不同字节得到不同 ID', async () => {
    const first = await createPdfDocumentIdentity(new Uint8Array([1, 2, 3]))
    const renamed = await createPdfDocumentIdentity(new Uint8Array([1, 2, 3]))
    const changed = await createPdfDocumentIdentity(new Uint8Array([1, 2, 4]))
    expect(renamed.id).toBe(first.id)
    expect(changed.id).not.toBe(first.id)
  })

  it('只将常见全角标点视为等价字符', async () => {
    const source = await page('线索：赤烛会将在午夜行动！守卫问：“口令是什么？”')
    const verified = await verifyPdfEvidenceCandidate({
      candidate: {
        documentId: source.documentId,
        documentName: source.documentName,
        page: 1,
        quote: '线索:赤烛会将在午夜行动!守卫问:"口令是什么?"',
      },
      page: source,
      chunkId: 'chunk-a',
    })
    expect(verified?.verification).toBe('normalized')
  })

  it('相同 quote 位于不同页时生成不同 evidence ID', async () => {
    const firstPage = await page('一封盖有赤蜡印的信揭示赤烛会将在午夜行动。', 1)
    const secondPage = await page('一封盖有赤蜡印的信揭示赤烛会将在午夜行动。', 2)
    const candidate = {
      documentId: firstPage.documentId,
      documentName: firstPage.documentName,
      quote: firstPage.text,
    }
    const first = await verifyPdfEvidenceCandidate({ candidate: { ...candidate, page: 1 }, page: firstPage, chunkId: 'chunk-a' })
    const second = await verifyPdfEvidenceCandidate({ candidate: { ...candidate, page: 2 }, page: secondPage, chunkId: 'chunk-b' })
    expect(first?.id).not.toBe(second?.id)
  })

  it('拒绝越界长度与错误页码的 quote', async () => {
    const source = await page('这是一段足够长、可以被验证的连续原文。')
    expect(await verifyPdfEvidenceCandidate({
      candidate: { documentId: source.documentId, documentName: source.documentName, page: 2, quote: source.text },
      page: source,
      chunkId: 'chunk-a',
    })).toBeNull()
    expect(await verifyPdfEvidenceCandidate({
      candidate: { documentId: source.documentId, documentName: source.documentName, page: 1, quote: '太短' },
      page: source,
      chunkId: 'chunk-a',
    })).toBeNull()
    expect(await verifyPdfEvidenceCandidate({
      candidate: { documentId: source.documentId, documentName: source.documentName, page: 1, quote: '原'.repeat(321) },
      page: { ...source, text: '原'.repeat(321), normalizedText: '原'.repeat(321) },
      chunkId: 'chunk-a',
    })).toBeNull()
  })

  it('OCR 引用保留页内坐标和识别置信度', async () => {
    const source = {
      ...await page('艾琳在暮钟旅馆为赤烛会收集情报。'),
      extractionMethod: 'ocr' as const,
      extractionConfidence: 0.82,
      textBlocks: [{
        text: '艾琳在暮钟旅馆为赤烛会收集情报。',
        bbox: [0.1, 0.2, 0.7, 0.3] as [number, number, number, number],
        confidence: 0.79,
      }],
    }
    const verified = await verifyPdfEvidenceCandidate({
      candidate: {
        documentId: source.documentId,
        documentName: source.documentName,
        page: 1,
        quote: source.text,
      },
      page: source,
      chunkId: 'chunk-ocr',
    })
    expect(verified).toMatchObject({
      sourceExtractionMethod: 'ocr',
      sourceConfidence: 0.79,
      pageRegion: [0.1, 0.2, 0.7, 0.3],
    })
  })
})
