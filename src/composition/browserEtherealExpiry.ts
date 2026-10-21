import type { EtherealExpirySettlement } from '../lib/campaignEtherealReturnCommit'
import { createDnd5eMapCombatSnapshot } from '../rulesets/dnd5e/mapBridge'
import { resolveDnd5eEtherealExpiry } from '../rulesets/dnd5e/etherealExpirySettlement'
import { createDnd5eTurnEconomyCounts, projectDnd5eHeadlessTurnEconomy } from '../rulesets/dnd5e/turnEconomy'
import type { Dnd5eSolidExitFeatherFallChoice } from '../rulesets/dnd5e/solidMaterialExitSettlement'
import { getTempleExpiryInteraction, requireTempleExpiryInteraction } from './templeExpiryInteraction'

export const settleBrowserEtherealExpiry: EtherealExpirySettlement = async input => {
  const combat = input.combat?.active && input.combat.mapId === input.map.id ? input.combat : undefined
  const shared = { map: input.map, geometry: input.geometry, worldMinute: input.worldMinute,
    combatId: combat?.combatId ?? `ethereal-expiry:${input.map.id}`, round: combat?.round,
    initiativeOrder: input.map.tokens.filter(token => ['player', 'enemy', 'npc'].includes(token.type)).map((token, index) =>
      combat?.initiativeOrder.find(entry => entry.tokenId === token.id) ??
      { tokenId: token.id, label: token.label, emoji: token.emoji, color: token.color, roll: 1000 - index }),
  }
  const before = createDnd5eMapCombatSnapshot({ ...shared, characters: input.beforeCharacters })
  const after = createDnd5eMapCombatSnapshot({ ...shared, characters: input.characters })
  for (const snapshot of [before, after]) {
    snapshot.state.active = !!combat
    for (const [id, economy] of Object.entries(combat?.dnd5eTurnEconomyByToken ?? {})) {
      const actor = snapshot.state.combatants[id]
      if (actor) actor.turn = { ...actor.turn, actionAvailable: economy.action.current > 0,
        bonusActionAvailable: economy.bonusAction.current > 0, reactionAvailable: economy.reaction.current > 0,
        movementRemaining: economy.movement.current }
    }
  }
  const choices: Dnd5eSolidExitFeatherFallChoice[] = []
  let rolls: Readonly<Record<string, readonly number[]>> | undefined
  let owner = getTempleExpiryInteraction()
  const transactionId = `ethereal-expiry:${crypto.randomUUID()}`
  for (let attempt = 0; attempt < 64; attempt++) {
    const result = resolveDnd5eEtherealExpiry({ before: before.state, after: after.state, map: input.map,
      geometry: input.geometry, characters: input.characters, characterIdByCombatantId: after.characterIdByCombatantId,
      choices, rolls })
    if (result.ok) {
      let nextCombat = undefined
      if (combat) {
        const economy = { ...combat.dnd5eTurnEconomyByToken }
        for (const event of result.events) if (event.type === 'turn-resource-spent' && event.resource === 'reaction') {
          const actor = result.state.combatants[event.actorId]
          if (actor) economy[event.actorId] = projectDnd5eHeadlessTurnEconomy(economy[event.actorId] ??
            createDnd5eTurnEconomyCounts(`ethereal-expiry:${combat.round}`, actor.speed), actor.turn)
        }
        nextCombat = { ...combat, dnd5eTurnEconomyByToken: economy }
      }
      return { map: result.application.map, characters: result.application.characters, combat: nextCombat }
    }
    if (rolls || !result.falls?.length || !result.reactionState) throw Error(result.reason)
    owner ??= await requireTempleExpiryInteraction()
    if (getTempleExpiryInteraction() !== owner) throw Error('ethereal-expiry-host-interaction-unavailable')
    const choice = await owner.chooseFeatherFall(result.reactionState, result.falls, input.map, transactionId)
    if (getTempleExpiryInteraction() !== owner) throw Error('ethereal-expiry-host-interaction-unavailable')
    if (choice) { choices.push(choice); continue }
    rolls = await owner.rollFalls(result.falls, input.map)
    if (getTempleExpiryInteraction() !== owner) throw Error('ethereal-expiry-host-interaction-unavailable')
  }
  throw Error('ethereal-expiry-reaction-limit')
}
