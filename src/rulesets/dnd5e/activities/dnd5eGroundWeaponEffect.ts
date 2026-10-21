import type { Dnd5eEffectDefinitionV1 } from './dnd5eEffectContracts'
import { evaluateDnd5eFormulaV1, type Dnd5eFormulaEvaluationContext } from './dnd5eFormula'
import type { Dnd5eActiveEffectInstance, Dnd5eActiveEffectModifiers } from '../activeEffects'
import type { Dnd5eInventoryEntry } from '../../../types/inventory'
import { dnd5eWeaponDamageSource } from '../equipment'

export interface Dnd5eResolvedGroundWeaponEffect {
  effectId: string
  label: string
  maximumRounds: number
  requiresNonmagical: boolean
  modifiers: Dnd5eActiveEffectModifiers
}

/** A physical object has no creature statistics. Unsupported effect mechanics fail explicitly. */
export function resolveDnd5eGroundWeaponEffect(
  effect: Dnd5eEffectDefinitionV1,
  context: Omit<Dnd5eFormulaEvaluationContext, 'target'>,
): Dnd5eResolvedGroundWeaponEffect {
  const allowed = new Set(['schemaVersion', 'id', 'name', 'magical', 'disposition', 'duration', 'concentration', 'stacking', 'modifiers'])
  if (Object.keys(effect).some(key => !allowed.has(key)) || effect.duration.kind !== 'concentration' ||
      !effect.modifiers?.length || effect.modifiers.some(modifier =>
        modifier.kind !== 'weapon-enchantment' && modifier.kind !== 'emitted-light')) {
    throw new Error('unsupported-ground-weapon-effect')
  }
  const weapons = effect.modifiers.filter(modifier => modifier.kind === 'weapon-enchantment')
  if (weapons.length !== 1) throw new Error('ground-weapon-effect-requires-one-binding')
  const weapon = weapons[0]
  if (weapon.weaponSlot !== 'inventory-item' || weapon.attackUses || weapon.consumeOnDraw || weapon.spellcastingFocusClassIds) {
    throw new Error('unsupported-ground-weapon-binding')
  }
  const bonus = evaluateDnd5eFormulaV1(weapon.attackAndDamageBonus, { ...context, target: undefined })
  if (!Number.isInteger(bonus) || bonus < 0 || bonus > 3) throw new Error('invalid-ground-weapon-bonus')
  const lights = effect.modifiers.filter(modifier => modifier.kind === 'emitted-light')
  if (lights.length > 1) throw new Error('ambiguous-ground-weapon-light')
  return {
    effectId: effect.id, label: effect.name, maximumRounds: effect.duration.maximumRounds,
    requiresNonmagical: weapon.requiresNonmagical === true,
    modifiers: {
      weaponEnchantment: { weaponId: '', attackAndDamageBonus: bonus as 0 | 1 | 2 | 3,
        bonusDamage: weapon.bonusDamage ? { ...weapon.bonusDamage } : undefined },
      emittedLight: lights[0] ? { brightRadiusFeet: lights[0].brightRadiusFeet,
        dimRadiusFeet: lights[0].dimRadiusFeet, color: lights[0].color } : undefined,
    },
  }
}

export function bindDnd5eResolvedGroundWeaponEffect(input: {
  resolved: Dnd5eResolvedGroundWeaponEffect
  entry: Dnd5eInventoryEntry
  source: Dnd5eActiveEffectInstance['source']
  actionId: string
  appliedAt: number
  round: number
}): Dnd5eActiveEffectInstance {
  const equipment = input.entry.item.equipment
  if (equipment?.dnd5e?.kind !== 'weapon' || !input.source.actorId || !input.source.rulesId) throw new Error('invalid-ground-weapon-source')
  if (input.resolved.requiresNonmagical && (input.entry.item.magicItem ||
      input.entry.item.category === 'magic-item' || dnd5eWeaponDamageSource(equipment)?.magical)) throw new Error('ground-weapon-must-be-nonmagical')
  const definitionId = `activity:${input.source.rulesId}:${input.resolved.effectId}:modifiers:0`
  return {
    schemaVersion: 1, id: `${input.actionId}:${input.resolved.effectId}`, definitionId,
    label: input.resolved.label, kind: 'buff', source: { ...input.source },
    appliedAt: input.appliedAt, appliedRound: input.round,
    duration: { type: 'concentration', sourceActorId: input.source.actorId,
      concentrationId: input.source.rulesId, remainingRounds: input.resolved.maximumRounds },
    stackingKey: `${definitionId}:${input.source.actorId}`, stackingPolicy: 'replace',
    modifiers: { ...structuredClone(input.resolved.modifiers), weaponEnchantment: {
      ...input.resolved.modifiers.weaponEnchantment!, weaponId: equipment.id,
      inventoryInstanceId: input.entry.instanceId,
    } },
  }
}
