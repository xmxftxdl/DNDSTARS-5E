import { parsePdfPageLink } from './pdfReaderExperience'
export interface PdfSplitViewRequest {
  requestId: number
  file?: File
  page?: number
  documentId?: string
}

type PdfSplitViewListener = (request: PdfSplitViewRequest | null) => void

let requestSequence = 0
let currentRequest: PdfSplitViewRequest | null = null
const listeners = new Set<PdfSplitViewListener>()

function publish(request: PdfSplitViewRequest | null) {
  currentRequest = request
  listeners.forEach((listener) => listener(request))
}

export function requestPdfSplitView(input: { file?: File; documentId?: string; page?: number } = {}): void {
  requestSequence += 1
  publish({ requestId: requestSequence, ...input })
}

export function closePdfSplitView(): void {
  publish(null)
}

export function getPdfSplitViewRequest(): PdfSplitViewRequest | null {
  return currentRequest
}

export function subscribePdfSplitView(listener: PdfSplitViewListener): () => void {
  listeners.add(listener)
  listener(currentRequest)
  return () => listeners.delete(listener)
}

if (typeof window !== 'undefined') {
  const openLink = () => {
    const target = parsePdfPageLink(window.location.hash)
    if (target) requestPdfSplitView(target)
  }
  window.addEventListener('hashchange', openLink)
  window.addEventListener('click', event => {
    const anchor = (event.target as Element | null)?.closest?.('a[href]')
    if (!anchor || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    const url = new URL(anchor.getAttribute('href')!, window.location.href)
    const target = url.origin === window.location.origin ? parsePdfPageLink(url.hash) : null
    if (target) { event.preventDefault(); requestPdfSplitView(target) }
  })
  openLink()
}
