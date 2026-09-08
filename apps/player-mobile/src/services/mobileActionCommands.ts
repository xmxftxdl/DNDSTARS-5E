import type { Dnd5eTraversalMode } from '../../../../src/rulesets/dnd5e/traversal'
import type { Dnd5eWeaponAttackOptions } from '../../../../src/lib/sharedCombatTypes'

export interface MobileMovementIntent {
  traversalMode: Dnd5eTraversalMode
  targetElevationFeet?: number
  carefulMovement?: boolean
  standFromProne?: boolean
}

export function mobileItemUseCommand(input: {
  instanceId: string
  useActionId: string
  targetTokenId?: string
  targetCell?: { col: number; row: number }
  spellSlotLevel?: number
}): Record<string, unknown> {
  return {
    type: 'dnd5e-item-use',
    dnd5eItemUse: {
      instanceId: input.instanceId,
      useActionId: input.useActionId,
      ...(input.targetTokenId ? { targetTokenId: input.targetTokenId } : {}),
      ...(input.targetCell ? { targetCell: input.targetCell } : {}),
      ...(input.spellSlotLevel ? { spellSlotLevel: input.spellSlotLevel } : {}),
    },
  }
}

export function mobileWeaponAttackCommand(
  base: Record<string, unknown>,
  requested: Dnd5eWeaponAttackOptions,
): Record<string, unknown> {
  const declared = base.dnd5eWeaponAttackOptions && typeof base.dnd5eWeaponAttackOptions === 'object'
    ? base.dnd5eWeaponAttackOptions as Dnd5eWeaponAttackOptions
    : {}
  const options = { ...declared, ...requested }
  return {
    ...base,
    ...(Object.keys(options).length ? { dnd5eWeaponAttackOptions: options } : {}),
  }
}

export function mobileCombatMoveCommand(
  targetPosition: { x: number; y: number },
  expectedActorElevationFeet: number,
  intent: MobileMovementIntent,
): Record<string, unknown> {
  const targetElevationFeet = Number.isFinite(intent.targetElevationFeet)
    ? Math.max(-1_000, Math.min(10_000, Math.round(intent.targetElevationFeet!)))
    : expectedActorElevationFeet
  return {
    type: 'move-token',
    targetPosition,
    dnd5eTraversalMode: intent.traversalMode,
    targetElevationFeet,
    ...(intent.carefulMovement ? { dnd5eCarefulMovement: true } : {}),
    ...(intent.standFromProne === false ? { dnd5eStandFromProne: false } : {}),
  }
}
