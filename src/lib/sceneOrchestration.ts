import type { AbilityKey } from './dnd'
import { DND5E_STANDARD_CONDITION_IDS, type Dnd5eStandardConditionId } from '../rulesets/dnd5e/conditions'
import { DND5E_DAMAGE_TYPES, type Dnd5eDamageType } from '../rulesets/dnd5e/damageTypes'

export const SCENE_ORCHESTRATION_RESOURCE = 'scene-orchestration'
export const SCENE_ORCHESTRATION_SCHEMA_VERSION = 1
export const SCENE_PRESENTATION_CHANNEL = 'scene-presentation'
export const SCENE_MAX_SCENES = 80
export const SCENE_MAX_TRIGGERS = 120
export const SCENE_MAX_INTERACTION_POINTS = 160
export const SCENE_MAX_INTERACTION_REWARDS = 12
export const SCENE_MAX_INTERACTION_EFFECTS = 24
export const SCENE_MAX_ACTIONS = 40
export const SCENE_MAX_HISTORY = 240

export type SceneRegion =
  | { kind: 'circle'; x: number; y: number; radius: number }
  | { kind: 'rect'; x: number; y: number; width: number; height: number }

export type SceneTriggerEvent = 'enter' | 'leave' | 'manual'
export type SceneTokenFilter = 'any' | 'player' | 'enemy'
export type SceneRepeatMode = 'always' | 'per-token' | 'once'
export type SceneAudioCue = 'none' | 'discovery' | 'danger' | 'door' | 'mystery' | 'victory'
export type SceneRollSelection = `ability:${AbilityKey}` | `skill:${string}` | `save:${AbilityKey}`
export type SceneInteractionPointIcon = 'bookshelf' | 'chest' | 'search' | 'altar' | 'switch' | 'custom'
export type SceneInteractionRepeat = 'once' | 'per-character' | 'always'

export interface SceneInteractionPointCheck {
  label: string
  selection: SceneRollSelection
  dc: number
  mode: 'normal' | 'advantage' | 'disadvantage'
}

export interface SceneInteractionPointReward {
  templateId: string
  quantity: number
  identified: boolean
}

export type SceneInteractionOutcomeEffect =
  | {
      id: string
      kind: 'currency'
      currency: 'cp' | 'sp' | 'ep' | 'gp' | 'pp'
      amount: number
    }
  | {
      id: string
      kind: 'handout'
      handoutId: string
      audience: 'all' | 'triggering-player'
    }
  | {
      id: string
      kind: 'task'
      operation: 'add' | 'complete'
      taskId?: string
      title: string
      body: string
    }
  | {
      id: string
      kind: 'damage'
      count: number
      sides: number
      bonus: number
      damageType: Dnd5eDamageType
    }
  | {
      id: string
      kind: 'condition'
      condition: Dnd5eStandardConditionId
      duration: { type: 'permanent' } | { type: 'rounds'; rounds: number }
    }

/**
 * 可点击地图互动点。check 与 rewards 属于 DM 私有配置；服务端向玩家投影时会删除，
 * 玩家请求只携带 point id，最终配置始终由 DM Host 重新读取。
 */
export interface SceneInteractionPoint {
  id: string
  name: string
  enabled: boolean
  visibleToPlayers: boolean
  icon: SceneInteractionPointIcon
  x: number
  y: number
  interactionRadiusFeet: number
  prompt: string
  repeat: SceneInteractionRepeat
  check?: SceneInteractionPointCheck
  successText: string
  failureText: string
  rewards: SceneInteractionPointReward[]
  successEffects: SceneInteractionOutcomeEffect[]
  failureEffects: SceneInteractionOutcomeEffect[]
}

interface SceneActionBase {
  id: string
  enabled: boolean
  delayMs?: number
}

export type SceneAction =
  | (SceneActionBase & { kind: 'reveal-handout'; handoutId: string; audience: 'all' | 'triggering-player' })
  | (SceneActionBase & { kind: 'whisper'; text: string })
  | (SceneActionBase & {
      kind: 'group-roll'
      label: string
      selection: SceneRollSelection
      dc: number
      mode: 'normal' | 'advantage' | 'disadvantage'
      allowPassiveFallback: boolean
    })
  | (SceneActionBase & { kind: 'door'; doorId: string; state: 'open' | 'closed' | 'locked' })
  | (SceneActionBase & { kind: 'light'; ambientLight: 'bright' | 'dim' | 'darkness' })
  | (SceneActionBase & { kind: 'fog'; operation: 'fill' | 'clear' })
  | (SceneActionBase & {
      kind: 'encounter'
      entries: Array<{ monsterId: string; quantity: number }>
      startInitiative: boolean
    })
  | (SceneActionBase & { kind: 'sound'; cue: Exclude<SceneAudioCue, 'none'> })
  | (SceneActionBase & {
      kind: 'audio'
      operation: 'play' | 'stop'
      assetId?: string
      loop: boolean
      volume: number
    })
  | (SceneActionBase & {
      kind: 'teleport'
      targetMapId: string
      x: number
      y: number
      moveTriggeringToken: boolean
    })
  | (SceneActionBase & { kind: 'task'; title: string; body: string })
  | (SceneActionBase & { kind: 'journal'; title: string; body: string })

