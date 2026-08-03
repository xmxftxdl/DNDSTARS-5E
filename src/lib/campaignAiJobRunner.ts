import type { AiProviderSelectionV1 } from '../../shared/ai-provider.mjs'
import { AiProviderRegistryV1 } from './aiProvider'
import {
  createCampaignAiJob,
  failCampaignAiJob,
  leaseCampaignAiJob,
  localAiRunnerId,
  submitCampaignAiJobResult,
  updateCampaignAiJobProgress,
  type PublicAiJobV2,
} from './aiJobApi'
import {
  createExternalAiBridgeRuntime,
  createLocalAiBridgeRuntime,
  localAiBridgeSnapshot,
} from './localAiBridgeApi'
import {
  analyzeExtractedPdfDocuments,
  extractPdfDocuments,
  pdfAnalysisErrorMessage,
  selectPdfAnalysisModelRouting,
  type PdfAnalysisDepthV1,
  type PdfAnalysisProgressV1,
  type PdfCampaignAnalysisV1,
} from './pdfCampaignAnalysis'
import {
  createEmptyPdfAnalysisCache,
  createPdfAnalysisCacheKey,
  deletePdfAnalysisCache,
  loadPdfAnalysisCache,
  savePdfAnalysisCache,
} from './pdfAnalysisCache'

const PDF_ANALYSIS_PROMPT_VERSION = 'pdf-campaign-analysis-v3'

export interface CampaignPdfAnalysisRunResult {
  job: PublicAiJobV2
  result: PdfCampaignAnalysisV1
}

function sourceAssetsForFiles(files: readonly File[]) {
  return files.map((file, index) => ({
    assetId: `pdf-${index}-${file.size}-${file.lastModified}`,
    name: file.name,
    mimeType: file.type || 'application/pdf',
    sizeBytes: file.size,
  }))
}

export function pdfFilesMatchAiJob(files: readonly File[], job: PublicAiJobV2): boolean {
  if (files.length !== job.sourceAssets.length) return false
  const fileKeys = files.map((file) => `${file.name}\u0000${file.size}`).sort()
  const sourceKeys = job.sourceAssets.map((source) => `${source.name}\u0000${source.sizeBytes}`).sort()
  return fileKeys.every((key, index) => key === sourceKeys[index])
}

function registerBridgeProvider(registry: AiProviderRegistryV1, selection: AiProviderSelectionV1): void {
  const bridge = localAiBridgeSnapshot()
  if (bridge.status !== 'ready' || !selection.modelId) throw new Error('provider-unavailable')
  if (selection.providerId === 'local-bridge') {
    registry.register(createLocalAiBridgeRuntime(bridge.models))
    return
  }
  if (selection.providerId === 'external-account') {
    registry.register(createExternalAiBridgeRuntime(bridge.models))
    return
  }
  throw new Error('selected-cloud-provider-not-configured')
}

function failureDetails(error: unknown, providerId?: string): { code: string; message: string } {
  const raw = error instanceof Error ? error.message : String(error)
  const code = (raw.split(':', 1)[0] || 'ai-job-failed').slice(0, 120)
  return { code, message: pdfAnalysisErrorMessage(error, providerId).slice(0, 1_000) }
}

