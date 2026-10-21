import type { Token } from '../../store/maps'

/** Read only Host-persisted command state, never a player request field. */
export function dnd5eHasVoluntaryCompanionOrder(token: Token | undefined): boolean {
  const summon=token?.dnd5eSummon, order=token?.dnd5eCombatState?.companionCommand
  return !!token && typeof token.id==='string' && token.id.length>0 && !!summon?.commandPolicy &&
    typeof order?.voluntaryForTokenId==='string' && order.voluntaryForTokenId===token.id &&
    order.sourceOwnerId===summon.sourceTokenId && order.sourceFeatureId===summon.featureId
}
