import { dnd5eHasVoluntaryCompanionOrder } from './voluntaryCompanionOrder'
import { dnd5eCompanionControlBinding } from './companionControlBinding'
import type { BattleMap, Token } from '../../store/maps'

type CompanionOrder = NonNullable<NonNullable<Token['dnd5eCombatState']>['companionCommand']>
/** Explicit Host retry only; the automatic once-per-slot checkpoint stays intact. */
export function dnd5eRetryableCompanionSceneOrder(token: Token | undefined, turnKey: string, actionAvailable: boolean, map?: BattleMap) {
  const order = token?.dnd5eCombatState?.companionCommand
  if (!token || !actionAvailable || (token.hp ?? 0) <= 0 || order?.executedTurnKey !== turnKey ||
    order.command !== 'use-object' || order.objectInteractionCompleted || order.objectInteraction?.operation !== 'interact-point') return undefined
  return dnd5eExecutableCompanionOrder({ ...token, dnd5eCombatState: { ...token.dnd5eCombatState,
    companionCommand: { ...order, executedTurnKey: undefined } } }, turnKey, map)
}

export function dnd5eExecutableCompanionOrder(token: Token | undefined, turnKey: string, map?: BattleMap): (CompanionOrder & { selfDefenseOnly?: true; autonomous?: true }) | undefined {
  const autonomous=token?.dnd5eSummon
  const existingOrder = token?.dnd5eCombatState?.companionCommand
  const protectorHasOrder = autonomous?.autonomousBehavior === 'protect-source' &&
    existingOrder?.sourceOwnerId === autonomous.sourceTokenId && existingOrder.sourceFeatureId === autonomous.featureId
  if(token?.type==='enemy' && !protectorHasOrder && (autonomous?.autonomousBehavior==='protect-source' || autonomous?.autonomousBehavior==='attack-nearest-visible' || autonomous?.autonomousBehavior==='attack-nearest-other-subtype')){
    if(token.dnd5eCombatState?.summonAutonomousTurnKey===turnKey)return undefined
    // A transient execution intent, never a player command or control grant.
    return {schemaVersion:1,sourceOwnerId:autonomous.sourceTokenId,sourceFeatureId:autonomous.featureId,
      command:'attack',issuedRound:autonomous.createdRound,autonomous:true}
  }
  const summon = map ? dnd5eCompanionControlBinding(map, token) : token?.dnd5eSummon, order = token?.dnd5eCombatState?.companionCommand
  if (!token || token.type !== 'enemy' || !summon?.commandPolicy || (summon.controlEnded && !dnd5eHasVoluntaryCompanionOrder(token))) return undefined
  if (!order && token.dnd5eSummon && summon.commandPolicy === 'persistent-order') {
    if (token.dnd5eCombatState?.summonSelfDefenseTurnKey === turnKey) return undefined
    // Execution intent only: never persist it as an attack order. The planner
    // and Host must continue to see no order and restrict attacks to self-defense.
    return { schemaVersion: 1, sourceOwnerId: summon.sourceTokenId, sourceFeatureId: summon.featureId,
      command: 'attack', issuedRound: token.dnd5eSummon.createdRound, selfDefenseOnly: true }
  }
  if (!order ||
    order.sourceOwnerId !== summon.sourceTokenId || order.sourceFeatureId !== summon.featureId || order.executedTurnKey === turnKey) return undefined
  return order
}

/** The declaration fingerprint excludes the execution checkpoint, never coordinates or targets. */
export function dnd5eCompanionOrderIdentity(order: NonNullable<NonNullable<Token['dnd5eCombatState']>['companionCommand']>) {
  const { executedTurnKey: _, objectInteractionCompleted: _completed, ...declaration } = order
  return JSON.stringify(declaration)
}