export interface SceneTrigger {
  id: string
  name: string
  enabled: boolean
  region: SceneRegion
  events: SceneTriggerEvent[]
  tokenFilter: SceneTokenFilter
  repeat: SceneRepeatMode
  actions: SceneAction[]
}

export interface OrchestratedScene {
  id: string
  mapId: string
  name: string
  description: string
  environmentLabel: string
  backgroundCue: SceneAudioCue
  backgroundAudioId?: string
  backgroundAudioLoop: boolean
  backgroundAudioVolume: number
  boundHandoutIds: string[]
  boundJournalEntryIds: string[]
  interactionPoints: SceneInteractionPoint[]
  triggers: SceneTrigger[]
  createdAt: number
  updatedAt: number
}

export interface SceneTriggerTokenSnapshot {
  tokenId: string
  characterId?: string
  label: string
  type: 'player' | 'enemy' | 'npc' | 'obstacle'
  x: number
  y: number
}

export interface ScenePendingRun {
  id: string
  sceneId: string
  triggerId: string
  mapId: string
  event: SceneTriggerEvent
  token?: SceneTriggerTokenSnapshot
  nextActionIndex: number
  createdAt: number
}

export type SceneUndoDescriptor =
  | { kind: 'door'; mapId: string; doorId: string; previousState: 'open' | 'closed' | 'locked' }
  | { kind: 'light'; mapId: string; previousAmbientLight: 'bright' | 'dim' | 'darkness' }
  | { kind: 'remove-tokens'; mapId: string; tokenIds: string[] }
  | { kind: 'teleport'; tokenId: string; fromMapId: string; toMapId: string; x: number; y: number }

export interface SceneHistoryEntry {
  id: string
  runId: string
  sceneId: string
  triggerId: string
  actionId: string
  summary: string
  executedAt: number
  reversible: boolean
  undoneAt?: number
  undo?: SceneUndoDescriptor
}

export interface SceneRuntimeState {
  paused: boolean
  pendingRuns: ScenePendingRun[]
  receipts: string[]
  history: SceneHistoryEntry[]
  lastError?: string
}

export interface SharedSceneOrchestrationState {
  schemaVersion: typeof SCENE_ORCHESTRATION_SCHEMA_VERSION
  scenes: OrchestratedScene[]
  runtime: SceneRuntimeState
  updatedAt: number
}

export interface ScenePresentationEvent {
  id: string
  kind: 'sound' | 'notice'
  cue?: Exclude<SceneAudioCue, 'none'>
  text?: string
  createdAt: number
}

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function text(value: unknown, max = 160): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function timestamp(value: unknown): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0
}

function id(value: unknown): string {
  return text(value, 180)
}

function finite(value: unknown, fallback = 0): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function normalizeRegion(value: unknown): SceneRegion | null {
  if (!object(value)) return null
  if (value.kind === 'circle') {
    const radius = Math.max(4, Math.min(100_000, finite(value.radius)))
    return { kind: 'circle', x: finite(value.x), y: finite(value.y), radius }
  }
  if (value.kind === 'rect') {
    const width = Math.max(4, Math.min(100_000, finite(value.width)))
    const height = Math.max(4, Math.min(100_000, finite(value.height)))
    return { kind: 'rect', x: finite(value.x), y: finite(value.y), width, height }
  }
  return null
}

const ABILITY_KEYS = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha'])
const INTERACTION_POINT_ICONS = new Set<SceneInteractionPointIcon>([
  'bookshelf',
  'chest',
  'search',
  'altar',
  'switch',
  'custom',
])
const INTERACTION_CURRENCIES = new Set(['cp', 'sp', 'ep', 'gp', 'pp'])
const INTERACTION_DAMAGE_TYPES = new Set<string>(DND5E_DAMAGE_TYPES)
const INTERACTION_CONDITIONS = new Set<string>(DND5E_STANDARD_CONDITION_IDS)

function validSelection(value: string): value is SceneRollSelection {
  const [kind, key] = value.split(':')
  return (kind === 'ability' || kind === 'save') ? ABILITY_KEYS.has(key) : kind === 'skill' && /^[a-zA-Z]+$/.test(key)
}

