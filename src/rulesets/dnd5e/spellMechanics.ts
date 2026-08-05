import type { AbilityKey } from '../../lib/dnd'
import { DND5E_DAMAGE_TYPES, type Dnd5eDamageType } from './damageTypes'
import {
  DND5E_STANDARD_CONDITION_IDS,
  type Dnd5eStandardConditionId,
} from './conditions'

export type Dnd5eSpellResolutionKind = 'spell-attack' | 'saving-throw' | 'automatic' | 'dm-adjudication'
export type Dnd5eSpellConditionTrigger = 'on-hit' | 'on-failed-save' | 'always'

export type Dnd5eSpellConditionDuration =
  | { kind: 'source-next-turn-start' }
  | { kind: 'target-next-turn-start' }
  | {
      kind: 'save-ends'
      timing: 'target-turn-end'
      maximumRounds: number
      saveAbility: AbilityKey
    }
  | { kind: 'fixed-rounds'; rounds: number }
  | { kind: 'concentration' }

export interface Dnd5eSpellConditionEffectDefinition {
  condition: Dnd5eStandardConditionId
  trigger: Dnd5eSpellConditionTrigger
  duration: Dnd5eSpellConditionDuration
}

export type Dnd5eSpellUpcastEffect =
  | { kind: 'damage-dice'; diceCountPerSlot: number }
  | { kind: 'flat-damage'; amountPerSlot: number }
  | { kind: 'additional-targets'; countPerSlot: number }
  | { kind: 'additional-projectiles'; countPerSlot: number }
  | { kind: 'duration-rounds'; roundsPerSlot: number }

export interface Dnd5eCantripScalingStep {
  level: number
  /** Extra copies of the primary damage die added at this threshold. */
  diceCount: number
  /** Optional flat damage added at this threshold. */
  flatDamage?: number
}

export interface Dnd5eCantripScalingDefinition {
  basis: 'character-level'
  steps: Dnd5eCantripScalingStep[]
}

export interface Dnd5eSpellMechanicsDefinition {
  kind: 'damage' | 'healing' | 'control' | 'utility'
  resolution: Dnd5eSpellResolutionKind
  savingThrow?: {
    ability: AbilityKey
    onSuccess: 'none' | 'half' | 'full'
  }
  damage?: {
    dice: { count: number; sides: number; bonus: number }
    type: Dnd5eDamageType
    addSpellcastingModifier?: boolean
    /** `true` preserves the legacy 5/11/17 multiplier; new content uses an explicit threshold table. */
    cantripScaling?: boolean | Dnd5eCantripScalingDefinition
  }
  conditions?: Dnd5eSpellConditionEffectDefinition[]
  upcast?: {
    fromSlotLevel: number
    effects: Dnd5eSpellUpcastEffect[]
  }
}

export interface Dnd5eSpellUpcastTotals {
  slotDelta: number
  damageDice: number
  flatDamage: number
  additionalTargets: number
  additionalProjectiles: number
  durationRounds: number
}

export interface Dnd5eCantripScalingTotals {
  damageDice: number
  flatDamage: number
}

/** Shared workshop preview/Host calculation for explicit cantrip level thresholds. */
export function dnd5eSpellCantripScalingTotals(
  damage: Dnd5eSpellMechanicsDefinition['damage'] | undefined,
  characterLevel: number,
): Dnd5eCantripScalingTotals {
  const scaling = damage?.cantripScaling
  if (!damage || !scaling) return { damageDice: 0, flatDamage: 0 }
  if (scaling === true) {
    const thresholds = characterLevel >= 17 ? 3 : characterLevel >= 11 ? 2 : characterLevel >= 5 ? 1 : 0
    return { damageDice: damage.dice.count * thresholds, flatDamage: 0 }
  }
  return scaling.steps.reduce<Dnd5eCantripScalingTotals>((totals, step) => {
    if (characterLevel >= step.level) {
      totals.damageDice += step.diceCount
      totals.flatDamage += step.flatDamage ?? 0
    }
    return totals
  }, { damageDice: 0, flatDamage: 0 })
}

