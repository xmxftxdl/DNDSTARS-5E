import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import type { MapGeometryState } from '../../lib/mapGeometry'
import { createDnd5eMapCombatSnapshot, refreshDnd5eMapSpatialRelations } from './mapBridge'
import { dnd5eSightingWorldMinute } from './recentCreatureSightings'

/** Host-only, after a route has been accepted. Persist observations, not snapshot-normalized mechanics. */
export function recordDnd5eAcceptedMovementSightings(input: {
  map: BattleMap; characters: readonly Character[]; geometry?: MapGeometryState
  actorTokenId: string; path: readonly { x: number; y: number }[]
  pathElevationsFeet?: readonly number[]; worldMinute?: number; worldSecondRemainder?: number
}): { map: BattleMap; characters: readonly Character[] } {
  if (dnd5eSightingWorldMinute(input.worldMinute, input.worldSecondRemainder) == null ||
    !input.path.length || !input.map.tokens.some(token => token.id === input.actorTokenId)) return input
  const actorToken = input.map.tokens.find(token => token.id === input.actorTokenId)!
  const startMap = { ...input.map, tokens: input.map.tokens.map(token => token.id === actorToken.id
    ? { ...token, ...input.path[0], elevationFeet: input.pathElevationsFeet?.[0] ?? token.elevationFeet } : token) }
  const { state, characterIdByCombatantId } = createDnd5eMapCombatSnapshot({
    map: startMap, characters: input.characters, geometry: input.geometry,
    combatId: `observation:${input.map.id}`, initiativeOrder: [],
    additionalCreatureTokenIds: input.map.tokens.filter(token => ['player', 'enemy', 'npc'].includes(token.type)).map(token => token.id),
    worldMinute: input.worldMinute, worldSecondRemainder: input.worldSecondRemainder,
  })
  const actor = state.combatants[input.actorTokenId]
  if (!actor) return input
  for (let index = 1; index < input.path.length; index++) {
    actor.position = { ...input.path[index] }
    actor.elevationFeet = input.pathElevationsFeet?.[index] ?? actorToken.elevationFeet ?? 0
    refreshDnd5eMapSpatialRelations(state, input.map, [], { geometry: input.geometry })
  }
  const histories = new Map(Object.entries(characterIdByCombatantId).map(([tokenId, characterId]) =>
    [characterId, state.combatants[tokenId]?.classState.recentCreatureSightings] as const))
  const characters = input.characters.map(character => {
    if (!histories.has(character.id)) return character
    const recentCreatureSightings = histories.get(character.id)
    if (JSON.stringify(recentCreatureSightings) === JSON.stringify(character.dnd5eCombatState?.recentCreatureSightings)) return character
    return { ...character, dnd5eCombatState: { ...character.dnd5eCombatState, recentCreatureSightings } }
  })
  const tokens = input.map.tokens.map(token => {
    if (characterIdByCombatantId[token.id] || !state.combatants[token.id]) return token
    const recentCreatureSightings = state.combatants[token.id].classState.recentCreatureSightings
    if (JSON.stringify(recentCreatureSightings) === JSON.stringify(token.dnd5eCombatState?.recentCreatureSightings)) return token
    return { ...token, dnd5eCombatState: { schemaVersion: 2 as const, ...token.dnd5eCombatState, recentCreatureSightings } }
  })
  return { map: { ...input.map, tokens }, characters }
}
