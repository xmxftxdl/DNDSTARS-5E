import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'
import { resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { resolveDnd5eCompanionScenePointAction } from './companionScenePointAction'

export function resolveDnd5eReadiedObjectAction(input: Parameters<typeof resolveDnd5eCompanionScenePointAction>[0] & { currentInitiativeIndex: number }) {
  const token = input.map.tokens.find(candidate => candidate.id === input.actorTokenId)
  const ready = token?.dnd5eCombatState?.readiedAction
  if (!token || token.type !== 'enemy' || ready?.actionKind !== 'interact-object' || !ready.objectInteraction) return undefined
  if (ready.objectInteraction.operation === 'interact-point') {
    const resolved = resolveDnd5eCompanionScenePointAction({ ...input, readied: true })
    return resolved ? { ...resolved, door: undefined } : undefined
  }
  const snapshot = createDnd5eMapCombatSnapshot(input)
  const actor = snapshot.state.combatants[token.id]
  if (!actor) return undefined
  snapshot.state.initiativeIndex = input.currentInitiativeIndex
  if (snapshot.state.companionScene && input.worldMinute != null) snapshot.state.companionScene.worldMinute = input.worldMinute
  if (input.turnEconomy) actor.turn = {
    actionAvailable: input.turnEconomy.action.current > 0, bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
    reactionAvailable: input.turnEconomy.reaction.current > 0, objectInteractionAvailable: (input.turnEconomy.objectInteraction?.current ?? 1) > 0,
    movementRemaining: input.turnEconomy.movement.current,
  }
  const result = resolveDnd5eHeadlessAction(snapshot.state, { type: 'trigger-readied-action', actorId: token.id, objectExecution: true, d20: input.d20, d20Second: input.d20Second })
  return { result, requiredJournal: undefined, requiredDamageEffects: undefined, journalMutations: undefined,
    door: result.ok ? result.state.companionScene?.geometry?.doors.find(door => door.id === ('doorId' in ready.objectInteraction! ? ready.objectInteraction.doorId : undefined)) : undefined,
    application: result.ok ? planDnd5eMapResultApplication({ state: result.state, map: input.map, characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId, events: [...result.events] }) : undefined,
  }
}
