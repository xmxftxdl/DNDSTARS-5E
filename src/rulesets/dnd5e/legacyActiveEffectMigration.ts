import type { Dnd5eTimedEffect } from './timedEffects'
import {
  DND5E_ACTIVE_EFFECT_SCHEMA_VERSION,
  DND5E_COMBAT_STATE_SCHEMA_VERSION,
  createDnd5eConditionEffect,
  dnd5eActiveEffectId,
  dnd5eConditionsFromActiveEffects,
  normalizeDnd5eActiveEffects,
  type Dnd5eActiveEffectDuration,
  type Dnd5eActiveEffectInstance,
} from './activeEffects'
import { DND5E_STANDARD_CONDITIONS, dnd5eStandardConditionId } from './conditions'

/** 只允许存档/共享资源入口使用的旧状态形状。运行时模型不得引用 timedEffects。 */
export interface LegacyDnd5eCombatStateEffectFields {
  schemaVersion?: number
  activeEffects?: unknown
  timedEffects?: readonly Dnd5eTimedEffect[]
  conditions?: readonly string[]
}

function positiveInteger(value: unknown, fallback = 1): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.floor(value))
    : fallback
}

/** 旧字符串只在载入时一次性转换；确定性 ID 保证多端迁移得到同一快照。 */
export function migrateLegacyDnd5eConditions(input: {
  targetId: string
  conditions?: readonly string[]
  activeEffects?: unknown
}): Dnd5eActiveEffectInstance[] {
  const effects = normalizeDnd5eActiveEffects(input.activeEffects)
  const represented = new Set(effects.map((effect) => effect.standardCondition
    ? `standard:${effect.standardCondition}`
    : effect.legacyCondition ? `extension:${effect.legacyCondition}` : effect.definitionId))
  for (const raw of input.conditions ?? []) {
    const condition = dnd5eStandardConditionId(raw)
    const key = condition ? `standard:${condition}` : `extension:${raw}`
    if (represented.has(key)) continue
    represented.add(key)
    if (condition) {
      effects.push({ ...createDnd5eConditionEffect({
        id: dnd5eActiveEffectId('legacy-condition', input.targetId, condition),
        condition,
        targetId: input.targetId,
        source: { kind: 'legacy', label: '旧状态迁移' },
        duration: { type: 'permanent' },
        stackingPolicy: 'reject',
        appliedAt: 0,
      }), legacyCondition: raw })
    } else {
      effects.push({
        schemaVersion: DND5E_ACTIVE_EFFECT_SCHEMA_VERSION,
        id: dnd5eActiveEffectId('legacy-condition', input.targetId, raw),
        definitionId: `legacy:${raw}`,
        label: raw,
        kind: 'custom',
        legacyCondition: raw,
        source: { kind: 'legacy', label: '旧状态迁移' },
        appliedAt: 0,
        duration: { type: 'permanent' },
        stackingKey: `legacy:${raw}`,
        stackingPolicy: 'reject',
        visibility: 'public',
      })
    }
  }
  return effects
}

export function activeEffectFromDnd5eTimedEffect(
  effect: Dnd5eTimedEffect,
  targetId: string,
): Dnd5eActiveEffectInstance {
  const duration: Dnd5eActiveEffectDuration = effect.expiresAt === 'source-next-turn-start'
    ? { type: 'until-turn-boundary', boundary: 'source-turn-start', appliedTurnKey: effect.appliedTurnKey }
    : effect.expiresAt === 'target-next-turn-start'
      ? { type: 'until-turn-boundary', boundary: 'target-turn-start', appliedTurnKey: effect.appliedTurnKey }
      : { type: 'rounds', remainingRounds: positiveInteger(effect.remainingRounds), tickOn: 'target-turn-end' }
  const condition = effect.kind === 'condition' ? effect.condition : undefined
  return {
    schemaVersion: DND5E_ACTIVE_EFFECT_SCHEMA_VERSION,
    id: dnd5eActiveEffectId('timed', targetId, effect.id),
    definitionId: condition ? `condition:${condition}` : `${effect.kind}:${effect.sourceSpellId}`,
    label: condition ? DND5E_STANDARD_CONDITIONS[condition].label : effect.sourceSpellId,
    kind: condition ? 'condition' : 'debuff',
    standardCondition: condition,
    source: { kind: 'spell', actorId: effect.sourceActorId, rulesId: effect.sourceSpellId, label: effect.sourceSpellId },
    appliedAt: 0,
    appliedTurnKey: effect.appliedTurnKey,
    duration,
    repeatSave: effect.expiresAt === 'target-turn-end-save' && effect.saveAbility && effect.saveDc != null
      ? { ability: effect.saveAbility, dc: effect.saveDc, timing: 'target-turn-end', onSuccess: 'remove' }
      : undefined,
    stackingKey: `timed:${effect.id}`,
    stackingPolicy: 'refresh-duration',
    visibility: 'public',
    modifiers: effect.kind === 'speed-penalty'
      ? { speedPenaltyFeet: Math.max(0, effect.amount ?? 0) }
      : effect.kind === 'reaction-lock'
        ? { preventReactions: true }
        : undefined,
    legacyTimedEffectId: effect.id,
  }
}

export function migrateDnd5eTimedEffects(input: {
  targetId: string
  timedEffects?: readonly Dnd5eTimedEffect[]
  activeEffects?: unknown
}): Dnd5eActiveEffectInstance[] {
  const effects = normalizeDnd5eActiveEffects(input.activeEffects)
  if (input.timedEffects == null) return effects
  const withoutStaleMirrors = effects.filter((effect) => !effect.legacyTimedEffectId)
  for (const effect of input.timedEffects ?? []) {
    withoutStaleMirrors.push(activeEffectFromDnd5eTimedEffect(effect, input.targetId))
  }
  return withoutStaleMirrors
}

/** 将 v1 conditions/timedEffects 一次性升级为 v2；返回值不再携带旧字段。 */
export function migrateDnd5eCombatStateEffects(input: {
  targetId: string
  state?: LegacyDnd5eCombatStateEffectFields
  conditions?: readonly string[]
}): {
  schemaVersion: typeof DND5E_COMBAT_STATE_SCHEMA_VERSION
  activeEffects?: Dnd5eActiveEffectInstance[]
  conditions: string[]
} {
  const timedMigrated = migrateDnd5eTimedEffects({
    targetId: input.targetId,
    timedEffects: input.state?.timedEffects,
    activeEffects: input.state?.activeEffects,
  })
  const activeEffects = migrateLegacyDnd5eConditions({
    targetId: input.targetId,
    conditions: input.conditions ?? input.state?.conditions,
    activeEffects: timedMigrated,
  })
  return {
    schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
    activeEffects: activeEffects.length > 0 ? activeEffects : undefined,
    conditions: dnd5eConditionsFromActiveEffects(activeEffects),
  }
}
