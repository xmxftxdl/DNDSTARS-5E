import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import {
  BookOpenText,
  Bot,
  Boxes,
  CheckCircle2,
  Download,
  FileText,
  GitBranch,
  Hammer,
  History,
  KeyRound,
  Lightbulb,
  LoaderCircle,
  MapPinned,
  MessageSquareText,
  Mic2,
  PackageCheck,
  PencilLine,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  Users,
  WandSparkles,
  XCircle,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import type { AiProviderSelectionV1 } from '../../shared/ai-provider.mjs'
import AiProviderSelector from '../components/dm/AiProviderSelector'
import PdfCampaignAnalysisEditor from '../components/dm/PdfCampaignAnalysisEditor'
import PdfCampaignKnowledgeBase from '../components/dm/PdfCampaignKnowledgeBase'
import PageHeader from '../components/PageHeader'
import { DEFAULT_AI_PROVIDER_SELECTION } from '../lib/aiProvider'
import { isAccountCampaignId } from '../lib/campaignNavigation'
import {
  aiJobApiErrorMessage,
  cancelCampaignAiJob,
  deleteCampaignAiJob,
  listCampaignAiJobs,
  localAiRunnerId,
  updateCampaignAiJobArtifact,
  type PublicAiJobV2,
} from '../lib/aiJobApi'
import { campaignBackupErrorMessage, downloadCampaignExport } from '../lib/campaignBackupApi'
import { pdfFilesMatchAiJob, runCampaignPdfAnalysisJob } from '../lib/campaignAiJobRunner'
import { clearPdfAnalysisCaches } from '../lib/pdfAnalysisCache'
import {
  estimatePdfAnalysisWorkload,
  inspectPdfAnalysisWorkload,
  pdfAnalysisErrorMessage,
  type PdfAnalysisDepthV1,
  type PdfAnalysisProgressV1,
  type PdfAnalysisWorkloadEstimateV1,
  type PdfCampaignAnalysisV1,
} from '../lib/pdfCampaignAnalysis'

type StageStatus = 'available' | 'partial' | 'planned'
type Notice = { kind: 'success' | 'error'; text: string }
type PendingAiJobAction = { mode: 'resume' | 'retry'; job: PublicAiJobV2 }

const STATUS_LABELS: Record<StageStatus, string> = {
  available: '已可用',
  partial: '部分可用',
  planned: '待接入',
}

const STATUS_CLASSES: Record<StageStatus, string> = {
  available: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
  partial: 'border-amber-400/20 bg-amber-500/10 text-amber-200',
  planned: 'border-violet-400/20 bg-violet-500/10 text-violet-200',
}

function StatusBadge({ status }: { status: StageStatus }) {
  return (
    <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${STATUS_CLASSES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

function ResultCard({ icon: Icon, title, description, count }: {
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
  count?: number
}) {
  return (
    <article className="rounded-xl border border-white/8 bg-black/15 p-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-violet-300" />
        <h4 className="text-xs font-semibold text-slate-200">{title}</h4>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-slate-500">{description}</p>
      <span className={`mt-3 inline-flex rounded-full border px-2 py-1 text-[10px] ${count == null
        ? 'border-white/8 text-slate-600'
        : 'border-violet-400/20 bg-violet-500/10 text-violet-200'}`}
      >
        {count == null ? '等待 AI 分析' : `${count} 项结果`}
      </span>
    </article>
  )
}

function formatBytes(value: number): string {
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(value / 1024))} KB`
}

const AI_JOB_STATUS_LABELS: Record<PublicAiJobV2['status'], string> = {
  queued: '等待执行',
  'awaiting-local-runner': '等待本机接管',
  running: '分析中',
  validating: '校验中',
  'review-required': '待 DM 审阅',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
}

function formatJobTime(value: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

export default function DmPrepAssistantPage() {
  const { campaignId = 'local' } = useParams()
  const campaignBasePath = `/campaign/${encodeURIComponent(campaignId)}`
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const [pdfFiles, setPdfFiles] = useState<File[]>([])
  const [pdfNotice, setPdfNotice] = useState<string | null>(null)
  const [pdfAnalysisBusy, setPdfAnalysisBusy] = useState(false)
  const pdfAnalysisRunRef = useRef(false)
  const [pdfAnalysisProgress, setPdfAnalysisProgress] = useState<PdfAnalysisProgressV1 | null>(null)
  const [pdfAnalysisResult, setPdfAnalysisResult] = useState<PdfCampaignAnalysisV1 | null>(null)
  const [pdfAnalysisEditorOpen, setPdfAnalysisEditorOpen] = useState(false)
  const [pdfAnalysisDirty, setPdfAnalysisDirty] = useState(false)
  const [pdfAnalysisDepth, setPdfAnalysisDepth] = useState<PdfAnalysisDepthV1>('quick')
  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null)
  const [pdfWorkloadLoading, setPdfWorkloadLoading] = useState(false)
  const [activeAiJob, setActiveAiJob] = useState<PublicAiJobV2 | null>(null)
  const [aiJobs, setAiJobs] = useState<PublicAiJobV2[]>([])
  const [aiJobClock, setAiJobClock] = useState(() => Date.now())
  const [aiRunnerId] = useState(() => localAiRunnerId())
  const [aiJobActionBusy, setAiJobActionBusy] = useState<string | null>(null)
  const [aiJobDeleteConfirm, setAiJobDeleteConfirm] = useState<string | null>(null)
  const [aiCacheClearBusy, setAiCacheClearBusy] = useState(false)
  const [pendingAiJobAction, setPendingAiJobAction] = useState<PendingAiJobAction | null>(null)
  const [pdfSaveBusy, setPdfSaveBusy] = useState(false)
  const [aiProviderSelection, setAiProviderSelection] = useState(() => ({ ...DEFAULT_AI_PROVIDER_SELECTION }))
  const [exportBusy, setExportBusy] = useState(false)
  const [exportNotice, setExportNotice] = useState<Notice | null>(null)

  const reloadAiJobs = useCallback(async () => {
    if (!isAccountCampaignId(campaignId)) return []
    const jobs = await listCampaignAiJobs(campaignId, true)
    setAiJobs(jobs)
    return jobs
  }, [campaignId])

  useEffect(() => {
    if (!isAccountCampaignId(campaignId)) return
    let cancelled = false
    void listCampaignAiJobs(campaignId, true).then((jobs) => {
      if (cancelled) return
      setAiJobs(jobs)
      const latest = jobs.find((job) => (
        ['review-required', 'completed'].includes(job.status) &&
        job.artifact?.kind === 'pdf-campaign-analysis'
      ))
      if (!latest?.artifact) return
      setActiveAiJob(latest)
      setPdfAnalysisResult(latest.artifact.payload as unknown as PdfCampaignAnalysisV1)
      setPdfAnalysisDirty(false)
      setPdfNotice('已从战役档案恢复上一次保存的 PDF 分析草稿。')
    }).catch(() => {})
    return () => { cancelled = true }
  }, [campaignId, reloadAiJobs])

  useEffect(() => {
    const timer = window.setInterval(() => setAiJobClock(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (pdfFiles.length === 0) return
    let cancelled = false
    void inspectPdfAnalysisWorkload(pdfFiles, 'quick').then((estimate) => {
      if (!cancelled) setPdfPageCount(estimate.pageCount)
    }).catch(() => {
      if (!cancelled) setPdfPageCount(null)
    }).finally(() => {
      if (!cancelled) setPdfWorkloadLoading(false)
    })
    return () => { cancelled = true }
  }, [pdfFiles])

  const pdfWorkload: PdfAnalysisWorkloadEstimateV1 | null = pdfPageCount == null
    ? null
    : estimatePdfAnalysisWorkload(pdfPageCount, pdfAnalysisDepth)
  const usesLocalPdfModel = aiProviderSelection.providerId === 'local-bridge'
  const localWorkloadRecommendation = usesLocalPdfModel ? pdfWorkload?.recommendation : null

  const changeAiProviderSelection = useCallback((selection: AiProviderSelectionV1) => {
    setAiProviderSelection(selection)
    setPendingAiJobAction((current) => current?.mode === 'resume' ? null : current)
    setPdfNotice(null)
  }, [])

  const selectPdfFiles = (files: readonly File[]) => {
    const accepted = files.filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))
    setPdfFiles(accepted)
    setPdfPageCount(null)
    setPdfWorkloadLoading(accepted.length > 0)
    setPdfNotice(accepted.length === files.length
      ? null
      : '已忽略非 PDF 文件。')
    setPdfAnalysisResult(null)
    setPdfAnalysisProgress(null)
    setPdfAnalysisEditorOpen(false)
    setPdfAnalysisDirty(false)
    setActiveAiJob(null)
    setPdfAnalysisDepth('quick')
  }

  const runPdfAnalysis = async () => {
    if (pdfFiles.length === 0 || pdfAnalysisBusy || pdfAnalysisRunRef.current) return
    if (!isAccountCampaignId(campaignId)) {
      setPdfNotice('当前房间没有绑定账号级战役。请返回战役列表，从对应战役进入或恢复房间后再分析 PDF。')
      return
    }
    pdfAnalysisRunRef.current = true
    setPdfAnalysisBusy(true)
    setPdfNotice(null)
    setPdfAnalysisResult(null)
    let attemptedProviderId = aiProviderSelection.providerId
    try {
      const templateJob = pendingAiJobAction?.job ?? null
      const selection = pendingAiJobAction?.mode === 'resume' && templateJob
        ? { ...aiProviderSelection, providerId: templateJob.providerId, modelId: templateJob.modelId }
        : aiProviderSelection
      attemptedProviderId = selection.providerId
      const depth = templateJob?.input?.depth === 'quick' ? 'quick' : templateJob ? 'deep' : pdfAnalysisDepth
      const resumeJob = pendingAiJobAction?.mode === 'resume' ? templateJob : null
      if (resumeJob && !pdfFilesMatchAiJob(pdfFiles, resumeJob)) throw new Error('ai-job-source-mismatch')
      setAiProviderSelection(selection)
      setPdfAnalysisDepth(depth)
      const completed = await runCampaignPdfAnalysisJob({
        campaignId,
        files: pdfFiles,
        selection,
        depth,
        resumeJob,
        onProgress: (progress) => {
          setPdfAnalysisProgress(progress)
        },
        onJob: (job) => {
          setActiveAiJob(job)
          setAiJobs((current) => [job, ...current.filter((candidate) => candidate.jobId !== job.jobId)])
        },
      })
      setActiveAiJob(completed.job)
      const persistedPayload = completed.job.artifact?.payload
      setPdfAnalysisResult(persistedPayload ? persistedPayload as unknown as PdfCampaignAnalysisV1 : completed.result)
      setPdfAnalysisDirty(false)
      setPdfNotice(`分析完成并已保存到战役：${completed.result.documents.length} 个文档，共 ${completed.result.analyzedChunks} 个页段、${completed.result.analysisPasses ?? completed.result.analyzedChunks} 个分析阶段。结果只作为 DM 审阅草稿，不会自动写入 Headless。`)
    } catch (error) {
      setPdfAnalysisProgress(null)
      const errorCode = error instanceof Error ? error.message : String(error)
      setPdfNotice(errorCode === 'selected-cloud-provider-not-configured'
        ? '当前平台云端 Provider 尚未配置。可选择“本地免费模型”，或在 Local AI Bridge 中配置“自己的模型 API”。'
        : errorCode === 'ai-job-source-mismatch'
          ? '请选择与中断任务完全相同的原始 PDF（文件名和大小必须一致），服务器不会保存原始 PDF。'
          : /^(?:pdf-|provider-|local-|external-|bridge-)|structured-output/.test(errorCode)
          ? pdfAnalysisErrorMessage(error, attemptedProviderId)
          : aiJobApiErrorMessage(error))
    } finally {
      pdfAnalysisRunRef.current = false
      setPdfAnalysisBusy(false)
      setPendingAiJobAction(null)
      void reloadAiJobs().catch(() => undefined)
    }
  }

  const restoreAiJob = (job: PublicAiJobV2) => {
    if (job.artifact?.kind !== 'pdf-campaign-analysis') return
    setActiveAiJob(job)
    setPdfAnalysisResult(job.artifact.payload as unknown as PdfCampaignAnalysisV1)
    setPdfAnalysisDirty(false)
    setPdfNotice(`已恢复 ${formatJobTime(job.updatedAt)} 保存的分析草稿。`)
  }

  const prepareAiJobAction = (job: PublicAiJobV2, mode: PendingAiJobAction['mode']) => {
    setPendingAiJobAction({ job, mode })
    setAiProviderSelection((current) => ({ ...current, providerId: job.providerId, modelId: job.modelId }))
    setPdfAnalysisDepth(job.input?.depth === 'quick' ? 'quick' : 'deep')
    setPdfNotice(mode === 'resume'
      ? '请重新选择该任务使用的原始 PDF，然后点击“接管中断任务”。'
      : '请重新选择原始 PDF，然后点击“重新分析”。旧任务会保留用于诊断。')
    pdfInputRef.current?.click()
  }

  const cancelAiJob = async (job: PublicAiJobV2) => {
    if (aiJobActionBusy) return
    setAiJobActionBusy(job.jobId)
    try {
      const cancelled = await cancelCampaignAiJob(campaignId, job.jobId, job.revision)
      setAiJobs((current) => current.map((candidate) => candidate.jobId === job.jobId ? cancelled : candidate))
      setPdfNotice('AI 任务已取消；已生成的其他分析草稿不受影响。')
    } catch (error) {
      setPdfNotice(aiJobApiErrorMessage(error))
      await reloadAiJobs().catch(() => undefined)
    } finally {
      setAiJobActionBusy(null)
    }
  }

  const deleteAiJob = async (job: PublicAiJobV2) => {
    if (aiJobActionBusy) return
    if (aiJobDeleteConfirm !== job.jobId) {
      setAiJobDeleteConfirm(job.jobId)
      return
    }
    setAiJobActionBusy(job.jobId)
    try {
      await deleteCampaignAiJob(campaignId, job.jobId, job.revision)
      setAiJobs((current) => current.filter((candidate) => candidate.jobId !== job.jobId))
      setPendingAiJobAction((current) => current?.job.jobId === job.jobId ? null : current)
      if (activeAiJob?.jobId === job.jobId) {
        setActiveAiJob(null)
        setPdfAnalysisResult(null)
        setPdfAnalysisDirty(false)
        setPdfAnalysisEditorOpen(false)
      }
      setAiJobDeleteConfirm(null)
      setPdfNotice('AI 任务记录已永久删除。原始 PDF 与其他任务不受影响。')
    } catch (error) {
      setPdfNotice(aiJobApiErrorMessage(error))
      await reloadAiJobs().catch(() => undefined)
    } finally {
      setAiJobActionBusy(null)
    }
  }

  const clearLocalAiCache = async () => {
    if (aiCacheClearBusy || pdfAnalysisBusy) return
    setAiCacheClearBusy(true)
    try {
      await clearPdfAnalysisCaches()
      setPdfNotice('已清除本机保存的 PDF 文字层和分析断点；服务器中的任务历史与草稿未删除。')
    } catch {
      setPdfNotice('无法清除本机 AI 缓存，请检查浏览器是否允许使用 IndexedDB。')
    } finally {
      setAiCacheClearBusy(false)
    }
  }

  const downloadPdfAnalysis = () => {
    if (!pdfAnalysisResult) return
    const blob = new Blob([JSON.stringify(pdfAnalysisResult, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `astral-trace-${campaignId}-pdf-analysis.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const savePdfAnalysisDraft = async () => {
    if (!pdfAnalysisResult || !activeAiJob || pdfSaveBusy) return
    setPdfSaveBusy(true)
    try {
      const updated = await updateCampaignAiJobArtifact(
        campaignId,
        activeAiJob.jobId,
        activeAiJob.revision,
        {
          schemaVersion: 1,
          kind: 'pdf-campaign-analysis',
          payload: pdfAnalysisResult as unknown as Record<string, unknown>,
        },
      )
      setActiveAiJob(updated)
      setPdfAnalysisDirty(false)
      setPdfNotice('DM 修改已保存到账号战役，可在其他设备恢复。')
    } catch (error) {
      setPdfNotice(aiJobApiErrorMessage(error))
    } finally {
      setPdfSaveBusy(false)
    }
  }

  const updatePdfPersonPortrait = (personName: string, portraitDataUrl: string) => {
    setPdfAnalysisDirty(true)
    setPdfAnalysisResult((current) => current ? {
      ...current,
      people: current.people.map((person) => person.name === personName
        ? { ...person, portraitDataUrl }
        : person),
    } : current)
  }

  const exportCampaign = async () => {
    setExportBusy(true)
    setExportNotice(null)
    try {
      await downloadCampaignExport()
      setExportNotice({ kind: 'success', text: '完整战役设置已导出。' })
    } catch (error) {
      setExportNotice({ kind: 'error', text: campaignBackupErrorMessage(error) })
    } finally {
      setExportBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="备团助手"
        description="从模组 PDF 到可运行场景，再把语音、玩家行为和战斗记录沉淀为持续更新的战役档案。"
      />

      <section className="mb-5 overflow-hidden rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.09] via-arcane-500/[0.035] to-transparent p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-violet-500/15 p-2.5 text-violet-200">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-100">目标：生成一套可以直接开团的战役工程</h2>
              <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-400">
                AI 负责理解资料和提出结构化草稿；地图、怪物、规则包与场景触发器只有经过 DM 确认和 Host 校验后才能写入战役。原始 PDF 不会直接修改角色、地图或 Headless 数据。
              </p>
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-4 gap-1 text-center text-[10px] text-slate-500">
            {['解析', '编排', '开团', '沉淀'].map((label, index) => (
              <div key={label} className="min-w-16 rounded-lg border border-white/8 bg-black/15 px-2 py-2">
                <strong className="block text-violet-300">0{index + 1}</strong>{label}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mb-5 rounded-2xl border border-white/8 bg-black/15 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex gap-3">
            <div className="rounded-xl border border-white/8 bg-white/[0.035] p-2.5 text-sky-300"><FileText className="h-5 w-5" /></div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-slate-100">第一阶段：导入模组并建立 AI 战役索引</h2>
                <StatusBadge status="partial" />
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                上传一个或多个 PDF，模型按章节提取人物、地点、阵营、关键线索、遭遇和可导入内容；DM 可以编辑或删除结果，原始页码引用保留用于核对。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => pdfInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-400"
          >
            <Upload className="h-4 w-4" />选择 PDF
          </button>
          <input
            ref={pdfInputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="hidden"
            onChange={(event) => {
              selectPdfFiles([...(event.currentTarget.files ?? [])])
              event.currentTarget.value = ''
            }}
          />
        </div>

        <div className="mt-4">
          <AiProviderSelector value={aiProviderSelection} onChange={changeAiProviderSelection} taskProfile="pdf-campaign" />
        </div>

        {aiJobs.length > 0 && (
          <div className="mt-4 rounded-2xl border border-white/8 bg-black/15 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-sky-300" />
                <div>
                  <h3 className="text-xs font-semibold text-slate-200">战役 AI 任务 · {aiJobs.filter((job) => job.taskKind === 'campaign-analysis').length}</h3>
                  <p className="mt-0.5 text-[10px] text-slate-600">任务状态保存在账号战役中；原始 PDF 不会上传，换设备或刷新后需重新选择原文件。</p>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button type="button" disabled={aiCacheClearBusy || pdfAnalysisBusy} onClick={() => void clearLocalAiCache()} className="rounded-lg border border-white/8 px-2.5 py-1.5 text-[10px] text-slate-500 hover:bg-white/[0.04] disabled:opacity-40">
                  {aiCacheClearBusy ? '正在清除' : '清除本机断点'}
                </button>
                <button type="button" onClick={() => void reloadAiJobs()} className="rounded-lg border border-white/8 px-2.5 py-1.5 text-[10px] text-slate-400 hover:bg-white/[0.04]">
                  刷新
                </button>
              </div>
            </div>
            <div className="mt-3 grid max-h-[42rem] gap-2 overflow-y-auto pr-1 lg:grid-cols-2">
              {aiJobs.filter((job) => job.taskKind === 'campaign-analysis').map((job) => {
                const leaseExpired = job.status === 'running' && (job.lease?.expiresAt ?? 0) <= aiJobClock
                const ownedLease = job.status === 'running' && job.lease?.runnerId === aiRunnerId
                const resumable = job.status === 'awaiting-local-runner' || leaseExpired || ownedLease
                const retryable = job.status === 'failed' || job.status === 'cancelled'
                const cancellable = ['queued', 'awaiting-local-runner', 'running', 'validating'].includes(job.status) &&
                  !(pdfAnalysisBusy && activeAiJob?.jobId === job.jobId)
                const deleteBlocked = job.status === 'running' && (job.lease?.expiresAt ?? 0) > aiJobClock
                const pending = pendingAiJobAction?.job.jobId === job.jobId
                return (
                  <article key={job.jobId} className={`rounded-xl border p-3 ${pending ? 'border-violet-400/30 bg-violet-500/[0.06]' : 'border-white/8 bg-black/15'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="truncate text-[11px] text-slate-200">{job.sourceAssets.map((asset) => asset.name).join('、')}</strong>
                          <span className={`rounded-full border px-2 py-0.5 text-[9px] ${job.status === 'failed'
                            ? 'border-rose-400/20 bg-rose-500/10 text-rose-200'
                            : job.status === 'review-required' || job.status === 'completed'
                              ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
                              : 'border-sky-400/20 bg-sky-500/10 text-sky-200'}`}
                          >
                            {leaseExpired
                              ? '执行中断，可接管'
                              : ownedLease && !pdfAnalysisBusy
                                ? '当前设备可接管'
                                : AI_JOB_STATUS_LABELS[job.status]}
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] text-slate-600">
                          {job.providerId} · {job.modelId} · {formatJobTime(job.updatedAt)}
                        </p>
                        {job.progress.message && <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">{job.progress.message}</p>}
                        {job.failure?.message && <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-rose-300/80">{job.failure.message}</p>}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {job.artifact?.kind === 'pdf-campaign-analysis' && (
                        <button type="button" onClick={() => restoreAiJob(job)} className="rounded-lg border border-emerald-400/15 px-2 py-1 text-[10px] text-emerald-200 hover:bg-emerald-500/10">
                          打开草稿
                        </button>
                      )}
                      {resumable && (
                        <button type="button" disabled={pdfAnalysisBusy} onClick={() => prepareAiJobAction(job, 'resume')} className="inline-flex items-center gap-1 rounded-lg border border-violet-400/20 px-2 py-1 text-[10px] text-violet-200 hover:bg-violet-500/10 disabled:cursor-not-allowed disabled:opacity-40">
                          <RotateCcw className="h-3 w-3" />重新选择 PDF 并接管
                        </button>
                      )}
                      {retryable && (
                        <button type="button" onClick={() => prepareAiJobAction(job, 'retry')} className="inline-flex items-center gap-1 rounded-lg border border-sky-400/20 px-2 py-1 text-[10px] text-sky-200 hover:bg-sky-500/10">
                          <RotateCcw className="h-3 w-3" />重新分析
                        </button>
                      )}
                      {cancellable && (
                        <button type="button" disabled={aiJobActionBusy === job.jobId} onClick={() => void cancelAiJob(job)} className="inline-flex items-center gap-1 rounded-lg border border-rose-400/15 px-2 py-1 text-[10px] text-rose-200 hover:bg-rose-500/10 disabled:opacity-40">
                          <XCircle className="h-3 w-3" />取消任务
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={deleteBlocked || aiJobActionBusy === job.jobId}
                        title={deleteBlocked ? '任务仍在执行，请先取消' : '永久删除这条任务记录'}
                        onClick={() => void deleteAiJob(job)}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] disabled:cursor-not-allowed disabled:opacity-35 ${aiJobDeleteConfirm === job.jobId
                          ? 'border-rose-300/40 bg-rose-500/15 text-rose-100'
                          : 'border-white/8 text-slate-500 hover:border-rose-400/20 hover:bg-rose-500/10 hover:text-rose-200'}`}
                      >
                        <Trash2 className="h-3 w-3" />{aiJobDeleteConfirm === job.jobId ? '确认永久删除' : '删除'}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
          <div
            className="rounded-2xl border border-dashed border-sky-400/20 bg-sky-500/[0.025] p-4"
            onDragOver={(event) => {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'copy'
            }}
            onDrop={(event) => {
              event.preventDefault()
              selectPdfFiles([...event.dataTransfer.files])
            }}
          >
            <p className="text-xs font-semibold text-sky-100">待分析资料</p>
            {pdfFiles.length === 0 ? (
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                className="group block w-full rounded-xl py-8 text-center transition hover:bg-sky-400/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
              >
                <FileText className="mx-auto h-8 w-8 text-slate-700" />
                <p className="mt-3 text-xs text-slate-500 group-hover:text-sky-200">点击选择 PDF，或将文件拖到这里</p>
              </button>
            ) : (
              <ul className="mt-3 space-y-2">
                {pdfFiles.map((file, index) => (
                  <li key={`${file.name}:${file.size}:${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/15 px-3 py-2.5">
                    <span className="min-w-0 truncate text-xs text-slate-300">{file.name}</span>
                    <span className="shrink-0 text-[10px] text-slate-600">{formatBytes(file.size)}</span>
                  </li>
                ))}
              </ul>
            )}
            {pdfNotice && <p className="mt-3 text-xs text-amber-300">{pdfNotice}</p>}
            <div className="mt-3 grid grid-cols-2 gap-2" aria-label="PDF 分析深度">
              <button
                type="button"
                onClick={() => setPdfAnalysisDepth('deep')}
                className={`rounded-xl border px-3 py-2 text-left transition ${pdfAnalysisDepth === 'deep' ? 'border-violet-400/35 bg-violet-500/10 text-violet-100' : 'border-white/8 bg-black/15 text-slate-500'}`}
              >
                <strong className="block text-[11px]">深度分析</strong>
                <span className="mt-1 block text-[9px] leading-4 opacity-75">实体、剧情分开提取，再做全书综合</span>
              </button>
              <button
                type="button"
                onClick={() => setPdfAnalysisDepth('quick')}
                className={`rounded-xl border px-3 py-2 text-left transition ${pdfAnalysisDepth === 'quick' ? 'border-sky-400/35 bg-sky-500/10 text-sky-100' : 'border-white/8 bg-black/15 text-slate-500'}`}
              >
                <strong className="block text-[11px]">快速提取</strong>
                <span className="mt-1 block text-[9px] leading-4 opacity-75">速度更快，适合先检查 PDF 可读性</span>
              </button>
            </div>
            {(pdfWorkloadLoading || pdfWorkload) && (
              <div className={`mt-3 rounded-xl border px-3 py-2.5 ${localWorkloadRecommendation === 'prefer-cloud'
                ? 'border-amber-400/25 bg-amber-500/[0.06]'
                : localWorkloadRecommendation === 'prefer-quick' && pdfAnalysisDepth === 'deep'
                  ? 'border-violet-400/25 bg-violet-500/[0.06]'
                  : 'border-sky-400/15 bg-sky-500/[0.035]'}`}
              >
                {pdfWorkloadLoading ? (
                  <p className="flex items-center gap-2 text-[10px] text-slate-400">
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />正在读取 PDF 页数，不会上传文件
                  </p>
                ) : pdfWorkload && (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
                      <strong className="text-slate-200">
                        共 {pdfWorkload.pageCount} 页 · 预计 {pdfWorkload.estimatedPasses} 个分析步骤
                      </strong>
                      <span className="text-slate-400">
                        {aiProviderSelection.providerId === 'local-bridge'
                          ? `本地模型约 ${pdfWorkload.estimatedMinutesLow}-${pdfWorkload.estimatedMinutesHigh} 分钟`
                          : aiProviderSelection.providerId === 'external-account'
                            ? '外部 API · 分段提取＋全书综合'
                            : 'Astral Trace 云端任务队列'}
                      </span>
                    </div>
                    <p className={`mt-1.5 text-[10px] leading-4 ${localWorkloadRecommendation === 'prefer-cloud'
                      ? 'text-amber-200'
                      : 'text-slate-500'}`}
                    >
                      {aiProviderSelection.providerId === 'external-account'
                        ? '将通过模型 API Bridge 使用已配置的提取模型和综合模型执行；无需启动 Ollama。实际耗时取决于模型供应商的响应与限流。'
                          : aiProviderSelection.providerId === 'astraltrace-cloud'
                          ? '文件将按平台 AI 任务策略处理，并计入本次任务的 AI Credit。'
                          : pdfWorkload.recommendation === 'prefer-cloud'
                        ? '超过 30 页：建议使用云端长上下文模型；仍可继续本地分析，并会按页段缓存，失败后可续跑。'
                        : pdfWorkload.recommendation === 'prefer-quick'
                          ? pdfAnalysisDepth === 'deep'
                            ? '11-30 页的深度分析耗时较长；建议先快速提取，确认文本质量后再运行深度分析。'
                            : '11-30 页优先使用快速提取；需要跨章节关系和因果链时再切换深度分析。'
                          : '1-10 页适合直接使用本地模型；可按需要选择快速或深度分析。'}
                    </p>
                  </>
                )}
              </div>
            )}
            {pdfAnalysisProgress && (
              <div className="mt-3 rounded-xl border border-violet-400/15 bg-violet-500/[0.045] p-3" role="status">
                <div className="flex items-center justify-between gap-3 text-[10px] text-violet-100">
                  <span>{pdfAnalysisProgress.message}</span>
                  <span className="shrink-0">{pdfAnalysisProgress.current}/{Math.max(1, pdfAnalysisProgress.total)}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/30">
                  <div
                    className="h-full rounded-full bg-violet-400 transition-[width]"
                    style={{ width: `${Math.min(100, Math.max(3, (pdfAnalysisProgress.current / Math.max(1, pdfAnalysisProgress.total)) * 100))}%` }}
                  />
                </div>
              </div>
            )}
            <button
              type="button"
              disabled={pdfAnalysisBusy}
              onClick={() => {
                if (pdfFiles.length === 0) pdfInputRef.current?.click()
                else void runPdfAnalysis()
              }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-white/[0.025] disabled:text-slate-600"
            >
              {pdfAnalysisBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
              {pdfAnalysisBusy
                ? '正在分析 PDF'
                : pdfFiles.length === 0
                  ? '选择 PDF'
                  : pendingAiJobAction?.mode === 'resume'
                    ? '接管中断任务'
                    : pendingAiJobAction?.mode === 'retry'
                      ? '重新分析 PDF'
                      : '开始分析 PDF'}
            </button>
            <p className="mt-2 text-[10px] leading-4 text-slate-600">文字型 PDF 可直接分析；扫描页会被标记。深度分析调用次数更多，但能显著改善跨章节人物、因果链与场景质量。</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <ResultCard icon={GitBranch} title="人物关系图" description="人物、阵营、地点和事件之间的有向关系，并可追溯到原文页码。" count={pdfAnalysisResult?.relationships.length} />
            <ResultCard icon={Users} title="人物形象与档案" description="立绘、外貌、性格、动机、秘密、说话方式与可能的剧情反应。" count={pdfAnalysisResult?.people.length} />
            <ResultCard icon={KeyRound} title="关键线索" description="线索来源、可发现地点、前置条件、失败补救和关联讲义。" count={pdfAnalysisResult?.clues.length} />
            <ResultCard icon={BookOpenText} title="章节与场景" description="按地点和事件拆成可编排场景，标记必要人物、怪物和地图。" count={pdfAnalysisResult?.scenes.length} />
            <ResultCard icon={Boxes} title="可导入内容" description="怪物、NPC、道具、法术和规则草稿，经 schema 校验后才能写入。" count={pdfAnalysisResult?.importCandidates.length} />
            <ResultCard icon={Lightbulb} title="备团提示" description="矛盾点、遗漏素材、可能脱轨路线与下一场需要准备的内容。" count={pdfAnalysisResult?.prepTips.length} />
          </div>
        </div>

        {pdfAnalysisResult && (
          <div className="mt-5 space-y-4 border-t border-white/8 pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-100">AI 战役索引草稿</h2>
                <p className="mt-1 text-xs text-slate-500">
                  已分析 {pdfAnalysisResult.documents.reduce((sum, document) => sum + document.pageCount, 0)} 页；所有引用均保留原 PDF 页码，写入工坊前仍需 DM 审阅。
                </p>
                {pdfAnalysisResult.modelRouting && (
                  <p className="mt-1 text-[10px] text-sky-300/80">
                    实际模型路线：{pdfAnalysisResult.modelRouting.extraction.displayName}（分段提取）
                    {' → '}{pdfAnalysisResult.modelRouting.synthesis.displayName}（全书综合）
                  </p>
                )}
                {pdfAnalysisDirty && <p className="mt-1 text-[10px] text-amber-300">当前草稿包含尚未保存到战役的 DM 修改。</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setPdfAnalysisEditorOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-500/15">
                  <PencilLine className="h-4 w-4" />审阅与编辑
                </button>
                <button
                  type="button"
                  disabled={!pdfAnalysisDirty || pdfSaveBusy || !activeAiJob}
                  onClick={() => void savePdfAnalysisDraft()}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {pdfSaveBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {pdfSaveBusy ? '正在保存' : '保存到战役'}
                </button>
                <button type="button" onClick={downloadPdfAnalysis} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.04]">
                  <Download className="h-4 w-4" />导出分析 JSON
                </button>
              </div>
            </div>

            <PdfCampaignKnowledgeBase
              analysis={pdfAnalysisResult}
              mapHref={`${campaignBasePath}/maps`}
              onEdit={() => setPdfAnalysisEditorOpen(true)}
              onPortraitChange={updatePdfPersonPortrait}
            />

            {pdfAnalysisResult.warnings.length > 0 && (
              <div className="rounded-2xl border border-amber-400/15 bg-amber-500/[0.035] p-4">
                <h3 className="text-sm font-semibold text-amber-100">需要 DM 复核</h3>
                <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-200/75">{pdfAnalysisResult.warnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul>
              </div>
            )}

            {pdfAnalysisEditorOpen && (
              <PdfCampaignAnalysisEditor
                analysis={pdfAnalysisResult}
                onChange={(next) => {
                  setPdfAnalysisResult(next)
                  setPdfAnalysisDirty(true)
                }}
                onClose={() => setPdfAnalysisEditorOpen(false)}
                onExport={downloadPdfAnalysis}
              />
            )}
          </div>
        )}
      </section>

      <section className="mb-5 grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.035] p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-3">
              <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-300"><MapPinned className="h-5 w-5" /></div>
              <div>
                <h2 className="font-semibold text-slate-100">第二阶段：地图与场景制作</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">导入地图后设置墙、门、窗、海拔、灯光、迷雾、怪物、出场动画、区域触发器和互动点。</p>
              </div>
            </div>
            <StatusBadge status="available" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-slate-400 sm:grid-cols-3">
            {['地图与几何', '光照与迷雾', '预设遭遇', '触发区域', '讲义／密语', '场景音频'].map((label) => (
              <span key={label} className="rounded-lg border border-white/8 bg-black/15 px-2.5 py-2">{label}</span>
            ))}
          </div>
          <Link to={`${campaignBasePath}/maps`} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20">
            <MapPinned className="h-4 w-4" />进入地图与场景编排
          </Link>
        </article>

        <article className="rounded-2xl border border-cyan-400/15 bg-cyan-500/[0.035] p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-3">
              <div className="rounded-xl bg-cyan-500/10 p-2.5 text-cyan-300"><Hammer className="h-5 w-5" /></div>
              <div>
                <h2 className="font-semibold text-slate-100">内容入库与遭遇验证</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">审阅 AI 提取的怪物、NPC 和规则内容，再用确定性战斗模拟检查难度与 Headless 覆盖。</p>
              </div>
            </div>
            <StatusBadge status="partial" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to={`${campaignBasePath}/dm-tools/workshop`} className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/15 bg-cyan-400/8 px-3 py-2.5 text-sm font-semibold text-cyan-100"><Hammer className="h-4 w-4" />打开自定义工坊</Link>
            <Link to={`${campaignBasePath}/dm-tools/simulation`} className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/15 bg-cyan-400/8 px-3 py-2.5 text-sm font-semibold text-cyan-100"><Bot className="h-4 w-4" />运行遭遇预演</Link>
          </div>
        </article>
      </section>

      <section className="mb-5 rounded-2xl border border-fuchsia-400/15 bg-fuchsia-500/[0.03] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex gap-3">
            <div className="rounded-xl bg-fuchsia-500/10 p-2.5 text-fuchsia-300"><Mic2 className="h-5 w-5" /></div>
            <div>
              <h2 className="font-semibold text-slate-100">第三阶段：语音转录与持续战役记忆</h2>
              <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-500">
                语音、聊天、骰子、战斗日志和场景触发记录进入同一时间线。AI 只基于 DM 允许的记录生成本场总结、人物变化、未解决线索、玩家决定和下一场备团建议。
              </p>
            </div>
          </div>
          <StatusBadge status="planned" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['实时转录', '按发言者切分并允许玩家选择是否参与录音。'],
            ['事件时间线', '将语音片段与行动、骰子、地图和战斗事件对齐。'],
            ['团务总结', '生成可编辑的故事记录、NPC 变化和任务进度。'],
            ['下次备团', '根据未解决线索和玩家计划提出准备清单。'],
          ].map(([title, description]) => (
            <div key={title} className="rounded-xl border border-white/8 bg-black/15 p-3">
              <p className="text-xs font-semibold text-slate-200">{title}</p>
              <p className="mt-2 text-[11px] leading-5 text-slate-500">{description}</p>
            </div>
          ))}
        </div>
        <Link to={`${campaignBasePath}/communications`} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-fuchsia-300/15 bg-fuchsia-400/8 px-3 py-2.5 text-sm font-semibold text-fuchsia-100">
          <MessageSquareText className="h-4 w-4" />查看现有讲义与战役日志
        </Link>
      </section>

      <section className="rounded-2xl border border-amber-400/15 bg-amber-500/[0.035] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-3">
            <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-300"><PackageCheck className="h-5 w-5" /></div>
            <div>
              <h2 className="font-semibold text-slate-100">第四阶段：导出完整战役设置</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                导出角色、地图、地图图片、几何、场景、怪物、房间规则包和共享状态。AI 原文与转录资料接入后会采用独立权限和可选导出策略。
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={exportBusy}
            onClick={() => void exportCampaign()}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {exportBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            导出完整战役
          </button>
        </div>
        {exportNotice && (
          <p
            role="status"
            className={`mt-4 flex items-center gap-2 rounded-xl border bg-black/15 px-3 py-2 text-xs ${exportNotice.kind === 'success'
              ? 'border-emerald-400/15 text-emerald-100'
              : 'border-rose-400/15 text-rose-200'}`}
          >
            <CheckCircle2 className={`h-4 w-4 ${exportNotice.kind === 'success' ? 'text-emerald-300' : 'text-rose-300'}`} />
            {exportNotice.text}
          </p>
        )}
      </section>
    </div>
  )
}
