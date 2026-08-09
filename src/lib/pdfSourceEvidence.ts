import type {
  PdfEvidenceCandidateV2,
  PdfSourceEvidenceV2,
  PdfSourcePageV2,
} from './pdfCampaignAnalysisV2'

const MIN_QUOTE_LENGTH = 8
const MAX_QUOTE_LENGTH = 320
const REPAIRED_QUOTE_TARGET_LENGTH = 48

export function normalizePdfEvidenceText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/\u00ad/g, '')
    .replace(/([\p{L}\p{N}])[-‐‑]\s*\n\s*([\p{L}\p{N}])/gu, '$1$2')
    .replace(/\r\n?/g, '\n')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[，､]/g, ',')
    .replace(/[。｡]/g, '.')
    .replace(/[：﹕]/g, ':')
    .replace(/[；﹔]/g, ';')
    .replace(/[！？]/g, (value) => value === '！' ? '!' : '?')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function pdfSha256(value: ArrayBuffer | Uint8Array | string): Promise<string> {
  const source = typeof value === 'string'
    ? new TextEncoder().encode(value)
    : value instanceof Uint8Array
      ? value
      : new Uint8Array(value)
  const bytes = new Uint8Array(source.byteLength)
  bytes.set(source)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes.buffer)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function createPdfDocumentIdentity(bytes: Uint8Array): Promise<{ sha256: string; id: string }> {
  const sha256 = await pdfSha256(bytes)
  return { sha256, id: `pdf_${sha256.slice(0, 24)}` }
}

/**
 * Expands a model-produced short citation using only contiguous text from the
 * cited source page. Ambiguous or non-verbatim snippets are deliberately left
 * unrepaired so the normal Host validation path can reject them.
 */
export function expandShortPdfEvidenceQuote(pageText: string, quote: string): string | null {
  const needle = quote.trim()
  if (needle.length >= MIN_QUOTE_LENGTH || needle.length === 0 || pageText.length < MIN_QUOTE_LENGTH) return null

  const start = pageText.indexOf(needle)
  if (start < 0 || pageText.indexOf(needle, start + 1) >= 0) return null

  const originalEnd = start + needle.length
  const targetLength = Math.min(MAX_QUOTE_LENGTH, Math.max(MIN_QUOTE_LENGTH, REPAIRED_QUOTE_TARGET_LENGTH))
  const missing = Math.max(0, targetLength - needle.length)
  let expandedStart = Math.max(0, start - Math.ceil(missing / 2))
  let expandedEnd = Math.min(pageText.length, originalEnd + Math.floor(missing / 2))

  if (expandedEnd - expandedStart < targetLength) {
    expandedStart = Math.max(0, expandedEnd - targetLength)
    expandedEnd = Math.min(pageText.length, expandedStart + targetLength)
  }

  const expanded = pageText.slice(expandedStart, expandedEnd).trim()
  return expanded.length >= MIN_QUOTE_LENGTH && expanded.length <= MAX_QUOTE_LENGTH && expanded.includes(needle)
    ? expanded
    : null
}

export async function verifyPdfEvidenceCandidate(input: {
  candidate: PdfEvidenceCandidateV2
  page: PdfSourcePageV2
  chunkId: string
}): Promise<PdfSourceEvidenceV2 | null> {
  const quote = input.candidate.quote.trim()
  if (quote.length < MIN_QUOTE_LENGTH || quote.length > MAX_QUOTE_LENGTH) return null
  if (
    input.candidate.documentId !== input.page.documentId ||
    input.candidate.documentName !== input.page.documentName ||
    input.candidate.page !== input.page.page
  ) return null

  const normalizedQuote = normalizePdfEvidenceText(quote)
  if (normalizedQuote.length < MIN_QUOTE_LENGTH) return null
  const verification = input.page.text.includes(quote)
    ? 'exact'
    : input.page.normalizedText.includes(normalizedQuote)
      ? 'normalized'
      : null
  if (!verification) return null
  const normalizedQuoteSha256 = await pdfSha256(normalizedQuote)
  const idSeed = [input.page.documentId, input.page.page, input.chunkId, normalizedQuoteSha256].join('|')
  const id = `ev_${(await pdfSha256(idSeed)).slice(0, 24)}`
  const matchingBlocks = (input.page.textBlocks ?? []).filter((block) => {
    const blockText = normalizePdfEvidenceText(block.text)
    return blockText.length >= 2 && (normalizedQuote.includes(blockText) || blockText.includes(normalizedQuote))
  })
  const pageRegion = matchingBlocks.length > 0 ? matchingBlocks.reduce<[number, number, number, number]>(
    (region, block) => [
      Math.min(region[0], block.bbox[0]),
      Math.min(region[1], block.bbox[1]),
      Math.max(region[2], block.bbox[2]),
      Math.max(region[3], block.bbox[3]),
    ],
    [...matchingBlocks[0].bbox],
  ) : undefined
  const blockConfidences = matchingBlocks.flatMap((block) => block.confidence == null ? [] : [block.confidence])
  const sourceConfidence = blockConfidences.length > 0
    ? blockConfidences.reduce((sum, value) => sum + value, 0) / blockConfidences.length
    : input.page.extractionConfidence
  return {
    id,
    documentId: input.page.documentId,
    documentName: input.page.documentName,
    page: input.page.page,
    chunkId: input.chunkId,
    quote,
    normalizedQuoteSha256,
    verification,
    sourceExtractionMethod: input.page.extractionMethod,
    ...(sourceConfidence != null ? { sourceConfidence } : {}),
    ...(pageRegion ? { pageRegion } : {}),
  }
}

export function findPdfQuoteRange(text: string, quote: string): { start: number; end: number } | null {
  const exactStart = text.indexOf(quote)
  if (exactStart >= 0) return { start: exactStart, end: exactStart + quote.length }

  const normalizedQuote = normalizePdfEvidenceText(quote)
  if (!normalizedQuote) return null
  let normalized = ''
  const positions: number[] = []
  let pendingSpace = false
  for (let index = 0; index < text.length; index += 1) {
    const source = text[index]
    const mapped = normalizePdfEvidenceText(source)
    if (!mapped) {
      if (/\s/u.test(source)) pendingSpace = normalized.length > 0
      continue
    }
    if (pendingSpace && normalized && !normalized.endsWith(' ')) {
      normalized += ' '
      positions.push(index)
    }
    pendingSpace = false
    for (const character of mapped) {
      normalized += character
      positions.push(index)
    }
  }
  const start = normalized.indexOf(normalizedQuote)
  if (start < 0) return null
  const first = positions[start]
  const last = positions[start + normalizedQuote.length - 1]
  return Number.isInteger(first) && Number.isInteger(last) ? { start: first, end: last + 1 } : null
}
