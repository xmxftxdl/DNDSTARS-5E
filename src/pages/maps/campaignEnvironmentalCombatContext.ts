import type { readCampaignInteractionContext } from './campaignInteractionController'
import { createDnd5eMapCombatSnapshot } from '../../rulesets/dnd5e/mapBridge'

/** Use the live slot and counted resources; map occupants outside initiative stay targets only. */
export function campaignEnvironmentalCombatContext(context: Awaited<ReturnType<typeof readCampaignInteractionContext>>) {
  const combat = context.rawCombat?.active && context.rawCombat.mapId === context.map.id ? context.rawCombat : undefined
  if (!combat) return { ...context, state: { ...context.state, active: false }, combat: undefined }
  if (combat.flowPause) throw Error('战斗已暂停，请恢复战斗后再结算气候暴露。')
  const current = combat.initiativeOrder[combat.initiativeIndex]
  if (!current) throw Error('exposure-combat-slot-unavailable')
  const snapshot = createDnd5eMapCombatSnapshot({ map: context.map, roomMaps: context.maps, characters: context.characters,
    geometry: context.geometry, worldMinute: context.clock.worldMinute, combatId: combat.combatId ?? `exposure:${context.map.id}`,
    round: combat.round, turnSlotId: current.slotId ?? current.tokenId, effectiveRules: combat.effectiveRules,
    initiativeOrder: combat.initiativeOrder,
    additionalCreatureTokenIds: context.map.tokens.filter(token => ['player', 'enemy', 'npc'].includes(token.type)).map(token => token.id),
  })
  snapshot.state.active = true
  const slotIndex = snapshot.state.initiativeSlotIds?.indexOf(current.slotId ?? current.tokenId) ?? -1
  if (slotIndex < 0) throw Error('exposure-combat-slot-unavailable')
  snapshot.state.initiativeIndex = slotIndex
  for (const [id, actor] of Object.entries(snapshot.state.combatants)) {
    const economy = combat.dnd5eTurnEconomyByToken?.[id]
    if (!economy) {
      if (combat.initiativeOrder.some(slot => slot.tokenId === id)) throw Error('exposure-combat-economy-unavailable')
      continue
    }
    actor.turn = { ...actor.turn, actionAvailable: economy.action.current > 0, bonusActionAvailable: economy.bonusAction.current > 0,
      reactionAvailable: economy.reaction.current > 0, objectInteractionAvailable: (economy.objectInteraction?.current ?? 1) > 0,
      movementRemaining: economy.movement.current,
      movementSpent: economy.movement.spent ?? Math.max(0, economy.movement.max - Math.min(economy.movement.max, economy.movement.current)) }
  }
  return { ...context, ...snapshot, combat }
}
