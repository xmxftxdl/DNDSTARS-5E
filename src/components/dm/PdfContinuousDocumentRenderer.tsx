import { LoaderCircle } from 'lucide-react'
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'

type PdfJsRuntime = {
  pdf: PDFDocumentProxy
  TextLayer: typeof import('pdfjs-dist')['TextLayer']
}

type PdfPageRenderScheduler = {
  enqueue: (task: () => Promise<void>) => () => void
  dispose: () => void
}

type PdfPageOffset = { top: number; height: number }

const PDF_CANVAS_PIXEL_BUDGET = 3_200_000

export function pdfCanvasOutputScale(width: number, height: number, devicePixelRatio: number): number {
  const cssPixels = Math.max(1, width * height)
  const pixelBudgetScale = Math.sqrt(PDF_CANVAS_PIXEL_BUDGET / cssPixels)
  return Math.min(2, Math.max(1, devicePixelRatio || 1), Math.max(1, pixelBudgetScale))
}

/** Finds the reading page without forcing layout for every page on every scroll frame. */
export function pdfPageAtScrollOffset(
  totalPages: number,
  scrollOffset: number,
  pageOffset: (pageNumber: number) => PdfPageOffset | undefined,
  fallbackPage: number,
): number {
  let low = 1
  let high = Math.max(1, totalPages)
  let candidate = Math.max(1, Math.min(high, fallbackPage))
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const offset = pageOffset(middle)
    if (!offset) break
    if (offset.top <= scrollOffset) {
      candidate = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }
  const offset = pageOffset(candidate)
  if (offset && scrollOffset > offset.top + offset.height && candidate < totalPages) return candidate + 1
  return candidate
}

function createPdfPageRenderScheduler(): PdfPageRenderScheduler {
  const queue: Array<{ cancelled: boolean; task: () => Promise<void> }> = []
  let running = false
  let disposed = false
  const runNext = () => {
    if (running || disposed) return
    const entry = queue.shift()
    if (!entry) return
    if (entry.cancelled) {
      runNext()
      return
    }
    running = true
    void entry.task().catch(() => undefined).finally(() => {
      running = false
      runNext()
    })
  }
  return {
    enqueue(task) {
      const entry = { cancelled: false, task }
      queue.push(entry)
      runNext()
      return () => { entry.cancelled = true }
    },
    dispose() {
      disposed = true
      queue.length = 0
    },
  }
}

export type PdfContinuousDocumentRendererHandle = {
  scrollToPage: (pageNumber: number, behavior?: ScrollBehavior) => void
}

