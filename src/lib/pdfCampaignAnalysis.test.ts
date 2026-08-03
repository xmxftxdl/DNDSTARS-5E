import { describe, expect, it, vi } from 'vitest'
import type { AiModelDescriptorV1, AiProviderDescriptorV1, AiProviderSelectionV1 } from '../../shared/ai-provider.mjs'
import { AiProviderRegistryV1, type AiProviderRuntimeV1 } from './aiProvider'
import {
  analyzeExtractedPdfDocuments,
  estimatePdfAnalysisWorkload,
  PDF_CAMPAIGN_CHUNK_SCHEMA,
  pdfAnalysisSchemaForPass,
  selectPdfAnalysisModelRouting,
  pdfAnalysisErrorMessage,
  validatePdfCampaignChunkAnalysis,
  type ExtractedPdfDocumentV1,
  type PdfCampaignChunkAnalysisV1,
} from './pdfCampaignAnalysis'

const descriptor: AiProviderDescriptorV1 = {
  schemaVersion: 1,
  id: 'local-bridge',
  displayName: '本地模型',
  description: '测试 Provider',
  transport: 'local-bridge',
  status: 'ready',
  dataBoundary: 'local-only',
  capabilities: ['text-generation', 'structured-output', 'chinese'],
  supportedTasks: ['pdf-extraction', 'campaign-analysis'],
  pricing: {
    mode: 'free-local',
    creditsPerMillionInput: 0,
    creditsPerMillionOutput: 0,
    minimumCredits: 0,
  },
}

const model: AiModelDescriptorV1 = {
  schemaVersion: 1,
  providerId: descriptor.id,
  id: 'ollama:qwen-test',
  displayName: 'Qwen Test',
  contextWindowTokens: 32_768,
  capabilities: ['text-generation', 'structured-output', 'chinese'],
  supportedTasks: ['pdf-extraction', 'campaign-analysis'],
}

function routeModel(id: string, displayName: string, providerId = 'local-bridge'): AiModelDescriptorV1 {
  return {
    schemaVersion: 1,
    providerId,
    id,
    displayName,
    contextWindowTokens: 32_768,
    capabilities: ['text-generation', 'structured-output', 'chinese'],
    supportedTasks: ['pdf-extraction', 'campaign-analysis'],
  }
}

const selection: AiProviderSelectionV1 = {
  schemaVersion: 1,
  providerId: descriptor.id,
  modelId: model.id,
  allowPaidFallback: false,
  maxCreditsPerTask: 0,
}

function output(page: number): PdfCampaignChunkAnalysisV1 {
  return {
    schemaVersion: 1,
    overview: page === 1 ? '冒险围绕失踪的王冠展开。' : '第二段补充了地下陵墓。',
    people: [{
      name: '艾琳',
      description: page === 1 ? '王室调查员。' : '负责寻找失踪王冠的调查员。',
      role: '盟友',
      appearance: '银色短发，穿深蓝色旅行斗篷。',
      personality: '谨慎',
      motivation: '找回王冠',
      secret: '',
      voice: '语速缓慢',
      citations: [{ documentName: '冒险.pdf', page }],
    }],
    relationships: [],
    locations: [],
    factions: [],
    clues: [],
    scenes: [],
    encounters: [],
    importCandidates: [],
    prepTips: [],
    warnings: [],
  }
}

function outputForSchema(page: number, schema: unknown): PdfCampaignChunkAnalysisV1 {
  const result = output(page)
  const properties = (schema as { properties?: Record<string, { maxItems?: number }> })?.properties ?? {}
  for (const key of [
    'people', 'relationships', 'locations', 'factions', 'clues', 'scenes', 'encounters',
    'importCandidates', 'prepTips', 'warnings',
  ] as const) {
    if (properties[key]?.maxItems === 0) result[key] = [] as never
  }
  return result
}

function documents(): ExtractedPdfDocumentV1[] {
  return [{
    id: 'pdf-1',
    name: '冒险.pdf',
    pageCount: 3,
    extractedCharacters: 100,
    scannedPages: [3],
    chunks: [1, 2].map((page) => ({
      id: `chunk-${page}`,
      documentName: '冒险.pdf',
      mimeType: 'application/pdf-text',
      text: `第 ${page} 页内容`,
      pageStart: page,
      pageEnd: page,
    })),
  }]
}

