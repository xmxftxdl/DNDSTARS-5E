import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  FileText,
  Hand,
  LoaderCircle,
  PanelLeftClose,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { PdfDocumentRecordV2 } from '../../lib/pdfCampaignAnalysisV2'
import { createPdfDocumentIdentity } from '../../lib/pdfSourceEvidence'
import { pdfSourceRepository } from '../../lib/pdfSourceRepository'
import type { PdfSplitViewRequest } from '../../lib/pdfSplitViewController'
import { isPdfSplitViewFile } from '../../lib/pdfSplitViewFile'
import PdfContinuousDocumentRenderer, { type PdfContinuousDocumentRendererHandle } from './PdfContinuousDocumentRenderer'

async function inspectPdf(file: File): Promise<{ id: string; sha256: string; pageCount: number }> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const identity = await createPdfDocumentIdentity(bytes)
  const [pdfJs, workerModule] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfJs.GlobalWorkerOptions.workerSrc = workerModule.default
  const loadingTask = pdfJs.getDocument({ data: bytes.slice() })
  try {
    const pdf = await loadingTask.promise
    return { ...identity, pageCount: pdf.numPages }
  } finally {
    await loadingTask.destroy()
  }
}

async function saveReaderPdf(file: File): Promise<PdfDocumentRecordV2> {
  if (!isPdfSplitViewFile(file)) throw new Error('只支持 100MB 以内的 PDF 文件。')
  let metadata: Awaited<ReturnType<typeof inspectPdf>>
  try {
    metadata = await inspectPdf(file)
  } catch {
    throw new Error('PDF 无法打开，文件可能损坏、加密或不是有效的 PDF。')
  }
  const existing = await pdfSourceRepository.loadDocument(metadata.id)
  if (existing) {
    await pdfSourceRepository.saveOriginalFile(existing.id, file)
    return existing
  }
  const document: PdfDocumentRecordV2 = {
    id: metadata.id,
    name: file.name,
    mimeType: 'application/pdf',
    sha256: metadata.sha256,
    sizeBytes: file.size,
    pageCount: metadata.pageCount,
    extractedCharacters: 0,
    scannedPages: [],
  }
  await pdfSourceRepository.saveDocument(document, [], file)
  return document
}

