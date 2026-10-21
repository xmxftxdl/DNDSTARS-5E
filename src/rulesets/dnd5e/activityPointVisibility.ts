import { mapGeometryCanSeePoint, mapGeometryRuntimeForMap, type MapGeometryState } from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5eConditionsFromActiveEffects } from './activeEffects'
import { dnd5eStandardConditionId } from './conditions'
import { projectDnd5eMapAreaStatusEffects } from './mapBridge'
import { getDnd5eSrdMonster } from './monsters'
import { migrateCharacterToDnd5e } from './character'

/** Host point visibility includes linked senses and transient occupied-area conditions. */
export function dnd5eActivityPointVisible(input: {
  map: BattleMap
  viewer: Token
  characters?: readonly Character[]
  worldMinute?: number
  geometry?: MapGeometryState
  point: { x: number; y: number; elevationFeet?: number }
}): boolean {
  const characters = input.characters ?? []
  const linked = characters.find(candidate => candidate.id === input.viewer.characterId)
  const character = linked ? migrateCharacterToDnd5e(linked) : undefined
  const projected = projectDnd5eMapAreaStatusEffects(input.map, characters)[input.viewer.id]
  const effects = projected ?? [
    ...(linked?.dnd5eCombatState?.activeEffects ?? []),
    ...(input.viewer.dnd5eCombatState?.activeEffects ?? []),
  ]
  const viewerBlinded = dnd5eConditionsFromActiveEffects(effects, [
    ...(character?.conditions ?? []), ...(input.viewer.dnd5eCombatState?.conditions ?? []),
  ]).some(condition => dnd5eStandardConditionId(condition) === 'blinded')
  return mapGeometryCanSeePoint({
    map: input.map, geometry: input.geometry ?? mapGeometryRuntimeForMap(input.map.id),
    viewer: { ...input.viewer, dnd5eCombatState: { ...input.viewer.dnd5eCombatState, activeEffects: effects } },
    character: character ? { ...character, classState: { ...character.classState, activeEffects: effects },
      dnd5eCombatState: { ...linked?.dnd5eCombatState, activeEffects: effects } } : undefined,
    monster: input.viewer.poolId ? getDnd5eSrdMonster(input.viewer.poolId) : undefined,
    point: input.point, viewerBlinded,
    // Without a synchronized clock, a finite-duration light cannot grant sight.
    worldMinute: Number.isFinite(input.worldMinute) ? input.worldMinute : Number.MAX_SAFE_INTEGER,
  })
}