/** Shared preview/Host calculation for every structured higher-slot effect. */
export function dnd5eSpellUpcastTotals(
  mechanics: Pick<Dnd5eSpellMechanicsDefinition, 'upcast'> | undefined,
  slotLevel: number,
  fallbackBaseLevel = 0,
): Dnd5eSpellUpcastTotals {
  const fromSlotLevel = mechanics?.upcast?.fromSlotLevel ?? fallbackBaseLevel
  const slotDelta = Math.max(0, Math.floor(slotLevel) - fromSlotLevel)
  const totals: Dnd5eSpellUpcastTotals = {
    slotDelta,
    damageDice: 0,
    flatDamage: 0,
    additionalTargets: 0,
    additionalProjectiles: 0,
    durationRounds: 0,
  }
  for (const effect of mechanics?.upcast?.effects ?? []) {
    if (effect.kind === 'damage-dice') totals.damageDice += effect.diceCountPerSlot * slotDelta
    else if (effect.kind === 'flat-damage') totals.flatDamage += effect.amountPerSlot * slotDelta
    else if (effect.kind === 'additional-targets') totals.additionalTargets += effect.countPerSlot * slotDelta
    else if (effect.kind === 'additional-projectiles') totals.additionalProjectiles += effect.countPerSlot * slotDelta
    else totals.durationRounds += effect.roundsPerSlot * slotDelta
  }
  return totals
}

const ABILITIES = new Set<AbilityKey>(['str', 'dex', 'con', 'int', 'wis', 'cha'])
const DAMAGE_TYPES = new Set<string>(DND5E_DAMAGE_TYPES)
const CONDITIONS = new Set<string>(DND5E_STANDARD_CONDITION_IDS)
const RESOLUTIONS = new Set<Dnd5eSpellResolutionKind>(['spell-attack', 'saving-throw', 'automatic', 'dm-adjudication'])

function objectValue(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function boundedInteger(
  value: unknown,
  label: string,
  problems: string[],
  minimum: number,
  maximum: number,
): number {
  const number = Number(value)
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    problems.push(`${label}必须是 ${minimum} 到 ${maximum} 之间的整数`)
    return minimum
  }
  return number
}