function normalizeInteractionOutcomeEffect(value: unknown): SceneInteractionOutcomeEffect | null {
  if (!object(value)) return null
  const effectId = id(value.id)
  if (!effectId) return null
  if (value.kind === 'currency') {
    const currency = text(value.currency, 4)
    const amount = Math.floor(finite(value.amount))
    return INTERACTION_CURRENCIES.has(currency) && amount >= 1 && amount <= 1_000_000
      ? { id: effectId, kind: value.kind, currency: currency as 'cp' | 'sp' | 'ep' | 'gp' | 'pp', amount }
      : null
  }
  if (value.kind === 'handout') {
    const handoutId = id(value.handoutId)
    return handoutId
      ? {
          id: effectId,
          kind: value.kind,
          handoutId,
          audience: value.audience === 'all' ? 'all' : 'triggering-player',
        }
      : null
  }
  if (value.kind === 'task') {
    const operation = value.operation === 'complete' ? 'complete' : 'add'
    const taskId = id(value.taskId)
    const title = text(value.title, 120)
    const body = text(value.body, 4_000)
    if ((operation === 'complete' && !taskId) || (operation === 'add' && !title)) return null
    return {
      id: effectId,
      kind: value.kind,
      operation,
      ...(taskId ? { taskId } : {}),
      title,
      body,
    }
  }
  if (value.kind === 'damage') {
    const count = Math.floor(finite(value.count))
    const sides = Math.floor(finite(value.sides))
    const bonus = Math.floor(finite(value.bonus))
    const damageType = text(value.damageType, 20)
    return (
      count >= 1 && count <= 40 &&
      sides >= 2 && sides <= 100 &&
      bonus >= -1_000 && bonus <= 1_000 &&
      INTERACTION_DAMAGE_TYPES.has(damageType)
    )
      ? { id: effectId, kind: value.kind, count, sides, bonus, damageType: damageType as Dnd5eDamageType }
      : null
  }
  if (value.kind === 'condition') {
    const condition = text(value.condition, 40)
    if (!INTERACTION_CONDITIONS.has(condition) || !object(value.duration)) return null
    const duration = value.duration.type === 'rounds'
      ? { type: 'rounds' as const, rounds: Math.min(10_000, Math.max(1, Math.floor(finite(value.duration.rounds, 1)))) }
      : { type: 'permanent' as const }
    return {
      id: effectId,
      kind: value.kind,
      condition: condition as Dnd5eStandardConditionId,
      duration,
    }
  }
  return null
}

function normalizeInteractionOutcomeEffects(value: unknown): SceneInteractionOutcomeEffect[] {
  return (Array.isArray(value) ? value : [])
    .map(normalizeInteractionOutcomeEffect)
    .filter((effect): effect is SceneInteractionOutcomeEffect => effect !== null)
    .slice(0, SCENE_MAX_INTERACTION_EFFECTS)
}

function interactionOutcomeEffectStrictlyMatches(
  raw: unknown,
  effect: SceneInteractionOutcomeEffect | undefined,
): boolean {
  if (!effect || !object(raw) || raw.id !== effect.id || raw.kind !== effect.kind) return false
  if (effect.kind === 'currency') {
    return raw.currency === effect.currency && raw.amount === effect.amount
  }
  if (effect.kind === 'handout') {
    return raw.handoutId === effect.handoutId && raw.audience === effect.audience
  }
  if (effect.kind === 'task') {
    return raw.operation === effect.operation &&
      (raw.taskId ?? undefined) === effect.taskId &&
      raw.title === effect.title &&
      raw.body === effect.body
  }
  if (effect.kind === 'damage') {
    return raw.count === effect.count && raw.sides === effect.sides &&
      raw.bonus === effect.bonus && raw.damageType === effect.damageType
  }
  return raw.condition === effect.condition && object(raw.duration) &&
    raw.duration.type === effect.duration.type &&
    (effect.duration.type !== 'rounds' || raw.duration.rounds === effect.duration.rounds)
}

