import { dnd5eEquipmentHomingProjectileReached } from '../homingProjectilePath'
import { prepareDnd5eEquipmentAttack, dnd5ePreparedEquipmentActivityWeaponDamage, type PreparedDnd5eEquipmentAttack } from '../equipmentAttackAction'
import { planDnd5eMapResultApplication } from '../mapBridge'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { getRegisteredDnd5eActivity } from './dnd5eActivityRegistry'
import { resolveDnd5eActivityAreaMapSelectionV1 } from './dnd5eActivityMapInteraction'

/** Project all Host-selected occupants before resolving saves, including creatures without turns. */
export function prepareDnd5eEquipmentAttackReplacement(input: {
  attack: Parameters<typeof prepareDnd5eEquipmentAttack>[0]
  packageId: string
  activityId: string
  areaAimCell?: { col: number; row: number }
}) {
  const activity = getRegisteredDnd5eActivity(input.packageId, input.activityId)
  // Save-only equipment replacements are not attacks and cannot trigger the pre-attack teleport.
  if (input.attack.action.dnd5eWeaponAttackOptions?.attackActionTeleport)
    return { ok: false as const, reason: 'activity-equipment-attack-replacement-unavailable' }
  const actorToken = input.attack.map.tokens.find(token => token.id === input.attack.action.actorTokenId)
  if (!activity || !actorToken) return { ok: false as const, reason: 'activity-equipment-attack-replacement-unavailable' }
  const area = activity.target.kind === 'area' && input.areaAimCell
    ? resolveDnd5eActivityAreaMapSelectionV1({ activity, map: input.attack.map, actorToken,
      characters: input.attack.characters, anchorCell: input.areaAimCell }) : undefined
  if (activity.target.kind === 'area' && !area) return { ok: false as const, reason: 'activity-equipment-attack-area-unavailable' }
  const equipment = prepareDnd5eEquipmentAttack({ ...input.attack,
    ...((area && area.targetIds.length === 0) || activity.equipmentHomingProjectile ? { action: { ...input.attack.action, targetTokenId: actorToken.id },
      replacementAreaOriginOnly: true as const } : {}),
    additionalCreatureTokenIds: area?.targetIds ?? (activity.equipmentHomingProjectile
      ? [...new Set([input.attack.action.targetTokenId!, ...input.attack.additionalCreatureTokenIds ?? []])]
      : input.attack.additionalCreatureTokenIds) })
  if (equipment.ok && activity.equipmentHomingProjectile) {
    const reached = dnd5eEquipmentHomingProjectileReached({ state: equipment.prepared.state,
      actorId: actorToken.id, targetIds: [input.attack.action.targetTokenId!], profile: equipment.prepared.profile })
    if (reached == null) return { ok: false as const, reason: 'activity-homing-route-unavailable' }
    equipment.prepared.homingProjectileReached = reached
  }
  return equipment
}

/** Prepares one immutable map/character update; the caller owns the revision-checked commit. */
export function resolvePreparedDnd5eEquipmentAttackReplacement(input: {
  prepared: PreparedDnd5eEquipmentAttack
  /** Aim only; affected creatures are recomputed from the Host map. */
  areaAimCell?: { col: number; row: number }
  activity: Omit<Parameters<typeof resolveRegisteredDnd5eActivityInCombatV1>[0],
    'state' | 'equipmentAttackBudget' | 'equipmentWeaponDamage' | 'inventoryOwner' | 'inventoryRoster'>
}) {
  const { prepared } = input
  if (!prepared.countsTowardAttackAction || prepared.spendsBonusAction || !prepared.attackBudget || prepared.attackActionTeleport ||
    input.activity.command.actorId !== prepared.actorToken.id) {
    return { result: { ok: false as const, reason: 'activity-equipment-attack-replacement-unavailable' } }
  }
  const definition = getRegisteredDnd5eActivity(input.activity.command.packageId, input.activity.command.activityId)
  const area = definition?.target.kind === 'area' && input.areaAimCell
    ? resolveDnd5eActivityAreaMapSelectionV1({ activity: definition, map: prepared.map,
      actorToken: prepared.actorToken, characters: prepared.characters, anchorCell: input.areaAimCell })
    : undefined
  if (definition?.target.kind === 'area' && !area) {
    return { result: { ok: false as const, reason: 'activity-equipment-attack-area-unavailable' } }
  }
  const settled = resolveRegisteredDnd5eActivityInCombatV1({ ...input.activity,
    ...(area ? { command: { ...input.activity.command, targetIds: [...area.targetIds], areaPlacement: area.areaPlacement },
      areaTargetIds: area.targetIds, areaPlacementDistanceFeet: area.areaPlacementDistanceFeet } : {}),
    state: prepared.state, equipmentAttackBudget: prepared.attackBudget,
    equipmentWeaponDamage: dnd5ePreparedEquipmentActivityWeaponDamage(prepared),
    inventoryOwner: prepared.actor, inventoryRoster: prepared.characters,
  })
  const result = settled.result
  if (!result.ok) return { result }
  const characters = result.inventoryOwner
    ? prepared.characters.map(character => character.id === prepared.actor.id ? result.inventoryOwner! : character)
    : prepared.characters
  const application = planDnd5eMapResultApplication({ state: result.state, map: prepared.map,
    characters, baselineCharacters: prepared.characters,
    characterIdByCombatantId: prepared.characterIdByCombatantId, events: [...result.events],
  })
  const attackSlot = result.equipmentAttackSlot ? {
    ...result.equipmentAttackSlot, attackNumber: prepared.attackNumber,
  } : undefined
  return { result: { ...result, equipmentAttackSlot: attackSlot }, application, attackSlot }
}