const PdfContinuousPage = memo(function PdfContinuousPage({ runtime, pageNumber, displayWidth, scrollRoot, renderScheduler }: {
  runtime: PdfJsRuntime | null
  pageNumber: number
  displayWidth: number
  scrollRoot: RefObject<HTMLDivElement | null>
  renderScheduler: PdfPageRenderScheduler
}) {
  const pageRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const [nearViewport, setNearViewport] = useState(pageNumber === 1)
  const [pageHeight, setPageHeight] = useState(Math.round(displayWidth * 1.414))
  const [renderedKey, setRenderedKey] = useState('')
  const [error, setError] = useState('')
  const renderKey = runtime ? `${pageNumber}:${Math.round(displayWidth)}` : ''

  useEffect(() => {
    const pageElement = pageRef.current
    const root = scrollRoot.current
    if (!pageElement || !root || typeof IntersectionObserver === 'undefined') {
      setNearViewport(true)
      return
    }
    const observer = new IntersectionObserver((entries) => {
      setNearViewport(entries.some((entry) => entry.isIntersecting))
    }, { root, rootMargin: '75% 0px', threshold: 0.01 })
    observer.observe(pageElement)
    return () => observer.disconnect()
  }, [scrollRoot])

  useEffect(() => {
    if (!runtime || !nearViewport || displayWidth <= 0 || !canvasRef.current || !textLayerRef.current) return
    let cancelled = false
    let renderTask: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | null = null
    let textLayer: InstanceType<PdfJsRuntime['TextLayer']> | null = null
    const cancelQueuedRender = renderScheduler.enqueue(async () => {
      if (cancelled) return
      const page = await runtime.pdf.getPage(pageNumber)
      try {
        if (cancelled || !canvasRef.current || !textLayerRef.current) return
        const baseViewport = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: displayWidth / baseViewport.width })
        const outputScale = pdfCanvasOutputScale(viewport.width, viewport.height, globalThis.devicePixelRatio || 1)
        const canvas = canvasRef.current
        const context = canvas.getContext('2d', { alpha: false })
        if (!context) throw new Error('pdf-canvas-context-unavailable')
        setPageHeight(Math.ceil(viewport.height))
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
        if (!cancelled) {
          setError('')
          setRenderedKey(renderKey)
        }
      } catch (cause: unknown) {
        if (!cancelled && !(cause instanceof Error && cause.name === 'RenderingCancelledException')) setError('本页渲染失败')
      } finally {
        page.cleanup()
      }
    })
    return () => {
      cancelled = true
      cancelQueuedRender()
      renderTask?.cancel()
      textLayer?.cancel()
    }
  }, [displayWidth, nearViewport, pageNumber, renderKey, renderScheduler, runtime])

  useEffect(() => {
    if (nearViewport) return
    setRenderedKey('')
    setError('')
    const canvas = canvasRef.current
    if (canvas) {
      canvas.width = 1
      canvas.height = 1
      canvas.removeAttribute('style')
    }
    const layer = textLayerRef.current
    if (layer) {
      layer.replaceChildren()
      layer.removeAttribute('style')
    }
  }, [nearViewport])

  return (
    <section
      ref={pageRef}
      className="pdf-original-page pdf-continuous-page relative mx-auto shrink-0 overflow-hidden bg-white shadow-2xl shadow-black/45"
      style={{ width: `${displayWidth}px`, minHeight: `${pageHeight}px`, contentVisibility: 'auto', containIntrinsicSize: `${pageHeight}px` }}
      data-pdf-continuous-page={pageNumber}
      data-rendered={renderedKey === renderKey ? 'true' : 'false'}
      aria-label={`PDF 第 ${pageNumber} 页`}
    >
      {nearViewport && renderedKey !== renderKey && !error && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-slate-100 text-xs text-slate-500">
          <span><LoaderCircle className="mr-1.5 inline h-4 w-4 animate-spin" />正在渲染第 {pageNumber} 页</span>
        </div>
      )}
      {error && <div className="absolute inset-0 z-10 grid place-items-center bg-rose-50 text-sm text-rose-700">{error}</div>}
      <canvas ref={canvasRef} className="block" />
      <div ref={textLayerRef} className="textLayer" />
      <span className="pointer-events-none absolute bottom-2 right-3 z-[2] rounded bg-black/45 px-2 py-0.5 text-[10px] text-white/80">{pageNumber}</span>
    </section>
  )
})

