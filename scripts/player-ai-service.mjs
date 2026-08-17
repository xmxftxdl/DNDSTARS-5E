import { randomUUID } from 'node:crypto'
import path from 'node:path'
import {
  CHARACTER_EXCEL_AI_OUTPUT_SCHEMA,
  CHARACTER_EXCEL_AI_SYSTEM_PROMPT,
  CHARACTER_EXCEL_AI_USER_PROMPT,
  validateCharacterExcelAiPatch,
} from '../shared/character-excel-ai-contract.mjs'
import {
  AI_CREDIT_POLICY,
  AI_MODEL_POLICY,
} from '../shared/ai-model-policy.mjs'
import {
  createUsageAuditStore,
  errorWithUsage,
  estimatedStructuredInputTokens,
  externalModelApiUrl,
  generateExternalImage,
  generateStructured,
  safeAuditError,
} from './local-ai-bridge-core.mjs'
import {
  loadLocalAiBridgeConfig,
  localAiBridgeOptionsFromConfig,
} from './local-ai-config-store.mjs'

const PLAYER_AI_SCHEMA_VERSION = 1
const EXCEL_MAX_CHARACTERS = 100_000
const PORTRAIT_PROMPT_MIN_CHARACTERS = 20
const PORTRAIT_PROMPT_MAX_CHARACTERS = 4_000

function clean(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function providerIdForUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'api.openai.com' || hostname.endsWith('.openai.com')
      ? 'openai'
      : 'openai-compatible'
  } catch {
    return 'openai-compatible'
  }
}

function taskError(code, statusCode = 400) {
  const error = new Error(code)
  error.code = code
  error.statusCode = statusCode
  return error
}

function playerPortraitPrompt(userPrompt) {
  return [
    '创作一张 D&D 5e 玩家角色立绘。只画一名角色，主体清晰，适合角色卡与圆形 Token 裁切。',
    '不要出现文字、标志、水印、UI、装饰边框或多人物拼图。',
    '用户角色描述如下：',
    userPrompt,
  ].join('\n')
}

function boundedPositiveInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback
}

