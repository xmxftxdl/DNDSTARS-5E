import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { mapGeometryRuntimeForMap } from '../../lib/mapGeometry'
import { findMapGeometryPath } from '../../lib/mapPathfinding'
import { resolveDnd5eHeadlessAction, type Dnd5eActionResult } from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication, type Dnd5eMapResultPlan } from './mapBridge'
import { getDnd5eSrdMonster } from './monsters'

export function resolveDnd5eMonsterMapMove(input: {
  combatId: string
  round?: number
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  actorTokenId: string
  to: { x: number; y: number }
  dash?: boolean
}): { ok: true; result: Dnd5eActionResult; application?: Dnd5eMapResultPlan; distanceFeet: number; path: Array<{ x: number; y: number }>; doorsToOpen: string[] } | { ok: false; reason: 'invalid-actor' | 'combatant-missing' | 'movement-blocked' } {
  const actorToken = input.map.tokens.find((token) => token.id === input.actorTokenId && token.type === 'enemy')
  const monster = actorToken?.poolId ? getDnd5eSrdMonster(actorToken.poolId) : undefined
  if (!actorToken || !monster) return { ok: false, reason: 'invalid-actor' }
  const path = findMapGeometryPath({
    geometry: mapGeometryRuntimeForMap(input.map.id), map: input.map, token: actorToken, to: input.to,
    allowOpenUnlockedDoors: true,
    canClimb: (monster.speed.climb ?? 0) > 0,
    canSwim: (monster.speed.swim ?? 0) > 0,
  })
  if (!path) return { ok: false, reason: 'movement-blocked' }
  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.combatId,
    round: input.round,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const actorIndex = snapshot.state.initiativeOrder.indexOf(actorToken.id)
  const actorCombatant = snapshot.state.combatants[actorToken.id]
  if (actorIndex < 0 || !actorCombatant) return { ok: false, reason: 'combatant-missing' }
  const distanceFeet = path.distanceFeet
  let actionState = { ...snapshot.state, initiativeIndex: actorIndex }
  if (input.dash) {
    const dashed = resolveDnd5eHeadlessAction(actionState, { type: 'dash', actorId: actorToken.id })
    if (!dashed.ok) return { ok: true, result: dashed, distanceFeet, path: path.points, doorsToOpen: path.doorsToOpen }
    actionState = dashed.state
  }
  const result = resolveDnd5eHeadlessAction(
    actionState,
    {
      type: 'move', actorId: actorToken.id, to: input.to, distance: distanceFeet, movementCost: path.movementCostFeet,
      standFromProne: actorCombatant.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase())),
    },
  )
  if (!result.ok) return { ok: true, result, distanceFeet, path: path.points, doorsToOpen: path.doorsToOpen }
  return {
    ok: true,
    result,
    distanceFeet,
    path: path.points,
    doorsToOpen: path.doorsToOpen,
    application: planDnd5eMapResultApplication({
      state: result.state,
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
    }),
  }
}
