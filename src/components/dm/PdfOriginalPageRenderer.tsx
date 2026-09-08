import { LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { findPdfQuoteRange } from '../../lib/pdfSourceEvidence'
import { getPdfWheelPageDirection, type PdfWheelPageDirection } from '../../lib/pdfSplitViewWheel'

type PdfJsRuntime = {
  pdf: PDFDocumentProxy
  TextLayer: typeof import('pdfjs-dist')['TextLayer']
}

function applyPdfTextHighlight(layer: HTMLElement, quote: string): HTMLElement | null {
  const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let fullText = ''
  let current = walker.nextNode()
  while (current) {
    if (current.nodeValue) {
      nodes.push(current as Text)
      fullText += current.nodeValue
    }
    current = walker.nextNode()
  }
  const match = findPdfQuoteRange(fullText, quote)
  if (!match) return null
  const offsets: number[] = []
  let cursor = 0
  for (const node of nodes) {
    offsets.push(cursor)
    cursor += node.nodeValue?.length ?? 0
  }
  let firstMark: HTMLElement | null = null
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index]
    const nodeStart = offsets[index]
    const nodeEnd = nodeStart + (node.nodeValue?.length ?? 0)
    const overlapStart = Math.max(match.start, nodeStart)
    const overlapEnd = Math.min(match.end, nodeEnd)
    if (overlapStart >= overlapEnd) continue
    const range = document.createRange()
    range.setStart(node, overlapStart - nodeStart)
    range.setEnd(node, overlapEnd - nodeStart)
    const mark = document.createElement('mark')
    mark.dataset.pdfCitationHighlight = 'true'
    mark.className = 'rounded-sm bg-amber-300/70 text-transparent shadow-[0_0_8px_rgba(252,211,77,0.65)]'
    range.surroundContents(mark)
    firstMark = mark
  }
  return firstMark
}

