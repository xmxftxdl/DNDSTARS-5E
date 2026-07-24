import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { resolveDnd5eHeadlessAction, type Dnd5eActionResult } from './headlessCombatEngine'
import {
  createDnd5eMapCombatSnapshot,
  planDnd5eMapResultApplication,
  type Dnd5eMapResultPlan,
} from './mapBridge'
import { getDnd5eSrdMonster } from './monsters'

export function resolveDnd5eMonsterDodge(input: {
  combatId: string
  round?: number
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  actorTokenId: string
  turnEconomy?: Dnd5eTurnEconomyCounts
}):
  | { ok: true; actor: Token; result: Dnd5eActionResult; application?: Dnd5eMapResultPlan }
  | { ok: false; reason: 'invalid-actor' | 'combatant-missing' } {
  const actor = input.map.tokens.find((token) =>
    token.id === input.actorTokenId &&
    token.type === 'enemy' &&
    !!token.poolId &&
    !!getDnd5eSrdMonster(token.poolId),
  )
  if (!actor) return { ok: false, reason: 'invalid-actor' }
  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.combatId,
    round: input.round,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const actorIndex = snapshot.state.initiativeOrder.indexOf(actor.id)
  const combatant = snapshot.state.combatants[actor.id]
  if (actorIndex < 0 || !combatant) return { ok: false, reason: 'combatant-missing' }
  if (input.turnEconomy) {
    combatant.turn = {
      actionAvailable: input.turnEconomy.action.current > 0,
      bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
      reactionAvailable: input.turnEconomy.reaction.current > 0,
      objectInteractionAvailable: (input.turnEconomy.objectInteraction?.current ?? 1) > 0,
      movementRemaining: input.turnEconomy.movement.current,
    }
  }
  const result = resolveDnd5eHeadlessAction(
    { ...snapshot.state, initiativeIndex: actorIndex },
    { type: 'dodge', actorId: actor.id },
  )
  return {
    ok: true,
    actor,
    result,
    application: result.ok
      ? planDnd5eMapResultApplication({
          state: result.state,
          map: input.map,
          characters: input.characters,
          characterIdByCombatantId: snapshot.characterIdByCombatantId,
        })
      : undefined,
  }
}
