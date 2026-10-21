import { useEffect, useRef, useState } from 'react'
import { showAppConfirm } from '../../lib/appDialog'
import { pdfImportAttemptOrder } from '../../lib/pdfImportAttemptOrder'
import { PdfSpellImportCache, browserPdfSpellCacheStore, pdfSpellCacheIdentity, type PdfSpellBatch as Batch, type PdfSpellJob as SpellJob } from '../../lib/pdfSpellImportCache'
import { preflightPdfSpellDraft, type PdfSpellHeadlessPreflight } from '../../rulesets/dnd5e/pdfSpellHeadlessPreflight'
import { pdfSpellRepairFeedback } from '../../rulesets/dnd5e/pdfSpellRepairFeedback'
import { exportPdfContentModule } from '../../rulesets/dnd5e/pdfContentModule'
import { AiProviderRegistryV1, DEFAULT_AI_PROVIDER_SELECTION } from '../../lib/aiProvider'
import { createExternalAiBridgeRuntime, localAiBridgeSnapshot, createLocalBridgePdfOcrProvider, probeLocalAiBridge } from '../../lib/localAiBridgeApi'
import { extractPdfDocuments } from '../../lib/pdfCampaignAnalysis'
import { extractPdfSpellWindow, pdfSpellWindows, parsePdfExcludedPages, pdfSpellClassReference, pdfSpellConversionText, pdfSpellExpectedClasses, pdfSpellMetadataEvidence } from '../../rulesets/dnd5e/pdfSpellImport'
import { generateDnd5eLocalContentAiDraft, Dnd5eLocalContentAiDraftError } from '../../rulesets/dnd5e/localContentAiImport'
import { prepareDnd5eLocalContentJson } from '../../rulesets/dnd5e/localContentCollection'
import { dnd5eContentPackageAutomationCoverageV2 } from '../../rulesets/dnd5e/contentPackageV2'
import { reviewPdfNonTextPages, type PdfNonTextPageReview } from '../../rulesets/dnd5e/pdfNonTextPageReview'
import type { Dnd5eLocalContentEditorRequest } from './Dnd5eLocalRulesAiImporter'

const emptyBatch = (): Batch => ({ schemaVersion: 1, windows: [], spells: [] })
const message = (error: unknown) => error instanceof Error ? error.message : String(error)
const buttonClass = 'rounded-lg border border-white/15 px-3 py-2 text-xs text-violet-100 disabled:opacity-40'

