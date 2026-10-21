import type { BattleMap } from '../../store/maps'
import { planEtherealReturn } from '../../lib/mapEtherealGeometry'
import { mapGeometryTerrainElevationAtPoint, type MapGeometryState } from '../../lib/mapGeometry'
import { dnd5eActivePlanarPhase } from './activeEffects'
import { dnd5eEntitySupportElevation } from './entitySupport'
import { dnd5eMapTokenDistanceFeet } from './verticalCombatGeometry'
import { dnd5eCombatantPairKey, dnd5eEffectiveSizeRank, resolveDnd5eEtherealReturnDamage,
  type Dnd5eActionResult, type Dnd5eHeadlessCombatState, type Dnd5eCombatEvent } from './headlessCombatEngine'

/** Stage the entire return before commit; an impossible exit rolls back the originating action. */
export function settleDnd5eEtherealReturns(input: {
  before: Dnd5eHeadlessCombatState
  result: Dnd5eActionResult
  map: BattleMap
  geometry?: MapGeometryState
}): Dnd5eActionResult {
  if (!input.result.ok) return input.result
  const returning = Object.values(input.before.combatants).filter(actor =>
    dnd5eActivePlanarPhase(actor.classState.activeEffects).plane === 'ethereal' &&
    input.result.state.combatants[actor.id] &&
    dnd5eActivePlanarPhase(input.result.state.combatants[actor.id].classState.activeEffects).plane === 'material')
  if (!returning.length) return input.result
  const failure = (): Dnd5eActionResult => ({ ok: false, state: input.before, events: [], reason: 'invalid-target' })
  if (input.before.combatId !== input.result.state.combatId) return failure()
  let state = structuredClone(input.result.state)
  const events: Dnd5eCombatEvent[] = [...input.result.events]
  for (const returningActor of returning) {
    const actor = state.combatants[returningActor.id]
    const map = { ...input.map, tokens: input.map.tokens.map(saved => {
      const current = state.combatants[saved.id]
      return current ? { ...saved, ...current.position, elevationFeet: current.elevationFeet ?? saved.elevationFeet } : saved
    }) }
    const token = map.tokens.find(saved => saved.id === actor.id)
    if (!token) return failure()
    const plan = planEtherealReturn({ map, geometry: input.geometry, token, at: actor.position,
      elevationFeet: actor.elevationFeet ?? 0 })
    if (!plan.ok) return failure()
    actor.groundElevationFeet = dnd5eEntitySupportElevation({ map, geometry: input.geometry,
      token: { ...token, ...plan.position, elevationFeet: plan.elevationFeet },
      terrainElevationFeet: mapGeometryTerrainElevationAtPoint(input.geometry, plan.position), elevationFeet: plan.elevationFeet })
    actor.airborne = plan.elevationFeet > actor.groundElevationFeet + 1e-4
    if (!plan.displaced) continue
    const from = { ...actor.position }, fromElevationFeet = actor.elevationFeet ?? 0
    actor.position = { ...plan.position }
    actor.elevationFeet = plan.elevationFeet
    events.push({ type: 'moved', actorId: actor.id, from, to: { ...plan.position },
      fromElevationFeet, toElevationFeet: plan.elevationFeet, movementKind: 'forced', distance: plan.distanceFeet })
    state.distanceFeetByCombatantPair ??= {}
    for (const other of map.tokens) {
      if (other.id === actor.id || !state.combatants[other.id]) continue
      state.distanceFeetByCombatantPair[dnd5eCombatantPairKey(actor.id, other.id)] = dnd5eMapTokenDistanceFeet({
        map, geometry: input.geometry, left: { ...token, ...plan.position, elevationFeet: plan.elevationFeet }, right: other,
        leftSizeRank: dnd5eEffectiveSizeRank(actor), rightSizeRank: dnd5eEffectiveSizeRank(state.combatants[other.id]),
      })
    }
    const damage = resolveDnd5eEtherealReturnDamage(state, actor.id, plan.distanceFeet)
    if (!damage.ok) return failure()
    state = damage.state
    events.push(...damage.events)
  }
  return { ...input.result, state, events }
}
