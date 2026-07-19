import type { AbilityKey } from '../../lib/dnd'
import {
  DND5E_STANDARD_CONDITIONS,
  dnd5eStandardConditionId,
  type Dnd5eStandardConditionId,
} from './conditions'

export const DND5E_ACTIVE_EFFECT_SCHEMA_VERSION = 1 as const
export const DND5E_COMBAT_STATE_SCHEMA_VERSION = 2 as const

export type Dnd5eActiveEffectKind = 'condition' | 'mark' | 'buff' | 'debuff' | 'custom'
export type Dnd5eActiveEffectSourceKind =
  | 'dm'
  | 'spell'
  | 'feature'
  | 'item'
  | 'monster'
  | 'plugin'
  | 'system'
  | 'legacy'

export type Dnd5eActiveEffectStackingPolicy =
  | 'reject'
  | 'refresh-duration'
  | 'replace'
  | 'keep-strongest'
  | 'stack'

export type Dnd5eActiveEffectBreakTrigger =
  | 'takes-damage'
  | 'targeted-by-attack'
  | 'hit-by-attack'
  | 'makes-attack'
  | 'moves'

export type Dnd5eActiveEffectTurnBoundary =
  | 'source-turn-start'
  | 'source-turn-end'
  | 'target-turn-start'
  | 'target-turn-end'

export interface Dnd5eActiveEffectSource {
  kind: Dnd5eActiveEffectSourceKind
  actorId?: string
  actorName?: string
  rulesId?: string
  label?: string
  pluginId?: string
}

export type Dnd5eActiveEffectDuration =
  | { type: 'permanent' }
  | {
      type: 'rounds'
      remainingRounds: number
      tickOn: 'target-turn-start' | 'target-turn-end'
      /** 防止同一回合边界因多次 Headless 事务而重复扣减。 */
      lastTickTurnKey?: string
    }
  | { type: 'until-turn-boundary'; boundary: Dnd5eActiveEffectTurnBoundary; appliedTurnKey?: string }
  | { type: 'concentration'; sourceActorId: string; concentrationId?: string; remainingRounds?: number }

export interface Dnd5eActiveEffectRepeatSave {
  ability: AbilityKey
  dc: number
  timing: 'target-turn-start' | 'target-turn-end'
  onSuccess: 'remove'
}

export interface Dnd5eActiveEffectSavingThrowRoll {
  effectId: string
  d20: number
  d20Second?: number
  blessRoll?: number
  baneRoll?: number
  rerollD20?: number
  rerollD20Second?: number
  bardicInspirationRoll?: number
  darkOnesOwnLuckRoll?: number
}

/**
 * Headless 可执行的声明式修正。规则包只能写这些公开能力，不能携带任意 JavaScript。
 */
export interface Dnd5eActiveEffectModifiers {
  speedPenaltyFeet?: number
  preventReactions?: boolean
}

/**
 * 权威状态实例。状态正文仍由规则包定义；这里只保存跨端同步、生命周期与来源所需的事实。
 */
export interface Dnd5eActiveEffectInstance {
  schemaVersion: typeof DND5E_ACTIVE_EFFECT_SCHEMA_VERSION
  id: string
  definitionId: string
  label: string
  kind: Dnd5eActiveEffectKind
  standardCondition?: Dnd5eStandardConditionId
  /** 旧插件状态无法映射到标准 ID 时，保留其原始字符串。 */
  legacyCondition?: string
  source: Dnd5eActiveEffectSource
  appliedAt: number
  appliedRound?: number
  appliedTurnKey?: string
  duration: Dnd5eActiveEffectDuration
  repeatSave?: Dnd5eActiveEffectRepeatSave
  breakOn?: Dnd5eActiveEffectBreakTrigger[]
  stackingKey: string
  stackingPolicy: Dnd5eActiveEffectStackingPolicy
  potency?: number
  visibility?: 'public' | 'dm-only'
  modifiers?: Dnd5eActiveEffectModifiers
  /** 对应旧 timedEffects 的稳定 ID；迁移期间用于双写和去重。 */
  legacyTimedEffectId?: string
}

