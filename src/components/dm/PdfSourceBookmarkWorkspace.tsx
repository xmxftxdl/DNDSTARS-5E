import {
  Bookmark,
  BookmarkPlus,
  Bot,
  ChevronLeft,
  ChevronRight,
  FileText,
  LoaderCircle,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  PdfCampaignAnalysisView,
  PdfSourceBookmarkKindV1,
  PdfSourceBookmarkV1,
} from '../../lib/pdfCampaignAnalysisV2'
import { showAppConfirm } from '../../lib/appDialog'
import { createPdfDocumentIdentity } from '../../lib/pdfSourceEvidence'
import { pdfSourceRepository, type PdfSourceRepository } from '../../lib/pdfSourceRepository'
import PdfOriginalPageRenderer from './PdfOriginalPageRenderer'
import {
  buildPdfSourceBookmarkSuggestions,
  createPdfSourceBookmark,
  PDF_SOURCE_BOOKMARK_KIND_LABELS,
  pdfSourceBookmarkKey,
  pdfSourceDocuments,
} from './pdfSourceBookmarkModel'

export interface PdfSourceBookmarkTargetV1 {
  documentId: string
  page: number
  quote?: string
}

interface PdfSourceBookmarkWorkspaceProps {
  analysis: PdfCampaignAnalysisView
  bookmarks: readonly PdfSourceBookmarkV1[]
  onChange?: (bookmarks: PdfSourceBookmarkV1[]) => void
  repository?: PdfSourceRepository
  target?: PdfSourceBookmarkTargetV1
}

const fieldClass = 'mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-violet-400/40'

function clampPage(page: number, pageCount: number): number {
  return Math.max(1, Math.min(pageCount, Number.isFinite(page) ? Math.trunc(page) : 1))
}

