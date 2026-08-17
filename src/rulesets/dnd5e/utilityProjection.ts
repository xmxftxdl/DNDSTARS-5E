import {
  DND_FEET_PER_CELL,
  cellDistance,
  tokenCenterForAnchorCell,
  tokenOccupiedCellsAt,
} from '../../lib/gridCombat'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import type {
  Dnd5eCombatant,
  Dnd5eHeadlessCombatState,
} from './headlessCombatEngine'
import { dnd5eCombatantClassLevel, dnd5eCombatantPairKey } from './headlessCombatPrimitives'
import {
  dnd5eCharacterHasPluginFeature,
  dnd5ePluginFeatureDefinition,
  registeredDnd5ePluginFeatures,
} from './pluginApi'
import { dnd5eUtilityProjectionDistanceKey } from './utilityProjectionState'

function combatantOwnsFeature(
  actor: Dnd5eCombatant,
  featureId: string,
  requireFullAutomation: boolean,
): boolean {
  const feature = dnd5ePluginFeatureDefinition(featureId)
  if (
    !feature ||
    (requireFullAutomation
      ? feature.automation !== 'full'
      : feature.automation === 'manual') ||
    !actor.pluginFeatureIds.includes(featureId)
  ) return false
  if (
    feature.sourceClassId &&
    dnd5eCombatantClassLevel(actor, feature.sourceClassId) <
      (feature.minimumLevel ?? feature.declarativeAbility?.level ?? 1)
  ) return false
  if (
    feature.sourceClassId &&
    feature.sourceSubclassId &&
    actor.subclassIds?.[feature.sourceClassId] !== feature.sourceSubclassId
  ) return false
  return true
}

export interface Dnd5eSpellOriginProjection {
  areaId: string
  projectionId: string
  label: string
  cell: { col: number; row: number }
  position: { x: number; y: number }
}

/**
 * Returns only Host-declared persistent projections that the character owns
 * and whose imported mechanic explicitly allows spell origination. Saved
 * areas never become a spell origin merely by copying a projection id.
 */
export function dnd5eSpellOriginProjectionsForCharacter(
  character: Character,
  map: BattleMap,
): readonly Dnd5eSpellOriginProjection[] {
  const allowedProjectionIds = new Set(
    registeredDnd5ePluginFeatures().flatMap((feature) => {
      const mechanic = feature.declarativeAbility?.mechanic
      if (
        feature.automation !== 'full' ||
        mechanic?.kind !== 'persistent-projection' ||
        mechanic.spellOrigin !== true ||
        !dnd5eCharacterHasPluginFeature(character, feature.id)
      ) return []
      return [mechanic.projectionId]
    }),
  )
  if (allowedProjectionIds.size === 0) return []
  return (map.dnd5ePluginAreas ?? []).flatMap((area) => {
    const projectionId = area.utilityProjectionId
    const cell = area.anchorCell ?? area.cells[0]
    if (
      !projectionId || !cell ||
      area.sourceCharacterId !== character.id ||
      !allowedProjectionIds.has(projectionId)
    ) return []
    return [{
      areaId: area.id,
      projectionId,
      label: area.label,
      cell: { ...cell },
      position: tokenCenterForAnchorCell(cell, { size: 1 }, map),
    }]
  })
}

export function dnd5eSpellOriginProjectionForCharacter(input: {
  character: Character
  map: BattleMap
  areaId: string | undefined
}): Dnd5eSpellOriginProjection | undefined {
  if (!input.areaId) return undefined
  return dnd5eSpellOriginProjectionsForCharacter(input.character, input.map)
    .find((projection) => projection.areaId === input.areaId)
}

export function dnd5eUtilityProjectionMovementEconomy(
  character: Character,
  projectionId: string,
  fallback: 'action' | 'bonus-action',
): 'action' | 'bonus-action' {
  const overrides = registeredDnd5ePluginFeatures().flatMap((feature) => {
    const mechanic = feature.declarativeAbility?.mechanic
    if (
      mechanic?.kind !== 'utility-projection-control' ||
      mechanic.projectionId !== projectionId ||
      feature.automation === 'manual' ||
      !dnd5eCharacterHasPluginFeature(character, feature.id)
    ) return []
    return [mechanic.economy === 'bonusAction'
      ? 'bonus-action' as const
      : 'action' as const]
  })
  return overrides.includes('bonus-action') ? 'bonus-action' : fallback
}