function normalizeInteractionPoint(value: unknown): SceneInteractionPoint | null {
  if (!object(value)) return null
  const pointId = id(value.id)
  const name = text(value.name, 160)
  if (!pointId || !name || !Number.isFinite(Number(value.x)) || !Number.isFinite(Number(value.y))) return null
  const icon = INTERACTION_POINT_ICONS.has(value.icon as SceneInteractionPointIcon)
    ? value.icon as SceneInteractionPointIcon
    : 'search'
  let check: SceneInteractionPointCheck | undefined
  if (value.check != null) {
    if (!object(value.check)) return null
    const selection = text(value.check.selection, 100)
    if (!validSelection(selection) || selection.startsWith('save:')) return null
    check = {
      label: text(value.check.label, 160) || name,
      selection,
      dc: Math.min(100, Math.max(0, Math.floor(finite(value.check.dc, 10)))),
      mode: value.check.mode === 'advantage' || value.check.mode === 'disadvantage'
        ? value.check.mode
        : 'normal',
    }
  }
  const rewards = (Array.isArray(value.rewards) ? value.rewards : []).flatMap((reward) => {
    if (!object(reward)) return []
    const templateId = id(reward.templateId)
    const quantity = Math.min(999, Math.max(1, Math.floor(finite(reward.quantity, 1))))
    return templateId ? [{
      templateId,
      quantity,
      identified: reward.identified !== false,
    } satisfies SceneInteractionPointReward] : []
  }).slice(0, SCENE_MAX_INTERACTION_REWARDS)
  const successEffects = normalizeInteractionOutcomeEffects(value.successEffects)
  const failureEffects = normalizeInteractionOutcomeEffects(value.failureEffects)
  return {
    id: pointId,
    name,
    enabled: value.enabled !== false,
    visibleToPlayers: value.visibleToPlayers !== false,
    icon,
    x: finite(value.x),
    y: finite(value.y),
    interactionRadiusFeet: Math.min(120, Math.max(5, finite(value.interactionRadiusFeet, 5))),
    prompt: text(value.prompt, 1_000) || `调查${name}`,
    repeat: value.repeat === 'always' || value.repeat === 'once' ? value.repeat : 'per-character',
    ...(check ? { check } : {}),
    successText: text(value.successText, 1_000) || '你发现了一些有用的东西。',
    failureText: text(value.failureText, 1_000) || '你没有发现异常。',
    rewards,
    successEffects,
    failureEffects,
  }
}

function normalizeAction(value: unknown): SceneAction | null {
  if (!object(value)) return null
  const actionId = id(value.id)
  if (!actionId) return null
  const base = {
    id: actionId,
    enabled: value.enabled !== false,
    ...(value.delayMs == null ? {} : { delayMs: Math.min(30_000, Math.max(0, Math.floor(finite(value.delayMs)))) }),
  }
  if (value.kind === 'reveal-handout') {
    const handoutId = id(value.handoutId)
    if (!handoutId) return null
    return { ...base, kind: value.kind, handoutId, audience: value.audience === 'triggering-player' ? 'triggering-player' : 'all' }
  }
  if (value.kind === 'whisper') {
    const body = text(value.text, 2_000)
    return body ? { ...base, kind: value.kind, text: body } : null
  }
  if (value.kind === 'group-roll') {
    const selection = text(value.selection, 100)
    if (!validSelection(selection)) return null
    const mode = value.mode === 'advantage' || value.mode === 'disadvantage' ? value.mode : 'normal'
    return {
      ...base,
      kind: value.kind,
      label: text(value.label, 160) || '场景群体检定',
      selection,
      dc: Math.min(100, Math.max(0, Math.floor(finite(value.dc, 10)))),
      mode,
      allowPassiveFallback: value.allowPassiveFallback === true && !selection.startsWith('save:'),
    }
  }
  if (value.kind === 'door') {
    const doorId = id(value.doorId)
    if (!doorId) return null
    const state = value.state === 'open' || value.state === 'locked' ? value.state : 'closed'
    return { ...base, kind: value.kind, doorId, state }
  }
  if (value.kind === 'light') {
    const ambientLight = value.ambientLight === 'bright' || value.ambientLight === 'dim' ? value.ambientLight : 'darkness'
    return { ...base, kind: value.kind, ambientLight }
  }
  if (value.kind === 'fog') return { ...base, kind: value.kind, operation: value.operation === 'clear' ? 'clear' : 'fill' }
  if (value.kind === 'encounter') {
    const entries = (Array.isArray(value.entries) ? value.entries : []).flatMap((entry) => {
      if (!object(entry)) return []
      const monsterId = id(entry.monsterId)
      const quantity = Math.min(50, Math.max(1, Math.floor(finite(entry.quantity, 1))))
      return monsterId ? [{ monsterId, quantity }] : []
    }).slice(0, 30)
    return entries.length > 0 ? { ...base, kind: value.kind, entries, startInitiative: value.startInitiative === true } : null
  }
  if (value.kind === 'sound') {
    const cue = value.cue
    return ['discovery', 'danger', 'door', 'mystery', 'victory'].includes(String(cue))
      ? { ...base, kind: value.kind, cue: cue as Exclude<SceneAudioCue, 'none'> }
      : null
  }
  if (value.kind === 'audio') {
    const operation = value.operation === 'stop' ? 'stop' : 'play'
    const assetId = id(value.assetId)
    if (operation === 'play' && !assetId) return null
    return {
      ...base,
      kind: value.kind,
      operation,
      ...(assetId ? { assetId } : {}),
      loop: value.loop === true,
      volume: Math.min(1, Math.max(0, finite(value.volume, 0.7))),
    }
  }
  if (value.kind === 'teleport') {
    const targetMapId = id(value.targetMapId)
    return targetMapId ? {
      ...base, kind: value.kind, targetMapId, x: finite(value.x), y: finite(value.y), moveTriggeringToken: value.moveTriggeringToken !== false,
    } : null
  }
  if (value.kind === 'task' || value.kind === 'journal') {
    const title = text(value.title, 160)
    if (!title) return null
    return { ...base, kind: value.kind, title, body: text(value.body, 4_000) }
  }
  return null
}

