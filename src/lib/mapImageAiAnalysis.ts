import type { AiProviderSelectionV1 } from '../../shared/ai-provider.mjs'
import { AiProviderRegistryV1, executeStructuredAiTask } from './aiProvider'
import {
  createExternalAiBridgeRuntime,
  createLocalAiBridgeRuntime,
  localAiBridgeSnapshot,
} from './localAiBridgeApi'
import type { WallDetectionCandidate } from './mapImageGeometryDetection'

export interface AiMapAnalysisPointV1 {
  x: number
  y: number
}

export interface AiMapAnalysisV1 {
  schemaVersion: 1
  mapType: 'battlemap' | 'regional-map' | 'illustration' | 'unknown'
  summary: string
  grid: {
    visible: boolean
    estimatedPixelsPerGrid: number
    confidence: number
  }
  walls: Array<{
    points: AiMapAnalysisPointV1[]
    confidence: number
  }>
  warnings: string[]
}

const MAP_ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'mapType', 'summary', 'grid', 'walls', 'warnings'],
  properties: {
    schemaVersion: { type: 'integer', const: 1 },
    mapType: { type: 'string', enum: ['battlemap', 'regional-map', 'illustration', 'unknown'] },
    summary: { type: 'string', maxLength: 500 },
    grid: {
      type: 'object',
      additionalProperties: false,
      required: ['visible', 'estimatedPixelsPerGrid', 'confidence'],
      properties: {
        visible: { type: 'boolean' },
        estimatedPixelsPerGrid: { type: 'number', minimum: 0, maximum: 4096 },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
    },
    walls: {
      type: 'array',
      maxItems: 400,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['points', 'confidence'],
        properties: {
          points: {
            type: 'array',
            minItems: 2,
            maxItems: 80,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['x', 'y'],
              properties: {
                x: { type: 'number', minimum: 0, maximum: 1000 },
                y: { type: 'number', minimum: 0, maximum: 1000 },
              },
            },
          },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
    warnings: {
      type: 'array',
      maxItems: 20,
      items: { type: 'string', maxLength: 300 },
    },
  },
} as const

function finite(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
}

export function isAiMapAnalysisV1(value: unknown): value is AiMapAnalysisV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const raw = value as Record<string, unknown>
  const grid = raw.grid && typeof raw.grid === 'object' && !Array.isArray(raw.grid)
    ? raw.grid as Record<string, unknown>
    : null
  if (
    raw.schemaVersion !== 1 ||
    !['battlemap', 'regional-map', 'illustration', 'unknown'].includes(String(raw.mapType)) ||
    typeof raw.summary !== 'string' || raw.summary.length > 500 ||
    !grid || typeof grid.visible !== 'boolean' ||
    !finite(grid.estimatedPixelsPerGrid, 0, 4096) || !finite(grid.confidence, 0, 1) ||
    !Array.isArray(raw.walls) || raw.walls.length > 400 ||
    !Array.isArray(raw.warnings) || raw.warnings.length > 20 ||
    raw.warnings.some((warning) => typeof warning !== 'string' || warning.length > 300)
  ) return false
  return raw.walls.every((wall) => {
    if (!wall || typeof wall !== 'object' || Array.isArray(wall)) return false
    const candidate = wall as Record<string, unknown>
    return finite(candidate.confidence, 0, 1) &&
      Array.isArray(candidate.points) && candidate.points.length >= 2 && candidate.points.length <= 80 &&
      candidate.points.every((point) => {
        if (!point || typeof point !== 'object' || Array.isArray(point)) return false
        const coordinate = point as Record<string, unknown>
        return finite(coordinate.x, 0, 1000) && finite(coordinate.y, 0, 1000)
      })
  })
}

