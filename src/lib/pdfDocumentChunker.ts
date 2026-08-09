import type { AiDocumentChunkV1 } from './aiProvider'
import { pdfSha256 } from './pdfSourceEvidence'

export const PDF_DOCUMENT_CHUNKER_VERSION = 'structure-v1'

export interface PdfDocumentChunkV2 extends AiDocumentChunkV1 {
  documentId: string
  sourcePageNumbers: number[]
  textSha256: string
  overlapCharacters: number
}

const sentenceBoundary = /(?<=[。！？!?；;：:])\s*/u
const headingLike = /^\s*(?:第[一二三四五六七八九十百\d]+[章节幕场]|[一二三四五六七八九十]+[、.]|\d+(?:\.\d+)*[、.\s]|【.+】|.{1,24}[:：])\s*$/u

function structuredSegments(text: string): string[] {
  const paragraphs = text.split(/\n{2,}/u).map((entry) => entry.trim()).filter(Boolean)
  const result: string[] = []
  for (const paragraph of paragraphs) {
    const lines = paragraph.split('\n').map((entry) => entry.trim()).filter(Boolean)
    if (lines.length > 1 && headingLike.test(lines[0])) {
      result.push(lines[0], lines.slice(1).join('\n'))
      continue
    }
    result.push(...paragraph.split(sentenceBoundary).map((entry) => entry.trim()).filter(Boolean))
  }
  return result
}

function hardSplit(text: string, maximum: number): string[] {
  const result: string[] = []
  for (let offset = 0; offset < text.length; offset += maximum) result.push(text.slice(offset, offset + maximum))
  return result
}

export async function createPdfDocumentChunks(input: {
  documentId: string
  documentName: string
  pages: readonly string[]
  maximumCharacters?: number
  overlapCharacters?: number
}): Promise<PdfDocumentChunkV2[]> {
  const maximum = Math.max(1_000, input.maximumCharacters ?? 6_000)
  const overlap = Math.min(Math.max(0, input.overlapCharacters ?? 400), Math.floor(maximum / 3))
  const chunks: PdfDocumentChunkV2[] = []
  let current = ''
  let pages = new Set<number>()
  let currentOverlap = 0
  let hasFreshContent = false

  const flush = async () => {
    const text = current.trim()
    if (!text || !hasFreshContent) return
    const sourcePageNumbers = [...pages].sort((left, right) => left - right)
    const hash = await pdfSha256(text)
    chunks.push({
      id: `${input.documentId}:chunk:${String(chunks.length + 1).padStart(5, '0')}:${hash.slice(0, 20)}`,
      documentId: input.documentId,
      documentName: input.documentName,
      mimeType: 'application/pdf-text',
      text,
      pageStart: sourcePageNumbers[0],
      pageEnd: sourcePageNumbers.at(-1),
      sourcePageNumbers,
      textSha256: hash,
      overlapCharacters: currentOverlap,
    })
    const tail = overlap > 0 ? text.slice(-overlap) : ''
    current = tail
    currentOverlap = tail.length
    pages = new Set(sourcePageNumbers.slice(-1))
    hasFreshContent = false
  }

  for (let index = 0; index < input.pages.length; index += 1) {
    const pageNumber = index + 1
    const pageText = input.pages[index].trim()
    if (!pageText) continue
    const units = structuredSegments(pageText).flatMap((segment) => segment.length > maximum ? hardSplit(segment, maximum) : [segment])
    for (const unit of units) {
      const prefix = `\n[第 ${pageNumber} 页]\n`
      const addition = `${prefix}${unit}`
      if (hasFreshContent && current.length + addition.length > maximum) await flush()
      if (!hasFreshContent && current.length + addition.length > maximum) {
        current = current.slice(-Math.max(0, maximum - addition.length))
        currentOverlap = current.length
      }
      current += addition
      pages.add(pageNumber)
      hasFreshContent = true
      if (current.length >= maximum) await flush()
    }
    if (current.length >= maximum * 0.72) await flush()
  }
  await flush()
  return chunks
}
