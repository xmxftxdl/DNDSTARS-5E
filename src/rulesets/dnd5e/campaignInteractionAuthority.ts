import type { CampaignInteraction, CampaignInteractionMutation } from '../../../shared/campaign-interactions.mjs'
import { campaignInteractionReferenceIssue } from '../../../shared/campaign-interactions.mjs'
import { normalizeDnd5eActiveEffects } from './activeEffects'
import { reconcileDnd5eContinuousSourceLinks, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'

/** Read-only Host preflight; neither records time nor grants completion. */
export function dnd5eCampaignInteractionIssue(state: Dnd5eHeadlessCombatState, record: Pick<CampaignInteraction, 'sourceId' | 'bearerId' | 'effectId' | 'packageId' | 'requiredRounds'> & { status?: CampaignInteraction['status'] }): string | null {
  if (record.status != null && record.status !== 'active') return 'interaction-not-active'
  if (state.active) return 'interaction-requires-noncombat'
  const entities = Object.values(state.combatants).map(actor => ({ id: actor.id, effects: normalizeDnd5eActiveEffects(actor.classState.activeEffects) }))
  const referenceIssue = campaignInteractionReferenceIssue(record, entities)
  if (referenceIssue) return referenceIssue
  const source = state.combatants[record.sourceId], bearer = state.combatants[record.bearerId]
  if (source.currentHp <= 0 || source.deathSaves.dead || bearer.currentHp <= 0 || bearer.deathSaves.dead) return 'interaction-participant-unavailable'
  const checked = structuredClone(state)
  reconcileDnd5eContinuousSourceLinks(checked, [])
  return checked.combatants[record.bearerId].classState.activeEffects?.some(effect => effect.id === record.effectId)
    ? null : 'interaction-continuity-lost'
}

/** Derive effect identity/duration from Host state instead of accepting authored request facts. */
export function prepareDnd5eCampaignInteractionStart(input: {
  state: Dnd5eHeadlessCombatState; bearerId: string; effectId: string; interactionId: string; worldMinute: number
}): { ok: true; mutation: Extract<CampaignInteractionMutation, { operation: 'start-interaction' }> } | { ok: false; reason: string } {
  if (!input.interactionId.trim() || input.interactionId.trim() !== input.interactionId || input.interactionId.length > 160 || !Number.isSafeInteger(input.worldMinute) || input.worldMinute < 0) return { ok: false, reason: 'invalid-interaction-start' }
  const bearer = input.state.combatants[input.bearerId]
  const effect = normalizeDnd5eActiveEffects(bearer?.classState.activeEffects).find(effect => effect.id === input.effectId)
  if (!effect?.source.actorId || !effect.source.pluginId || !effect.completionGrant || effect.duration.type !== 'rounds') return { ok: false, reason: 'interaction-effect-unavailable' }
  const mutation: Extract<CampaignInteractionMutation, { operation: 'start-interaction' }> = {
    operation: 'start-interaction', id: input.interactionId, sourceId: effect.source.actorId, bearerId: input.bearerId,
    effectId: effect.id, packageId: effect.source.pluginId, requiredRounds: effect.duration.remainingRounds, expectedWorldMinute: input.worldMinute,
  }
  const reason = dnd5eCampaignInteractionIssue(input.state, mutation)
  return reason ? { ok: false, reason } : { ok: true, mutation }
}
