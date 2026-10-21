import { dnd5eNearbyOwnedCompanions } from './ownedCompanionProximity'
import type { BattleMap, Token } from '../../store/maps'
import type { MapGeometryState } from '../../lib/mapGeometry'
import type { Dnd5eCombatant, Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { dnd5eActiveMaximizeHealingDice } from './activeEffects'

export interface Dnd5eCompanionSceneSnapshot {
  map: BattleMap
  geometry: MapGeometryState | null
  worldMinute?: number
  worldSecondRemainder?: number
  projectedTokenIds: string[]
  interactionScenes?: readonly import('../../lib/sceneOrchestration').OrchestratedScene[]
  roomPlaneFacts?: readonly Pick<BattleMap, 'id' | 'dnd5ePlane'>[]
}

/** Host scene facts include companions outside initiative. Overlay transaction-local bodies. */
export function dnd5eHeadlessMaximizeHealingDice(
  state: Dnd5eHeadlessCombatState | undefined,
  recipient: Dnd5eCombatant,
): boolean {
  const scene = state?.companionScene
  if (!scene || !state || scene.map.id !== state.mapId) {
    return dnd5eActiveMaximizeHealingDice(recipient.classState.activeEffects)
  }
  const tokens = scene.map.tokens.flatMap<Token>(token => {
    const body = state.combatants[token.id]
    if (!body) return scene.projectedTokenIds.includes(token.id) ? [] : [token]
    return [{ ...token, x: body.position.x, y: body.position.y,
      elevationFeet: body.elevationFeet ?? token.elevationFeet,
      hp: body.currentHp,
      creatureSize: (['微型', '小型', '中型', '大型', '超大型', '巨型'] as const)[body.sizeRank],
      ...(token.dnd5eSummon && (body.summonedUncontrolledSubtype || body.summonedSourceCombatantId !== token.dnd5eSummon.sourceTokenId) ? {
        dnd5eSummon: { ...token.dnd5eSummon, controlEnded: true },
      } : {}),
    }]
  })
  const context = {
    map: { ...scene.map, tokens }, ownerTokenId: recipient.id,
    round: state.round, worldMinute: scene.worldMinute, geometry: scene.geometry,
  }
  return dnd5eActiveMaximizeHealingDice(recipient.classState.activeEffects, context) ||
    (recipient.maximizeHealingDiceNearCompanion ?? []).some(query => dnd5eNearbyOwnedCompanions({ ...context, query }).length > 0)
}
