import type { Dnd5eMonsterStatBlock } from '../rulesets/dnd5e/monsters'
import {
  buildDnd5eCustomMonster,
  createDnd5eCustomMonsterDraft,
} from '../rulesets/dnd5e/customMonsterWorkshop'
import { parseDnd5ePastedMonster } from '../rulesets/dnd5e/monsterStatBlockPaste'

const STORAGE_PREFIX = 'dndstars:dm-workshop-monster-handoff:v1:'
const MAX_AGE_MS = 6 * 60 * 60 * 1_000

export interface DmWorkshopMonsterSeedV1 {
  schemaVersion: 1
  campaignId: string
  name: string
  description: string
  monsterStatBlockText: string
  automation: 'full' | 'partial' | 'manual' | 'unreviewed'
  sourceLabels: string[]
  createdAt: number
}

export interface DmWorkshopMonsterEditRequestV1 {
  requestId: number
  monster: Dnd5eMonsterStatBlock
  review: {
    sourceText?: string
    assumptions?: readonly string[]
    unsupported?: readonly string[]
  }
}

interface SessionStorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function storageKey(campaignId: string): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(campaignId.trim() || 'local')}`
}

function browserSessionStorage(): SessionStorageLike | null {
  try {
    return typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : null
  } catch {
    return null
  }
}

function normalizeText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function parseSeed(value: unknown, campaignId: string, now: number): DmWorkshopMonsterSeedV1 | null {
  if (!value || typeof value !== 'object') return null
  const source = value as Partial<DmWorkshopMonsterSeedV1>
  const name = normalizeText(source.name, 160)
  const createdAt = Number(source.createdAt)
  if (
    source.schemaVersion !== 1 ||
    normalizeText(source.campaignId, 160) !== campaignId.trim() ||
    !name ||
    !Number.isSafeInteger(createdAt) ||
    createdAt < now - MAX_AGE_MS ||
    createdAt > now + 60_000
  ) return null
  const automation = source.automation === 'full' || source.automation === 'partial' || source.automation === 'manual'
    ? source.automation
    : 'unreviewed'
  return {
    schemaVersion: 1,
    campaignId: campaignId.trim(),
    name,
    description: normalizeText(source.description, 20_000),
    monsterStatBlockText: normalizeText(source.monsterStatBlockText, 24_000),
    automation,
    sourceLabels: Array.isArray(source.sourceLabels)
      ? source.sourceLabels.map((entry) => normalizeText(entry, 240)).filter(Boolean).slice(0, 24)
      : [],
    createdAt,
  }
}

export function stageDmWorkshopMonsterHandoff(
  campaignId: string,
  input: Omit<DmWorkshopMonsterSeedV1, 'schemaVersion' | 'campaignId' | 'createdAt'>,
  storage: SessionStorageLike | null = browserSessionStorage(),
  now = Date.now(),
): boolean {
  if (!storage || !input.name.trim()) return false
  const seed: DmWorkshopMonsterSeedV1 = {
    schemaVersion: 1,
    campaignId: campaignId.trim(),
    name: input.name.trim().slice(0, 160),
    description: input.description.trim().slice(0, 20_000),
    monsterStatBlockText: input.monsterStatBlockText.trim().slice(0, 24_000),
    automation: input.automation,
    sourceLabels: input.sourceLabels.map((entry) => entry.trim()).filter(Boolean).slice(0, 24),
    createdAt: now,
  }
  try {
    storage.setItem(storageKey(campaignId), JSON.stringify(seed))
    return true
  } catch {
    return false
  }
}

export function consumeDmWorkshopMonsterHandoff(
  campaignId: string,
  storage: SessionStorageLike | null = browserSessionStorage(),
  now = Date.now(),
): DmWorkshopMonsterEditRequestV1 | null {
  if (!storage) return null
  const key = storageKey(campaignId)
  let raw: string | null
  try {
    raw = storage.getItem(key)
    storage.removeItem(key)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const seed = parseSeed(JSON.parse(raw) as unknown, campaignId, now)
    return seed ? dmWorkshopMonsterEditRequest(seed) : null
  } catch {
    return null
  }
}

export function dmWorkshopMonsterEditRequest(seed: DmWorkshopMonsterSeedV1): DmWorkshopMonsterEditRequestV1 {
  const parsed = seed.monsterStatBlockText
    ? parseDnd5ePastedMonster(seed.monsterStatBlockText)
    : null
  const draft = parsed?.draft ?? createDnd5eCustomMonsterDraft()
  draft.name = seed.name
  draft.englishName = /^[\x20-\x7e]+$/.test(seed.name) ? seed.name : ''
  draft.description = seed.description || (parsed
    ? '从战役 PDF 的完整怪物属性块自动解析，等待 DM 复核。'
    : '从战役资源库载入，等待 DM 补齐属性与战斗能力。')
  if (!parsed) draft.actions = []
  const sourceText = [
    seed.name,
    seed.description,
    seed.monsterStatBlockText,
    seed.sourceLabels.length > 0 ? `来源：${seed.sourceLabels.join('；')}` : '',
  ].filter(Boolean).join('\n\n')
  return {
    requestId: seed.createdAt,
    monster: buildDnd5eCustomMonster(draft),
    review: {
      sourceText,
      assumptions: parsed ? [
        `已从 PDF 属性块识别：${parsed.recognizedFields.join('、') || '未识别到可靠字段'}。`,
        '复杂规则仍由共享怪物工坊与 Headless 校验决定；AI 文本不会绕过 Host 校验。',
      ] : [
        'PDF 分析未保存完整怪物属性块；当前仅带入资源名称与说明，基础数值仍是新建草稿默认值。请重新分析 PDF 或在工坊粘贴属性块。',
      ],
      unsupported: [
        `原资源自动化状态为“${seed.automation}”；保存前必须由 DM 补齐并核对动作、特性、伤害与 Headless 规则。`,
        ...(parsed?.warnings ?? []),
      ],
    },
  }
}
