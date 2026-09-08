import { Bookmark, FileSearch, FileText, LoaderCircle, ShieldCheck, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { PdfSourceCitationV2, PdfSourcePageV2 } from '../../lib/pdfCampaignAnalysisV2'
import { pdfSourceRepository, type PdfSourceRepository } from '../../lib/pdfSourceRepository'
import PdfOriginalPageRenderer from './PdfOriginalPageRenderer'
import { isPdfSourceCitationV2, splitPdfSourceHighlight, type PdfViewCitation } from './pdfSourceEvidenceViewModel'

export function PdfCitationButtons({ citations, onOpen }: {
  citations: readonly PdfViewCitation[]
  onOpen: (citation: PdfViewCitation) => void
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {citations.slice(0, 4).map((citation, index) => (
        <button
          key={`${citation.documentName}:${citation.page}:${isPdfSourceCitationV2(citation) ? citation.evidenceId : index}`}
          type="button"
          onClick={() => onOpen(citation)}
          className="inline-flex items-center gap-1 rounded-lg border border-sky-400/15 bg-sky-500/[0.045] px-2 py-1 text-[10px] font-medium text-sky-200 transition hover:border-sky-300/30 hover:bg-sky-500/10"
        >
          <FileSearch className="h-3 w-3" />{citation.documentName} · 第 {citation.page} 页 · 查看原文
        </button>
      ))}
    </div>
  )
}

export default function PdfSourceEvidenceDrawer({ citation, onClose, onOpenWorkspace, repository = pdfSourceRepository }: {
  citation: PdfViewCitation | null
  onClose: () => void
  onOpenWorkspace?: (citation: PdfSourceCitationV2) => void
  repository?: PdfSourceRepository
}) {
  const v2 = citation && isPdfSourceCitationV2(citation) && citation.verification !== 'legacy'
    ? citation
    : null
  const citationKey = v2 ? `${v2.documentId}:${v2.page}:${v2.evidenceId}` : ''
  const [loaded, setLoaded] = useState<{ key: string; page: PdfSourcePageV2 | null; originalFile: File | null; failed: boolean }>({
    key: '',
    page: null,
    originalFile: null,
    failed: false,
  })

  useEffect(() => {
    if (!v2) return
    let cancelled = false
    void Promise.all([
      repository.loadPage(v2.documentId, v2.page).catch(() => null),
      repository.loadOriginalFile(v2.documentId).catch(() => null),
    ]).then(([page, originalFile]) => {
      if (!cancelled) setLoaded({ key: citationKey, page, originalFile, failed: !page && !originalFile })
    }).catch(() => {
      if (!cancelled) setLoaded({ key: citationKey, page: null, originalFile: null, failed: true })
    })
    return () => { cancelled = true }
  }, [citationKey, repository, v2])

  const loading = Boolean(v2 && loaded.key !== citationKey)
  const page = loaded.key === citationKey ? loaded.page : null
  const originalFile = loaded.key === citationKey ? loaded.originalFile : null
  const failed = loaded.key === citationKey && loaded.failed
  const highlight = useMemo(() => page && v2?.quote ? splitPdfSourceHighlight(page.text, v2.quote) : null, [page, v2])
  if (!citation) return null

  return (
    <div className="fixed inset-0 z-[10020] flex justify-end bg-black/55 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="PDF 原文证据">
      <button type="button" aria-label="关闭原文" className="min-w-0 flex-1 cursor-default" onClick={onClose} />
      <aside className="flex h-full w-full max-w-5xl flex-col overflow-hidden border-l border-sky-400/15 bg-slate-950 shadow-2xl shadow-black/60">
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b border-white/8 px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">原始 PDF · 引用定位</p>
            <h2 className="mt-1 text-base font-semibold text-slate-100">{citation.documentName}</h2>
            <p className="mt-1 text-xs text-slate-500">第 {citation.page} 页</p>
          </div>
          <div className="flex items-center gap-2">
            {v2 && onOpenWorkspace && <button type="button" onClick={() => onOpenWorkspace(v2)} className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/25 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-500/20"><Bookmark className="h-3.5 w-3.5" />在原文与书签中打开</button>}
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 p-2 text-slate-400 hover:bg-white/[0.04] hover:text-white"><X className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="rounded-xl border border-emerald-400/15 bg-emerald-500/[0.035] p-3 text-[11px] leading-5 text-emerald-100/80">
            <p className="flex items-center gap-2 font-semibold text-emerald-200"><ShieldCheck className="h-4 w-4" />原文仅保存在此设备</p>
            <p className="mt-1">页全文不会进入 AI Job Artifact、房间同步或战役导出。</p>
          </div>

          {!v2 ? (
            <div className="mt-5 rounded-xl border border-amber-400/15 bg-amber-500/[0.035] p-4 text-xs leading-6 text-amber-100/80">
              这是 V1 历史引用，只保存了文件名和页码，没有可验证的文档标识。请重新附加原始 PDF 并运行 V2 分析。
            </div>
          ) : loading ? (
            <div className="grid min-h-[32rem] place-items-center text-sm text-slate-500"><span><LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />正在定位原始 PDF 第 {v2.page} 页……</span></div>
          ) : (
            <div className="mt-4 space-y-3">
              {v2.quote && <blockquote className="rounded-xl border-l-2 border-amber-300 bg-amber-500/[0.055] px-4 py-3 text-xs leading-6 text-amber-50">引用短句：“{v2.quote}”</blockquote>}
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px]">
              <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2 py-1 text-sky-200">
                {v2.verification === 'exact' ? '原文精确匹配' : v2.verification === 'normalized' ? '格式规范化匹配' : '未验证'}
              </span>
              {v2.sourceExtractionMethod === 'ocr' && (
                <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-2 py-1 text-violet-200">
                  OCR 识别{v2.sourceConfidence != null ? ` · 置信度 ${Math.round(v2.sourceConfidence * 100)}%` : ''}
                </span>
              )}
              {v2.pageRegion && (
                <span className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-1 text-slate-400">
                  页内区域 {v2.pageRegion.map((value) => `${Math.round(value * 100)}%`).join(' / ')}
                </span>
              )}
              {originalFile && !v2.pageRegion && <span className="text-slate-500">已定位到原始页；此引用没有可靠页内坐标。</span>}
            </div>
              {originalFile ? (
                <div className="overflow-hidden rounded-2xl border border-white/10">
                  <PdfOriginalPageRenderer file={originalFile} pageNumber={v2.page} highlightRegion={v2.pageRegion} highlightLabel={v2.quote || '引用位置'} highlightText={v2.quote} />
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-400/15 bg-amber-500/[0.035] p-5">
                  <div className="flex items-start gap-3"><FileText className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" /><div><h3 className="text-sm font-semibold text-amber-100">需要重新附加原 PDF</h3><p className="mt-1 text-xs leading-6 text-amber-100/70">这份分析来自旧版本，当前设备只缓存了检索文字。请前往“原文与书签”重新附加分析时使用的同一 PDF，APP 会先校验文件哈希，再恢复原排版和图片。</p></div></div>
                  {onOpenWorkspace && <button type="button" onClick={() => onOpenWorkspace(v2)} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-100"><Bookmark className="h-3.5 w-3.5" />前往原文与书签</button>}
                </div>
              )}
              {page && <details className="rounded-xl border border-white/8 bg-black/15 px-4 py-3 text-xs text-slate-400">
                <summary className="cursor-pointer font-semibold text-slate-300">查看兼容文本（非原 PDF 排版）</summary>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words font-sans text-xs leading-6 text-slate-400">{highlight ? <>{highlight.before}<mark className="rounded bg-amber-300 px-0.5 text-slate-950">{highlight.match}</mark>{highlight.after}</> : page.text}</pre>
              </details>}
              {failed && !page && !originalFile && <p className="text-xs text-rose-200">此设备无法读取对应的 PDF 或兼容文本缓存。</p>}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