function normalizeTrigger(value: unknown): SceneTrigger | null {
  if (!object(value)) return null
  const triggerId = id(value.id)
  const region = normalizeRegion(value.region)
  if (!triggerId || !region) return null
  const events = [...new Set((Array.isArray(value.events) ? value.events : []).filter(
    (entry): entry is SceneTriggerEvent => entry === 'enter' || entry === 'leave' || entry === 'manual',
  ))]
  return {
    id: triggerId,
    name: text(value.name, 160) || '未命名触发区',
    enabled: value.enabled !== false,
    region,
    events: events.length > 0 ? events : ['enter'],
    tokenFilter: value.tokenFilter === 'player' || value.tokenFilter === 'enemy' ? value.tokenFilter : 'any',
    repeat: value.repeat === 'always' || value.repeat === 'once' ? value.repeat : 'per-token',
    actions: (Array.isArray(value.actions) ? value.actions : []).map(normalizeAction)
      .filter((entry): entry is SceneAction => entry !== null).slice(0, SCENE_MAX_ACTIONS),
  }
}

function normalizeScene(value: unknown): OrchestratedScene | null {
  if (!object(value)) return null
  const sceneId = id(value.id)
  const mapId = id(value.mapId)
  if (!sceneId || !mapId) return null
  const cue = ['none', 'discovery', 'danger', 'door', 'mystery', 'victory'].includes(String(value.backgroundCue))
    ? value.backgroundCue as SceneAudioCue
    : 'none'
  return {
    id: sceneId,
    mapId,
    name: text(value.name, 160) || '未命名场景',
    description: text(value.description, 2_000),
    environmentLabel: text(value.environmentLabel, 300),
    backgroundCue: cue,
    ...(id(value.backgroundAudioId) ? { backgroundAudioId: id(value.backgroundAudioId) } : {}),
    backgroundAudioLoop: value.backgroundAudioLoop !== false,
    backgroundAudioVolume: Math.min(1, Math.max(0, finite(value.backgroundAudioVolume, 0.7))),
    boundHandoutIds: (Array.isArray(value.boundHandoutIds) ? value.boundHandoutIds : []).map(id).filter(Boolean).slice(0, 100),
    boundJournalEntryIds: (Array.isArray(value.boundJournalEntryIds) ? value.boundJournalEntryIds : []).map(id).filter(Boolean).slice(0, 100),
    interactionPoints: (Array.isArray(value.interactionPoints) ? value.interactionPoints : [])
      .map(normalizeInteractionPoint)
      .filter((entry): entry is SceneInteractionPoint => entry !== null)
      .slice(0, SCENE_MAX_INTERACTION_POINTS),
    triggers: (Array.isArray(value.triggers) ? value.triggers : []).map(normalizeTrigger)
      .filter((entry): entry is SceneTrigger => entry !== null).slice(0, SCENE_MAX_TRIGGERS),
    createdAt: timestamp(value.createdAt),
    updatedAt: timestamp(value.updatedAt),
  }
}

function normalizeToken(value: unknown): SceneTriggerTokenSnapshot | undefined {
  if (!object(value)) return undefined
  const tokenId = id(value.tokenId)
  if (!tokenId) return undefined
  const type = value.type === 'player' || value.type === 'enemy' || value.type === 'npc' ? value.type : 'obstacle'
  return {
    tokenId,
    ...(id(value.characterId) ? { characterId: id(value.characterId) } : {}),
    label: text(value.label, 160) || 'Token', type, x: finite(value.x), y: finite(value.y),
  }
}

function normalizeUndo(value: unknown): SceneUndoDescriptor | undefined {
  if (!object(value)) return undefined
  if (value.kind === 'door') {
    const mapId = id(value.mapId)
    const doorId = id(value.doorId)
    const previousState = value.previousState
    if (!mapId || !doorId || (previousState !== 'open' && previousState !== 'closed' && previousState !== 'locked')) return undefined
    return { kind: value.kind, mapId, doorId, previousState }
  }
  if (value.kind === 'light') {
    const mapId = id(value.mapId)
    const previousAmbientLight = value.previousAmbientLight
    if (!mapId || (previousAmbientLight !== 'bright' && previousAmbientLight !== 'dim' && previousAmbientLight !== 'darkness')) return undefined
    return { kind: value.kind, mapId, previousAmbientLight }
  }
  if (value.kind === 'remove-tokens') {
    const mapId = id(value.mapId)
    const tokenIds = (Array.isArray(value.tokenIds) ? value.tokenIds : []).map(id).filter(Boolean).slice(0, 200)
    if (!mapId || tokenIds.length < 1) return undefined
    return { kind: value.kind, mapId, tokenIds }
  }
  if (value.kind === 'teleport') {
    const tokenId = id(value.tokenId)
    const fromMapId = id(value.fromMapId)
    const toMapId = id(value.toMapId)
    if (!tokenId || !fromMapId || !toMapId) return undefined
    return { kind: value.kind, tokenId, fromMapId, toMapId, x: finite(value.x), y: finite(value.y) }
  }
  return undefined
}

