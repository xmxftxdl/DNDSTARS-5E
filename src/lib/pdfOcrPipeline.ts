import type {
  PdfOcrPageInputV1,
  PdfOcrPageResultV1,
  PdfOcrProviderV1,
  PdfSourceTextBlockV1,
} from './pdfCampaignAnalysisV2'
import { normalizePdfEvidenceText } from './pdfSourceEvidence'

export const PDF_TEXT_LAYER_MIN_CHARACTERS = 20
export const PDF_OCR_MIN_CHARACTERS = 20
const MAX_OCR_TEXT_CHARACTERS = 250_000
const MAX_OCR_BLOCKS = 10_000

export interface NormalizedPdfOcrResultV1 {
  text: string
  confidence?: number
  textBlocks: PdfSourceTextBlockV1[]
}

export interface ResolvePdfPageTextInputV1 {
  documentId: string
  page: number
  pdfText: string
  renderPage: () => Promise<{ image: Blob; width: number; height: number }>
  ocrProvider?: PdfOcrProviderV1
  languageHints?: string[]
  signal?: AbortSignal
  /** False means the page has no raster image and therefore is not a scanned page. */
  hasRasterImage?: boolean
}

export interface ResolvedPdfPageTextV1 {
  text: string
  extractionMethod: 'pdf-text' | 'ocr'
  scanned: boolean
  unresolved: boolean
  extractionConfidence?: number
  textBlocks?: PdfSourceTextBlockV1[]
  warning?: string
}

function boundedConfidence(value: unknown): number | undefined {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= 1 ? numeric : undefined
}

function normalizedCoordinate(value: unknown, maximum: number): number | null {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0 || maximum <= 0) return null
  return Math.min(1, numeric / maximum)
}

function cleanOcrText(value: unknown, maximum: number): string {
  return String(value ?? '')
    .replaceAll('\u0000', '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\f\v]+/g, ' ')
    .replace(/ +\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, maximum)
}

export function pdfPageNeedsOcr(text: string): boolean {
  return normalizePdfEvidenceText(text).replace(/\s/gu, '').length < PDF_TEXT_LAYER_MIN_CHARACTERS
}

export function normalizePdfOcrResult(
  result: PdfOcrPageResultV1,
  imageWidth: number,
  imageHeight: number,
): NormalizedPdfOcrResultV1 | null {
  const text = cleanOcrText(result.text, MAX_OCR_TEXT_CHARACTERS)
  if (normalizePdfEvidenceText(text).replace(/\s/gu, '').length < PDF_OCR_MIN_CHARACTERS) return null
  const textBlocks = (result.blocks ?? []).slice(0, MAX_OCR_BLOCKS).flatMap((block): PdfSourceTextBlockV1[] => {
    const blockText = cleanOcrText(block?.text, 4_000)
    if (!blockText || !Array.isArray(block?.bbox) || block.bbox.length !== 4) return []
    const left = normalizedCoordinate(block.bbox[0], imageWidth)
    const top = normalizedCoordinate(block.bbox[1], imageHeight)
    const right = normalizedCoordinate(block.bbox[2], imageWidth)
    const bottom = normalizedCoordinate(block.bbox[3], imageHeight)
    if (left == null || top == null || right == null || bottom == null || right <= left || bottom <= top) return []
    const confidence = boundedConfidence(block.confidence)
    return [{
      text: blockText,
      bbox: [left, top, right, bottom],
      ...(confidence != null ? { confidence } : {}),
    }]
  })
  const confidence = boundedConfidence(result.confidence)
  return {
    text,
    ...(confidence != null ? { confidence } : {}),
    textBlocks,
  }
}

export async function resolvePdfPageText(input: ResolvePdfPageTextInputV1): Promise<ResolvedPdfPageTextV1> {
  const pdfText = input.pdfText.trim()
  if (!pdfPageNeedsOcr(pdfText)) return { text: pdfText, extractionMethod: 'pdf-text', scanned: false, unresolved: false }
  if (input.hasRasterImage === false) {
    return { text: pdfText, extractionMethod: 'pdf-text', scanned: false, unresolved: false }
  }
  if (!input.ocrProvider) {
    return {
      text: pdfText,
      extractionMethod: 'pdf-text',
      scanned: true,
      unresolved: true,
      warning: `第 ${input.page} 页疑似扫描页，但当前没有可用的 OCR 引擎。`,
    }
  }
  try {
    const rendered = await input.renderPage()
    const request: PdfOcrPageInputV1 = {
      documentId: input.documentId,
      page: input.page,
      image: rendered.image,
      imageWidth: rendered.width,
      imageHeight: rendered.height,
      languageHints: input.languageHints ?? ['zh-Hans', 'en'],
    }
    const recognized = normalizePdfOcrResult(
      await input.ocrProvider.recognizePage(request, input.signal),
      rendered.width,
      rendered.height,
    )
    if (!recognized) {
      return {
        text: pdfText,
        extractionMethod: 'pdf-text',
        scanned: true,
        unresolved: true,
        warning: `第 ${input.page} 页的 OCR 结果文字不足，已阻止该页进入模型分析。`,
      }
    }
    return {
      text: recognized.text,
      extractionMethod: 'ocr',
      scanned: true,
      unresolved: false,
      ...(recognized.confidence != null ? { extractionConfidence: recognized.confidence } : {}),
      ...(recognized.textBlocks.length > 0 ? { textBlocks: recognized.textBlocks } : {}),
    }
  } catch (error) {
    if (input.signal?.aborted) throw error
    const reason = error instanceof Error ? error.message : 'ocr-failed'
    return {
      text: pdfText,
      extractionMethod: 'pdf-text',
      scanned: true,
      unresolved: true,
      warning: `第 ${input.page} 页 OCR 失败（${reason.slice(0, 120)}），已阻止该页进入模型分析。`,
    }
  }
}
