import type { AiBillingRecordV1 } from '../../shared/ai-model-policy.mjs'
import {
  validateCharacterExcelAiPatch,
  type CharacterExcelAiPatchV1,
} from '../../shared/character-excel-ai-contract.mjs'
import { getRoomSession } from './roomSession'
import { sharedEventApiCandidates } from './sharedApi'
import { CLIENT_SHARED_PROTOCOL_VERSION } from './sharedProtocolVersion'
import type {
  LocalAiPortraitGenerationInput,
  LocalAiPortraitGenerationResult,
} from './localAiBridgeApi'

export class PlayerAiApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, status = 0) {
    super(code)
    this.name = 'PlayerAiApiError'
    this.code = code
    this.status = status
  }
}

interface PlayerCharacterExcelResultV1 {
  schemaVersion: 1
  providerId: string
  modelId: string
  patch: CharacterExcelAiPatchV1
  billing?: AiBillingRecordV1
}

async function playerAiRequest<T>(path: string, body?: unknown, timeoutMs = 320_000): Promise<T> {
  const session = getRoomSession()
  if (!session || (session.role !== 'player' && session.role !== 'dm')) {
    throw new PlayerAiApiError('player-ai-room-membership-required', 403)
  }
  const api = sharedEventApiCandidates()[0]
  if (!api) throw new PlayerAiApiError('player-ai-server-unavailable')
  const url = new URL(`${api}${path}`)
  url.searchParams.set('room', session.roomId)
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      method: body == null ? 'GET' : 'POST',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        ...(body == null ? {} : { 'Content-Type': 'application/json' }),
        'X-Stars-Member': session.memberId,
        'X-Stars-Room-Token': session.roomToken,
        'X-Stars-Protocol': String(CLIENT_SHARED_PROTOCOL_VERSION),
      },
      ...(body == null ? {} : { body: JSON.stringify(body) }),
    })
    const payload = await response.json().catch(() => ({})) as { error?: unknown } & T
    if (!response.ok) {
      const code = typeof payload?.error === 'string' ? payload.error : `player-ai-http-${response.status}`
      throw new PlayerAiApiError(code, response.status)
    }
    return payload
  } catch (error) {
    if (error instanceof PlayerAiApiError) throw error
    if (controller.signal.aborted) throw new PlayerAiApiError('player-ai-timeout')
    throw new PlayerAiApiError('player-ai-server-unavailable')
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function requestPlayerCharacterExcelAi(input: {
  workbookText: string
  fileName: string
}): Promise<PlayerCharacterExcelResultV1> {
  const result = await playerAiRequest<Partial<PlayerCharacterExcelResultV1>>('/player-ai/character-excel', {
    schemaVersion: 1,
    workbookText: input.workbookText,
    fileName: input.fileName,
  })
  if (
    result.schemaVersion !== 1 ||
    typeof result.providerId !== 'string' ||
    typeof result.modelId !== 'string' ||
    !validateCharacterExcelAiPatch(result.patch)
  ) throw new PlayerAiApiError('invalid-player-ai-character-excel-response')
  return result as PlayerCharacterExcelResultV1
}

export async function generatePlayerCharacterPortrait(
  input: LocalAiPortraitGenerationInput,
): Promise<LocalAiPortraitGenerationResult> {
  const prompt = input.prompt.trim()
  if (prompt.length < 20 || prompt.length > 4_000) throw new PlayerAiApiError('invalid-image-prompt')
  const result = await playerAiRequest<Partial<LocalAiPortraitGenerationResult>>('/player-ai/character-portrait', {
    schemaVersion: 1,
    prompt,
    aspect: input.aspect ?? 'portrait-3:4',
    ...(input.background ? { background: input.background } : {}),
  })
  if (
    typeof result.modelId !== 'string' ||
    result.quality !== 'low' ||
    !['image/png', 'image/jpeg', 'image/webp'].includes(result.mimeType ?? '') ||
    typeof result.dataUrl !== 'string' ||
    !result.dataUrl.startsWith(`data:${result.mimeType};base64,`) ||
    result.dataUrl.length > 16_000_000
  ) throw new PlayerAiApiError('invalid-player-ai-portrait-response')
  return result as LocalAiPortraitGenerationResult
}

export function playerAiErrorMessage(error: unknown): string {
  const code = error instanceof PlayerAiApiError ? error.code : error instanceof Error ? error.message : ''
  if (code.includes('player-ai-room-membership-required')) return '玩家 AI 需要先加入一个有效房间。'
  if (code.includes('player-ai-task-not-allowed')) return '玩家端只开放 Excel / AI 填卡和角色立绘生成。'
  if (code.includes('player-ai-unconfigured')) return '房间服务器尚未配置玩家 AI。请由服务器管理员完成持久化 AI 配置并重启服务。'
  if (code.includes('player-ai-rate-limit')) return '本小时的玩家 AI 使用次数已达上限，请稍后再试。'
  if (code.includes('player-ai-task-active')) return '上一项相同类型的 AI 任务仍在运行，请等待完成。'
  if (code.includes('player-ai-timeout')) return 'AI 任务超时；服务器不会自动重复提交，请稍后查看或重试。'
  if (code.includes('invalid-image-prompt')) return '立绘提示词需为 20–4000 个字符。'
  if (code.includes('upstream-')) return `模型供应商拒绝了请求：${code}`
  if (code.includes('player-ai-server-unavailable')) return '无法连接房间 AI 服务。'
  return '玩家 AI 任务失败；没有修改角色数据。'
}