/** 供房间 JSON 与 Worker 插件共同使用的纯数据法术机械字段校验器。 */
export function parseDnd5eSpellMechanics(
  value: unknown,
  label: string,
  problems: string[],
): Dnd5eSpellMechanicsDefinition | undefined {
  if (value == null) return undefined
  if (!objectValue(value)) {
    problems.push(`${label}必须是对象`)
    return undefined
  }
  const kind = typeof value.kind === 'string' && ['damage', 'healing', 'control', 'utility'].includes(value.kind)
    ? value.kind as Dnd5eSpellMechanicsDefinition['kind']
    : undefined
  if (!kind) problems.push(`${label}.kind 无效`)
  const resolution = typeof value.resolution === 'string' && RESOLUTIONS.has(value.resolution as Dnd5eSpellResolutionKind)
    ? value.resolution as Dnd5eSpellResolutionKind
    : undefined
  if (!resolution) problems.push(`${label}.resolution 无效`)

  let savingThrow: Dnd5eSpellMechanicsDefinition['savingThrow']
  if (value.savingThrow != null) {
    if (!objectValue(value.savingThrow)) problems.push(`${label}.savingThrow 必须是对象`)
    else {
      const ability = typeof value.savingThrow.ability === 'string' && ABILITIES.has(value.savingThrow.ability as AbilityKey)
        ? value.savingThrow.ability as AbilityKey
        : undefined
      const onSuccess = typeof value.savingThrow.onSuccess === 'string' && ['none', 'half', 'full'].includes(value.savingThrow.onSuccess)
        ? value.savingThrow.onSuccess as 'none' | 'half' | 'full'
        : undefined
      if (!ability) problems.push(`${label}.savingThrow.ability 无效`)
      if (!onSuccess) problems.push(`${label}.savingThrow.onSuccess 无效`)
      if (ability && onSuccess) savingThrow = { ability, onSuccess }
    }
  }
  if (resolution === 'saving-throw' && !savingThrow) problems.push(`${label}使用 saving-throw 时必须填写 savingThrow`)

  let damage: Dnd5eSpellMechanicsDefinition['damage']
  if (value.damage != null) {
    if (!objectValue(value.damage)) problems.push(`${label}.damage 必须是对象`)
    else {
      const diceInput = objectValue(value.damage.dice) ? value.damage.dice : {}
      if (!objectValue(value.damage.dice)) problems.push(`${label}.damage.dice 必须是对象`)
      const count = boundedInteger(diceInput.count, `${label}.damage.dice.count`, problems, 0, 100)
      const sides = boundedInteger(diceInput.sides, `${label}.damage.dice.sides`, problems, 2, 1_000)
      const bonus = boundedInteger(diceInput.bonus, `${label}.damage.dice.bonus`, problems, -1_000_000, 1_000_000)
      const damageType = typeof value.damage.type === 'string' && DAMAGE_TYPES.has(value.damage.type)
        ? value.damage.type as Dnd5eDamageType
        : undefined
      if (!damageType) problems.push(`${label}.damage.type 无效`)
      const addSpellcastingModifier = value.damage.addSpellcastingModifier === true
      let cantripScaling: boolean | Dnd5eCantripScalingDefinition | undefined
      if (value.damage.addSpellcastingModifier != null && typeof value.damage.addSpellcastingModifier !== 'boolean') {
        problems.push(`${label}.damage.addSpellcastingModifier 必须是布尔值`)
      }
      if (value.damage.cantripScaling === true) {
        cantripScaling = true
      } else if (value.damage.cantripScaling != null && value.damage.cantripScaling !== false) {
        if (!objectValue(value.damage.cantripScaling) || value.damage.cantripScaling.basis !== 'character-level' || !Array.isArray(value.damage.cantripScaling.steps)) {
          problems.push(`${label}.damage.cantripScaling 必须是布尔值或 character-level 缩放表`)
        } else {
          const seenLevels = new Set<number>()
          const steps = value.damage.cantripScaling.steps.slice(0, 20).flatMap((entry, index): Dnd5eCantripScalingStep[] => {
            const stepLabel = `${label}.damage.cantripScaling.steps[${index}]`
            if (!objectValue(entry)) {
              problems.push(`${stepLabel}必须是对象`)
              return []
            }
            const level = boundedInteger(entry.level, `${stepLabel}.level`, problems, 2, 20)
            const diceCount = boundedInteger(entry.diceCount, `${stepLabel}.diceCount`, problems, 0, 100)
            const flatDamage = entry.flatDamage == null
              ? 0
              : boundedInteger(entry.flatDamage, `${stepLabel}.flatDamage`, problems, 0, 1_000_000)
            if (seenLevels.has(level)) problems.push(`${stepLabel}.level 不能重复`)
            seenLevels.add(level)
            if (diceCount === 0 && flatDamage === 0) problems.push(`${stepLabel}必须增加伤害骰或固定伤害`)
            return [{ level, diceCount, ...(flatDamage > 0 ? { flatDamage } : {}) }]
          }).sort((left, right) => left.level - right.level)
          if (steps.length === 0) problems.push(`${label}.damage.cantripScaling.steps 不能为空`)
          cantripScaling = { basis: 'character-level', steps }
        }
      }
      if (damageType) damage = {
        dice: { count, sides, bonus }, type: damageType,
        ...(addSpellcastingModifier ? { addSpellcastingModifier: true } : {}),
        ...(cantripScaling ? { cantripScaling } : {}),
      }
    }
  }
  if (kind === 'damage' && !damage) problems.push(`${label}.kind 为 damage 时必须填写 damage`)

  let conditions: Dnd5eSpellConditionEffectDefinition[] | undefined
  if (value.conditions != null) {
    if (!Array.isArray(value.conditions)) problems.push(`${label}.conditions 必须是数组`)
    else {
      conditions = value.conditions.slice(0, 20).flatMap((entry, index) => {
        const conditionLabel = `${label}.conditions[${index}]`
        if (!objectValue(entry)) {
          problems.push(`${conditionLabel}必须是对象`)
          return []
        }
        const condition = typeof entry.condition === 'string' && CONDITIONS.has(entry.condition)
          ? entry.condition as Dnd5eStandardConditionId
          : undefined
        const trigger = typeof entry.trigger === 'string' && ['on-hit', 'on-failed-save', 'always'].includes(entry.trigger)
          ? entry.trigger as Dnd5eSpellConditionTrigger
          : undefined
        if (!condition) problems.push(`${conditionLabel}.condition 不是标准状态 ID`)
        if (!trigger) problems.push(`${conditionLabel}.trigger 无效`)
        if (!objectValue(entry.duration)) {
          problems.push(`${conditionLabel}.duration 必须是对象`)
          return []
        }
        const durationKind = entry.duration.kind
        let duration: Dnd5eSpellConditionDuration | undefined
        if (durationKind === 'source-next-turn-start' || durationKind === 'target-next-turn-start' || durationKind === 'concentration') {
          duration = { kind: durationKind }
        } else if (durationKind === 'fixed-rounds') {
          duration = { kind: durationKind, rounds: boundedInteger(entry.duration.rounds, `${conditionLabel}.duration.rounds`, problems, 1, 10_000) }
        } else if (durationKind === 'save-ends') {
          const ability = typeof entry.duration.saveAbility === 'string' && ABILITIES.has(entry.duration.saveAbility as AbilityKey)
            ? entry.duration.saveAbility as AbilityKey
            : undefined
          if (entry.duration.timing !== 'target-turn-end') problems.push(`${conditionLabel}.duration.timing 必须是 target-turn-end`)
          if (!ability) problems.push(`${conditionLabel}.duration.saveAbility 无效`)
          if (ability) duration = {
            kind: durationKind,
            timing: 'target-turn-end',
            maximumRounds: boundedInteger(entry.duration.maximumRounds, `${conditionLabel}.duration.maximumRounds`, problems, 1, 10_000),
            saveAbility: ability,
          }
        } else problems.push(`${conditionLabel}.duration.kind 无效`)
        return condition && trigger && duration ? [{ condition, trigger, duration }] : []
      })
    }
  }

  let upcast: Dnd5eSpellMechanicsDefinition['upcast']
  if (value.upcast != null) {
    if (!objectValue(value.upcast) || !Array.isArray(value.upcast.effects)) problems.push(`${label}.upcast 必须包含 effects 数组`)
    else {
      const effects = value.upcast.effects.slice(0, 20).flatMap((entry, index): Dnd5eSpellUpcastEffect[] => {
        const effectLabel = `${label}.upcast.effects[${index}]`
        if (!objectValue(entry) || typeof entry.kind !== 'string') {
          problems.push(`${effectLabel}无效`)
          return []
        }
        if (entry.kind === 'damage-dice') return [{ kind: entry.kind, diceCountPerSlot: boundedInteger(entry.diceCountPerSlot, `${effectLabel}.diceCountPerSlot`, problems, 1, 100) }]
        if (entry.kind === 'flat-damage') return [{ kind: entry.kind, amountPerSlot: boundedInteger(entry.amountPerSlot, `${effectLabel}.amountPerSlot`, problems, 1, 1_000_000) }]
        if (entry.kind === 'additional-targets') return [{ kind: entry.kind, countPerSlot: boundedInteger(entry.countPerSlot, `${effectLabel}.countPerSlot`, problems, 1, 100) }]
        if (entry.kind === 'additional-projectiles') return [{ kind: entry.kind, countPerSlot: boundedInteger(entry.countPerSlot, `${effectLabel}.countPerSlot`, problems, 1, 100) }]
        if (entry.kind === 'duration-rounds') return [{ kind: entry.kind, roundsPerSlot: boundedInteger(entry.roundsPerSlot, `${effectLabel}.roundsPerSlot`, problems, 1, 10_000) }]
        problems.push(`${effectLabel}.kind 无效`)
        return []
      })
      if (effects.length === 0) problems.push(`${label}.upcast.effects 不能为空`)
      upcast = {
        fromSlotLevel: boundedInteger(value.upcast.fromSlotLevel, `${label}.upcast.fromSlotLevel`, problems, 1, 9),
        effects,
      }
    }
  }

  if (!kind || !resolution) return undefined
  return {
    kind,
    resolution,
    ...(savingThrow ? { savingThrow } : {}),
    ...(damage ? { damage } : {}),
    ...(conditions?.length ? { conditions } : {}),
    ...(upcast ? { upcast } : {}),
  }
}
