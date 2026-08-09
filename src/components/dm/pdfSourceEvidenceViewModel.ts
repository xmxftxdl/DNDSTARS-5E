import type { PdfSourceCitationV1 } from '../../lib/pdfCampaignAnalysis'
import type { PdfSourceCitationV2 } from '../../lib/pdfCampaignAnalysisV2'
import { findPdfQuoteRange } from '../../lib/pdfSourceEvidence'

export type PdfViewCitation = PdfSourceCitationV1 | PdfSourceCitationV2

export function isPdfSourceCitationV2(citation: PdfViewCitation): citation is PdfSourceCitationV2 {
  return 'evidenceId' in citation && typeof citation.evidenceId === 'string'
}

export function splitPdfSourceHighlight(text: string, quote: string): { before: string; match: string; after: string } | null {
  const range = findPdfQuoteRange(text, quote)
  if (!range) return null
  return { before: text.slice(0, range.start), match: text.slice(range.start, range.end), after: text.slice(range.end) }
}