export interface Dnd5eActiveEffectMutation {
  effects: Dnd5eActiveEffectInstance[]
  status: 'applied' | 'refreshed' | 'replaced' | 'rejected-immune' | 'rejected-duplicate' | 'kept-stronger'
  removedIds: string[]
}

export interface Dnd5eActiveEffectProjection {
  activeEffects?: Dnd5eActiveEffectInstance[]
  /** 兼容旧 UI 的只读投影；调用方不得独立编辑。 */
  conditions: string[]
}

function stableSegment(value: string): string {
  return encodeURIComponent(value.trim().toLowerCase()).replaceAll('%', '_')
}

function positiveInteger(value: unknown, fallback = 1): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.floor(value))
    : fallback
}

export function dnd5eActiveEffectId(prefix: string, ...parts: readonly string[]): string {
  return [prefix, ...parts].map(stableSegment).join(':')
}

export function createDnd5eConditionEffect(input: {
  id?: string
  condition: Dnd5eStandardConditionId
  source: Dnd5eActiveEffectSource
  targetId: string
  duration?: Dnd5eActiveEffectDuration
  repeatSave?: Dnd5eActiveEffectRepeatSave
  breakOn?: readonly Dnd5eActiveEffectBreakTrigger[]
  stackingPolicy?: Dnd5eActiveEffectStackingPolicy
  stackingKey?: string
  potency?: number
  appliedAt?: number
  appliedRound?: number
  appliedTurnKey?: string
  visibility?: 'public' | 'dm-only'
}): Dnd5eActiveEffectInstance {
  const definitionId = `condition:${input.condition}`
  const sourceKey = input.source.actorId ?? input.source.rulesId ?? input.source.kind
  return {
    schemaVersion: DND5E_ACTIVE_EFFECT_SCHEMA_VERSION,
    id: input.id ?? dnd5eActiveEffectId(definitionId, sourceKey, input.targetId),
    definitionId,
    label: DND5E_STANDARD_CONDITIONS[input.condition].label,
    kind: 'condition',
    standardCondition: input.condition,
    source: { ...input.source },
    appliedAt: input.appliedAt ?? Date.now(),
    appliedRound: input.appliedRound,
    appliedTurnKey: input.appliedTurnKey,
    duration: input.duration ?? { type: 'permanent' },
    repeatSave: input.repeatSave ? { ...input.repeatSave } : undefined,
    breakOn: input.breakOn ? [...new Set(input.breakOn)] : undefined,
    stackingKey: input.stackingKey ?? definitionId,
    stackingPolicy: input.stackingPolicy ?? 'refresh-duration',
    potency: input.potency,
    visibility: input.visibility ?? 'public',
  }
}

