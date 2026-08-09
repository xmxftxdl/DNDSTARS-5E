import { FileSearch, ShieldCheck, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { PdfSourcePageV2 } from '../../lib/pdfCampaignAnalysisV2'
import { pdfSourceRepository, type PdfSourceRepository } from '../../lib/pdfSourceRepository'
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

export default function PdfSourceEvidenceDrawer({ citation, onClose, repository = pdfSourceRepository }: {
  citation: PdfViewCitation | null
  onClose: () => void
  repository?: PdfSourceRepository
}) {
  const v2 = citation && isPdfSourceCitationV2(citation) && citation.verification !== 'legacy'
    ? citation
    : null
  const citationKey = v2 ? `${v2.documentId}:${v2.page}:${v2.evidenceId}` : ''
  const [loaded, setLoaded] = useState<{ key: string; page: PdfSourcePageV2 | null; failed: boolean }>({
    key: '',
    page: null,
    failed: false,
  })

  useEffect(() => {
    if (!v2) return
    let cancelled = false
    void repository.loadPage(v2.documentId, v2.page).then((value) => {
      if (!cancelled) setLoaded({ key: citationKey, page: value, failed: false })
    }).catch(() => {
      if (!cancelled) setLoaded({ key: citationKey, page: null, failed: true })
    })
    return () => { cancelled = true }
  }, [citationKey, repository, v2])

  const loading = Boolean(v2 && loaded.key !== citationKey)
  const page = loaded.key === citationKey ? loaded.page : null
  const failed = loaded.key === citationKey && loaded.failed
  const highlight = useMemo(() => page && v2?.quote ? splitPdfSourceHighlight(page.text, v2.quote) : null, [page, v2])
  if (!citation) return null

  return (
    <div className="fixed inset-0 z-[10020] flex justify-end bg-black/55 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="PDF 原文证据">
      <button type="button" aria-label="关闭原文" className="min-w-0 flex-1 cursor-default" onClick={onClose} />
      <aside className="h-full w-full max-w-2xl overflow-y-auto border-l border-sky-400/15 bg-slate-950 p-5 shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-4 border-b border-white/8 pb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">PDF 原文证据</p>
            <h2 className="mt-1 text-base font-semibold text-slate-100">{citation.documentName}</h2>
            <p className="mt-1 text-xs text-slate-500">第 {citation.page} 页</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 p-2 text-slate-400 hover:bg-white/[0.04] hover:text-white"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-4 rounded-xl border border-emerald-400/15 bg-emerald-500/[0.035] p-3 text-[11px] leading-5 text-emerald-100/80">
          <p className="flex items-center gap-2 font-semibold text-emerald-200"><ShieldCheck className="h-4 w-4" />原文仅保存在此设备</p>
          <p className="mt-1">页全文不会进入 AI Job Artifact、房间同步或战役导出。</p>
        </div>

        {!v2 ? (
          <div className="mt-5 rounded-xl border border-amber-400/15 bg-amber-500/[0.035] p-4 text-xs leading-6 text-amber-100/80">
            这是 V1 历史引用，只保存了文件名和页码，没有原文短引。若要核验证据，请重新附加原始 PDF 并运行 V2 分析。
          </div>
        ) : loading ? (
          <p className="mt-5 text-sm text-slate-500">正在从此设备读取原文页……</p>
        ) : failed || !page ? (
          <div className="mt-5 rounded-xl border border-amber-400/15 bg-amber-500/[0.035] p-4 text-xs leading-6 text-amber-100/80">
            此设备没有对应原文页缓存。分析结果仍然安全保留；请重新附加同一份 PDF，以恢复本机原文查看。
          </div>
        ) : (
          <div className="mt-5">
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
              {!highlight && <span className="text-amber-300">当前页可读取，但无法安全映射高亮范围；下方仍显示完整原文。</span>}
            </div>
            <pre className="whitespace-pre-wrap break-words rounded-2xl border border-white/8 bg-black/20 p-5 font-sans text-sm leading-7 text-slate-300">
              {highlight ? <>{highlight.before}<mark className="rounded bg-amber-300 px-0.5 text-slate-950">{highlight.match}</mark>{highlight.after}</> : page.text}
            </pre>
            {v2.quote && !highlight && (
              <blockquote className="mt-3 rounded-xl border-l-2 border-amber-300 bg-amber-500/[0.04] px-4 py-3 text-xs leading-6 text-amber-100/80">候选短引：{v2.quote}</blockquote>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}