function runtime(generate: AiProviderRuntimeV1['generateStructured']): AiProviderRuntimeV1 {
  return {
    descriptor,
    listModels: async () => [model],
    generateStructured: generate,
  }
}

describe('PDF 战役分析', () => {
  it('限制每个页段的结构化输出规模，避免本地模型无限扩写', () => {
    const properties = PDF_CAMPAIGN_CHUNK_SCHEMA.properties as Record<string, Record<string, unknown>>
    expect(properties.people.maxItems).toBe(12)
    expect(properties.relationships.maxItems).toBe(40)
    expect(properties.scenes.maxItems).toBe(10)
    expect(properties.warnings.maxItems).toBe(8)
  })

  it('按分析阶段关闭无关字段，并给长文档提供非强制的模型建议', () => {
    const entityProperties = pdfAnalysisSchemaForPass({ pass: 'entities', documentName: '冒险.pdf', pageStart: 1, pageEnd: 2 })
      .properties as Record<string, { maxItems?: number }>
    const adventureProperties = pdfAnalysisSchemaForPass({ pass: 'adventure', documentName: '冒险.pdf', pageStart: 1, pageEnd: 2 })
      .properties as Record<string, { maxItems?: number }>
    const synthesisProperties = pdfAnalysisSchemaForPass({ pass: 'synthesis' })
      .properties as Record<string, { maxItems?: number }>
    expect(entityProperties.people.maxItems).toBeGreaterThan(0)
    expect(entityProperties.scenes.maxItems).toBe(0)
    expect(adventureProperties.people.maxItems).toBe(0)
    expect(adventureProperties.scenes.maxItems).toBeGreaterThan(0)
    expect(synthesisProperties.people.maxItems).toBe(0)
    expect(synthesisProperties.relationships.maxItems).toBeGreaterThan(0)
    expect(estimatePdfAnalysisWorkload(8, 'deep').recommendation).toBe('local-ready')
    expect(estimatePdfAnalysisWorkload(20, 'deep').recommendation).toBe('prefer-quick')
    expect(estimatePdfAnalysisWorkload(40, 'quick').recommendation).toBe('prefer-cloud')
  })

  it('本地按参数量路由，外部 API 按显式角色路由', () => {
    const localSelection = { ...selection, modelId: 'ollama:qwen3.5:35b' }
    const localRoute = selectPdfAnalysisModelRouting([
      routeModel('ollama:qwen3.5:9b', 'Qwen 3.5 9B'),
      routeModel('ollama:qwen3.5:14b', 'Qwen 3.5 14B'),
      routeModel('ollama:qwen3.5:35b', 'Qwen 3.5 35B'),
    ], localSelection)
    expect(localRoute).toMatchObject({
      automatic: true,
      extraction: { modelId: 'ollama:qwen3.5:9b', parameterBillions: 9 },
      synthesis: { modelId: 'ollama:qwen3.5:35b', parameterBillions: 35 },
      extractionUsedPreferredSize: true,
      synthesisUsedPreferredSize: true,
    })

    const externalSelection = {
      ...selection,
      providerId: 'external-account',
      modelId: 'external:synthesis:paid-35b',
    }
    const externalRoute = selectPdfAnalysisModelRouting([
      routeModel('external:extraction:paid-mini', 'Paid Mini', 'external-account'),
      routeModel('external:synthesis:paid-35b', 'Paid 35B', 'external-account'),
    ], externalSelection)
    expect(externalRoute).toMatchObject({
      automatic: true,
      extraction: { modelId: 'external:extraction:paid-mini' },
      synthesis: { modelId: 'external:synthesis:paid-35b' },
      extractionUsedPreferredSize: true,
      synthesisUsedPreferredSize: true,
    })

    const legacyRoute = selectPdfAnalysisModelRouting([
      routeModel('external:legacy-model', 'Legacy Model', 'external-account'),
    ], { ...externalSelection, modelId: 'external:legacy-model' })
    expect(legacyRoute).toMatchObject({
      automatic: false,
      extraction: { modelId: 'external:legacy-model' },
      synthesis: { modelId: 'external:legacy-model' },
    })
  })

  it('执行深度分析时按阶段把请求交给不同模型', async () => {
    const small = routeModel('ollama:qwen3.5:9b', 'Qwen 3.5 9B')
    const large = routeModel('ollama:qwen3.5:35b', 'Qwen 3.5 35B')
    const usedModels: string[] = []
    const registry = new AiProviderRegistryV1()
    registry.register({
      descriptor,
      listModels: async () => [small, large],
      generateStructured: async (request, context) => {
        usedModels.push(context.model?.id ?? '')
        return {
          schemaVersion: 1,
          jobId: request.jobId,
          providerId: descriptor.id,
          modelId: context.model?.id,
          output: outputForSchema(request.documents?.[0]?.pageStart ?? 1, request.outputSchema),
        }
      },
    })
    const oneChunk = documents().map((document) => ({ ...document, chunks: document.chunks.slice(0, 1) }))
    const result = await analyzeExtractedPdfDocuments({
      documents: oneChunk,
      registry,
      selection: { ...selection, modelId: large.id },
      depth: 'deep',
    })
    expect(usedModels).toEqual([small.id, small.id, large.id])
    expect(result.modelRouting).toMatchObject({
      extraction: { modelId: small.id },
      synthesis: { modelId: large.id },
    })
  })

  it('外部 API 深度分析按角色把分段与综合请求交给不同模型', async () => {
    const externalDescriptor: AiProviderDescriptorV1 = {
      ...descriptor,
      id: 'external-account',
      displayName: '外部模型',
      transport: 'external-server',
      dataBoundary: 'cloud-processing',
      pricing: { ...descriptor.pricing, mode: 'external-account' },
    }
    const extraction = routeModel(
      'external:extraction:economy-model',
      '经济提取模型',
      externalDescriptor.id,
    )
    const synthesis = routeModel(
      'external:synthesis:advanced-model',
      '高级综合模型',
      externalDescriptor.id,
    )
    const usedModels: string[] = []
    const registry = new AiProviderRegistryV1()
    registry.register({
      descriptor: externalDescriptor,
      listModels: async () => [extraction, synthesis],
      generateStructured: async (request, context) => {
        usedModels.push(context.model?.id ?? '')
        return {
          schemaVersion: 1,
          jobId: request.jobId,
          providerId: externalDescriptor.id,
          modelId: context.model?.id,
          output: outputForSchema(request.documents?.[0]?.pageStart ?? 1, request.outputSchema),
        }
      },
    })

    const result = await analyzeExtractedPdfDocuments({
      documents: documents().map((document) => ({ ...document, chunks: document.chunks.slice(0, 1) })),
      registry,
      selection: {
        ...selection,
        providerId: externalDescriptor.id,
        modelId: synthesis.id,
      },
      depth: 'deep',
    })

    expect(usedModels).toEqual([extraction.id, extraction.id, synthesis.id])
    expect(result.modelRouting).toMatchObject({
      automatic: true,
      extraction: { modelId: extraction.id },
      synthesis: { modelId: synthesis.id },
    })
  })

  it('把本地模型中止原因转换成可执行的中文诊断', () => {
    expect(pdfAnalysisErrorMessage(new Error('provider-execution-failed:This operation was aborted')))
      .toContain('Ollama 生成请求被中止')
    expect(pdfAnalysisErrorMessage(new Error('provider-execution-failed:upstream-timeout-after-900000ms')))
      .toContain('超过允许时长')
    expect(pdfAnalysisErrorMessage(new Error('provider-execution-failed:bridge-client-disconnected')))
      .toContain('连接已断开')
    expect(pdfAnalysisErrorMessage(new Error('provider-execution-failed:fetch failed')))
      .toContain('Bridge 与 Ollama')
    expect(pdfAnalysisErrorMessage(new Error('provider-execution-failed:structured-output-truncated')))
      .toContain('已自动提高输出预算')
  })

  it('把外部 API 故障与 Ollama 故障区分开', () => {
    expect(pdfAnalysisErrorMessage(
      new Error('provider-execution-failed:upstream-network-error:ECONNRESET'),
      'external-account',
    )).toContain('ECONNRESET')
    expect(pdfAnalysisErrorMessage(
      new Error('provider-execution-failed:upstream-timeout-after-900000ms'),
      'external-account',
    )).toContain('外部模型 API 请求超过允许时长')
    expect(pdfAnalysisErrorMessage(
      new Error('provider-execution-failed:structured-output-truncated'),
      'external-account',
    )).toContain('外部模型已使用完整安全输出预算')
    expect(pdfAnalysisErrorMessage(
      new Error('provider-execution-failed:upstream-401'),
      'external-account',
    )).toContain('密钥')
    expect(pdfAnalysisErrorMessage(
      new Error('provider-execution-failed:upstream-429'),
      'external-account',
    )).toContain('额度')
  })

  it('按页段调用 Provider、合并重复人物并保留页码和扫描页警告', async () => {
    const registry = new AiProviderRegistryV1()
    const generate = vi.fn<AiProviderRuntimeV1['generateStructured']>(async (request) => {
      const page = request.documents?.[0]?.pageStart ?? 1
      return {
        schemaVersion: 1,
        jobId: request.jobId,
        providerId: descriptor.id,
        modelId: model.id,
        output: output(page),
      }
    })
    registry.register(runtime(generate))
    const progress = vi.fn()

    const result = await analyzeExtractedPdfDocuments({
      documents: documents(),
      registry,
      selection,
      onProgress: progress,
    })

    expect(generate).toHaveBeenCalledTimes(2)
    expect(result.analyzedChunks).toBe(2)
    expect(result.people).toHaveLength(1)
    expect(result.people[0].description).toContain('失踪王冠')
    expect(result.people[0].appearance).toContain('银色短发')
    expect(result.people[0].citations).toEqual([
      { documentName: '冒险.pdf', page: 1 },
      { documentName: '冒险.pdf', page: 2 },
    ])
    expect(result.warnings[0]).toContain('1 页未提取到足够文字')
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ stage: 'complete' }))
    expect(generate.mock.calls[0]?.[0].systemPrompt).toContain('严格区分人物、势力和地点')
  })

  it('Host 拒绝缺少页码引用或结构不完整的模型输出', () => {
    expect(validatePdfCampaignChunkAnalysis(output(1))).toBe(true)
    expect(validatePdfCampaignChunkAnalysis({ ...output(1), people: [{ name: '无引用' }] })).toBe(false)
  })

  it('模型返回非法结构时终止任务而不是写入半成品', async () => {
    const registry = new AiProviderRegistryV1()
    registry.register(runtime(async (request) => ({
      schemaVersion: 1,
      jobId: request.jobId,
      providerId: descriptor.id,
      modelId: model.id,
      output: { arbitrary: true },
    })))

    await expect(analyzeExtractedPdfDocuments({
      documents: documents().slice(0, 1).map((document) => ({ ...document, chunks: document.chunks.slice(0, 1) })),
      registry,
      selection,
    })).rejects.toThrow('provider-output-invalid')
  })

  it('本地模型命中结构化输出上限时自动扩容重试', async () => {
    const registry = new AiProviderRegistryV1()
    const requests: Array<{ maxOutputTokens?: number; userPrompt: string }> = []
    registry.register(runtime(async (request) => {
      requests.push({ maxOutputTokens: request.maxOutputTokens, userPrompt: request.userPrompt })
      if (requests.length === 1) throw new Error('structured-output-truncated')
      return {
        schemaVersion: 1,
        jobId: request.jobId,
        providerId: descriptor.id,
        modelId: model.id,
        output: outputForSchema(request.documents?.[0]?.pageStart ?? 1, request.outputSchema),
      }
    }))
    const progress = vi.fn()

    const result = await analyzeExtractedPdfDocuments({
      documents: documents().map((document) => ({ ...document, chunks: document.chunks.slice(0, 1) })),
      registry,
      selection,
      onProgress: progress,
    })

    expect(requests.map(({ maxOutputTokens }) => maxOutputTokens)).toEqual([2_200, 4_400])
    expect(requests[1]?.userPrompt).toContain('上一次输出达到长度上限')
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('第 1 次扩容重试（4400 tokens）'),
    }))
    expect(result.people).toHaveLength(1)
  })

  it('外部模型输出被截断时不自动重试，避免产生未确认费用', async () => {
    const externalDescriptor: AiProviderDescriptorV1 = {
      ...descriptor,
      id: 'external-account',
      displayName: '外部模型',
      transport: 'external-server',
      dataBoundary: 'cloud-processing',
      pricing: { ...descriptor.pricing, mode: 'external-account' },
    }
    const externalModel = routeModel('external:test', 'External Test', externalDescriptor.id)
    const generate = vi.fn<AiProviderRuntimeV1['generateStructured']>(async () => {
      throw new Error('structured-output-truncated')
    })
    const registry = new AiProviderRegistryV1()
    registry.register({
      descriptor: externalDescriptor,
      listModels: async () => [externalModel],
      generateStructured: generate,
    })

    await expect(analyzeExtractedPdfDocuments({
      documents: documents().map((document) => ({ ...document, chunks: document.chunks.slice(0, 1) })),
      registry,
      selection: {
        ...selection,
        providerId: externalDescriptor.id,
        modelId: externalModel.id,
      },
    })).rejects.toThrow('provider-execution-failed:structured-output-truncated')
    expect(generate).toHaveBeenCalledTimes(1)
    expect(generate.mock.calls[0]?.[0].maxOutputTokens).toBe(16_384)
  })

  it('从已完成页段继续分析，不会再次调用模型或重复写入缓存', async () => {
    const registry = new AiProviderRegistryV1()
    const generate = vi.fn<AiProviderRuntimeV1['generateStructured']>(async (request) => ({
      schemaVersion: 1,
      jobId: request.jobId,
      providerId: descriptor.id,
      modelId: model.id,
      output: outputForSchema(request.documents?.[0]?.pageStart ?? 1, request.outputSchema),
    }))
    registry.register(runtime(generate))
    const onPassCompleted = vi.fn()
    const progress = vi.fn()

    const result = await analyzeExtractedPdfDocuments({
      documents: documents(),
      registry,
      selection,
      cachedPasses: { 'chunk-1:quick': output(1) },
      onPassCompleted,
      onProgress: progress,
    })

    expect(generate).toHaveBeenCalledTimes(1)
    expect(generate.mock.calls[0]?.[0].documents?.[0]?.id).toBe('chunk-2')
    expect(onPassCompleted).toHaveBeenCalledTimes(1)
    expect(onPassCompleted).toHaveBeenCalledWith('chunk-2:quick', expect.objectContaining({ schemaVersion: 1 }))
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('已恢复本机缓存') }))
    expect(result.people[0]?.citations).toEqual([
      { documentName: '冒险.pdf', page: 1 },
      { documentName: '冒险.pdf', page: 2 },
    ])
  })

  it('深度分析分离实体与剧情抽取，并在最后执行全书级综合', async () => {
    const registry = new AiProviderRegistryV1()
    const generate = vi.fn<AiProviderRuntimeV1['generateStructured']>(async (request) => ({
      schemaVersion: 1,
      jobId: request.jobId,
      providerId: descriptor.id,
      modelId: model.id,
      output: outputForSchema(request.documents?.[0]?.pageStart ?? 1, request.outputSchema),
    }))
    registry.register(runtime(generate))
    const progress = vi.fn()

    const result = await analyzeExtractedPdfDocuments({
      documents: documents(),
      registry,
      selection,
      depth: 'deep',
      onProgress: progress,
    })

    expect(generate).toHaveBeenCalledTimes(5)
    expect(generate.mock.calls.filter(([request]) => request.task === 'pdf-extraction')).toHaveLength(4)
    expect(generate.mock.calls.slice(0, 4).map(([request]) => request.maxOutputTokens)).toEqual([1_600, 1_600, 1_600, 1_600])
    expect(generate.mock.calls.at(-1)?.[0].maxOutputTokens).toBe(2_200)
    expect(generate.mock.calls.at(-1)?.[0].task).toBe('campaign-analysis')
    expect(progress).toHaveBeenLastCalledWith({ stage: 'complete', current: 5, total: 5, message: 'PDF 分析完成' })
    expect(result.people).toHaveLength(1)
    expect(result).toMatchObject({ analyzedChunks: 2, analysisDepth: 'deep', analysisPasses: 5 })
  })

  it('Host 拒绝把纪年或其他超范围数字冒充成 PDF 页码', async () => {
    const registry = new AiProviderRegistryV1()
    registry.register(runtime(async (request) => ({
      schemaVersion: 1,
      jobId: request.jobId,
      providerId: descriptor.id,
      modelId: model.id,
      output: output(1495),
    })))

    await expect(analyzeExtractedPdfDocuments({
      documents: documents().slice(0, 1).map((document) => ({ ...document, chunks: document.chunks.slice(0, 1) })),
      registry,
      selection,
    })).rejects.toThrow('provider-output-invalid')
  })
})