/** Resolves the largest Host-registered instance count for one projection family. */
export function dnd5eUtilityProjectionInstanceCount(
  actor: Dnd5eCombatant,
  projectionId: string,
  baseCount = 1,
): number {
  return registeredDnd5ePluginFeatures().reduce((maximum, feature) => {
    const mechanic = feature.declarativeAbility?.mechanic
    if (
      feature.automation !== 'full' ||
      !combatantOwnsFeature(actor, feature.id, true) ||
      (mechanic?.kind !== 'persistent-projection' &&
        mechanic?.kind !== 'persistent-projection-upgrade') ||
      mechanic.projectionId !== projectionId
    ) return maximum
    return Math.max(maximum, mechanic.instanceCount ?? 1)
  }, Math.max(1, Math.min(16, baseCount)))
}

export function dnd5eUtilityProjectionTargetDistanceFeet(input: {
  character: Character
  featureId: string
  map: BattleMap
  targetToken: Token
}): number | undefined {
  const feature = dnd5ePluginFeatureDefinition(input.featureId)
  const mechanic = feature?.declarativeAbility?.mechanic
  if (
    feature?.automation !== 'full' ||
    mechanic?.kind !== 'utility-projection-attack-advantage' ||
    !dnd5eCharacterHasPluginFeature(input.character, input.featureId)
  ) return undefined
  const targetCells = tokenOccupiedCellsAt(
    input.targetToken,
    input.map,
    input.targetToken,
  )
  const distances = (input.map.dnd5ePluginAreas ?? []).flatMap((area) => {
    if (
      (area.utilityProjectionId ?? area.coreSpellId) !== mechanic.projectionId ||
      area.sourceCharacterId !== input.character.id
    ) return []
    let minimum = Number.POSITIVE_INFINITY
    for (const projectionCell of area.cells) {
      for (const targetCell of targetCells) {
        minimum = Math.min(minimum, cellDistance(projectionCell, targetCell))
      }
    }
    return Number.isFinite(minimum)
      ? [minimum * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)]
      : []
  })
  return distances.length > 0 ? Math.min(...distances) : undefined
}

export function dnd5eUtilityProjectionDistanceFeet(
  state: Pick<Dnd5eHeadlessCombatState, 'utilityProjectionDistanceFeetByPair'>,
  sourceActorId: string,
  projectionId: string,
  targetId: string,
): number | undefined {
  return state.utilityProjectionDistanceFeetByPair?.[
    dnd5eUtilityProjectionDistanceKey(sourceActorId, projectionId, targetId)
  ]
}

export function dnd5eUtilityProjectionAttackAdvantageApplies(
  state: Dnd5eHeadlessCombatState,
  actor: Dnd5eCombatant,
  target: Dnd5eCombatant,
): boolean {
  const passiveProjectionAdvantage = registeredDnd5ePluginFeatures().some((feature) => {
    const mechanic = feature.declarativeAbility?.mechanic
    if (
      feature.automation !== 'full' || mechanic?.kind !== 'persistent-projection' ||
      mechanic.attackAdvantageWithinFeet == null ||
      !combatantOwnsFeature(actor, feature.id, false)
    ) return false
    const projectionDistance = dnd5eUtilityProjectionDistanceFeet(
      state, actor.id, mechanic.projectionId, target.id,
    )
    const actorDistance = state.distanceFeetByCombatantPair?.[
      dnd5eCombatantPairKey(actor.id, target.id)
    ]
    return projectionDistance != null && projectionDistance <= mechanic.attackAdvantageWithinFeet &&
      actorDistance != null && actorDistance <= mechanic.attackAdvantageWithinFeet
  })
  if (passiveProjectionAdvantage) return true
  const marker = actor.classState.utilityProjectionAttackAdvantage
  if (
    !marker ||
    marker.targetId !== target.id ||
    marker.turnKey !== `${state.combatId}:${state.round}:${
      state.initiativeSlotIds?.[state.initiativeIndex] ??
      state.turnSlotId ??
      actor.id
    }` ||
    !combatantOwnsFeature(actor, marker.featureId, true)
  ) return false
  return dnd5ePluginFeatureDefinition(marker.featureId)
    ?.declarativeAbility?.mechanic?.kind ===
    'utility-projection-attack-advantage'
}