function normalizeRuntime(value: unknown): SceneRuntimeState {
  const source = object(value) ? value : {}
  const pendingRuns = (Array.isArray(source.pendingRuns) ? source.pendingRuns : []).flatMap((entry) => {
    if (!object(entry)) return []
    const runId = id(entry.id)
    const sceneId = id(entry.sceneId)
    const triggerId = id(entry.triggerId)
    const mapId = id(entry.mapId)
    const event = entry.event === 'leave' || entry.event === 'manual' ? entry.event : 'enter'
    if (!runId || !sceneId || !triggerId || !mapId) return []
    return [{
      id: runId, sceneId, triggerId, mapId, event,
      ...(normalizeToken(entry.token) ? { token: normalizeToken(entry.token) } : {}),
      nextActionIndex: Math.max(0, Math.floor(finite(entry.nextActionIndex))),
      createdAt: timestamp(entry.createdAt),
    } satisfies ScenePendingRun]
  }).slice(-50)
  const history = (Array.isArray(source.history) ? source.history : []).flatMap((entry) => {
    if (!object(entry)) return []
    const historyId = id(entry.id)
    const runId = id(entry.runId)
    const sceneId = id(entry.sceneId)
    const triggerId = id(entry.triggerId)
    const actionId = id(entry.actionId)
    if (!historyId || !runId || !sceneId || !triggerId || !actionId) return []
    return [{
      id: historyId, runId, sceneId, triggerId, actionId,
      summary: text(entry.summary, 500) || '已执行场景动作',
      executedAt: timestamp(entry.executedAt),
      reversible: entry.reversible === true,
      ...(entry.undoneAt == null ? {} : { undoneAt: timestamp(entry.undoneAt) }),
      ...(normalizeUndo(entry.undo) ? { undo: normalizeUndo(entry.undo) } : {}),
    } satisfies SceneHistoryEntry]
  }).slice(-SCENE_MAX_HISTORY)
  return {
    paused: source.paused === true,
    pendingRuns,
    receipts: (Array.isArray(source.receipts) ? source.receipts : []).map((entry) => text(entry, 300)).filter(Boolean).slice(-2_000),
    history,
    ...(text(source.lastError, 500) ? { lastError: text(source.lastError, 500) } : {}),
  }
}

export function normalizeSharedSceneOrchestration(value: unknown): SharedSceneOrchestrationState {
  const source = object(value) ? value : {}
  return {
    schemaVersion: SCENE_ORCHESTRATION_SCHEMA_VERSION,
    scenes: (Array.isArray(source.scenes) ? source.scenes : []).map(normalizeScene)
      .filter((entry): entry is OrchestratedScene => entry !== null).slice(-SCENE_MAX_SCENES),
    runtime: normalizeRuntime(source.runtime),
    updatedAt: timestamp(source.updatedAt),
  }
}