export function aiMapAnalysisWallCandidates(
  analysis: AiMapAnalysisV1,
  width: number,
  height: number,
): WallDetectionCandidate[] {
  return analysis.walls.flatMap((wall) => wall.points.slice(0, -1).map((point, index) => ({
    a: { x: point.x / 1000 * width, y: point.y / 1000 * height },
    b: { x: wall.points[index + 1].x / 1000 * width, y: wall.points[index + 1].y / 1000 * height },
    confidence: wall.confidence,
  }))).filter((candidate) => Math.hypot(
    candidate.b.x - candidate.a.x,
    candidate.b.y - candidate.a.y,
  ) >= Math.max(4, Math.min(width, height) * 0.005))
}

async function aiImageDataUrl(file: File, maximumDimension = 2048): Promise<{
  dataUrl: string
  mimeType: 'image/jpeg'
}> {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, maximumDimension / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('map-analysis-canvas-unavailable')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.88), mimeType: 'image/jpeg' }
  } finally {
    bitmap.close()
  }
}

export async function analyzeMapImageWithAi(input: {
  file: File
  selection: AiProviderSelectionV1
}): Promise<{ analysis: AiMapAnalysisV1; modelId: string }> {
  const bridge = localAiBridgeSnapshot()
  if (bridge.status !== 'ready') throw new Error('map-analysis-bridge-unavailable')
  const eligible = bridge.models.filter((model) =>
    model.providerId === input.selection.providerId &&
    model.supportedTasks.includes('map-analysis') &&
    model.capabilities.includes('vision') &&
    model.capabilities.includes('structured-output'))
  const selectedModel = eligible.find((model) => model.id === input.selection.modelId) ?? eligible[0]
  if (!selectedModel) throw new Error('map-analysis-model-unavailable')
  const registry = new AiProviderRegistryV1()
  if (input.selection.providerId === 'local-bridge') registry.register(createLocalAiBridgeRuntime(bridge.models))
  else if (input.selection.providerId === 'external-account') registry.register(createExternalAiBridgeRuntime(bridge.models))
  else throw new Error('map-analysis-cloud-unavailable')
  const image = await aiImageDataUrl(input.file)
  const jobId = `map-analysis-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const result = await executeStructuredAiTask({
    registry,
    selection: { ...input.selection, modelId: selectedModel.id },
    request: {
      schemaVersion: 1,
      jobId,
      task: 'map-analysis',
      systemPrompt: [
        '你是虚拟桌面地图几何分析器。只分析俯视地图中的真实建筑墙体边界。',
        '忽略网格线、地板纹理、家具边缘、树木、文字、水印、船帆与装饰。',
        '所有坐标使用图片左上角为 (0,0)、右下角为 (1000,1000) 的归一化坐标。',
        '沿墙体中心线输出尽量少的折线；不要把同一面厚墙的两侧轮廓都输出。',
        '不确定的墙不要猜测，并在 warnings 中说明。',
      ].join('\n'),
      userPrompt: '识别这张图片是否适合作为战斗地图，估计网格尺寸，并输出可以阻挡移动和视线的墙体中心线。',
      outputSchema: MAP_ANALYSIS_SCHEMA,
      maxOutputTokens: 8192,
      images: [{ id: 'battlemap', mimeType: image.mimeType, dataUrl: image.dataUrl }],
    },
    validateOutput: isAiMapAnalysisV1,
    estimatedInputTokens: 4_000,
    estimatedOutputTokens: 4_000,
  })
  if (!result.ok) throw new Error(`${result.error}${result.detail ? `:${result.detail}` : ''}`)
  return { analysis: result.output, modelId: selectedModel.id }
}

export function mapImageAiAnalysisErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : String(error)
  if (code.includes('map-analysis-bridge-unavailable')) return '模型 API Bridge 尚未连接；可先使用本地墙体识别，或启动并配对 Bridge 后再使用 AI 语义增强。'
  if (code.includes('map-analysis-model-unavailable') || code.includes('provider-cannot-run-task')) return '当前 Bridge 没有支持视觉与结构化输出的地图分析模型。'
  if (code.includes('provider-output-invalid')) return '模型返回的墙体坐标不符合安全结构，结果未采用。'
  if (code.includes('local-ai-bridge-timeout')) return '地图 AI 分析超时，请稍后重试。'
  return `地图 AI 分析失败：${code.slice(0, 220)}`
}
