import type { resolvePreparedDnd5ePlayerBasicAction } from '../../rulesets/dnd5e/playerBasicAction'
import { requestDisadvantageNegation } from './requestDisadvantageNegation'

/** Shared by player actions and companion orders; the parent resolution owns the debit. */
export async function requestBasicContestNegation(
  prepared: Parameters<typeof resolvePreparedDnd5ePlayerBasicAction>[0]['prepared'],
  side: 'actor' | 'target',
  ports: Pick<Parameters<typeof requestDisadvantageNegation>[1], 'choose' | 'isCurrent'>,
) {
  const payload = prepared.payload
  if (payload.kind === 'dismiss-effect' && !prepared.actorCheckAbility) return undefined
  const single = payload.kind === 'dismiss-effect' || payload.kind === 'hide' || payload.kind === 'escape-effect' ||
    (payload.kind === 'escape-grapple' && !!prepared.escapeEffectId)
  if (single && side === 'target') return undefined
  if (!(payload.kind === 'dismiss-effect' || payload.kind === 'hide' || payload.kind === 'escape-effect' || payload.kind === 'grapple' || payload.kind === 'shove' || payload.kind === 'escape-grapple')) return undefined
  const tokenId = side === 'actor' || payload.kind === 'dismiss-effect' || payload.kind === 'hide' || payload.kind === 'escape-effect' ? prepared.actorTokenId : payload.targetTokenId
  const mode = side === 'actor' ? prepared.actorRollMode : prepared.targetRollMode
  const token = prepared.map.tokens.find(row => row.id === tokenId)
  const owner = prepared.characters.find(row => row.id === token?.characterId)
  const combatant = prepared.state.combatants[tokenId]
  if (mode !== 'disadvantage' || !owner || !combatant) return undefined
  const character = { ...owner, classResources: structuredClone(combatant.classResources) }
  const contextId = payload.kind === 'dismiss-effect'
    ? JSON.stringify(['remove-active-effect', prepared.actorTokenId, payload.targetTokenId ?? prepared.actorTokenId, prepared.dismissEffectId])
    : payload.kind === 'escape-effect' || (payload.kind === 'escape-grapple' && prepared.escapeEffectId)
    ? JSON.stringify(['escape-active-effect', prepared.actorTokenId, prepared.escapeEffectId])
    : payload.kind === 'hide' ? JSON.stringify(['hide', prepared.actorTokenId])
    : JSON.stringify([payload.kind, prepared.actorTokenId, payload.targetTokenId, side])
  const transactionId = `basic-contest:${crypto.randomUUID()}`
  const roll = { rollId: transactionId, characterId: character.id, kind: prepared.actorRollKind === 'saving-throw' && side === 'actor' ? 'saving-throw' as const : 'ability-check' as const,
    mode, phase: 'before-roll' as const, contextId }
  const choice = await requestDisadvantageNegation({ mapId: prepared.map.id, transactionId, character, roll }, {
    ...ports, deferToParentTransaction: true,
  })
  return choice?.used ? { featureId: choice.featureId, rollId: roll.rollId, transactionId, contextId } : undefined
}
