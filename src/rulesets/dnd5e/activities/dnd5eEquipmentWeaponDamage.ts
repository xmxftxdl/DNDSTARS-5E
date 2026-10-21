import type { Dnd5eWeaponAttackProfile, Dnd5eWeaponDamageSource } from '../equipment'
import { DND5E_DAMAGE_TYPES } from '../damageTypes'
import type { Dnd5eFormulaV1 } from './dnd5eFormula'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

/** Host-only evidence. Never populate this from an Activity command or player payload. */
export interface Dnd5eEquipmentWeaponDamageSnapshot {
  /** Computed by Host route authority, never copied from a command. */
  homingReached?: boolean
  profile: Dnd5eWeaponAttackProfile
  source: Dnd5eWeaponDamageSource
}

export function materializeDnd5eEquipmentWeaponDamage(activity: Dnd5eActivityDefinitionV1,
  snapshot?: Dnd5eEquipmentWeaponDamageSnapshot): Dnd5eActivityDefinitionV1 {
  if (!activity.outcomes.some(outcome => outcome.operations.some(op => op.kind === 'damage' && op.equipmentWeaponDamage))) return activity
  const damage = snapshot?.profile.damage
  if (!snapshot || !damage || !Number.isSafeInteger(damage.count) || damage.count < 1 || damage.count > 1000 ||
    !Number.isSafeInteger(damage.sides) || damage.sides < 2 || damage.sides > 10000 ||
    !Number.isSafeInteger(damage.bonus) || !DND5E_DAMAGE_TYPES.includes(damage.type)) throw Error('activity-equipment-weapon-unavailable')
  if (activity.outcomes.some(outcome => outcome.operations.some(op => op.kind === 'damage' && op.equipmentWeaponDamage &&
    !op.equipmentWeaponDamage.weaponBaseIds.includes(snapshot.profile.baseWeaponId)))) throw Error('activity-equipment-weapon-ineligible')
  if (activity.equipmentHomingProjectile) {
    if (typeof snapshot.homingReached !== 'boolean') throw Error('activity-homing-route-unavailable')
    if (!snapshot.homingReached) return { ...activity, checks: [], outcomes: [] }
  }
  return { ...activity, outcomes: activity.outcomes.map(outcome => ({ ...outcome,
    operations: outcome.operations.map(op => {
      if (op.kind !== 'damage' || !op.equipmentWeaponDamage) return op
      if (!op.equipmentWeaponDamage.weaponBaseIds.includes(snapshot.profile.baseWeaponId)) throw Error('activity-equipment-weapon-ineligible')
      const { equipmentWeaponDamage, ...ordinary } = op
      const total: Dnd5eFormulaV1 = { kind: 'add', values: [
        { kind: 'dice', rollId: equipmentWeaponDamage.rollId, count: damage.count, sides: damage.sides },
        { kind: 'constant', value: damage.bonus }, ordinary.amount,
      ] }
      return { ...ordinary, damageType: damage.type, magical: op.magical ?? snapshot.source.magical,
        amount: equipmentWeaponDamage.multiplier === 0.5
          ? { kind: 'floor' as const, value: { kind: 'multiply' as const, values: [total, { kind: 'constant' as const, value: 0.5 }] } }
          : total }

    }),
  })) }
}
