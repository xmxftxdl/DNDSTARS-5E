import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import type { Dnd5eActiveEffectInstance } from './activeEffects'
import { dnd5ePersistentAreaConditionEffects } from './persistentAreaConditionEffects'
import { mapGeometryRuntimeForMap } from '../../lib/mapGeometry'
import { dnd5eMappedVerticalDisplacement } from './verticalDisplacement'

/** Only a live restraint from this exact area generation can carry a creature upward. */
export function planDnd5ePersistentAreaCaptiveRise(input: {
  map: BattleMap; area: Dnd5ePluginArea; token: Token
  effects: readonly Dnd5eActiveEffectInstance[] | undefined
  elevationFeet: number; distanceFeet: number
}): number {
  const {map, area, token, elevationFeet, distanceFeet} = input
  if (!Number.isFinite(elevationFeet) || !Number.isInteger(distanceFeet) || distanceFeet < 1 || distanceFeet > 1000 ||
    area.vertical?.mode !== 'volume' || !map.dnd5ePluginAreas?.some(live => live.id === area.id &&
      live.sourceTokenId === area.sourceTokenId && (live.boundEffectGeneration ?? 0) === (area.boundEffectGeneration ?? 0))) return elevationFeet
  const bound = dnd5ePersistentAreaConditionEffects({effects: input.effects, areaId: area.id,
    sourceId: area.sourceTokenId, condition: 'restrained'}).some(effect =>
      effect.modifiers?.magicallyHeldAloft === true && effect.areaLifetime?.mapId === map.id &&
      effect.areaLifetime.sourceActorId === area.sourceTokenId &&
      (effect.areaLifetime.generation ?? 0) === (area.boundEffectGeneration ?? 0))
  if (!bound) return elevationFeet
  const ceiling = area.vertical.baseElevationFeet + area.vertical.heightFeet
  const destination = Math.max(elevationFeet, Math.min(ceiling, elevationFeet + distanceFeet))
  const sweep = dnd5eMappedVerticalDisplacement({map, geometry: mapGeometryRuntimeForMap(map.id), token,
    fromFeet: elevationFeet, toFeet: destination})
  return Math.max(elevationFeet, Math.min(destination, sweep.elevationFeet))
}