export default function PdfOriginalPageRenderer({ file, pageNumber, onTextSelect, highlightRegion, highlightLabel, highlightText, fillAvailableHeight = false, panWithPointer = false, wheelPageTurn, pageEntryEdge = 'start', zoom = 1 }: {
  file: File
  pageNumber: number
  onTextSelect?: (text: string) => void
  highlightRegion?: readonly [number, number, number, number]
  highlightLabel?: string
  highlightText?: string
  fillAvailableHeight?: boolean
  panWithPointer?: boolean
  wheelPageTurn?: (direction: PdfWheelPageDirection) => boolean
  pageEntryEdge?: 'start' | 'end'
  zoom?: number
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const wheelPageTurnLockedRef = useRef(false)
  const lastPositionedPageRef = useRef('')
  const panStateRef = useRef<{
    pointerId: number
    clientX: number
    clientY: number
    scrollLeft: number
    scrollTop: number
  } | null>(null)
  const [hostWidth, setHostWidth] = useState(0)
  const [isPanning, setIsPanning] = useState(false)
  const fileKey = `${file.name}:${file.size}:${file.lastModified}`
  const [documentState, setDocumentState] = useState<{ key: string; runtime: PdfJsRuntime | null; error: string }>({ key: '', runtime: null, error: '' })
  const runtime = documentState.key === fileKey ? documentState.runtime : null
  const normalizedZoom = Math.max(0.5, Math.min(3, zoom))
  const renderKey = runtime && hostWidth > 0 ? `${fileKey}:${pageNumber}:${Math.round(hostWidth)}:${Math.round(normalizedZoom * 100)}` : ''
  const [renderState, setRenderState] = useState<{ key: string; error: string }>({ key: '', error: '' })
  const loadingDocument = documentState.key !== fileKey
  const rendering = Boolean(runtime && renderKey && renderState.key !== renderKey)
  const error = documentState.key === fileKey && documentState.error
    ? documentState.error
    : renderState.key === renderKey ? renderState.error : ''

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const update = () => setHostWidth(Math.max(320, host.clientWidth))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    let loadingTask: ReturnType<typeof import('pdfjs-dist')['getDocument']> | null = null
    void Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
      file.arrayBuffer(),
    ]).then(async ([pdfJs, workerModule, bytes]) => {
      if (cancelled) return
      pdfJs.GlobalWorkerOptions.workerSrc = workerModule.default
      loadingTask = pdfJs.getDocument({ data: new Uint8Array(bytes) })
      const loadedPdf = await loadingTask.promise
      if (!cancelled) setDocumentState({ key: fileKey, runtime: { pdf: loadedPdf, TextLayer: pdfJs.TextLayer }, error: '' })
    }).catch(() => {
      if (!cancelled) setDocumentState({ key: fileKey, runtime: null, error: '原 PDF 无法打开，文件可能已损坏或受密码保护。' })
    })
    return () => {
      cancelled = true
      void loadingTask?.destroy()
    }
  }, [file, fileKey])

  useEffect(() => {
    if (!runtime || !canvasRef.current || !textLayerRef.current || hostWidth <= 0) return
    let cancelled = false
    let renderTask: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | null = null
    let textLayer: InstanceType<PdfJsRuntime['TextLayer']> | null = null
    void runtime.pdf.getPage(pageNumber).then(async (page) => {
      if (cancelled || !canvasRef.current || !textLayerRef.current) return
      const baseViewport = page.getViewport({ scale: 1 })
      const displayWidth = Math.max(280, hostWidth - 32) * normalizedZoom
      const scale = displayWidth / baseViewport.width
      const viewport = page.getViewport({ scale })
      const outputScale = Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1))
      const canvas = canvasRef.current
      const context = canvas.getContext('2d', { alpha: false })
      if (!context) throw new Error('pdf-canvas-context-unavailable')
      canvas.width = Math.max(1, Math.floor(viewport.width * outputScale))
      canvas.height = Math.max(1, Math.floor(viewport.height * outputScale))
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`
      const layer = textLayerRef.current
      layer.replaceChildren()
      layer.style.width = `${Math.floor(viewport.width)}px`
      layer.style.height = `${Math.floor(viewport.height)}px`
      renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
        transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
      })
      await renderTask.promise
      if (cancelled) return
      textLayer = new runtime.TextLayer({
        textContentSource: await page.getTextContent(),
        container: layer,
        viewport,
      })
      await textLayer.render()
      const textHighlight = highlightText ? applyPdfTextHighlight(layer, highlightText) : null
      page.cleanup()
      if (!cancelled) {
        setRenderState({ key: renderKey, error: '' })
        window.requestAnimationFrame(() => {
          const target = textHighlight ?? layer.parentElement?.querySelector<HTMLElement>('[data-testid="pdf-original-page-highlight"]') ?? null
          const host = hostRef.current
          if (!host) return
          if (target) {
            const hostRect = host.getBoundingClientRect()
            const targetRect = target.getBoundingClientRect()
            host.scrollTop += targetRect.top - hostRect.top - Math.max(24, host.clientHeight * 0.28)
            wheelPageTurnLockedRef.current = false
            return
          }
          const positionedPageKey = `${fileKey}:${pageNumber}`
          if (lastPositionedPageRef.current !== positionedPageKey) {
            host.scrollTop = pageEntryEdge === 'end' ? host.scrollHeight : 0
            lastPositionedPageRef.current = positionedPageKey
          }
          wheelPageTurnLockedRef.current = false
        })
      }
    }).catch((cause: unknown) => {
      wheelPageTurnLockedRef.current = false
      if (!cancelled && !(cause instanceof Error && cause.name === 'RenderingCancelledException')) {
        setRenderState({ key: renderKey, error: '这一页无法完成视觉渲染，请重新附加原 PDF 后重试。' })
      }
    })
    return () => {
      cancelled = true
      renderTask?.cancel()
      textLayer?.cancel()
    }
  }, [fileKey, highlightText, hostWidth, normalizedZoom, pageEntryEdge, pageNumber, renderKey, runtime])

  const captureSelection = () => {
    const selection = window.getSelection()
    const text = selection?.toString().trim() ?? ''
    if (!text || !textLayerRef.current || !selection?.rangeCount) return
    const ancestor = selection.getRangeAt(0).commonAncestorContainer
    const selectionNode = ancestor.nodeType === Node.TEXT_NODE ? ancestor.parentNode : ancestor
    if (!selectionNode || !textLayerRef.current.contains(selectionNode)) return
    onTextSelect?.(text.slice(0, 500))
  }

  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panWithPointer || event.button !== 0) return
    const host = event.currentTarget
    panStateRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      scrollLeft: host.scrollLeft,
      scrollTop: host.scrollTop,
    }
    host.setPointerCapture(event.pointerId)
    setIsPanning(true)
    event.preventDefault()
  }

  const movePan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = panStateRef.current
    if (!state || state.pointerId !== event.pointerId) return
    const host = event.currentTarget
    host.scrollLeft = state.scrollLeft - (event.clientX - state.clientX)
    host.scrollTop = state.scrollTop - (event.clientY - state.clientY)
    event.preventDefault()
  }

  const finishPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = panStateRef.current
    if (!state || state.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    panStateRef.current = null
    setIsPanning(false)
  }

  const turnPageWithWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!wheelPageTurn || wheelPageTurnLockedRef.current) return
    const host = event.currentTarget
    const direction = getPdfWheelPageDirection({
      deltaY: event.deltaY,
      scrollTop: host.scrollTop,
      clientHeight: host.clientHeight,
      scrollHeight: host.scrollHeight,
    })
    if (!direction) return
    if (!wheelPageTurn(direction)) return
    wheelPageTurnLockedRef.current = true
    event.preventDefault()
  }

  return (
    <div
      ref={hostRef}
      className={`relative bg-slate-900/70 p-4 ${fillAvailableHeight
        ? 'h-full min-h-0 overflow-x-auto overflow-y-scroll overscroll-contain [scrollbar-gutter:stable]'
        : 'min-h-[32rem] overflow-auto'} ${panWithPointer
        ? isPanning ? 'cursor-grabbing select-none touch-none' : 'cursor-grab touch-none'
        : ''}`}
      data-testid="pdf-original-page-renderer"
      data-fill-available-height={fillAvailableHeight ? 'true' : undefined}
      data-pan-with-pointer={panWithPointer ? 'true' : undefined}
      data-wheel-page-turn={wheelPageTurn ? 'true' : undefined}
      data-zoom-percent={Math.round(normalizedZoom * 100)}
      aria-label={panWithPointer ? 'PDF 页面；按住并拖动可平移' : undefined}
      onPointerDown={startPan}
      onPointerMove={movePan}
      onPointerUp={finishPan}
      onPointerCancel={finishPan}
      onWheel={turnPageWithWheel}
    >
      {(loadingDocument || rendering) && <div className="pointer-events-none absolute left-1/2 top-6 z-20 -translate-x-1/2 rounded-full border border-white/10 bg-slate-950/90 px-3 py-2 text-xs text-slate-300 shadow-xl"><LoaderCircle className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />正在渲染原 PDF</div>}
      {error ? <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-rose-400/15 bg-rose-500/[0.04] p-5 text-sm leading-7 text-rose-100/80">{error}</div> : (
        <div className="pdf-original-page relative mx-auto w-fit overflow-hidden bg-white shadow-2xl shadow-black/50" onMouseUp={captureSelection}>
          <canvas ref={canvasRef} className="block" />
          <div ref={textLayerRef} className="textLayer" />
          {highlightRegion && (
            <div
              className="pointer-events-none absolute z-[3] rounded-sm border-2 border-amber-300 bg-amber-300/15 shadow-[0_0_0_2px_rgba(15,23,42,0.5),0_0_18px_rgba(252,211,77,0.65)]"
              data-testid="pdf-original-page-highlight"
              aria-label={highlightLabel || '引用位置'}
              style={{
                left: `${Math.max(0, Math.min(1, highlightRegion[0])) * 100}%`,
                top: `${Math.max(0, Math.min(1, highlightRegion[1])) * 100}%`,
                width: `${Math.max(0.01, Math.min(1, highlightRegion[2]) - Math.max(0, highlightRegion[0])) * 100}%`,
                height: `${Math.max(0.01, Math.min(1, highlightRegion[3]) - Math.max(0, highlightRegion[1])) * 100}%`,
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}