export function validateSharedSceneOrchestration(value: unknown): boolean {
  if (!object(value) || value.schemaVersion !== SCENE_ORCHESTRATION_SCHEMA_VERSION || !Array.isArray(value.scenes) || !object(value.runtime)) return false
  if (!Array.isArray(value.runtime.pendingRuns) || !Array.isArray(value.runtime.receipts) || !Array.isArray(value.runtime.history)) return false
  const rawScenes = value.scenes
  const normalized = normalizeSharedSceneOrchestration(value)
  if (normalized.scenes.length !== rawScenes.length || rawScenes.length > SCENE_MAX_SCENES) return false
  if (normalized.runtime.pendingRuns.length !== value.runtime.pendingRuns.length || value.runtime.pendingRuns.length > 50) return false
  if (normalized.runtime.receipts.length !== value.runtime.receipts.length || value.runtime.receipts.length > 2_000) return false
  if (normalized.runtime.history.length !== value.runtime.history.length || value.runtime.history.length > SCENE_MAX_HISTORY) return false
  const sceneIds = new Set<string>()
  const scenesValid = normalized.scenes.every((scene, index) => {
    const raw = rawScenes[index]
    if (
      !object(raw) ||
      sceneIds.has(scene.id) ||
      !Array.isArray(raw.triggers) ||
      raw.triggers.length !== scene.triggers.length ||
      (raw.interactionPoints != null && (
        !Array.isArray(raw.interactionPoints) ||
        raw.interactionPoints.length !== scene.interactionPoints.length ||
        raw.interactionPoints.length > SCENE_MAX_INTERACTION_POINTS
      ))
    ) return false
    sceneIds.add(scene.id)
    const interactionIds = new Set<string>()
    if (scene.interactionPoints.some((point, pointIndex) => {
      if (interactionIds.has(point.id)) return true
      interactionIds.add(point.id)
      const rawPoint = Array.isArray(raw.interactionPoints) ? raw.interactionPoints[pointIndex] : undefined
      if (!object(rawPoint)) return true
      const rawRewards = Array.isArray(rawPoint.rewards) ? rawPoint.rewards : []
      const rawSuccessEffects = Array.isArray(rawPoint.successEffects) ? rawPoint.successEffects : []
      const rawFailureEffects = Array.isArray(rawPoint.failureEffects) ? rawPoint.failureEffects : []
      if (
        rawPoint.check != null && !point.check ||
        typeof rawPoint.name !== 'string' ||
        !rawPoint.name.trim() ||
        typeof rawPoint.enabled !== 'boolean' ||
        typeof rawPoint.visibleToPlayers !== 'boolean' ||
        !Number.isFinite(rawPoint.x) ||
        !Number.isFinite(rawPoint.y) ||
        !Number.isFinite(Number(rawPoint.interactionRadiusFeet)) ||
        Number(rawPoint.interactionRadiusFeet) < 5 ||
        Number(rawPoint.interactionRadiusFeet) > 120 ||
        typeof rawPoint.prompt !== 'string' ||
        !rawPoint.prompt.trim() ||
        !Array.isArray(rawPoint.rewards) ||
        rawRewards.length !== point.rewards.length ||
        rawRewards.length > SCENE_MAX_INTERACTION_REWARDS ||
        (rawPoint.successEffects != null && (
          !Array.isArray(rawPoint.successEffects) ||
          rawSuccessEffects.length !== point.successEffects.length ||
          rawSuccessEffects.length > SCENE_MAX_INTERACTION_EFFECTS ||
          new Set(point.successEffects.map((effect) => effect.id)).size !== point.successEffects.length ||
          rawSuccessEffects.some((effect, effectIndex) =>
            !interactionOutcomeEffectStrictlyMatches(effect, point.successEffects[effectIndex]))
        )) ||
        (rawPoint.failureEffects != null && (
          !Array.isArray(rawPoint.failureEffects) ||
          rawFailureEffects.length !== point.failureEffects.length ||
          rawFailureEffects.length > SCENE_MAX_INTERACTION_EFFECTS ||
          new Set(point.failureEffects.map((effect) => effect.id)).size !== point.failureEffects.length ||
          rawFailureEffects.some((effect, effectIndex) =>
            !interactionOutcomeEffectStrictlyMatches(effect, point.failureEffects[effectIndex]))
        )) ||
        rawRewards.some((reward, rewardIndex) => {
          if (!object(reward)) return true
          const normalizedReward = point.rewards[rewardIndex]
          return (
            !normalizedReward ||
            typeof reward.templateId !== 'string' ||
            reward.templateId !== normalizedReward.templateId ||
            !Number.isInteger(reward.quantity) ||
            reward.quantity !== normalizedReward.quantity ||
            typeof reward.identified !== 'boolean'
          )
        })
      ) return true
      return false
    })) return false
    const triggerIds = new Set<string>()
    return raw.triggers.every((trigger, triggerIndex) => {
      const normalizedTrigger = scene.triggers[triggerIndex]
      if (!object(trigger) || !normalizedTrigger || triggerIds.has(normalizedTrigger.id) || !Array.isArray(trigger.actions) || trigger.actions.length !== normalizedTrigger.actions.length) return false
      triggerIds.add(normalizedTrigger.id)
      const actionIds = new Set<string>()
      return normalizedTrigger.actions.every((action) => {
        if (actionIds.has(action.id)) return false
        actionIds.add(action.id)
        return true
      })
    })
  })
  if (!scenesValid) return false
  const pendingIds = new Set<string>()
  if (normalized.runtime.pendingRuns.some((run) => {
    if (pendingIds.has(run.id)) return true
    pendingIds.add(run.id)
    const scene = normalized.scenes.find((candidate) => candidate.id === run.sceneId && candidate.mapId === run.mapId)
    const trigger = scene?.triggers.find((candidate) => candidate.id === run.triggerId)
    return !trigger
  })) return false
  const rawHistory = value.runtime.history
  const historyIds = new Set<string>()
  return normalized.runtime.history.every((entry, index) => {
    if (historyIds.has(entry.id)) return false
    historyIds.add(entry.id)
    const raw = rawHistory[index]
    return !object(raw) || raw.undo == null || entry.undo != null
  })
}