export async function runCampaignPdfAnalysisJob(input: {
  campaignId: string
  files: readonly File[]
  selection: AiProviderSelectionV1
  depth: PdfAnalysisDepthV1
  resumeJob?: PublicAiJobV2 | null
  onProgress?: (progress: PdfAnalysisProgressV1) => void
  onJob?: (job: PublicAiJobV2) => void
}): Promise<CampaignPdfAnalysisRunResult> {
  if (input.files.length === 0) throw new Error('pdf-files-required')
  const registry = new AiProviderRegistryV1()
  registerBridgeProvider(registry, input.selection)
  const modelRouting = selectPdfAnalysisModelRouting(await registry.models(), input.selection)
  if (!modelRouting) throw new Error('pdf-model-routing-unavailable')

  let leasedJob: PublicAiJobV2 | null = null
  let leaseToken = ''
  let latestRevision = 0
  let latestProgress: PdfAnalysisProgressV1 = {
    stage: 'extracting', current: 0, total: 0, message: '准备分析 PDF',
  }
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let heartbeatError: unknown = null
  let heartbeatChain = Promise.resolve()

  try {
    let job = input.resumeJob ?? null
    const runnerId = localAiRunnerId()
    if (job) {
      if (!pdfFilesMatchAiJob(input.files, job)) throw new Error('ai-job-source-mismatch')
      const leaseExpired = job.status === 'running' && (job.lease?.expiresAt ?? 0) <= Date.now()
      const ownedLease = job.status === 'running' && job.lease?.runnerId === runnerId
      if (job.status !== 'awaiting-local-runner' && !leaseExpired && !ownedLease) throw new Error('ai-job-not-leasable')
    } else {
      const created = await createCampaignAiJob(input.campaignId, {
        schemaVersion: 2,
        taskKind: 'campaign-analysis',
        executionMode: 'local-runner',
        providerId: input.selection.providerId,
        modelId: input.selection.modelId ?? '',
        promptVersion: PDF_ANALYSIS_PROMPT_VERSION,
        idempotencyKey: `pdf-${crypto.randomUUID()}`,
        sourceAssets: sourceAssetsForFiles(input.files),
        input: {
          depth: input.depth,
          extractionModelId: modelRouting.extraction.modelId,
          synthesisModelId: modelRouting.synthesis.modelId,
        },
      })
      job = created.job
    }

    const leased = await leaseCampaignAiJob(
      input.campaignId,
      job.jobId,
      job.revision,
      runnerId,
      !!input.resumeJob,
    )
    leasedJob = leased.job
    leaseToken = leased.leaseToken
    latestRevision = leased.job.revision
    input.onJob?.(leased.job)

    const heartbeat = () => {
      heartbeatChain = heartbeatChain.then(async () => {
        const updated = await updateCampaignAiJobProgress(
          input.campaignId,
          leased.job.jobId,
          latestRevision,
          leaseToken,
          latestProgress,
        )
        latestRevision = updated.revision
        input.onJob?.(updated)
      }).catch((error: unknown) => {
        heartbeatError = error
      })
    }
    heartbeatTimer = setInterval(heartbeat, 45_000)

    const cacheKey = await createPdfAnalysisCacheKey({
      files: input.files,
      selection: input.selection,
      depth: input.depth,
      promptVersion: PDF_ANALYSIS_PROMPT_VERSION,
      routeModelIds: {
        extraction: modelRouting.extraction.modelId,
        synthesis: modelRouting.synthesis.modelId,
      },
    })
    const cached = await loadPdfAnalysisCache(cacheKey).catch(() => null)
    const cache = cached ?? createEmptyPdfAnalysisCache({
      cacheKey,
      files: input.files,
      selection: input.selection,
      depth: input.depth,
      promptVersion: PDF_ANALYSIS_PROMPT_VERSION,
    })
    let cacheWritable = true
    const persistCache = async () => {
      if (!cacheWritable) return
      try {
        await savePdfAnalysisCache(cache)
      } catch {
        cacheWritable = false
      }
    }
    const reportProgress = (progress: PdfAnalysisProgressV1) => {
      latestProgress = progress
      input.onProgress?.(progress)
    }
    let documents = cache.documents
    if (documents) {
      reportProgress({
        stage: 'extracting', current: 1, total: 1,
        message: `已从本机缓存恢复 ${documents.length} 个 PDF 的文字层`,
      })
    } else {
      documents = await extractPdfDocuments(input.files, reportProgress)
      cache.documents = documents
      await persistCache()
    }
    const result = await analyzeExtractedPdfDocuments({
      documents,
      registry,
      selection: input.selection,
      modelRouting,
      depth: input.depth,
      cachedPasses: cache.passes,
      cachedSynthesis: cache.synthesis,
      onProgress: reportProgress,
      onPassCompleted: async (key, analysis) => {
        cache.passes[key] = analysis
        await persistCache()
      },
      onSynthesisCompleted: async (analysis) => {
        cache.synthesis = analysis
        await persistCache()
      },
    })

    if (heartbeatTimer) clearInterval(heartbeatTimer)
    heartbeatTimer = null
    heartbeat()
    await heartbeatChain
    if (heartbeatError) throw heartbeatError

    const persisted = await submitCampaignAiJobResult(
      input.campaignId,
      leased.job.jobId,
      latestRevision,
      leaseToken,
      {
        schemaVersion: 1,
        kind: 'pdf-campaign-analysis',
        payload: result as unknown as Record<string, unknown>,
      },
    )
    await deletePdfAnalysisCache(cacheKey).catch(() => undefined)
    input.onJob?.(persisted)
    return { job: persisted, result }
  } catch (error) {
    if (heartbeatTimer) clearInterval(heartbeatTimer)
    await heartbeatChain.catch(() => undefined)
    if (leasedJob && leaseToken) {
      const failed = await failCampaignAiJob(
        input.campaignId,
        leasedJob.jobId,
        latestRevision || leasedJob.revision,
        leaseToken,
        failureDetails(error, input.selection.providerId),
      ).catch(() => null)
      if (failed) input.onJob?.(failed)
    }
    throw error
  }
}