const PdfContinuousDocumentRenderer = forwardRef<PdfContinuousDocumentRendererHandle, {
  file: File
  pageCount: number
  pageNumber: number
  zoom?: number
  onPageChange?: (pageNumber: number) => void
}>(function PdfContinuousDocumentRenderer({ file, pageCount, pageNumber, zoom = 1, onPageChange }, forwardedRef) {
  const hostRef = useRef<HTMLDivElement>(null)
  const pageElementsRef = useRef(new Map<number, HTMLElement>())
  const panStateRef = useRef<{
    pointerId: number
    clientX: number
    clientY: number
    scrollLeft: number
    scrollTop: number
  } | null>(null)
  const scrollFrameRef = useRef<number | null>(null)
  const [hostWidth, setHostWidth] = useState(0)
  const [isPanning, setIsPanning] = useState(false)
  const [documentState, setDocumentState] = useState<{ key: string; runtime: PdfJsRuntime | null; error: string }>({ key: '', runtime: null, error: '' })
  const fileKey = `${file.name}:${file.size}:${file.lastModified}`
  const renderScheduler = useMemo(() => createPdfPageRenderScheduler(), [fileKey])
  const runtime = documentState.key === fileKey ? documentState.runtime : null
  const normalizedZoom = Math.max(0.5, Math.min(3, zoom))
  const displayWidth = Math.max(280, hostWidth - 32) * normalizedZoom
  const totalPages = Math.max(1, runtime?.pdf.numPages ?? pageCount)
  const pages = useMemo(() => Array.from({ length: totalPages }, (_, index) => index + 1), [totalPages])

  useEffect(() => () => renderScheduler.dispose(), [renderScheduler])

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
      if (!cancelled) setDocumentState({ key: fileKey, runtime: null, error: 'PDF 无法打开，文件可能损坏或受密码保护。' })
    })
    return () => {
      cancelled = true
      void loadingTask?.destroy()
    }
  }, [file, fileKey])

  const scrollToPage = useCallback((nextPage: number, behavior: ScrollBehavior = 'smooth') => {
    const host = hostRef.current
    const pageElement = pageElementsRef.current.get(Math.max(1, Math.min(totalPages, Math.round(nextPage))))
    if (!host || !pageElement) return
    const top = host.scrollTop + pageElement.getBoundingClientRect().top - host.getBoundingClientRect().top - 16
    host.scrollTo({ top, behavior })
  }, [totalPages])

  useImperativeHandle(forwardedRef, () => ({ scrollToPage }), [scrollToPage])

  const reportCurrentPage = useCallback(() => {
    const host = hostRef.current
    if (!host) return
    const readingOffset = host.scrollTop + Math.min(220, host.clientHeight * 0.32)
    const nearestPage = pdfPageAtScrollOffset(totalPages, readingOffset, (candidatePage) => {
      const element = pageElementsRef.current.get(candidatePage)
      return element ? { top: element.offsetTop, height: element.offsetHeight } : undefined
    }, pageNumber)
    if (nearestPage !== pageNumber) onPageChange?.(nearestPage)
  }, [onPageChange, pageNumber, totalPages])

  const handleScroll = () => {
    if (scrollFrameRef.current !== null) return
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null
      reportCurrentPage()
    })
  }

  useEffect(() => () => {
    if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current)
  }, [])

  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const host = event.currentTarget
    panStateRef.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, scrollLeft: host.scrollLeft, scrollTop: host.scrollTop }
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
    handleScroll()
    event.preventDefault()
  }

  const finishPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = panStateRef.current
    if (!state || state.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    panStateRef.current = null
    setIsPanning(false)
  }

  return (
    <div
      ref={hostRef}
      className={`relative h-full min-h-0 overflow-auto overscroll-contain bg-slate-900/70 p-4 [scrollbar-gutter:stable] ${isPanning ? 'cursor-grabbing select-none' : 'cursor-grab'} touch-none`}
      data-testid="pdf-continuous-document-renderer"
      data-continuous-pages="true"
      data-zoom-percent={Math.round(normalizedZoom * 100)}
      aria-label="连续 PDF 文档；滚轮可连续翻页，按住可拖动"
      onScroll={handleScroll}
      onPointerDown={startPan}
      onPointerMove={movePan}
      onPointerUp={finishPan}
      onPointerCancel={finishPan}
    >
      {!runtime && !documentState.error && <div className="sticky left-1/2 top-6 z-20 w-fit -translate-x-1/2 rounded-full border border-white/10 bg-slate-950/90 px-3 py-2 text-xs text-slate-300 shadow-xl"><LoaderCircle className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />正在打开连续 PDF</div>}
      {documentState.error ? (
        <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-rose-400/15 bg-rose-500/[0.04] p-5 text-sm leading-7 text-rose-100/80">{documentState.error}</div>
      ) : (
        <div className="flex w-max min-w-full flex-col gap-4 pb-4">
          {pages.map((candidatePage) => (
            <div
              key={candidatePage}
              ref={(element) => {
                if (element) pageElementsRef.current.set(candidatePage, element)
                else pageElementsRef.current.delete(candidatePage)
              }}
            >
              <PdfContinuousPage runtime={runtime} pageNumber={candidatePage} displayWidth={displayWidth} scrollRoot={hostRef} renderScheduler={renderScheduler} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

export default PdfContinuousDocumentRenderer
