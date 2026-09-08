export interface PdfSplitViewRequest {
  requestId: number
  file?: File
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

export function requestPdfSplitView(input: { file?: File; documentId?: string } = {}): void {
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