export function createPlayerAiService(options) {
  const apiUrl = externalModelApiUrl(options.apiUrl)
  const imageApiUrl = externalModelApiUrl(options.imageApiUrl || options.apiUrl)
  const apiKey = clean(options.apiKey)
  const imageApiKey = clean(options.imageApiKey) || apiKey
  if (!apiKey || !imageApiKey) throw new Error('player-ai-credentials-incomplete')
  const providerId = providerIdForUrl(apiUrl)
  const imageProviderId = providerIdForUrl(imageApiUrl)
  const usageAudit = createUsageAuditStore(options.usageAuditPath, options.billingPolicy ?? AI_CREDIT_POLICY)
  const hourlyExcelLimit = boundedPositiveInteger(options.hourlyExcelLimit, 30, 1, 1_000)
  const hourlyPortraitLimit = boundedPositiveInteger(options.hourlyPortraitLimit, 10, 1, 1_000)
  const recentTasks = new Map()
  const activeTasks = new Set()

  const rateLimit = (actorId, task) => {
    const now = Date.now()
    const key = `${actorId}:${task}`
    const limit = task === 'character-excel' ? hourlyExcelLimit : hourlyPortraitLimit
    const recent = (recentTasks.get(key) ?? []).filter((at) => at > now - 60 * 60_000)
    if (recent.length >= limit) throw taskError('player-ai-rate-limit', 429)
    recent.push(now)
    recentTasks.set(key, recent)
  }

  const exclusive = async (actorId, task, operation) => {
    const key = `${actorId}:${task}`
    if (activeTasks.has(key)) throw taskError('player-ai-task-active', 409)
    rateLimit(actorId, task)
    activeTasks.add(key)
    try {
      return await operation()
    } finally {
      activeTasks.delete(key)
    }
  }

  return {
    capabilities() {
      return {
        schemaVersion: PLAYER_AI_SCHEMA_VERSION,
        enabled: true,
        tasks: {
          characterExcel: {
            enabled: true,
            providerId,
            modelId: AI_MODEL_POLICY.generalModelId,
          },
          characterPortrait: {
            enabled: true,
            providerId: imageProviderId,
            modelId: AI_MODEL_POLICY.imageModelId,
            quality: AI_MODEL_POLICY.imageQuality,
          },
        },
      }
    },

    async enhanceCharacterExcel({ workbookText, fileName, actorId, roomId }) {
      const text = clean(workbookText)
      const safeFileName = clean(fileName).slice(0, 240) || 'character.xlsx'
      if (!text || text.length > EXCEL_MAX_CHARACTERS) throw taskError('invalid-character-excel-text')
      return exclusive(actorId, 'character-excel', async () => {
        const request = {
          schemaVersion: 1,
          jobId: `player-character-excel-${randomUUID()}`,
          task: 'resource-structuring',
          systemPrompt: CHARACTER_EXCEL_AI_SYSTEM_PROMPT,
          userPrompt: CHARACTER_EXCEL_AI_USER_PROMPT,
          outputSchema: CHARACTER_EXCEL_AI_OUTPUT_SCHEMA,
          maxOutputTokens: 4_096,
          documents: [{
            id: 'character-workbook-values',
            documentName: safeFileName,
            mimeType: 'text/plain',
            text,
          }],
        }
        const reservation = await usageAudit.begin({
          task: 'character-excel-import',
          providerId,
          modelId: AI_MODEL_POLICY.generalModelId,
          jobId: request.jobId,
          actorId,
          roomId,
          estimatedInputTokens: estimatedStructuredInputTokens(request),
          estimatedOutputTokens: 4_096,
        })
        try {
          const generated = await generateStructured({
            baseUrl: apiUrl,
            engine: 'external',
            modelId: `external:${AI_MODEL_POLICY.generalModelId}`,
            upstreamModelId: AI_MODEL_POLICY.generalModelId,
            request,
            apiKey,
            providerId,
          })
          if (!validateCharacterExcelAiPatch(generated.output)) throw errorWithUsage(
            new Error('invalid-character-excel-ai-output'),
            generated.usage,
          )
          const billing = await usageAudit.settle(reservation, { status: 'completed', usage: generated.usage })
          return {
            schemaVersion: PLAYER_AI_SCHEMA_VERSION,
            providerId,
            modelId: AI_MODEL_POLICY.generalModelId,
            patch: generated.output,
            billing,
          }
        } catch (error) {
          await usageAudit.settle(reservation, {
            status: /cancel|disconnect|abort/i.test(safeAuditError(error)) ? 'cancelled' : 'failed',
            usage: error?.aiUsage,
            errorCode: safeAuditError(error),
          }).catch(() => undefined)
          throw error
        }
      })
    },

    async generateCharacterPortrait({ prompt, aspect, background, actorId, roomId }) {
      const normalizedPrompt = clean(prompt)
      if (
        normalizedPrompt.length < PORTRAIT_PROMPT_MIN_CHARACTERS ||
        normalizedPrompt.length > PORTRAIT_PROMPT_MAX_CHARACTERS
      ) throw taskError('invalid-image-prompt')
      return exclusive(actorId, 'character-portrait', async () => {
        const reservation = await usageAudit.begin({
          task: 'image-generation',
          providerId: imageProviderId,
          modelId: AI_MODEL_POLICY.imageModelId,
          jobId: `player-character-portrait-${randomUUID()}`,
          actorId,
          roomId,
          quality: AI_MODEL_POLICY.imageQuality,
        })
        let upstreamCharged = false
        try {
          const generated = await generateExternalImage({
            baseUrl: imageApiUrl,
            apiKey: imageApiKey,
            modelId: AI_MODEL_POLICY.imageModelId,
            prompt: playerPortraitPrompt(normalizedPrompt),
            aspect,
            background,
          })
          upstreamCharged = true
          const billing = await usageAudit.settle(reservation, { status: 'completed' })
          return {
            ...generated,
            providerId: imageProviderId,
            billing,
          }
        } catch (error) {
          await usageAudit.settle(reservation, {
            status: 'failed',
            usage: upstreamCharged ? { chargeable: true } : undefined,
            errorCode: safeAuditError(error),
          }).catch(() => undefined)
          throw error
        }
      })
    },
  }
}

export async function createPlayerAiServiceFromPersistedConfig(options = {}) {
  const persisted = await loadLocalAiBridgeConfig(options.configOptions)
  if (!persisted.found) return { service: null, files: persisted.files }
  const configured = localAiBridgeOptionsFromConfig(persisted.config, options.env ?? process.env)
  return {
    service: createPlayerAiService({
      apiUrl: configured.externalApiUrl,
      apiKey: configured.externalApiKey,
      imageApiUrl: configured.externalImageApiUrl,
      imageApiKey: configured.externalImageApiKey,
      usageAuditPath: options.usageAuditPath ?? persisted.files.playerUsage ?? path.join(persisted.files.directory, 'player-usage.jsonl'),
      hourlyExcelLimit: options.hourlyExcelLimit ?? process.env.STARS_PLAYER_AI_EXCEL_HOURLY_LIMIT,
      hourlyPortraitLimit: options.hourlyPortraitLimit ?? process.env.STARS_PLAYER_AI_PORTRAIT_HOURLY_LIMIT,
    }),
    files: persisted.files,
  }
}
