import { dnd5eHeadlessTurnKey, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import type { Dnd5eZeroHitPointCheckpoint } from './zeroHitPointCheckpoint'
import { captureDnd5eInterruptedTurnUsage, canTriggerDnd5eZeroHitPointTurn, planDnd5eInterruptingTurn } from './interruptedTurn'
import { registeredDnd5ePluginFeatures, dnd5eDeclarativeResourceKey } from './pluginApi'
import { dnd5eCombatantClassLevel, dnd5eCombatantHasSubclass } from './headlessCombatPrimitives'
import { dnd5eReactionsPrevented } from './passiveDefenses'

/** Lists choices only; neither this query nor a preview spends the reaction. */
export function dnd5eZeroHitPointTurnOptions(state: Dnd5eHeadlessCombatState, checkpoint: Dnd5eZeroHitPointCheckpoint) {
  const actor = state.combatants[checkpoint.targetId]
  if (!actor) return []
  return registeredDnd5ePluginFeatures().flatMap(feature => {
    const ability = feature.declarativeAbility
    if (ability?.mechanic?.kind !== 'zero-hit-point-extra-turn' || ability.automation === 'manual' ||
      !actor.pluginFeatureIds.includes(feature.id) ||
      (feature.sourceClassId != null && dnd5eCombatantClassLevel(actor, feature.sourceClassId) < (feature.minimumLevel ?? 1)) ||
      (feature.sourceClassId != null && feature.sourceSubclassId != null &&
        !dnd5eCombatantHasSubclass(actor, feature.sourceClassId, feature.sourceSubclassId))) return []
    const costs = new Map<string, number>()
    for (const cost of ability.cost?.resources ?? []) {
      const key = cost.scope === 'core' ? cost.resourceId : dnd5eDeclarativeResourceKey(feature.ownerPluginId, cost)
      costs.set(key, (costs.get(key) ?? 0) + cost.amount)
    }
    const funded = costs.size > 0 && [...costs].every(([key, amount]) =>
      Number.isInteger(amount) && amount > 0 && (actor.classResources[key]?.current ?? 0) >= amount)
    if (!canTriggerDnd5eZeroHitPointTurn({hitPointsBefore: checkpoint.hitPointsBefore,
      hitPointsAfter: actor.currentHp, maximumHitPoints: actor.maxHp, hitPointDamage: checkpoint.hitPointDamage,
      remainingDamageAfterZero: checkpoint.remainingDamageAfterZero, dead: actor.deathSaves.dead,
      incapacitatedBeforeDamage: checkpoint.incapacitatedBeforeDamage,
      reactionAvailable: actor.turn.reactionAvailable, reactionsPrevented: dnd5eReactionsPrevented(actor),
      featureEligible: true, remainingUses: funded ? 1 : 0})) return []
    return [{featureId: feature.id, name: feature.name, actorId: actor.id,
      resourceCosts: [...costs].map(([resourceId, amount]) => ({resourceId, amount}))}]
  })
}

function stateSignature(state: Dnd5eHeadlessCombatState): string {
  return JSON.stringify(state, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value)
}

/** Retained by the Host while awaiting a choice; never take this object from a player command. */
export function createDnd5eZeroHitPointTurnOffer(state: Dnd5eHeadlessCombatState, checkpoint: Dnd5eZeroHitPointCheckpoint) {
  const options = dnd5eZeroHitPointTurnOptions(state, checkpoint)
  if (!options.length) return undefined
  return {signature: stateSignature(state), checkpoint: structuredClone(checkpoint), options}
}

/** Prepares costs and a resume receipt. Caller must still run zero-HP and turn lifecycle semantics atomically. */
export function planDnd5eZeroHitPointTurnAcceptance(
  state: Dnd5eHeadlessCombatState,
  offer: NonNullable<ReturnType<typeof createDnd5eZeroHitPointTurnOffer>>,
  featureId: string,
  transactionId: string,
) {
  if (stateSignature(state) !== offer.signature || !offer.options.some(option => option.featureId === featureId)) return undefined
  const option = dnd5eZeroHitPointTurnOptions(state, offer.checkpoint).find(candidate => candidate.featureId === featureId)
  if (!option || JSON.stringify(option) !== JSON.stringify(offer.options.find(candidate => candidate.featureId === featureId))) return undefined
  const initiative = planDnd5eInterruptingTurn(state, option.actorId, `${transactionId}:${offer.checkpoint.occurrence}:${featureId}`)
  if (!transactionId.trim() || !initiative) return undefined
  const interruptedActor = state.combatants[initiative.receipt.interruptedActorId]
  if (!interruptedActor) return undefined
  const actorAfterCosts = structuredClone(state.combatants[option.actorId])
  actorAfterCosts.turn.reactionAvailable = false
  actorAfterCosts.classState.zeroHitPointExtraTurn = {featureId, slotId: initiative.receipt.extraSlotId, phase: 'pending'}
  actorAfterCosts.classState.interruptedTurnResume = {
    receipt: structuredClone(initiative.receipt), economy: structuredClone(interruptedActor.turn),
    turnStartResolvedTurnKey: interruptedActor.classState.turnStartResolvedTurnKey,
    nativeUsage: captureDnd5eInterruptedTurnUsage(interruptedActor.classState, dnd5eHeadlessTurnKey(state, interruptedActor.id)),
    attackProgress: {
      weaponAttackActionTurnKey: interruptedActor.classState.weaponAttackActionTurnKey,
      attacksMadeTurnKey: interruptedActor.classState.attacksMadeTurnKey,
      attacksMadeThisTurn: interruptedActor.classState.attacksMadeThisTurn,
      meleeAttackTargetIdsThisTurn: interruptedActor.classState.meleeAttackTargetIdsThisTurn?.slice(),
      usedFeatureTurnKeys: Object.fromEntries(Object.entries(interruptedActor.classState.declarativeUsedTurnKeys ?? {})
        .filter(([, key]) => key === dnd5eHeadlessTurnKey(state, interruptedActor.id))),
    },
  }
  for (const cost of option.resourceCosts) actorAfterCosts.classResources[cost.resourceId].current -= cost.amount
  return {actorAfterCosts, initiative: initiative.initiative, receipt: initiative.receipt,
    interruptedTurnEconomy: structuredClone(interruptedActor.turn),
    checkpoint: structuredClone(offer.checkpoint), featureId, resourceCosts: option.resourceCosts}
}