export function createDnd5eMechanicalEffect(input: {
  id?: string
  definitionId: string
  label: string
  kind?: Exclude<Dnd5eActiveEffectKind, 'condition'>
  source: Dnd5eActiveEffectSource
  targetId: string
  duration?: Dnd5eActiveEffectDuration
  repeatSave?: Dnd5eActiveEffectRepeatSave
  breakOn?: readonly Dnd5eActiveEffectBreakTrigger[]
  stackingPolicy?: Dnd5eActiveEffectStackingPolicy
  stackingKey?: string
  potency?: number
  appliedAt?: number
  appliedRound?: number
  appliedTurnKey?: string
  visibility?: 'public' | 'dm-only'
  legacyCondition?: string
  modifiers?: Dnd5eActiveEffectModifiers
}): Dnd5eActiveEffectInstance {
  const sourceKey = input.source.actorId ?? input.source.rulesId ?? input.source.kind
  return {
    schemaVersion: DND5E_ACTIVE_EFFECT_SCHEMA_VERSION,
    id: input.id ?? dnd5eActiveEffectId(input.definitionId, sourceKey, input.targetId),
    definitionId: input.definitionId,
    label: input.label,
    kind: input.kind ?? 'debuff',
    source: { ...input.source },
    appliedAt: input.appliedAt ?? Date.now(),
    appliedRound: input.appliedRound,
    appliedTurnKey: input.appliedTurnKey,
    duration: input.duration ?? { type: 'permanent' },
    repeatSave: input.repeatSave ? { ...input.repeatSave } : undefined,
    breakOn: input.breakOn ? [...new Set(input.breakOn)] : undefined,
    stackingKey: input.stackingKey ?? input.definitionId,
    stackingPolicy: input.stackingPolicy ?? 'refresh-duration',
    potency: input.potency,
    visibility: input.visibility ?? 'public',
    legacyCondition: input.legacyCondition,
    modifiers: input.modifiers ? { ...input.modifiers } : undefined,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const ACTIVE_EFFECT_KINDS = new Set<Dnd5eActiveEffectKind>(['condition', 'mark', 'buff', 'debuff', 'custom'])
const SOURCE_KINDS = new Set<Dnd5eActiveEffectSourceKind>(['dm', 'spell', 'feature', 'item', 'monster', 'plugin', 'system', 'legacy'])
const STACKING_POLICIES = new Set<Dnd5eActiveEffectStackingPolicy>(['reject', 'refresh-duration', 'replace', 'keep-strongest', 'stack'])
const BREAK_TRIGGERS = new Set<Dnd5eActiveEffectBreakTrigger>(['takes-damage', 'targeted-by-attack', 'hit-by-attack', 'makes-attack', 'moves'])
const TURN_BOUNDARIES = new Set<Dnd5eActiveEffectTurnBoundary>(['source-turn-start', 'source-turn-end', 'target-turn-start', 'target-turn-end'])
const ABILITIES = new Set<AbilityKey>(['str', 'dex', 'con', 'int', 'wis', 'cha'])

/** Rejects malformed remote/plugin values instead of trusting a TypeScript cast. */
export function normalizeDnd5eActiveEffects(value: unknown): Dnd5eActiveEffectInstance[] {
  if (!Array.isArray(value)) return []
  const effects: Dnd5eActiveEffectInstance[] = []
  const seen = new Set<string>()
  for (const candidate of value) {
    if (!isRecord(candidate) || candidate.schemaVersion !== DND5E_ACTIVE_EFFECT_SCHEMA_VERSION) continue
    if (typeof candidate.id !== 'string' || !candidate.id.trim() || seen.has(candidate.id)) continue
    if (typeof candidate.definitionId !== 'string' || typeof candidate.label !== 'string') continue
    if (!ACTIVE_EFFECT_KINDS.has(candidate.kind as Dnd5eActiveEffectKind)) continue
    if (!isRecord(candidate.source) || !SOURCE_KINDS.has(candidate.source.kind as Dnd5eActiveEffectSourceKind)) continue
    if (!isRecord(candidate.duration) || typeof candidate.duration.type !== 'string') continue
    if (typeof candidate.stackingKey !== 'string' || !STACKING_POLICIES.has(candidate.stackingPolicy as Dnd5eActiveEffectStackingPolicy)) continue
    const standardCondition = typeof candidate.standardCondition === 'string'
      ? dnd5eStandardConditionId(candidate.standardCondition)
      : undefined
    const rawDuration = candidate.duration
    let normalizedDuration: Dnd5eActiveEffectDuration
    if (rawDuration.type === 'permanent') {
      normalizedDuration = { type: 'permanent' }
    } else if (
      rawDuration.type === 'rounds' &&
      (rawDuration.tickOn === 'target-turn-start' || rawDuration.tickOn === 'target-turn-end')
    ) {
      normalizedDuration = {
        type: 'rounds',
        remainingRounds: positiveInteger(rawDuration.remainingRounds),
        tickOn: rawDuration.tickOn,
        lastTickTurnKey: typeof rawDuration.lastTickTurnKey === 'string' && rawDuration.lastTickTurnKey.trim().length > 0
          ? rawDuration.lastTickTurnKey.trim()
          : undefined,
      }
    } else if (rawDuration.type === 'until-turn-boundary' && TURN_BOUNDARIES.has(rawDuration.boundary as Dnd5eActiveEffectTurnBoundary)) {
      normalizedDuration = {
        type: 'until-turn-boundary',
        boundary: rawDuration.boundary as Dnd5eActiveEffectTurnBoundary,
        appliedTurnKey: typeof rawDuration.appliedTurnKey === 'string' ? rawDuration.appliedTurnKey : undefined,
      }
    } else if (rawDuration.type === 'concentration' && typeof rawDuration.sourceActorId === 'string') {
      normalizedDuration = {
        type: 'concentration',
        sourceActorId: rawDuration.sourceActorId,
        concentrationId: typeof rawDuration.concentrationId === 'string' ? rawDuration.concentrationId : undefined,
        remainingRounds: rawDuration.remainingRounds == null ? undefined : positiveInteger(rawDuration.remainingRounds),
      }
    } else continue
    const rawRepeatSave = candidate.repeatSave
    const repeatSave = isRecord(rawRepeatSave) &&
      ABILITIES.has(rawRepeatSave.ability as AbilityKey) &&
      typeof rawRepeatSave.dc === 'number' && Number.isInteger(rawRepeatSave.dc) && rawRepeatSave.dc > 0 &&
      (rawRepeatSave.timing === 'target-turn-start' || rawRepeatSave.timing === 'target-turn-end')
      ? {
          ability: rawRepeatSave.ability as AbilityKey,
          dc: rawRepeatSave.dc,
          timing: rawRepeatSave.timing as 'target-turn-start' | 'target-turn-end',
          onSuccess: 'remove' as const,
        }
      : undefined
    seen.add(candidate.id)
    const rawModifiers = candidate.modifiers
    const modifiers = isRecord(rawModifiers)
      ? {
          speedPenaltyFeet: typeof rawModifiers.speedPenaltyFeet === 'number' &&
            Number.isFinite(rawModifiers.speedPenaltyFeet) && rawModifiers.speedPenaltyFeet >= 0
            ? rawModifiers.speedPenaltyFeet
            : undefined,
          preventReactions: typeof rawModifiers.preventReactions === 'boolean'
            ? rawModifiers.preventReactions
            : undefined,
        }
      : undefined
    effects.push({
      ...(candidate as unknown as Dnd5eActiveEffectInstance),
      id: candidate.id.trim(),
      definitionId: candidate.definitionId.trim(),
      label: candidate.label.trim(),
      standardCondition,
      source: { ...(candidate.source as unknown as Dnd5eActiveEffectSource) },
      duration: normalizedDuration,
      repeatSave,
      breakOn: Array.isArray(candidate.breakOn)
        ? [...new Set(candidate.breakOn.filter((entry): entry is Dnd5eActiveEffectBreakTrigger => BREAK_TRIGGERS.has(entry as Dnd5eActiveEffectBreakTrigger)))]
        : undefined,
      modifiers: modifiers && (modifiers.speedPenaltyFeet != null || modifiers.preventReactions != null)
        ? modifiers
        : undefined,
    })
  }
  return effects
}

export interface Dnd5eActiveEffectValidationResult {
  ok: boolean
  effects: Dnd5eActiveEffectInstance[]
  issues: string[]
}

/**
 * 共享资源边界使用严格模式：本地迁移可以修复旧数据，但远端损坏数据必须 fail closed。
 */
export function validateDnd5eActiveEffectsStrict(value: unknown): Dnd5eActiveEffectValidationResult {
  if (value == null) return { ok: true, effects: [], issues: [] }
  if (!Array.isArray(value)) return { ok: false, effects: [], issues: ['activeEffects 必须是数组'] }
  const effects = normalizeDnd5eActiveEffects(value)
  const issues: string[] = []
  if (effects.length !== value.length) issues.push('activeEffects 含有无法解析或重复的实例')
  for (let index = 0; index < value.length; index += 1) {
    const raw = value[index]
    if (!isRecord(raw)) continue
    const effect = effects.find((candidate) => candidate.id === raw.id)
    if (!effect) continue
    if (raw.repeatSave != null && effect.repeatSave == null) issues.push(`activeEffects[${index}].repeatSave 损坏`)
    if (Array.isArray(raw.breakOn) && (effect.breakOn?.length ?? 0) !== new Set(raw.breakOn).size) {
      issues.push(`activeEffects[${index}].breakOn 含未知触发器`)
    }
    if (isRecord(raw.duration) && raw.duration.type === 'rounds' && (
      !Number.isInteger(raw.duration.remainingRounds) || Number(raw.duration.remainingRounds) <= 0
    )) issues.push(`activeEffects[${index}].duration.remainingRounds 无效`)
    if (isRecord(raw.duration) && raw.duration.type === 'rounds' && raw.duration.lastTickTurnKey != null && (
      typeof raw.duration.lastTickTurnKey !== 'string' ||
      raw.duration.lastTickTurnKey.trim().length === 0 ||
      raw.duration.lastTickTurnKey.length > 512
    )) issues.push(`activeEffects[${index}].duration.lastTickTurnKey 无效`)
    if (raw.modifiers != null) {
      if (!isRecord(raw.modifiers)) issues.push(`activeEffects[${index}].modifiers 损坏`)
      else {
        if (raw.modifiers.speedPenaltyFeet != null && (
          typeof raw.modifiers.speedPenaltyFeet !== 'number' ||
          !Number.isFinite(raw.modifiers.speedPenaltyFeet) || raw.modifiers.speedPenaltyFeet < 0
        )) issues.push(`activeEffects[${index}].modifiers.speedPenaltyFeet 无效`)
        if (raw.modifiers.preventReactions != null && typeof raw.modifiers.preventReactions !== 'boolean') {
          issues.push(`activeEffects[${index}].modifiers.preventReactions 无效`)
        }
      }
    }
  }
  return { ok: issues.length === 0, effects, issues: [...new Set(issues)] }
}

export function dnd5eActiveSpeedPenalty(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): number {
  return normalizeDnd5eActiveEffects(effects).reduce(
    (total, effect) => total + Math.max(0, effect.modifiers?.speedPenaltyFeet ?? 0),
    0,
  )
}

export function dnd5eActiveEffectsPreventReactions(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): boolean {
  return normalizeDnd5eActiveEffects(effects).some((effect) => effect.modifiers?.preventReactions === true)
}

export function dnd5eConditionsFromActiveEffects(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  preservedConditions: readonly string[] = [],
): string[] {
  const conditions: string[] = []
  const seen = new Set<string>()
  const add = (value: string, preserveAlias = false) => {
    const standard = dnd5eStandardConditionId(value)
    const normalized = preserveAlias ? value : standard ?? value
    const key = standard ? `standard:${standard}` : `extension:${value}`
    if (seen.has(key)) return
    seen.add(key)
    conditions.push(normalized)
  }
  for (const effect of effects ?? []) {
    if (effect.standardCondition) {
      const legacyAlias = effect.legacyCondition
      add(legacyAlias ?? effect.standardCondition, !!legacyAlias)
    }
    else if (effect.legacyCondition) add(effect.legacyCondition)
  }
  for (const value of preservedConditions) add(value)
  return conditions
}

/** ActiveEffect 是唯一事实源；所有持久化层均使用此函数同时生成实例与只读投影。 */
export function projectDnd5eActiveEffectState(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): Dnd5eActiveEffectProjection {
  const activeEffects = normalizeDnd5eActiveEffects(effects)
  return {
    activeEffects: activeEffects.length > 0 ? activeEffects : undefined,
    conditions: dnd5eConditionsFromActiveEffects(activeEffects),
  }
}

export function removeDnd5eActiveEffectById(input: {
  effects?: readonly Dnd5eActiveEffectInstance[]
  id: string
}): { effects: Dnd5eActiveEffectInstance[]; removed: Dnd5eActiveEffectInstance[] } {
  const removed: Dnd5eActiveEffectInstance[] = []
  const effects = normalizeDnd5eActiveEffects(input.effects).filter((effect) => {
    if (effect.id !== input.id) return true
    removed.push(effect)
    return false
  })
  return { effects, removed }
}

export function removeDnd5eActiveEffectsByStandardCondition(input: {
  effects?: readonly Dnd5eActiveEffectInstance[]
  condition: Dnd5eStandardConditionId
}): { effects: Dnd5eActiveEffectInstance[]; removed: Dnd5eActiveEffectInstance[] } {
  const removed: Dnd5eActiveEffectInstance[] = []
  const effects = normalizeDnd5eActiveEffects(input.effects).filter((effect) => {
    if (effect.standardCondition !== input.condition) return true
    removed.push(effect)
    return false
  })
  return { effects, removed }
}

export function applyDnd5eActiveEffect(input: {
  effects?: readonly Dnd5eActiveEffectInstance[]
  incoming: Dnd5eActiveEffectInstance
  conditionImmunities?: readonly string[]
}): Dnd5eActiveEffectMutation {
  const effects = normalizeDnd5eActiveEffects(input.effects)
  if (
    input.incoming.standardCondition &&
    (input.conditionImmunities ?? []).some((value) => dnd5eStandardConditionId(value) === input.incoming.standardCondition)
  ) return { effects, status: 'rejected-immune', removedIds: [] }

  const matching = effects.filter((effect) => effect.stackingKey === input.incoming.stackingKey)
  if (input.incoming.stackingPolicy === 'stack' || matching.length === 0) {
    return { effects: [...effects.filter((effect) => effect.id !== input.incoming.id), input.incoming], status: 'applied', removedIds: [] }
  }
  if (input.incoming.stackingPolicy === 'reject') {
    return { effects, status: 'rejected-duplicate', removedIds: [] }
  }
  if (input.incoming.stackingPolicy === 'keep-strongest') {
    const strongest = Math.max(...matching.map((effect) => effect.potency ?? 0))
    if (strongest >= (input.incoming.potency ?? 0)) return { effects, status: 'kept-stronger', removedIds: [] }
  }
  const removedIds = matching.map((effect) => effect.id)
  if (input.incoming.stackingPolicy === 'refresh-duration') {
    const existing = matching[0]
    const refreshed = { ...input.incoming, id: existing.id }
    return {
      effects: [...effects.filter((effect) => effect.stackingKey !== input.incoming.stackingKey), refreshed],
      status: 'refreshed',
      removedIds: removedIds.slice(1),
    }
  }
  return {
    effects: [...effects.filter((effect) => effect.stackingKey !== input.incoming.stackingKey), input.incoming],
    status: 'replaced',
    removedIds,
  }
}

export function removeDnd5eActiveEffectsForEvent(input: {
  effects?: readonly Dnd5eActiveEffectInstance[]
  trigger: Dnd5eActiveEffectBreakTrigger
}): { effects: Dnd5eActiveEffectInstance[]; removed: Dnd5eActiveEffectInstance[] } {
  const removed: Dnd5eActiveEffectInstance[] = []
  const effects = normalizeDnd5eActiveEffects(input.effects).filter((effect) => {
    const matches = effect.breakOn?.includes(input.trigger) === true
    if (matches) removed.push(effect)
    return !matches
  })
  return { effects, removed }
}

export function dnd5eActiveEffectRemainingLabel(effect: Dnd5eActiveEffectInstance): string {
  if (effect.duration.type === 'permanent') return '永久（由 DM 或规则解除）'
  if (effect.duration.type === 'concentration') {
    return effect.duration.remainingRounds == null
      ? '专注期间'
      : `专注期间，最多 ${effect.duration.remainingRounds} 轮`
  }
  if (effect.duration.type === 'rounds') return `剩余 ${effect.duration.remainingRounds} 轮`
  const labels: Record<Dnd5eActiveEffectTurnBoundary, string> = {
    'source-turn-start': '来源下回合开始',
    'source-turn-end': '来源下回合结束',
    'target-turn-start': '目标下回合开始',
    'target-turn-end': '目标下回合结束',
  }
  return `直到${labels[effect.duration.boundary]}`
}