export default function PdfSplitViewPanel({ request, onClose }: {
  request: PdfSplitViewRequest
  onClose: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const readerRef = useRef<PdfContinuousDocumentRendererHandle>(null)
  const [documents, setDocuments] = useState<PdfDocumentRecordV2[]>([])
  const [document, setDocument] = useState<PdfDocumentRecordV2 | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refreshDocuments = useCallback(async () => {
    const next = await pdfSourceRepository.listDocuments()
    setDocuments(next)
    return next
  }, [])

  const openStoredDocument = useCallback(async (nextDocument: PdfDocumentRecordV2) => {
    setBusy(true)
    setError('')
    try {
      const original = await pdfSourceRepository.loadOriginalFile(nextDocument.id)
      setDocument(nextDocument)
      setPage(1)
      setFile(original)
      if (!original) setError('当前设备没有保留这份原 PDF。请点击“上传 PDF”重新附加同一文件。')
    } catch {
      setFile(null)
      setDocument(nextDocument)
      setError('无法读取本机 PDF，请重新上传。')
    } finally {
      setBusy(false)
    }
  }, [])

  const openUploadedFile = useCallback(async (nextFile: File) => {
    setBusy(true)
    setError('')
    try {
      const savedDocument = await saveReaderPdf(nextFile)
      setDocument(savedDocument)
      setFile(nextFile)
      setPage(1)
      await refreshDocuments()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'PDF 上传失败。')
    } finally {
      setBusy(false)
    }
  }, [refreshDocuments])

  useEffect(() => {
    let cancelled = false
    const initialize = async () => {
      setBusy(true)
      setError('')
      try {
        if (request.file) {
          const savedDocument = await saveReaderPdf(request.file)
          if (cancelled) return
          setDocument(savedDocument)
          setFile(request.file)
          setPage(1)
          const next = await pdfSourceRepository.listDocuments()
          if (!cancelled) setDocuments(next)
          return
        }
        const next = await pdfSourceRepository.listDocuments()
        if (cancelled) return
        setDocuments(next)
        const target = next.find((entry) => entry.id === request.documentId) ?? next[0]
        if (!target) {
          setDocument(null)
          setFile(null)
          return
        }
        const original = await pdfSourceRepository.loadOriginalFile(target.id)
        if (cancelled) return
        setDocument(target)
        setFile(original)
        setPage(1)
        if (!original) setError('当前设备没有保留这份原 PDF。请点击“上传 PDF”重新附加同一文件。')
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : '无法打开 PDF 分屏。')
      } finally {
        if (!cancelled) setBusy(false)
      }
    }
    void initialize()
    return () => { cancelled = true }
  }, [request.documentId, request.file, request.requestId])

  const totalPages = Math.max(1, document?.pageCount ?? 1)
  const changePage = (next: number) => {
    const normalizedPage = Math.max(1, Math.min(totalPages, Math.round(next)))
    setPage(normalizedPage)
    readerRef.current?.scrollToPage(normalizedPage)
  }

  return (
    <aside
      className="relative z-[80] flex h-screen w-[clamp(24rem,42vw,48rem)] shrink-0 flex-col border-r border-sky-300/15 bg-slate-950 shadow-[14px_0_36px_rgba(0,0,0,0.36)]"
      aria-label="PDF 分屏阅读器"
      data-testid="pdf-split-view-panel"
    >
      <header className="shrink-0 border-b border-white/10 bg-gradient-to-r from-sky-500/[0.09] to-violet-500/[0.05] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-sky-300/15 bg-sky-500/10 p-2 text-sky-200">
            <BookOpenText className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-slate-100">PDF 分屏阅读</h2>
            <p className="truncate text-[10px] text-slate-500">{document?.name ?? '选择备团资料或上传本机 PDF'}</p>
          </div>
          <button type="button" onClick={onClose} title="关闭 PDF 分屏" className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-slate-100">
            <PanelLeftClose className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <select
            value={document?.id ?? ''}
            onChange={(event) => {
              const selected = documents.find((entry) => entry.id === event.target.value)
              if (selected) void openStoredDocument(selected)
            }}
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900 px-2.5 py-2 text-xs text-slate-200 outline-none focus:border-sky-400/40"
            aria-label="选择本机 PDF"
          >
            <option value="">选择备团助手中的 PDF…</option>
            {documents.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </select>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(event) => {
              const nextFile = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              if (nextFile) void openUploadedFile(nextFile)
            }}
          />
          <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-sky-300/15 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-500/15 disabled:opacity-40">
            <Upload className="h-4 w-4" />上传 PDF
          </button>
        </div>
      </header>

      {file && document ? (
        <>
          <div className="flex shrink-0 items-center justify-center gap-2 border-b border-white/8 bg-black/20 px-3 py-2">
            <button type="button" disabled={page <= 1} onClick={() => changePage(page - 1)} title="上一页" className="rounded-lg p-1.5 text-slate-300 hover:bg-white/5 disabled:text-slate-700"><ChevronLeft className="h-4 w-4" /></button>
            <label className="flex items-center gap-1.5 text-xs text-slate-400">
              第
              <input type="number" min={1} max={totalPages} value={page} onChange={(event) => changePage(Number(event.target.value))} className="w-16 rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-center text-xs text-slate-100 outline-none" />
              / {totalPages} 页
            </label>
            <button type="button" disabled={page >= totalPages} onClick={() => changePage(page + 1)} title="下一页" className="rounded-lg p-1.5 text-slate-300 hover:bg-white/5 disabled:text-slate-700"><ChevronRight className="h-4 w-4" /></button>
            <span className="mx-1 h-5 w-px bg-white/10" aria-hidden="true" />
            <button type="button" disabled={zoom <= 0.75} onClick={() => setZoom((value) => Math.max(0.75, value - 0.25))} title="缩小 PDF" aria-label="缩小 PDF" className="rounded-lg p-1.5 text-slate-300 hover:bg-white/5 disabled:text-slate-700"><ZoomOut className="h-4 w-4" /></button>
            <button type="button" onClick={() => setZoom(1)} title="恢复为适合宽度" className="min-w-12 rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-center text-[11px] font-medium text-slate-200 hover:bg-slate-800">{Math.round(zoom * 100)}%</button>
            <button type="button" disabled={zoom >= 2} onClick={() => setZoom((value) => Math.min(2, value + 0.25))} title="放大 PDF" aria-label="放大 PDF" className="rounded-lg p-1.5 text-slate-300 hover:bg-white/5 disabled:text-slate-700"><ZoomIn className="h-4 w-4" /></button>
            <span className="ml-1 inline-flex items-center gap-1 text-[10px] text-slate-500" title="页面连续排列；滚轮直接跨页，按住页面可上下左右拖动"><Hand className="h-3.5 w-3.5" />连续</span>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <PdfContinuousDocumentRenderer
              ref={readerRef}
              key={`${document.id}:${file.lastModified}`}
              file={file}
              pageCount={totalPages}
              pageNumber={page}
              onPageChange={setPage}
              zoom={zoom}
            />
          </div>
        </>
      ) : (
        <div className="grid min-h-0 flex-1 place-items-center p-8 text-center">
          <div className="max-w-sm">
            {busy ? <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-sky-300" /> : <FileText className="mx-auto h-10 w-10 text-slate-700" />}
            <h3 className="mt-4 text-sm font-semibold text-slate-200">{busy ? '正在读取 PDF' : '在左侧打开一份 PDF'}</h3>
            <p className="mt-2 text-xs leading-6 text-slate-500">可以选择备团助手已经保存在本机的原文，也可以仅在这里上传一份 PDF。文件不会跟随房间同步。</p>
            {!busy && <button type="button" onClick={() => inputRef.current?.click()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-xs font-semibold text-slate-950 hover:bg-sky-400"><Upload className="h-4 w-4" />上传 PDF</button>}
          </div>
        </div>
      )}

      {error && <div className="shrink-0 border-t border-amber-400/15 bg-amber-500/[0.06] px-4 py-3 text-xs leading-5 text-amber-200">{error}</div>}
    </aside>
  )
}
