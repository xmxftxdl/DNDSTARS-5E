import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Upload, X, ZoomIn, ZoomOut } from 'lucide-react'
import { readPdfReadingState, savePdfReadingState, normalizePdfReadingState, pdfPageLink, searchPdf, pdfOutline, renderPdfShare, type PdfReadingState, type PdfSearchHit } from '../../lib/pdfReaderExperience'
import { getRoomSession } from '../../lib/roomSession'
const PdfShareDialog = lazy(() => import('./PdfShareDialog'))
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

export default function PdfSplitViewPanel({ request, onClose, embedded = false }: {
  request: PdfSplitViewRequest; onClose: () => void; embedded?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const readerRef = useRef<PdfContinuousDocumentRendererHandle>(null)
  const [documents, setDocuments] = useState<PdfDocumentRecordV2[]>([])
  const [opened, setOpened] = useState<{ document: PdfDocumentRecordV2; file: File; initial: PdfReadingState; key: number } | null>(null)
  const [reading, setReading] = useState<PdfReadingState>(() => normalizePdfReadingState({}, 1))
  const current = useRef(opened)
  const readingRef = useRef(reading)
  const sequence = useRef(0)
  const searchAbort = useRef<AbortController | null>(null)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [drawer, setDrawer] = useState<'search' | 'outline' | 'saved' | null>(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<PdfSearchHit[]>([])
  const [searchBusy, setSearchBusy] = useState(false)
  const [searchNote, setSearchNote] = useState('')
  const [hitIndex, setHitIndex] = useState(0)
  const [searchedQuery, setSearchedQuery] = useState('')
  const [searchHint, setSearchHint] = useState('')
  const [shareImage, setShareImage] = useState<string | null>(null)
  const persist = (next: PdfReadingState) => {
    readingRef.current = next
    setReading(next)
    if (current.current) savePdfReadingState(current.current.document.id, next)
  }
  const load = async (id?: string, upload?: File, requestedPage?: number) => {
    const token = ++sequence.current
    searchAbort.current?.abort()
    setBusy(true); setReady(false); setError(''); setHits([]); setSearchNote(''); setSearchBusy(false); setShareImage(null)
    try {
      const saved = upload ? await saveReaderPdf(upload) : null
      const list = await pdfSourceRepository.listDocuments()
      if (token !== sequence.current) return
      setDocuments(list)
      const document = saved ?? (id ? list.find(item => item.id === id) : list[0])
      if (!document) throw new Error(id ? '当前设备没有这份 PDF。请上传同一文件后重新打开页码链接。' : '请从书目菜单上传 PDF。')
      const file = upload ?? await pdfSourceRepository.loadOriginalFile(document.id)
      if (token !== sequence.current) return
      if (!file) throw new Error('当前设备没有原文件，请重新上传同一份 PDF。')
      const initial = readPdfReadingState(document.id, document.pageCount)
      if (requestedPage !== undefined) { initial.page = Math.max(1, Math.min(document.pageCount, requestedPage)); initial.fraction = 0 }
      const next = { document, file, initial, key: token }
      current.current = next; readingRef.current = initial
      setOpened(next); setReading(initial)
    } catch (cause) { if (token === sequence.current) { current.current = null; setOpened(null); setError(cause instanceof Error ? cause.message : 'PDF 打开失败') } }
    finally { if (token === sequence.current) setBusy(false) }
  }
  useEffect(() => {
    // The request is an external navigation command that starts an asynchronous file load.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(request.documentId, request.file, request.page)
    const navigation = sequence
    const activeSearch = searchAbort
    return () => { navigation.current++; activeSearch.current?.abort() }
    // Each request is an explicit navigation; reader state is maintained separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.requestId])
  const total = opened?.document.pageCount ?? 1
  const go = (page: number, back = false) => {
    if (!Number.isFinite(page)) return
    const next = Math.max(1, Math.min(total, Math.round(page)))
    const state = readingRef.current
    persist({ ...state, page: next, fraction: 0, recent: back ? state.recent.slice(1) : [state.page, ...state.recent.filter(n => n !== state.page)].slice(0, 50) })
    readerRef.current?.scrollToPage(next, 'instant')
  }
  const lookup = async (mode: 'search' | 'outline') => {
    searchAbort.current?.abort()
    const controller = new AbortController(); searchAbort.current = controller
    setDrawer(mode); setSearchBusy(true); setHits([]); setHitIndex(0); setSearchedQuery(''); setSearchHint(''); setSearchNote('')
    try {
      const pdf = readerRef.current?.getPdf()
      if (!pdf || !opened) throw new Error('PDF 正在打开，请稍后重试。')
      if (mode === 'outline') {
        const result = await pdfOutline(pdf)
        if (!controller.signal.aborted) { setHits(result); setSearchNote(result.length ? '' : '这份 PDF 没有内置目录，可使用搜索或收藏定位。') }
      } else {
        const result = await searchPdf(pdf, opened.document.id, query, controller.signal)
        if (!controller.signal.aborted) {
          setHits(result.hits); setSearchedQuery(query.trim())
          setSearchHint(result.unsearchable ? `${result.unsearchable} 页没有可搜索文字，需先在备团助手进行 OCR。` : '')
          if (result.hits.length) go(result.hits[0].page)
        }
      }
    } catch (cause) { if (!controller.signal.aborted) setSearchNote(cause instanceof Error ? cause.message : '读取失败') }
    finally { if (!controller.signal.aborted) setSearchBusy(false) }
  }
  const moveHit = (delta: number) => {
    if (!hits.length) return
    const next = (hitIndex + delta + hits.length) % hits.length
    setHitIndex(next); go(hits[next].page)
  }
  const share = async () => {
    setError(''); setBusy(true)
    const token = sequence.current
    try {
      const pdf = readerRef.current?.getPdf()
      if (!pdf) throw new Error('请等待 PDF 打开。')
      const image = await renderPdfShare(pdf, reading.page)
      if (token === sequence.current) setShareImage(image)
    } catch (cause) { if (token === sequence.current) setError(cause instanceof Error ? cause.message : '页面生成失败') }
    finally { if (token === sequence.current) setBusy(false) }
  }
  const pageLabel = (page: number) => `${page - reading.offset}（PDF ${page}）`
  return <aside aria-label="PDF 分屏阅读器" data-testid="pdf-split-view-panel" className={`pdf-reader relative flex min-h-0 flex-col bg-slate-950 text-xs text-slate-200 ${embedded ? 'h-full w-full' : 'h-screen w-[clamp(24rem,42vw,48rem)]'}`}>
    <header className="flex shrink-0 flex-wrap items-center gap-1 border-b border-white/10 p-2">
      <select aria-label="书目菜单" disabled={busy} value={opened?.document.id ?? ''} onChange={event => { if (event.target.value === 'upload') inputRef.current?.click(); else if (event.target.value) void load(event.target.value) }} className="min-w-0 max-w-48 flex-1 truncate rounded bg-slate-900 p-1.5">
        <option value="">选择资料</option>{documents.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}<option value="upload">＋ 上传 PDF…</option>
      </select>
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void load(undefined, file) }} />
      <button disabled={!ready || busy} onClick={() => void lookup('outline')}>目录</button>
      <button disabled={!opened} onClick={() => { searchAbort.current?.abort(); setSearchBusy(false); setHits([]); setHitIndex(0); setSearchedQuery(''); setSearchHint(''); setSearchNote(''); setDrawer(drawer === 'search' ? null : 'search') }}>搜索</button>
      <button disabled={!opened} onClick={() => setDrawer(drawer === 'saved' ? null : 'saved')}>收藏</button>
      <button title="关闭 PDF" aria-label="关闭 PDF" onClick={onClose}><X size={16} /></button>
    </header>
    {opened && <>
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-white/10 p-2">
        <button title="返回上次跳转位置" disabled={!reading.recent.length} onClick={() => go(reading.recent[0], true)}>返回</button>
        <button aria-label="上一页" disabled={reading.page <= 1} onClick={() => go(reading.page - 1)}><ChevronLeft size={16} /></button>
        <input key={`${opened.key}:${reading.page}:${reading.offset}`} aria-label="印刷页码，回车跳转" title={`PDF 第 ${reading.page} / ${total} 页`} type="number" defaultValue={reading.page - reading.offset} onKeyDown={e => { if (e.key === 'Enter') go(Number(e.currentTarget.value) + reading.offset) }} onBlur={e => { if (e.currentTarget.value && Number(e.currentTarget.value) + reading.offset !== reading.page) go(Number(e.currentTarget.value) + reading.offset) }} className="w-14 rounded bg-slate-800 p-1 text-center" />
        <span title="PDF 物理页">PDF {reading.page}/{total}</span>
        <button aria-label="下一页" disabled={reading.page >= total} onClick={() => go(reading.page + 1)}><ChevronRight size={16} /></button>
        <button aria-label="缩小 PDF" disabled={reading.zoom <= .75} onClick={() => persist({ ...readingRef.current, zoom: Math.max(.75, reading.zoom - .25) })}><ZoomOut size={16} /></button>
        <button title="适合宽度" onClick={() => { readerRef.current?.fitToWidth(); persist({ ...readingRef.current, zoom: 1 }) }}>{reading.zoom === 1 ? '适合宽度' : `${Math.round(reading.zoom * 100)}%`}</button>
        <button aria-label="放大 PDF" disabled={reading.zoom >= 2} onClick={() => persist({ ...readingRef.current, zoom: Math.min(2, reading.zoom + .25) })}><ZoomIn size={16} /></button>
        <button title="复制页码链接，可粘贴到地图备注、日志或法术资料中" onClick={() => void navigator.clipboard.writeText(pdfPageLink(opened.document.id, reading.page)).then(() => setError('页码链接已复制。')).catch(() => setError('复制失败，请检查浏览器剪贴板权限。'))}>页码链接</button>
        {getRoomSession()?.role === 'dm' && <button disabled={busy || !ready} onClick={() => void share()}>向玩家展示</button>}
      </div>
      {drawer && <section aria-label="PDF 导航" className="max-h-[40%] shrink-0 overflow-auto border-b border-white/10 bg-slate-900 p-3">
        <button className="float-right" aria-label="关闭导航" onClick={() => { searchAbort.current?.abort(); setDrawer(null) }}>×</button>
        {drawer === 'search' && <>
          <form onSubmit={e => { e.preventDefault(); if (searchedQuery === query.trim() && hits.length) moveHit(1); else void lookup('search') }} className="flex items-center gap-1">
            <input aria-label="搜索 PDF 全文" value={query} onChange={e => { searchAbort.current?.abort(); setSearchBusy(false); setQuery(e.target.value); setHits([]); setHitIndex(0); setSearchedQuery(''); setSearchHint(''); setSearchNote('') }} onKeyDown={e => { if (e.key === 'Enter' && e.shiftKey && searchedQuery === query.trim() && hits.length) { e.preventDefault(); moveHit(-1) } }} placeholder="搜索全文…" className="min-w-0 flex-1 rounded bg-slate-800 p-2" />
            <span role="status" aria-label="匹配页计数" title={searchHint || '当前匹配页 / 匹配页总数'} className="shrink-0 px-2 tabular-nums text-slate-400">{searchBusy ? '…' : `${hits.length ? hitIndex + 1 : 0}/${hits.length}`}</span>
            <button disabled={!query.trim() || searchBusy || !ready || busy}>查找</button>
            <button type="button" aria-label="上一个匹配页" title="上一个匹配页（Shift+Enter）" disabled={!hits.length || searchBusy} onClick={() => moveHit(-1)}><ChevronLeft size={14} /></button>
            <button type="button" aria-label="下一个匹配页" title="下一个匹配页（Enter）" disabled={!hits.length || searchBusy} onClick={() => moveHit(1)}><ChevronRight size={14} /></button>
          </form>
          {searchNote && <p role="alert" className="mt-2 text-amber-200">{searchNote}</p>}
        </>}
        {drawer === 'outline' && <><p role="status" className="my-2 text-slate-400">{searchBusy ? '正在查找…' : searchNote}</p>{hits.map((hit, index) => <button key={index} className="block w-full text-left" onClick={() => go(hit.page)}>{pageLabel(hit.page)} · {hit.text}</button>)}</>}
        {drawer === 'saved' && <>
          <button onClick={() => persist({ ...readingRef.current, bookmarks: reading.bookmarks.includes(reading.page) ? reading.bookmarks.filter(p => p !== reading.page) : [...reading.bookmarks, reading.page].slice(-50) })}>{reading.bookmarks.includes(reading.page) ? '取消本页收藏' : '收藏当前页'}</button>
          <label className="my-2 block">页码偏移（PDF 页 − 印刷页）<input aria-label="印刷页码偏移" type="number" value={reading.offset} onChange={e => persist({ ...readingRef.current, offset: Number(e.target.value) || 0 })} className="ml-2 w-16 rounded bg-slate-800 p-1" /></label>
          <p className="text-slate-400">当前：印刷第 {reading.page - reading.offset} 页 / PDF 第 {reading.page} 页</p>
          <p className="mt-3">收藏</p>{reading.bookmarks.map(p => <button key={p} onClick={() => go(p)}>{pageLabel(p)}</button>)}
          <p className="mt-3">最近阅读</p>{reading.recent.map(p => <button key={p} onClick={() => go(p)}>{pageLabel(p)}</button>)}
        </>}
      </section>}
      <div className="min-h-0 flex-1 overflow-hidden"><PdfContinuousDocumentRenderer ref={readerRef} key={opened.key} file={opened.file} pageCount={total} pageNumber={reading.page} zoom={reading.zoom} initialPosition={opened.initial} onReady={setReady}
        onPositionChange={position => { const state = readingRef.current; persist({ ...state, ...position, recent: position.page !== state.page ? [state.page, ...state.recent.filter(n => n !== state.page)].slice(0, 50) : state.recent }) }} /></div>
      <p className="shrink-0 px-2 py-1 text-[10px] text-slate-500">拖动选择文字 · 按住空格拖动页面</p>
    </>}
    {!opened && <div className="grid flex-1 place-content-center gap-4 p-6 text-center"><p>{busy ? '正在读取 PDF…' : '打开本机 PDF 资料'}</p><button disabled={busy} onClick={() => inputRef.current?.click()}><Upload className="inline h-4 w-4" /> 上传 PDF</button></div>}
    {error && <p role="status" className="shrink-0 bg-amber-950/40 p-2 text-amber-200">{error}</p>}
    {shareImage && <Suspense fallback={<p className="absolute inset-0 z-50 bg-slate-950 p-6">正在准备展示…</p>}><PdfShareDialog image={shareImage} onClose={() => setShareImage(null)} /></Suspense>}
  </aside>
}
