import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import { DND_FEET_PER_CELL, cellDistance, tokenAnchorCellFromPixel } from '../../lib/gridCombat'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { mapGeometryMovementBlocked, mapGeometryRuntimeForMap } from '../../lib/mapGeometry'
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
}): { ok: true; result: Dnd5eActionResult; application?: Dnd5eMapResultPlan; distanceFeet: number } | { ok: false; reason: 'invalid-actor' | 'combatant-missing' | 'movement-blocked' } {
  const actorToken = input.map.tokens.find((token) => token.id === input.actorTokenId && token.type === 'enemy')
  if (!actorToken?.poolId || !getDnd5eSrdMonster(actorToken.poolId)) return { ok: false, reason: 'invalid-actor' }
  if (mapGeometryMovementBlocked({
    geometry: mapGeometryRuntimeForMap(input.map.id), map: input.map, token: actorToken, to: input.to,
  }).blocked) return { ok: false, reason: 'movement-blocked' }
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
  const fromCell = tokenAnchorCellFromPixel(actorToken.x, actorToken.y, actorToken, input.map)
  const toCell = tokenAnchorCellFromPixel(input.to.x, input.to.y, actorToken, input.map)
  const distanceFeet = cellDistance(fromCell, toCell) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
  let actionState = { ...snapshot.state, initiativeIndex: actorIndex }
  if (input.dash) {
    const dashed = resolveDnd5eHeadlessAction(actionState, { type: 'dash', actorId: actorToken.id })
    if (!dashed.ok) return { ok: true, result: dashed, distanceFeet }
    actionState = dashed.state
  }
  const result = resolveDnd5eHeadlessAction(
    actionState,
    {
      type: 'move', actorId: actorToken.id, to: input.to, distance: distanceFeet,
      standFromProne: actorCombatant.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase())),
    },
  )
  if (!result.ok) return { ok: true, result, distanceFeet }
  return {
    ok: true,
    result,
    distanceFeet,
    application: planDnd5eMapResultApplication({
      state: result.state,
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
    }),
  }
}