export function scenePointInsideRegion(point: { x: number; y: number }, region: SceneRegion): boolean {
  if (region.kind === 'circle') return Math.hypot(point.x - region.x, point.y - region.y) <= region.radius
  return point.x >= region.x && point.y >= region.y && point.x <= region.x + region.width && point.y <= region.y + region.height
}

export function sceneTriggerAcceptsToken(trigger: SceneTrigger, token: SceneTriggerTokenSnapshot): boolean {
  return trigger.tokenFilter === 'any' || trigger.tokenFilter === token.type
}

export function sceneTriggerReceiptKey(
  scene: OrchestratedScene,
  trigger: SceneTrigger,
  tokenId: string | undefined,
): string | null {
  if (trigger.repeat === 'always') return null
  if (trigger.repeat === 'once') return `${scene.id}:${trigger.id}:once`
  return `${scene.id}:${trigger.id}:token:${tokenId ?? 'manual'}`
}

export function sceneInteractionReceiptId(
  scene: Pick<OrchestratedScene, 'id'>,
  point: Pick<SceneInteractionPoint, 'id' | 'repeat'>,
  characterId: string,
  requestId: string,
): string {
  const scope = point.repeat === 'once'
    ? 'once'
    : point.repeat === 'per-character'
      ? `character:${characterId}`
      : `request:${requestId}`
  return `scene-interaction:${scene.id}:${point.id}:${scope}`
}

export function sceneInteractionPointPublicSummary(
  point: SceneInteractionPoint,
): Pick<SceneInteractionPoint,
  'id' | 'name' | 'enabled' | 'visibleToPlayers' | 'icon' | 'x' | 'y' |
  'interactionRadiusFeet' | 'prompt' | 'repeat' | 'successText' | 'failureText'
> & { rewards: []; successEffects: []; failureEffects: [] } {
  return {
    id: point.id,
    name: point.name,
    enabled: point.enabled,
    visibleToPlayers: point.visibleToPlayers,
    icon: point.icon,
    x: point.x,
    y: point.y,
    interactionRadiusFeet: point.interactionRadiusFeet,
    prompt: point.prompt,
    repeat: point.repeat,
    successText: '',
    failureText: '',
    rewards: [],
    successEffects: [],
    failureEffects: [],
  }
}

export function sceneActionSummary(action: SceneAction): string {
  switch (action.kind) {
    case 'reveal-handout': return `展示讲义 ${action.handoutId}`
    case 'whisper': return `发送密语：${action.text.slice(0, 40)}`
    case 'group-roll': return `发起 ${action.label}（DC ${action.dc}）`
    case 'door': return `将门 ${action.doorId} 设为${action.state === 'open' ? '开启' : action.state === 'locked' ? '上锁' : '关闭'}`
    case 'light': return `环境光改为${action.ambientLight === 'bright' ? '明亮' : action.ambientLight === 'dim' ? '昏暗' : '黑暗'}`
    case 'fog': return action.operation === 'fill' ? '完全遮蔽地图' : '清除地图迷雾'
    case 'encounter': return `投放 ${action.entries.reduce((sum, entry) => sum + entry.quantity, 0)} 个遭遇单位${action.startInitiative ? '并开始先攻' : ''}`
    case 'sound': return `播放音效：${action.cue}`
    case 'audio': return action.operation === 'stop' ? '停止房间场景音频' : `播放房间音频 ${action.assetId}`
    case 'teleport': return `传送至地图 ${action.targetMapId}`
    case 'task': return `写入任务：${action.title}`
    case 'journal': return `写入日志：${action.title}`
  }
}

export function createSceneAction(kind: SceneAction['kind']): SceneAction {
  const base = { id: crypto.randomUUID(), enabled: true }
  switch (kind) {
    case 'reveal-handout': return { ...base, kind, handoutId: '', audience: 'all' }
    case 'whisper': return { ...base, kind, text: '你察觉到了一些异常。' }
    case 'group-roll': return { ...base, kind, label: '全队察觉检定', selection: 'skill:perception', dc: 12, mode: 'normal', allowPassiveFallback: true }
    case 'door': return { ...base, kind, doorId: '', state: 'open' }
    case 'light': return { ...base, kind, ambientLight: 'dim' }
    case 'fog': return { ...base, kind, operation: 'clear' }
    case 'encounter': return { ...base, kind, entries: [], startInitiative: true }
    case 'sound': return { ...base, kind, cue: 'discovery' }
    case 'audio': return { ...base, kind, operation: 'play', loop: true, volume: 0.7 }
    case 'teleport': return { ...base, kind, targetMapId: '', x: 0, y: 0, moveTriggeringToken: true }
    case 'task': return { ...base, kind, title: '新任务', body: '' }
    case 'journal': return { ...base, kind, title: '场景日志', body: '' }
  }
}