export default function Dnd5ePdfSpellImporter({ scope, busy, onEditContent }: {
  scope: string
  busy: boolean
  onEditContent?: (request: Dnd5eLocalContentEditorRequest) => void
}) {
  const key = `dndstars5e:pdf-spell-import:v1:${encodeURIComponent(scope)}`
  const [batch, setBatch] = useState<Batch>(() => {
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? 'null') as Batch | null
      return value?.schemaVersion === 1 && Array.isArray(value.windows) && Array.isArray(value.spells) ? value : emptyBatch()
    } catch { return emptyBatch() }
  })
  const [running, setRunning] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [cache] = useState(() => new PdfSpellImportCache(browserPdfSpellCacheStore()))
  const [checks, setChecks] = useState<Record<string, PdfSpellHeadlessPreflight>>({})
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [limit, setLimit] = useState(10)
  const [excludedPagesText, setExcludedPagesText] = useState('')
  const [automaticPageReview, setAutomaticPageReview] = useState(false)
  const stopped = useRef(false)
  const active = useRef(false)
  useEffect(() => () => { stopped.current = true }, [])
  useEffect(() => {
    let cancelled = false
    void cache.restore(scope).then(async (saved) => {
      if (!saved || cancelled) return
      const results: Record<string, PdfSpellHeadlessPreflight> = {}
      for (const job of saved.spells) {
        if (cancelled) return
        if (job.draft) results[job.source.id] = await preflightPdfSpellDraft(job.draft, job.source.kind, { source: job.source, classReference: saved.classReference })
      }
      if (!cancelled) { setBatch(saved); setChecks(results); setNotice(saved.revisedSourceIds?.length
        ? `已核对缓存原文，修正 ${saved.revisedSourceIds.length} 个条目的边界并移除对应旧配置；请继续转换。`
        : saved.restoredSourceOnly
        ? '规则接口已更新，已恢复 PDF 原文与提取进度；旧自动化配置已隔离，继续转换即可生成新配置，无需重新提取。'
        : '已恢复本地缓存，并使用当前规则引擎重新完成 Headless 接口预检；未调用 AI。') }
    }).catch(() => { if (!cancelled) setSaveError('本地缓存暂不可用；可继续转换，但离开前请下载草稿。') })
      .finally(() => { if (!cancelled) setInitializing(false) })
    return () => { cancelled = true }
  }, [cache, scope])

  const checkDrafts = async (value: Batch) => {
    const results: Record<string, PdfSpellHeadlessPreflight> = {}
    for (const job of value.spells) if (job.draft) results[job.source.id] = await preflightPdfSpellDraft(job.draft, job.source.kind, { source: job.source, classReference: value.classReference })
    setChecks(results)
  }

  const updateBatch = async (value: Batch) => {
    setBatch(value)
    try { await cache.save(scope, value); localStorage.removeItem(key); setSaveError('') }
    catch { setSaveError('浏览器保存空间不足，本次进度尚未保存；请在离开前下载草稿备份。') }
  }

  const clearBatch = async () => {
    if (await showAppConfirm({ title: '删除本批次本地缓存', message: '删除本批次缓存和当前房间进度？再次上传此 PDF 将需要重新提取和转换。已保存到工坊的内容不受影响。', confirmLabel: '删除缓存', tone: 'danger' })) {
      try { await cache.clear(scope, batch.identity); localStorage.removeItem(key); setBatch(emptyBatch()); setChecks({}); setNotice(''); setError('') }
      catch (reason) { setError(message(reason)) }
    }
  }

  const loadPdf = async (file: File) => {
    if (active.current || busy || initializing) return
    active.current = true
    setRunning(true); setError('')
    try {
      setNotice('正在计算 PDF 内容指纹并查找本地缓存…')
      const excludedPages = parsePdfExcludedPages(excludedPagesText)
      const identity = await pdfSpellCacheIdentity(file, excludedPages)
      const cached = await cache.load(identity).catch(() => null)
      if (cached) {
        await checkDrafts(cached)
        await updateBatch(cached)
        setNotice(cached.revisedSourceIds?.length
          ? `已核对缓存原文，修正 ${cached.revisedSourceIds.length} 个条目的边界并移除对应旧配置；请继续转换。`
          : cached.restoredSourceOnly
          ? '已复用同一 PDF 的原文与提取进度；自动化接口已更新，请继续转换以生成新配置，无需重新提取。'
          : '命中同一 PDF 的本地缓存。已跳过提取和 AI 转换，直接完成当前版本 Headless 接口预检；未完成的条目可继续处理。')
        return
      }
      await probeLocalAiBridge().catch(() => undefined)
      const bridge = localAiBridgeSnapshot()
      const ocrProvider = bridge.engines.rapidocr === 'ready' ? createLocalBridgePdfOcrProvider() : undefined
      const images: Array<{ page: number; mimeType: 'image/png'; dataUrl: string }> = []
      const documents = await extractPdfDocuments([file], (progress) => setNotice(progress.message), {
        ocrProvider,
        ...(automaticPageReview ? { onUnresolvedPage: async ({ page, image }: { page: number; image: Blob }) => {
          if (excludedPages.includes(page)) return
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('页面图像读取失败')); reader.readAsDataURL(image)
          })
          images.push({ page, mimeType: 'image/png', dataUrl })
        } } : {}),
      })
      const pageReviews: PdfNonTextPageReview[] = []
      if (images.length) {
        if (bridge.status !== 'ready') throw new Error('自动检查页面需要连接 AI Credit 账号。')
        const registry = new AiProviderRegistryV1(); registry.register(createExternalAiBridgeRuntime(bridge.models))
        for (let start = 0; start < images.length; start += 4) {
          setNotice(`正在检查 OCR 未识别页面 ${images.slice(start, start + 4).map(p => p.page).join(', ')}（消耗积分）`)
          pageReviews.push(...await reviewPdfNonTextPages({ registry, selection: DEFAULT_AI_PROVIDER_SELECTION, pages: images.slice(start, start + 4) }))
        }
      }
      const reviewedExclusions = pageReviews.filter(p => p.classification === 'blank' || p.classification === 'illustration-only').map(p => p.page)
      const effectiveExclusions = [...excludedPages, ...reviewedExclusions]
      const unresolved = documents[0].unresolvedPages?.filter(page => !effectiveExclusions.includes(page)) ?? []
      if (unresolved.length) throw new Error(`这些页尚未读取：${unresolved.join(', ')}。请连接 OCR；确认不含规则的页面可填写排除页码后重新上传。`)
      const windows = pdfSpellWindows(documents, effectiveExclusions)
      setChecks({})
      await updateBatch({ schemaVersion: 1, identity, excludedPages, pageReviews, windows: windows.map((window) => ({ window })), spells: [], classReference: pdfSpellClassReference(documents.flatMap((document) => document.pages ?? []).filter(page => !effectiveExclusions.includes(page.page))) })
      setNotice(`已读取 ${documents[0].pageCount} 页。${pageReviews.length ? `已用 AI 检查 ${pageReviews.length} 个未识别页面。` : ''}法术与角色选项尚未转换，点击开始或连续处理后使用 AI Credit。`)
    } catch (reason) { setError(message(reason)) }
    finally { active.current = false; setRunning(false) }
  }

  const run = async (retrySourceId?: string, wholeBook = false) => {
    if (active.current || busy || initializing) return
    active.current = true
    stopped.current = false
    setRunning(true); setError('')
    const next = structuredClone(batch)
    // React state updates are asynchronous; retries must use this run's latest result.
    const currentChecks = { ...checks }
    const publish = () => updateBatch(structuredClone(next))
    let steps = 0
    const stepLimit = wholeBook ? Number.POSITIVE_INFINITY : limit
    try {
      for (const job of next.spells) if (job.draft) currentChecks[job.source.id] = await preflightPdfSpellDraft(job.draft, job.source.kind, { source: job.source, classReference: next.classReference })
      setChecks(currentChecks)
      if (!retrySourceId && next.windows.every((job) => job.done) && next.spells.every((job) => job.draft && (!wholeBook || currentChecks[job.source.id]?.status === 'ready-for-behavior-tests'))) {
        setNotice('全部草稿已在本地，已重新运行 Headless 接口预检；未调用 AI。')
        return
      }
      const bridge = localAiBridgeSnapshot()
      if (bridge.status !== 'ready') throw new Error('请先连接 AI Credit 账号。')
      const registry = new AiProviderRegistryV1()
      registry.register(createExternalAiBridgeRuntime(bridge.models))
      for (const job of pdfImportAttemptOrder(next.windows, wholeBook ? 2 : 1, job => !job.done)) {
        if (stopped.current || steps >= stepLimit) break
        steps += 1
        setNotice(`正在提取 ${job.window.documentName} 第 ${job.window.startPage}–${job.window.ownedEndPage} 页`)
        try {
          const result = await extractPdfSpellWindow({ window: job.window, registry, selection: DEFAULT_AI_PROVIDER_SELECTION, includeCharacterOptions: true, repairFeedback: job.error })
          job.done = true; job.error = undefined; job.warnings = result.warnings
          for (const source of result.spells) {
            if (!next.spells.some((entry) => entry.source.id === source.id)) next.spells.push({ source })
          }
        } catch (reason) { job.error = message(reason) }
        await publish()
        if (job.error && !wholeBook) break
      }
      // Finish inventory before generating drafts so missing pages stay visible.
      if (next.windows.every((job) => job.done)) {
        const completed = new Set<string>()
        for (const job of pdfImportAttemptOrder(next.spells, wholeBook ? 3 : 1, job =>
          !completed.has(job.source.id) && (retrySourceId ? job.source.id === retrySourceId :
            !job.draft || (wholeBook && currentChecks[job.source.id]?.status !== 'ready-for-behavior-tests')))) {
          if (stopped.current || steps >= stepLimit) break
          steps += 1
          setNotice(`正在转换 ${job.source.name}（第 ${job.source.startPage} 页）`)
          let candidateDraft: SpellJob['draft']
          try {
            const repairFeedback = pdfSpellRepairFeedback({ error: job.error,
              preflight: currentChecks[job.source.id], unsupported: job.draft?.unsupported })
            const sourcePages = next.windows.filter(entry => entry.window.documentName === job.source.documentName).flatMap(entry => entry.window.pages)
            const generated = await generateDnd5eLocalContentAiDraft({ sourceText: pdfSpellConversionText(job.source, next.classReference ?? '', sourcePages), targetKind: job.source.kind ?? 'spell', registry, selection: DEFAULT_AI_PROVIDER_SELECTION, repairFeedback, repairDraft: job.rejectedDraft ?? job.draft, planMechanisms: true })
            candidateDraft = generated.draft
            const prepared = await prepareDnd5eLocalContentJson(generated.draft.contentJson, 'pdf-spell.json', { targetCollection: ({ spell: 'spells', feature: 'features', feat: 'feats', subclass: 'subclasses' } as const)[job.source.kind ?? 'spell'] })
            if (prepared.package.content[({ spell: 'spells', feature: 'features', feat: 'feats', subclass: 'subclasses' } as const)[job.source.kind ?? 'spell']].length !== 1) throw new Error('单条原文必须恰好生成一个对应类型的条目，请校对后重试。')
            const expectedClasses = pdfSpellExpectedClasses(job.source, next.classReference ?? '')
            if (!job.source.kind || job.source.kind === 'spell') {
              const evidence = pdfSpellMetadataEvidence(job.source)
              const spell = prepared.package.content.spells[0]
              if (evidence.level !== undefined && evidence.level !== spell.level) throw new Error(`法术环级与原文不一致：应为 ${evidence.level}。`)
              if (evidence.concentration !== undefined && evidence.concentration !== spell.duration.concentration) throw new Error(`法术专注要求与原文不一致：应为 ${evidence.concentration}。`)
            }
            if ((!job.source.kind || job.source.kind === 'spell') && expectedClasses &&
              expectedClasses.some((classId) => !prepared.package.content.spells[0].classes.includes(classId as typeof prepared.package.content.spells[0]['classes'][number]))) {
              throw new Error(`法术职业遗漏 PDF 目录中的明确条目；classes 至少应包含 ${expectedClasses.join(', ')}。其他职业仍需核对别称与目录。`)
            }
            const coverage = dnd5eContentPackageAutomationCoverageV2(prepared.package)
            job.draft = generated.draft
            delete job.rejectedDraft
            job.coverage = `接口检查：完整 ${coverage.totals.full}／部分 ${coverage.totals.partial}／手动 ${coverage.totals.manual}／资料 ${coverage.totals.referenceOnly}`
            job.error = undefined
            const preflight = await preflightPdfSpellDraft(job.draft, job.source.kind, { source: job.source, classReference: next.classReference })
            currentChecks[job.source.id] = preflight
            setChecks((current) => ({ ...current, [job.source.id]: preflight }))
          } catch (reason) {
            job.error = message(reason)
            if (reason instanceof Dnd5eLocalContentAiDraftError && reason.rejectedDraft) job.rejectedDraft = reason.rejectedDraft
            else if (candidateDraft) job.rejectedDraft = candidateDraft
          }
          await publish()
          if (!job.error && (!wholeBook || currentChecks[job.source.id]?.status === 'ready-for-behavior-tests')) completed.add(job.source.id)
          if (job.error && !wholeBook) break
        }
      }
      const failures = next.windows.filter(job => job.error).length + next.spells.filter(job => job.error || currentChecks[job.source.id]?.status === 'blocked').length
      setNotice(`本轮执行 ${steps} 项任务。${stopped.current ? '已暂停。' : failures ? `${failures} 项仍需修复，成功结果已保存；未标记全书完成。` : '本轮已结束，结果已保存。'}`)
    } catch (reason) { setError(message(reason)) }
    finally { await publish(); active.current = false; setRunning(false) }
  }

  const review = async (job: SpellJob) => {
    if (!job.draft || !onEditContent) return
    try {
      const prepared = await prepareDnd5eLocalContentJson(job.draft.contentJson, 'pdf-spell.json', { targetCollection: ({ spell: 'spells', feature: 'features', feat: 'feats', subclass: 'subclasses' } as const)[job.source.kind ?? 'spell'] })
      onEditContent({ targetKind: job.source.kind ?? 'spell', package: prepared.package, review: { sourceText: job.source.text, assumptions: job.draft.assumptions, unsupported: job.draft.unsupported } })
    } catch (reason) { setError(message(reason)) }
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(batch, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = 'pdf-spell-drafts.json'; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1_000)
  }

  const exportModule = async () => {
    if (active.current || busy || initializing) return
    active.current = true; setRunning(true); setError('')
    try {
      const exported = await exportPdfContentModule({
        id: `local.pdf.${batch.identity?.pdfSha256.slice(0, 16) ?? 'import'}`,
        name: batch.windows[0]?.window.documentName ?? 'PDF 法术合集', version: '1.0.0',
        classReference: batch.classReference,
        inventoryComplete: batch.windows.length > 0 && batch.windows.every((job) => job.done),
        inventoryWarnings: [...batch.windows.flatMap((job) => job.warnings ?? []), ...(batch.excludedPages?.length ? [`用户明确排除页面：${batch.excludedPages.join(', ')}；本模块不包含这些页面。`] : []), ...(batch.pageReviews ?? []).map(p => `页面图像检查：第 ${p.page} 页 ${p.classification}；${p.reason}`)],
        entries: batch.spells.map((job) => ({ sourceId: job.source.id, name: job.source.name, source: job.source, draft: job.draft })),
      })
      for (const [name, blob] of [
        [exported.fileName, new Blob([exported.bytes], { type: 'application/octet-stream' })],
        [exported.fileName + '.report.json', new Blob([JSON.stringify(exported.report, null, 2)], { type: 'application/json' })],
      ] as const) {
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click()
        setTimeout(() => URL.revokeObjectURL(url), 1_000)
      }
      setNotice(`已导出 ${exported.report.counts.spells} 个法术及其他角色选项，并验证再导入内容一致。接收者可在工坊上传 .starmod；自动化缺口见报告，未通过逐项行为验收。`)
    } catch (reason) { setError(message(reason)) }
    finally { active.current = false; setRunning(false) }
  }

  const locked = running || busy || initializing
  return <section className="mb-6 rounded-2xl border border-violet-400/20 bg-violet-500/[0.04] p-5" data-testid="pdf-spell-importer">
    <h2 className="font-semibold text-violet-100">PDF 法术与角色选项转换</h2>
    <p className="mt-2 text-xs leading-5 text-slate-400">将 PDF 中的法术和角色选项转为可编辑草稿，核对后再导入。</p>
    <label className="mt-2 block text-xs text-slate-400">上传时排除非规则页（可选，如 1,2,7-9） <input aria-label="排除非规则页" value={excludedPagesText} disabled={locked} onChange={event => setExcludedPagesText(event.target.value)} className="rounded bg-black/30 p-2" /></label>
    <label className="mt-2 block text-xs text-slate-400"><input type="checkbox" checked={automaticPageReview} disabled={locked} onChange={event => setAutomaticPageReview(event.target.checked)} /> 上传时用 AI 检查 OCR 未识别页面（发送页面图像并消耗积分；仅跳过明确的空白或纯插图页）</label>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <input aria-label="上传法术 PDF" type="file" accept="application/pdf,.pdf" disabled={locked} onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadPdf(file); event.target.value = '' }} className="max-w-full text-xs text-slate-300" />
      <label className="text-xs text-slate-400">本轮最多任务数 <input type="number" min={1} max={100} value={limit} disabled={locked} onChange={(event) => setLimit(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} className="w-16 rounded bg-black/30 p-2" /></label>
      <button className={buttonClass} disabled={locked || !batch.windows.length} onClick={() => void run()}>开始／继续转换（消耗积分）</button>
      <button className={buttonClass} disabled={locked || !batch.windows.length} onClick={() => void run(undefined, true)}>连续处理全书（消耗积分）</button>
      <button className={buttonClass} disabled={!running} onClick={() => { stopped.current = true; setNotice('将在当前请求结束后暂停，已提交请求可能仍计费。') }}>暂停</button>
      <button className={buttonClass} disabled={locked || !batch.windows.length} onClick={download}>下载草稿备份</button>
      <button className={buttonClass} disabled={locked || !batch.spells.length} onClick={() => void exportModule()}>导出可安装模块及检查报告</button>
      <button className={buttonClass} disabled={locked || !batch.windows.length} onClick={() => void clearBatch()}>删除本批次缓存</button>
    </div>
    <p className="mt-2 text-xs text-slate-400">进度自动保存在本浏览器，可暂停后继续。失败项重试也会消耗积分，任务数不是费用上限。</p>
    {notice && <p role="status" className="mt-3 text-xs text-violet-200">{notice}</p>}
    {!!batch.excludedPages?.length && <p className="mt-2 text-xs text-amber-200">当前批次已排除页面：{batch.excludedPages.join(', ')}。更改范围后需重新上传。</p>}
    {(batch.pageReviews ?? []).map(review => <p key={review.page} className="mt-1 text-xs text-slate-400">页面检查 {review.page}：{review.reason}</p>)}
    {(error || saveError) && <p role="alert" className="mt-3 text-xs text-rose-200">{error} {saveError}</p>}
    {batch.windows.length > 0 && <p className="mt-3 text-xs text-slate-300">提取进度 {batch.windows.filter((job) => job.done).length}/{batch.windows.length} · 识别条目 {batch.spells.length} · 生成草稿 {batch.spells.filter((job) => job.draft).length}</p>}
    {batch.windows.filter((job) => job.error || job.warnings?.length).map((job) => <p key={job.window.id} className="mt-2 text-xs text-amber-200">第 {job.window.startPage}–{job.window.ownedEndPage} 页：{job.error ?? job.warnings?.join('；')}</p>)}
    <div className="mt-3 max-h-96 space-y-2 overflow-y-auto">
      {batch.spells.map((job) => <details key={job.source.id} className="rounded-xl border border-white/10 p-3 text-xs text-slate-300">
        <summary>{job.source.name} · 第 {job.source.startPage}–{job.source.endPage} 页 · {job.error ? '失败' : job.draft ? '待校对' : '等待转换'}</summary>
        <p className="mt-2">{job.error ?? job.coverage}</p>
        {checks[job.source.id] && <div className="mt-2 rounded-lg bg-black/20 p-2 text-amber-200">
          <p>自动化检查：{checks[job.source.id].status === 'blocked' ? '有待处理的问题' : '检查通过，待核对效果'}</p>
          {checks[job.source.id].issues.map((issue, index) => <p key={index} className="mt-1">{issue}</p>)}
        </div>}
        {job.draft && <><p className="mt-2 text-amber-200">{[...job.draft.assumptions, ...job.draft.unsupported].join('；') || 'AI 未报告额外缺口，仍需人工核对原文。'}</p><button className={`${buttonClass} mt-2`} disabled={locked || !onEditContent} onClick={() => void review(job)}>载入工坊校对并导入</button>{checks[job.source.id]?.status === 'blocked' && <button className={`${buttonClass} mt-2 ml-2`} disabled={locked} onClick={() => void run(job.source.id)}>按预检反馈重试此项（消耗积分）</button>}</>}
        <pre className="mt-2 whitespace-pre-wrap text-slate-500">{job.source.text}</pre>
      </details>)}
    </div>
  </section>
}


