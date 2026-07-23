import type { BattleMap } from '../../store/maps'
import type { Dnd5eCombatEvent } from '../../rulesets/dnd5e/headlessCombatEngine'

export interface FireBoltPresentationSettlement {
  id: string
  mapId: string
  transactionId: string
  sourceTokenId: string
  targetTokenId: string
  outcome: 'hit' | 'miss'
}

export function fireBoltPresentationForSettlement(input: {
  spellId: string
  transactionId: string
  mapId: string
  actorTokenId: string
  events: readonly Dnd5eCombatEvent[]
}): FireBoltPresentationSettlement | null {
  if (input.spellId !== 'fire-bolt') return null
  const attack = input.events.find((event) =>
    event.type === 'attack-resolved' && event.actorId === input.actorTokenId,
  )
  if (attack?.type !== 'attack-resolved') return null
  return {
    id: `${input.transactionId}:fire-bolt`,
    mapId: input.mapId,
    transactionId: input.transactionId,
    sourceTokenId: input.actorTokenId,
    targetTokenId: attack.targetId,
    outcome: attack.hit ? 'hit' : 'miss',
  }
}

export function spellSettlementMapLayerChanges(before: BattleMap, after: BattleMap) {
  return {
    areasChanged: JSON.stringify(after.dnd5ePluginAreas ?? []) !==
      JSON.stringify(before.dnd5ePluginAreas ?? []),
    effectTokensChanged: JSON.stringify(after.tokens.filter((token) => token.dnd5eSpellEffect)) !==
      JSON.stringify(before.tokens.filter((token) => token.dnd5eSpellEffect)),
  }
}

export function spellSettlementSpentTurnResource(
  events: readonly Dnd5eCombatEvent[],
): 'action' | 'bonusAction' | undefined {
  const spent = events.find((event) =>
    event.type === 'turn-resource-spent' &&
    (event.resource === 'action' || event.resource === 'bonusAction'),
  )
  return spent?.type === 'turn-resource-spent' &&
    (spent.resource === 'action' || spent.resource === 'bonusAction')
    ? spent.resource
    : undefined
}
