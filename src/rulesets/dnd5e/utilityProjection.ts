import {
  DND_FEET_PER_CELL,
  cellDistance,
  tokenOccupiedCellsAt,
} from '../../lib/gridCombat'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import type {
  Dnd5eCombatant,
  Dnd5eHeadlessCombatState,
} from './headlessCombatEngine'
import { dnd5eCombatantClassLevel } from './headlessCombatPrimitives'
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
      area.sourceKind !== 'core-spell' ||
      area.coreSpellId !== mechanic.projectionId ||
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
