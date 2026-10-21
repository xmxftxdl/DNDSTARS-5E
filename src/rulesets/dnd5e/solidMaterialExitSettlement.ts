import type { BattleMap } from '../../store/maps'
import { mapGeometryTerrainElevationAtPoint, type MapGeometryState } from '../../lib/mapGeometry'
import { planSolidMaterialExit } from '../../lib/mapSolidMaterialTraversal'
import { dnd5eActiveSolidMaterialTraversals, effectiveDnd5eActiveEffects } from './activeEffects'
import { dnd5eEntitySupportElevation } from './entitySupport'
import { dnd5eMapTokenDistanceFeet } from './verticalCombatGeometry'
import { applyDnd5eStandardConditionEffect, dnd5eHeadlessTurnKey, endDnd5eConcentration,
  dnd5eCombatantPairKey, dnd5eEffectiveSizeRank,
  previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange, resolveDnd5eFeatherFallReaction,
  type Dnd5eHeadlessCombatState, type Dnd5eCombatEvent } from './headlessCombatEngine'

export type Dnd5eSolidExitFeatherFallChoice = { spellcastingSavingThrows?: readonly import('./headlessCombatEngine').Dnd5eSpellcastingSavingThrowRoll[]; casterId: string; targetIds: readonly string[] }

/** Replay choices on the freshly calculated post-ejection state, never on the pre-move state. */
export function replayDnd5eSolidExitFeatherFallChoices(
  source: Dnd5eHeadlessCombatState,
  provisional: Dnd5eHeadlessCombatState,
  pushedIds: readonly string[],
  choices: readonly Dnd5eSolidExitFeatherFallChoice[] = [],
): { ok: true; state: Dnd5eHeadlessCombatState; events: Dnd5eCombatEvent[] } | { ok: false } {
  let state = provisional
  const events: Dnd5eCombatEvent[] = []
  for (const choice of choices) {
    const falls = previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(source, state, [...pushedIds])
      .filter(fall => choice.targetIds.includes(fall.combatantId))
    if (falls.length !== choice.targetIds.length) return { ok: false }
    const reaction = resolveDnd5eFeatherFallReaction(state, { casterId: choice.casterId, falls, spellcastingSavingThrows: choice.spellcastingSavingThrows })
    if (!reaction.ok) return { ok: false }
    state = reaction.state
    events.push(...reaction.events)
  }
  return { ok: true, state, events }
}

/** Keep downstream area settlement on the actual exit instead of the requested solid cell. */
export function appendDnd5eSolidExitMovementTraces<T extends {
  tokenId: string; to: { x: number; y: number }; path: Array<{ x: number; y: number }>; pathElevationsFeet: number[]
}>(traces: readonly T[], events: readonly Dnd5eCombatEvent[]): T[] {
  return traces.map(trace => {
    const moves = events.filter(event => (event.type === 'moved' || event.type === 'elevation-changed') && event.actorId === trace.tokenId)
    let result = trace
    for (const event of moves) if (event.type === 'moved' || event.type === 'elevation-changed') {
      const to = event.type === 'moved' ? event.to : result.to
      result = { ...result, to: { ...to }, path: [...result.path, { ...to }],
        pathElevationsFeet: [...result.pathElevationsFeet, event.toElevationFeet ?? result.pathElevationsFeet.at(-1) ?? 0] }
    }
    return result
  })
}

/** Detect capability loss at an already-settled movement trigger. */
export function dnd5eLostSolidMaterialTraversal(
  before: Dnd5eHeadlessCombatState, after: Dnd5eHeadlessCombatState, actorId: string,
): boolean {
  return before.combatId === after.combatId &&
    dnd5eActiveSolidMaterialTraversals(before.combatants[actorId]?.classState.activeEffects).length > 0 &&
    dnd5eActiveSolidMaterialTraversals(after.combatants[actorId]?.classState.activeEffects).length === 0
}

