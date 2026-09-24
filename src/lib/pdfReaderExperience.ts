import { pdfSourceRepository } from './pdfSourceRepository'
import type { PDFDocumentProxy } from 'pdfjs-dist'

export type PdfReadingState = { page: number; fraction: number; left: number; zoom: number; offset: number; bookmarks: number[]; recent: number[] }
const integer = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback
export function normalizePdfReadingState(value: Partial<PdfReadingState>, count: number): PdfReadingState {
  const page = (n: unknown) => Math.max(1, Math.min(count, integer(n, 1)))
  const list = (v: unknown) => Array.isArray(v) ? [...new Set(v.filter(n => typeof n === 'number' && Number.isFinite(n)).map(page))].slice(0, 50) : []
  return { page: page(value.page), fraction: Math.max(0, Math.min(1, Number(value.fraction) || 0)), left: Math.max(0, Number(value.left) || 0), zoom: Math.max(.75, Math.min(2, Number(value.zoom) || 1)), offset: integer(value.offset, 0), bookmarks: list(value.bookmarks), recent: list(value.recent) }
}
export function readPdfReadingState(id: string, count: number): PdfReadingState {
  try { return normalizePdfReadingState(JSON.parse(localStorage.getItem(`pdf-reader:v1:${id}`) || '{}') || {}, count) } catch { return normalizePdfReadingState({}, count) }
}
export function savePdfReadingState(id: string, state: PdfReadingState) {
  try { localStorage.setItem(`pdf-reader:v1:${id}`, JSON.stringify(state)) } catch { /* Reading remains available when storage is full. */ }
}
export function pdfPageLink(id: string, page: number) { return `${location.origin}${location.pathname}#pdf=${encodeURIComponent(id)}&page=${Math.max(1, Math.round(page))}` }
export function parsePdfPageLink(hash: string): { documentId: string; page: number } | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const id = params.get('pdf'), page = Number(params.get('page'))
  return id && id.length <= 200 && Number.isInteger(page) && page >= 1 ? { documentId: id, page } : null
}
export type PdfSearchHit = { page: number; text: string }
export async function searchPdf(pdf: PDFDocumentProxy, id: string, query: string, signal: AbortSignal): Promise<{ hits: PdfSearchHit[]; unsearchable: number }> {
  const needle = query.trim().toLocaleLowerCase()
  const hits: PdfSearchHit[] = []
  let unsearchable = 0
  if (!needle) return { hits, unsearchable }
  for (let page = 1; page <= pdf.numPages; page++) {
    signal.throwIfAborted()
    const source = await pdf.getPage(page)
    const content = await source.getTextContent()
    let text = content.items.map(item => 'str' in item ? item.str : '').join(' ')
    if (!text.trim()) text = (await pdfSourceRepository.loadPage(id, page))?.text ?? ''
    if (!text.trim()) unsearchable++
    const index = text.toLocaleLowerCase().indexOf(needle)
    if (index >= 0) hits.push({ page, text: text.slice(Math.max(0, index - 40), index + needle.length + 100) })
  }
  signal.throwIfAborted()
  return { hits, unsearchable }
}
export async function pdfOutline(pdf: PDFDocumentProxy): Promise<PdfSearchHit[]> {
  const result: PdfSearchHit[] = []
  const walk = async (items: NonNullable<Awaited<ReturnType<PDFDocumentProxy['getOutline']>>>, depth: number) => {
    for (const item of items) {
      const dest = typeof item.dest === 'string' ? await pdf.getDestination(item.dest) : item.dest
      if (Array.isArray(dest) && dest[0] != null) {
        const index = typeof dest[0] === 'number' ? dest[0] : await pdf.getPageIndex(dest[0])
        result.push({ page: index + 1, text: `${'　'.repeat(Math.min(depth, 6))}${item.title}` })
      }
      await walk(item.items, depth + 1)
    }
  }
  await walk(await pdf.getOutline() ?? [], 0)
  return result
}

export type PdfCrop = { x: number; y: number; width: number; height: number }
export function normalizedPdfCrop(a: { x: number; y: number }, b: { x: number; y: number }): PdfCrop {
  const clamp = (n: number) => Math.max(0, Math.min(1, n))
  return { x: Math.min(clamp(a.x), clamp(b.x)), y: Math.min(clamp(a.y), clamp(b.y)), width: Math.abs(clamp(a.x) - clamp(b.x)), height: Math.abs(clamp(a.y) - clamp(b.y)) }
}
export async function renderPdfShare(pdf: PDFDocumentProxy, pageNumber: number): Promise<string> {
  const page = await pdf.getPage(pageNumber)
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: Math.min(2, 1600 / base.width, Math.sqrt(3_200_000 / (base.width * base.height))) })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height)
  await page.render({ canvas, viewport }).promise
  return canvas.toDataURL('image/png')
}
export async function cropPdfShare(url: string, crop: PdfCrop | null): Promise<Blob> {
  const image = new Image(); image.src = url; await image.decode()
  const rect = crop ?? { x: 0, y: 0, width: 1, height: 1 }
  if (rect.width < .005 || rect.height < .005) throw new Error('选择区域太小，请重新框选。')
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * rect.width)); canvas.height = Math.max(1, Math.round(image.height * rect.height))
  canvas.getContext('2d')!.drawImage(image, image.width * rect.x, image.height * rect.y, image.width * rect.width, image.height * rect.height, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片生成失败')), 'image/png'))
}