export default function PdfSourceBookmarkWorkspace({
  analysis,
  bookmarks,
  onChange,
  repository = pdfSourceRepository,
  target,
}: PdfSourceBookmarkWorkspaceProps) {
  const documents = useMemo(() => pdfSourceDocuments(analysis), [analysis])
  const suggestions = useMemo(() => buildPdfSourceBookmarkSuggestions(analysis), [analysis])
  const initialDocument = documents.find((entry) => entry.id === target?.documentId) ?? documents[0] ?? null
  const [documentId, setDocumentId] = useState(initialDocument?.id ?? '')
  const document = documents.find((entry) => entry.id === documentId) ?? documents[0] ?? null
  const [pageNumber, setPageNumber] = useState(() => initialDocument ? clampPage(target?.page ?? 1, initialDocument.pageCount) : 1)
  const [original, setOriginal] = useState<{ key: string; file: File | null; failed: boolean }>({ key: '', file: null, failed: false })
  const [attachBusy, setAttachBusy] = useState(false)
  const [attachError, setAttachError] = useState('')
  const [selectedQuote, setSelectedQuote] = useState(() => target?.quote?.slice(0, 500) ?? '')
  const [activeBookmarkId, setActiveBookmarkId] = useState('')
  const [kind, setKind] = useState<PdfSourceBookmarkKindV1>('note')
  const [label, setLabel] = useState('')
  const [note, setNote] = useState('')
  const originalInputRef = useRef<HTMLInputElement>(null)

  const page = document ? clampPage(pageNumber, document.pageCount) : 1
  useEffect(() => {
    if (!document) return
    let cancelled = false
    void repository.loadOriginalFile(document.id).then((value) => {
      if (!cancelled) setOriginal({ key: document.id, file: value, failed: false })
    }).catch(() => {
      if (!cancelled) setOriginal({ key: document.id, file: null, failed: true })
    })
    return () => { cancelled = true }
  }, [document, repository])

  const originalFile = original.key === document?.id ? original.file : null
  const legacyDocument = document?.id.startsWith('pdf_legacy_') === true
  const loadingOriginal = Boolean(document && original.key !== document.id)
  const failedOriginal = original.key === document?.id && original.failed
  const activeBookmark = bookmarks.find((entry) => entry.id === activeBookmarkId)
  const activeQuote = activeBookmark && activeBookmark.documentId === document?.id && activeBookmark.page === page ? activeBookmark.quote : ''
  const targetQuote = target && document && target.documentId === document.id && clampPage(target.page, document.pageCount) === page ? target.quote ?? '' : ''
  const focusQuote = activeQuote || targetQuote
  const savedKeys = useMemo(() => new Set(bookmarks.map(pdfSourceBookmarkKey)), [bookmarks])
  const pageSuggestions = suggestions.filter((entry) => entry.documentId === document?.id && entry.page === page && !savedKeys.has(pdfSourceBookmarkKey(entry)))
  const documentBookmarks = bookmarks.filter((entry) => !document || entry.documentId === document.id)

  const goTo = (targetDocumentId: string, targetPage: number, bookmarkId = '') => {
    const target = documents.find((entry) => entry.id === targetDocumentId)
    if (!target) return
    setDocumentId(target.id)
    setPageNumber(clampPage(targetPage, target.pageCount))
    setActiveBookmarkId(bookmarkId)
    setSelectedQuote('')
  }

  const addBookmark = (bookmark: PdfSourceBookmarkV1) => {
    if (!onChange || savedKeys.has(pdfSourceBookmarkKey(bookmark))) return
    onChange([...bookmarks, bookmark])
    setActiveBookmarkId(bookmark.id)
  }

  const addManualBookmark = () => {
    if (!document || !label.trim() || !onChange) return
    const bookmark = createPdfSourceBookmark({
      documentId: document.id,
      documentName: document.name,
      page,
      kind,
      label,
      quote: selectedQuote,
      note,
      origin: 'dm',
    })
    addBookmark(bookmark)
    setLabel('')
    setNote('')
    setSelectedQuote('')
  }

  const deleteBookmark = async (bookmark: PdfSourceBookmarkV1) => {
    if (!onChange) return
    const confirmed = await showAppConfirm({
      title: '删除原文书签',
      message: `确定删除“${bookmark.label}”吗？原 PDF 与 AI 分析结果不会被删除。`,
      confirmLabel: '删除书签',
      cancelLabel: '取消',
      tone: 'danger',
    })
    if (!confirmed) return
    onChange(bookmarks.filter((entry) => entry.id !== bookmark.id))
    if (activeBookmarkId === bookmark.id) setActiveBookmarkId('')
  }

  const captureSelection = (text: string) => {
    setSelectedQuote(text.slice(0, 500))
    if (!label.trim()) setLabel(text.replace(/\s+/g, ' ').slice(0, 36))
  }

  const attachOriginalPdf = async (file: File) => {
    if (!document) return
    setAttachBusy(true)
    setAttachError('')
    try {
      const identity = await createPdfDocumentIdentity(new Uint8Array(await file.arrayBuffer()))
      if (identity.id !== document.id || identity.sha256 !== document.sha256) {
        setAttachError('这不是分析时使用的同一份 PDF。文件内容哈希不一致，为避免书签跳到错误页，未进行替换。')
        return
      }
      await repository.saveOriginalFile(document.id, file)
      setOriginal({ key: document.id, file, failed: false })
    } catch {
      setAttachError('无法保存原 PDF。请确认文件未损坏，并检查浏览器是否允许本机存储。')
    } finally {
      setAttachBusy(false)
      if (originalInputRef.current) originalInputRef.current.value = ''
    }
  }

  if (documents.length === 0) return (
    <div className="rounded-2xl border border-amber-400/15 bg-amber-500/[0.035] p-5 text-sm leading-7 text-amber-100/80">
      当前是旧版分析结果，只有文件名和页码，没有可安全打开的本机原文索引。重新附加同一份 PDF 并运行分析后，即可在 APP 内阅读并建立书签。
    </div>
  )

  return (
    <div className="grid min-h-[42rem] gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]" data-testid="pdf-source-bookmark-workspace">
      <section className="overflow-hidden rounded-2xl border border-sky-400/15 bg-black/15">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 p-3">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-sky-300" />
            <select value={document?.id ?? ''} onChange={(event) => { setDocumentId(event.target.value); setPageNumber(1); setActiveBookmarkId(''); setAttachError('') }} className="max-w-md rounded-lg border border-white/10 bg-slate-950 px-2.5 py-2 text-xs text-slate-100 outline-none">
              {documents.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" disabled={page <= 1} onClick={() => { setPageNumber(page - 1); setActiveBookmarkId('') }} aria-label="上一页" className="rounded-lg border border-white/10 p-2 text-slate-300 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
            <label className="flex items-center gap-1.5 text-xs text-slate-400">
              第<input type="number" min={1} max={document?.pageCount ?? 1} value={page} onChange={(event) => { setPageNumber(clampPage(Number(event.target.value), document?.pageCount ?? 1)); setActiveBookmarkId('') }} className="w-16 rounded-lg border border-white/10 bg-slate-950 px-2 py-1.5 text-center text-slate-100 outline-none" />页
            </label>
            <span className="text-xs text-slate-600">/ {document?.pageCount ?? 0}</span>
            <button type="button" disabled={page >= (document?.pageCount ?? 1)} onClick={() => { setPageNumber(page + 1); setActiveBookmarkId('') }} aria-label="下一页" className="rounded-lg border border-white/10 p-2 text-slate-300 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </header>

        <div className="border-b border-emerald-400/10 bg-emerald-500/[0.025] px-4 py-2 text-[10px] leading-5 text-emerald-100/75">
          完整页文只从此设备读取；战役仅保存书签短引、页码和 DM 备注。选中下方原文即可快速建立书签。
        </div>

        {focusQuote && <blockquote className="border-b border-amber-400/15 bg-amber-500/[0.035] px-4 py-2 text-[10px] leading-5 text-amber-100/85">当前定位短引：“{focusQuote}”</blockquote>}

        {loadingOriginal ? (
          <div className="grid min-h-[32rem] place-items-center text-sm text-slate-500"><LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />正在读取原 PDF……</div>
        ) : failedOriginal || !originalFile ? (
          <div className="grid min-h-[32rem] place-items-center p-5">
            <div className="max-w-xl rounded-2xl border border-amber-400/15 bg-amber-500/[0.035] p-6 text-center">
              <FileText className="mx-auto h-8 w-8 text-amber-300" />
              <h3 className="mt-3 text-sm font-semibold text-amber-100">{legacyDocument ? '旧版分析需要重新运行' : '需要重新附加原 PDF'}</h3>
              <p className="mt-2 text-xs leading-6 text-amber-100/70">{legacyDocument
                ? '这份历史分析没有保存真实文件哈希，无法安全确认原文版本。请在“导入与复核”重新附加 PDF 并运行一次分析，已有战役内容不会被自动覆盖。'
                : '此前版本只保留了检索文字，没有长期保存 PDF 页面。重新选择分析时使用的同一文件后，APP 会校验哈希并恢复原排版、图片和可选择文字层。'}</p>
              {!legacyDocument && <>
                <input ref={originalInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void attachOriginalPdf(file) }} />
                <button type="button" disabled={attachBusy} onClick={() => originalInputRef.current?.click()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-500/15 px-4 py-2.5 text-xs font-semibold text-amber-100 disabled:opacity-40">{attachBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{attachBusy ? '正在校验 PDF' : '重新附加同一 PDF'}</button>
              </>}
              {attachError && <p className="mt-3 rounded-xl border border-rose-400/15 bg-rose-500/[0.04] px-3 py-2 text-left text-[10px] leading-5 text-rose-100/85">{attachError}</p>}
            </div>
          </div>
        ) : (
          <PdfOriginalPageRenderer file={originalFile} pageNumber={page} onTextSelect={captureSelection} />
        )}
      </section>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-violet-400/15 bg-violet-500/[0.025] p-4">
          <div className="flex items-center gap-2"><BookmarkPlus className="h-4 w-4 text-violet-300" /><h3 className="text-sm font-semibold text-slate-100">添加书签</h3></div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-[10px] font-semibold text-slate-500">类型<select value={kind} onChange={(event) => setKind(event.target.value as PdfSourceBookmarkKindV1)} className={fieldClass}>{Object.entries(PDF_SOURCE_BOOKMARK_KIND_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
            <label className="text-[10px] font-semibold text-slate-500">页码<input readOnly value={page} className={`${fieldClass} text-slate-500`} /></label>
          </div>
          <label className="mt-2 block text-[10px] font-semibold text-slate-500">名称<input value={label} maxLength={160} onChange={(event) => setLabel(event.target.value)} placeholder="例如：瑟维迪尔首次登场" className={fieldClass} /></label>
          <label className="mt-2 block text-[10px] font-semibold text-slate-500">原文短引<textarea value={selectedQuote} maxLength={500} rows={3} onChange={(event) => setSelectedQuote(event.target.value)} placeholder="在左侧选中原文，或在此粘贴短引" className={`${fieldClass} resize-y`} /></label>
          <label className="mt-2 block text-[10px] font-semibold text-slate-500">DM 备注<textarea value={note} maxLength={2000} rows={3} onChange={(event) => setNote(event.target.value)} placeholder="出场方式、秘密、需要提醒的规则……" className={`${fieldClass} resize-y`} /></label>
          <button type="button" disabled={!onChange || !label.trim()} onClick={addManualBookmark} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-violet-500 px-3 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-3.5 w-3.5" />保存书签</button>
        </section>

        <section className="rounded-2xl border border-cyan-400/15 bg-cyan-500/[0.025] p-4">
          <div className="flex items-start justify-between gap-3">
            <div><h3 className="flex items-center gap-2 text-sm font-semibold text-cyan-100"><Sparkles className="h-4 w-4" />AI 分析建议</h3><p className="mt-1 text-[10px] leading-5 text-slate-500">来自人物、地点、势力、线索、事件和怪物的已验证原文引用。</p></div>
            <span className="rounded-full bg-cyan-500/10 px-2 py-1 text-[9px] text-cyan-200">本页 {pageSuggestions.length}</span>
          </div>
          {pageSuggestions.length === 0 ? <p className="mt-3 text-xs leading-6 text-slate-600">本页没有尚待确认的 AI 书签。</p> : <div className="mt-3 space-y-2">{pageSuggestions.map((suggestion) => (
            <article key={suggestion.id} className="rounded-xl border border-white/8 bg-black/15 p-3">
              <div className="flex items-start justify-between gap-2"><div><p className="text-xs font-semibold text-slate-100">{suggestion.label}</p><p className="mt-0.5 text-[9px] text-cyan-300">{PDF_SOURCE_BOOKMARK_KIND_LABELS[suggestion.kind]}</p></div><button type="button" disabled={!onChange} onClick={() => addBookmark(suggestion)} className="shrink-0 rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold text-cyan-100">添加</button></div>
              {suggestion.quote && <p className="mt-2 line-clamp-3 text-[10px] leading-5 text-slate-400">“{suggestion.quote}”</p>}
            </article>
          ))}</div>}
        </section>

        <section className="rounded-2xl border border-white/8 bg-black/15 p-4">
          <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100"><Bookmark className="h-4 w-4 text-amber-300" />已保存书签</h3><span className="text-[10px] text-slate-500">{documentBookmarks.length}</span></div>
          {documentBookmarks.length === 0 ? <p className="mt-3 text-xs leading-6 text-slate-600">这份文档还没有书签。</p> : <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">{documentBookmarks.map((bookmark) => (
            <article key={bookmark.id} className={`rounded-xl border p-3 ${bookmark.id === activeBookmarkId ? 'border-amber-300/30 bg-amber-500/[0.055]' : 'border-white/8 bg-white/[0.018]'}`}>
              <button type="button" onClick={() => goTo(bookmark.documentId, bookmark.page, bookmark.id)} className="w-full text-left">
                <div className="flex items-center gap-2"><span className="rounded-md bg-amber-500/10 px-1.5 py-1 text-[9px] text-amber-200">第 {bookmark.page} 页</span><span className="text-[9px] text-violet-300">{PDF_SOURCE_BOOKMARK_KIND_LABELS[bookmark.kind]}</span>{bookmark.origin === 'ai' && <Bot className="h-3 w-3 text-cyan-300" />}</div>
                <p className="mt-2 text-xs font-semibold text-slate-100">{bookmark.label}</p>
                {bookmark.note && <p className="mt-1 line-clamp-2 text-[10px] leading-5 text-slate-500">{bookmark.note}</p>}
              </button>
              {onChange && <button type="button" onClick={() => void deleteBookmark(bookmark)} className="mt-2 inline-flex items-center gap-1 text-[10px] text-rose-300/75 hover:text-rose-200"><Trash2 className="h-3 w-3" />删除</button>}
            </article>
          ))}</div>}
        </section>
      </aside>
    </div>
  )
}