/** Called after a successful voluntary move; never mutates the pre-commit snapshot. */
export function settleDnd5eSolidMaterialExit(input: {
  state: Dnd5eHeadlessCombatState
  map: BattleMap
  geometry?: MapGeometryState
  actorId: string
  /** Trusted snapshot from this movement, before along-path effects can end traversal. */
  movementSourceState?: Dnd5eHeadlessCombatState
}): { ok: true; state: Dnd5eHeadlessCombatState; events: Dnd5eCombatEvent[] } |
  { ok: false; reason: string } {
  const actor = input.state.combatants[input.actorId]
  const token = input.map.tokens.find(token => token.id === input.actorId)
  if (!actor || !token) return { ok: false, reason: 'solid-traversal-actor-missing' }
  const currentSources = dnd5eActiveSolidMaterialTraversals(actor.classState.activeEffects)
  const sourceState = currentSources.length ? input.state : input.movementSourceState
  if (sourceState && sourceState.combatId !== input.state.combatId) return { ok: false, reason: 'solid-traversal-source-mismatch' }
  const sources = currentSources.length ? currentSources
    : dnd5eActiveSolidMaterialTraversals(sourceState?.combatants[input.actorId]?.classState.activeEffects)
  if (!sources.length) return { ok: true, state: input.state, events: [] }
  // Headless may have moved attached creatures before the map is projected.
  // Use that authoritative snapshot when choosing an unoccupied exit.
  const map = { ...input.map, tokens: input.map.tokens.map(token => {
    const combatant = input.state.combatants[token.id]
    return combatant ? { ...token, x: combatant.position.x, y: combatant.position.y,
      elevationFeet: combatant.elevationFeet ?? token.elevationFeet } : token
  }) }
  const carriedIds = new Set<string>()
  const sourcesToCheck = [actor.id]
  for (const sourceId of sourcesToCheck) {
    for (const target of Object.values(input.state.combatants)) {
      if (target.id === actor.id || carriedIds.has(target.id) || target.deathSaves.dead) continue
      if (effectiveDnd5eActiveEffects(target.classState.activeEffects).some(effect =>
        !effect.dependsOnEffectId && effect.relation?.movement === 'carry-target' &&
        effect.relation.sourceActorId === sourceId && effect.source.actorId === sourceId)) {
        carriedIds.add(target.id)
        sourcesToCheck.push(target.id)
      }
    }
  }
  const carriedTokens = map.tokens.filter(token => carriedIds.has(token.id))
  const plan = planSolidMaterialExit({ map, geometry: input.geometry, token,
    carriedTokens,
    at: actor.position, elevationFeet: actor.elevationFeet ?? 0,
    materials: [...new Set(sources.flatMap(source => source.rule.materials))] })
  if (!plan.ok) return plan
  if (!plan.displaced) return { ok: true, state: input.state, events: [] }
  for (const { effect } of sources) {
    if (effect.duration.type !== 'concentration') return { ok: false, reason: 'solid-traversal-source-missing' }
    const caster = sourceState?.combatants[effect.duration.sourceActorId]
    const concentrationId = effect.duration.concentrationId ?? (
      effect.source.kind === 'spell' && effect.source.actorId === effect.duration.sourceActorId
        ? effect.source.rulesId : undefined)
    if (!caster || !concentrationId ||
      caster.classState.concentrationSpellId !== concentrationId) {
      return { ok: false, reason: 'solid-traversal-source-mismatch' }
    }
  }
  const state = structuredClone(input.state), moved = state.combatants[input.actorId]
  const from = { ...moved.position }, fromElevationFeet = moved.elevationFeet ?? 0
  const events: Dnd5eCombatEvent[] = []
  moved.position = { ...plan.position }
  moved.elevationFeet = plan.elevationFeet
  moved.groundElevationFeet = dnd5eEntitySupportElevation({ map, geometry: input.geometry,
    token: { ...token, ...plan.position, elevationFeet: plan.elevationFeet },
    terrainElevationFeet: mapGeometryTerrainElevationAtPoint(input.geometry, plan.position),
    elevationFeet: plan.elevationFeet })
  moved.airborne = plan.elevationFeet > moved.groundElevationFeet + 1e-4
  for (const carriedToken of carriedTokens) {
    const target = state.combatants[carriedToken.id]
    const previous = { ...target.position }, previousElevation = target.elevationFeet ?? fromElevationFeet
    target.position = { x: previous.x + plan.position.x - from.x, y: previous.y + plan.position.y - from.y }
    target.elevationFeet = previousElevation + plan.elevationFeet - fromElevationFeet
    target.groundElevationFeet = dnd5eEntitySupportElevation({ map, geometry: input.geometry,
      token: { ...carriedToken, ...target.position, elevationFeet: target.elevationFeet },
      terrainElevationFeet: mapGeometryTerrainElevationAtPoint(input.geometry, target.position), elevationFeet: target.elevationFeet })
    target.airborne = target.elevationFeet > target.groundElevationFeet + 1e-4
    events.push({ type: 'moved', actorId: target.id, from: previous, to: { ...target.position },
      fromElevationFeet: previousElevation, toElevationFeet: target.elevationFeet, movementKind: 'forced',
      distance: Math.max(Math.max(Math.abs(plan.position.x - from.x), Math.abs(plan.position.y - from.y)) / Math.max(1, map.gridSize) * (map.feetPerCell ?? 5), Math.abs(plan.elevationFeet - fromElevationFeet)) })
  }
  // Reaction ranges must use the exit location, not the pre-ejection cache.
  const groupIds = new Set([moved.id, ...carriedIds])
  const positionedTokens = map.tokens.map(saved => {
    const combatant = state.combatants[saved.id]
    return combatant ? { ...saved, ...combatant.position, elevationFeet: combatant.elevationFeet } : saved
  })
  state.distanceFeetByCombatantPair ??= {}
  for (const left of positionedTokens.filter(token => groupIds.has(token.id))) {
    for (const right of positionedTokens) {
      const leftActor = state.combatants[left.id], rightActor = state.combatants[right.id]
      if (left.id === right.id || !leftActor || !rightActor) continue
      state.distanceFeetByCombatantPair[dnd5eCombatantPairKey(left.id, right.id)] = dnd5eMapTokenDistanceFeet({
        map, geometry: input.geometry, left, right,
        leftSizeRank: dnd5eEffectiveSizeRank(leftActor), rightSizeRank: dnd5eEffectiveSizeRank(rightActor),
      })
    }
  }
  const ended = new Set<string>()
  for (const { effect } of sources) {
    if (effect.duration.type !== 'concentration' || ended.has(effect.duration.sourceActorId)) continue
    ended.add(effect.duration.sourceActorId)
    const caster = state.combatants[effect.duration.sourceActorId]
    const concentrationId = effect.duration.concentrationId ?? effect.source.rulesId
    // A hazard may already have ended this spell. Never restore it or end an
    // unrelated replacement concentration merely because the earlier move used it.
    if (caster?.concentrating && caster.classState.concentrationSpellId === concentrationId) {
      endDnd5eConcentration(state, caster, events)
    }
  }
  applyDnd5eStandardConditionEffect(moved, moved, {
    rulesId: 'solid-material-ejection', condition: 'stunned', magical: false,
    appliedTurnKey: dnd5eHeadlessTurnKey(state, moved.id),
    duration: state.active
      ? { type: 'until-turn-boundary', boundary: 'target-turn-end', includeCreationTurn: false }
      : { type: 'rounds', remainingRounds: 1, tickOn: 'target-turn-end' },
  }, events)
  const gridSize = Math.max(1, input.map.gridSize), feet = input.map.feetPerCell ?? 5
  events.push({ type: 'moved', actorId: moved.id, from, to: { ...moved.position },
    fromElevationFeet, toElevationFeet: plan.elevationFeet, movementKind: 'forced',
    distance: Math.max(Math.abs(from.x - moved.position.x) / gridSize * feet,
      Math.abs(from.y - moved.position.y) / gridSize * feet, Math.abs(fromElevationFeet - plan.elevationFeet)),
  })
  return { ok: true, state, events }
}
