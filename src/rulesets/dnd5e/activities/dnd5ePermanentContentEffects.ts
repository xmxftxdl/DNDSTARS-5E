import type { AbilityKey } from '../../../lib/dnd'
import type {
  Dnd5ePluginRacialSavingThrowAdvantages,
  Dnd5ePluginStaticCombatModifiers,
} from '../pluginApi'
import type { Dnd5ePluginFeaturePassiveEffect } from '../pluginFeaturePassiveEffectProtocol'
import type { Dnd5eEffectDefinitionV1 } from './dnd5eEffectContracts'

export interface Dnd5ePermanentContentEffectProjectionV1 {
  staticModifiers?: Dnd5ePluginStaticCombatModifiers
  passiveEffects?: readonly Dnd5ePluginFeaturePassiveEffect[]
  racialSavingThrowAdvantages?: Dnd5ePluginRacialSavingThrowAdvantages
  naturalOneReroll?: boolean
}

function constantValue(value: unknown): number | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const formula = value as { kind?: unknown; value?: unknown }
  return formula.kind === 'constant' && typeof formula.value === 'number' && Number.isFinite(formula.value)
    ? formula.value
    : undefined
}

function appendUnique<T>(values: T[] | undefined, value: T): T[] {
  return values?.includes(value) ? values : [...(values ?? []), value]
}

/**
 * Converts permanent, validated Effect data into the immutable character
 * snapshot fields used by the current Headless engine. This is a runtime view
 * of Unified Content; it never reads the legacy feature/race payload fields.
 */
export function dnd5ePermanentContentEffectProjectionV1(
  effects: readonly Dnd5eEffectDefinitionV1[] | undefined,
): Dnd5ePermanentContentEffectProjectionV1 {
  const staticModifiers: Record<string, unknown> = {}
  const passiveEffects: Dnd5ePluginFeaturePassiveEffect[] = []
  const racialConditions: string[] = []
  const racialDamageTypes: NonNullable<Dnd5ePluginRacialSavingThrowAdvantages['damageTypes']>[number][] = []
  const racialMagicAbilities: AbilityKey[] = []
  let naturalOneReroll = false

  for (const effect of effects ?? []) {
    if (effect.duration.kind !== 'permanent') continue
    for (const modifier of effect.modifiers ?? []) {
      if (modifier.kind === 'armor-class' && modifier.mode === 'add') {
        const value = constantValue(modifier.value)
        if (value != null) staticModifiers.armorClassBonus = Number(staticModifiers.armorClassBonus ?? 0) + value
      } else if (modifier.kind === 'speed' && modifier.mode === 'add') {
        const value = constantValue(modifier.value)
        if (value != null) staticModifiers.speedBonusFeet = Number(staticModifiers.speedBonusFeet ?? 0) + value
      } else if (modifier.kind === 'saving-throw' && modifier.mode === 'add' && !modifier.ability && modifier.value) {
        const value = constantValue(modifier.value)
        if (value != null) staticModifiers.savingThrowBonus = Number(staticModifiers.savingThrowBonus ?? 0) + value
      } else if (modifier.kind === 'darkvision') {
        staticModifiers.darkvisionRangeFeet = Math.max(Number(staticModifiers.darkvisionRangeFeet ?? 0), modifier.rangeFeet)
      } else if (modifier.kind === 'damage-resistance') {
        staticModifiers.damageResistances = appendUnique(
          staticModifiers.damageResistances as typeof modifier.damageType[] | undefined,
          modifier.damageType,
        )
      } else if (modifier.kind === 'damage-immunity') {
        staticModifiers.damageImmunities = appendUnique(
          staticModifiers.damageImmunities as typeof modifier.damageType[] | undefined,
          modifier.damageType,
        )
      } else if (modifier.kind === 'condition-immunity') {
        staticModifiers.conditionImmunities = appendUnique(
          staticModifiers.conditionImmunities as string[] | undefined,
          modifier.condition,
        )
      } else if (modifier.kind === 'character-capability') {
        if (modifier.capability === 'naturalOneReroll') naturalOneReroll = modifier.value === true
        else staticModifiers[modifier.capability] = Array.isArray(modifier.value)
          ? [...modifier.value]
          : modifier.value
      } else if (modifier.kind === 'racial-saving-throw-advantage') {
        for (const condition of modifier.conditions ?? []) {
          if (!racialConditions.includes(condition)) racialConditions.push(condition)
        }
        for (const damageType of modifier.damageTypes ?? []) {
          if (!racialDamageTypes.includes(damageType)) racialDamageTypes.push(damageType)
        }
        for (const ability of modifier.magicAbilities ?? []) {
          if (!racialMagicAbilities.includes(ability)) racialMagicAbilities.push(ability)
        }
      } else if (modifier.kind === 'damage-reduction') {
        const amount = constantValue(modifier.amount)
        if (amount == null || amount < 1) continue
        const trigger = effect.triggers?.find((entry) => entry.effectId === effect.id && entry.event === 'before-damage')
        if (!trigger) continue
        passiveEffects.push({
          schemaVersion: 1,
          id: effect.id.split('.passive.').at(-1) ?? effect.id,
          kind: 'damage-reduction',
          trigger: 'before-damage',
          amount: Math.floor(amount),
          damageTypes: modifier.damageTypes ? [...modifier.damageTypes] : undefined,
          deliveries: modifier.deliveries ? [...modifier.deliveries] : undefined,
          magical: modifier.magical,
          requiresHeavyArmor: modifier.requiresHeavyArmor,
          minimumIncomingDamage: modifier.minimumIncomingDamage,
          maximumCurrentHitPointPercent: modifier.maximumCurrentHitPointPercent,
          oncePerTurn: modifier.oncePerTurn,
        })
      }
    }
  }

  const racialSavingThrowAdvantages = racialConditions.length || racialDamageTypes.length || racialMagicAbilities.length
    ? {
        ...(racialConditions.length ? { conditions: racialConditions } : {}),
        ...(racialDamageTypes.length ? { damageTypes: racialDamageTypes } : {}),
        ...(racialMagicAbilities.length ? { magicAbilities: racialMagicAbilities } : {}),
      }
    : undefined
  return {
    staticModifiers: Object.keys(staticModifiers).length
      ? staticModifiers as Dnd5ePluginStaticCombatModifiers
      : undefined,
    passiveEffects: passiveEffects.length ? passiveEffects : undefined,
    racialSavingThrowAdvantages,
    naturalOneReroll: naturalOneReroll || undefined,
  }
}
