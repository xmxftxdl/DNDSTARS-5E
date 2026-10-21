import { createDnd5eMechanicalEffect, effectiveDnd5eActiveEffects, type Dnd5eActiveEffectInstance } from './activeEffects'

/** Only the Host boundary that advanced a timer may supply natural expiry IDs. */
export function planDnd5eTimedActivityCompletions(input: {
  targetId: string
  effects: readonly Dnd5eActiveEffectInstance[]
  expiredEffectIds: readonly string[]
  liveSourceIds: ReadonlySet<string>
  appliedTurnKey: string
}): { recipientId: string; effect: Dnd5eActiveEffectInstance }[] {
  const expired = new Set(input.expiredEffectIds)
  const existing = new Set(input.effects.map(effect => effect.id))
  return effectiveDnd5eActiveEffects(input.effects).flatMap(effect => {
    const grant = effect.completionGrant
    const id = `${effect.id}:completed`
    if (!grant || effect.duration.type !== 'rounds' || !expired.has(effect.id) || existing.has(id) ||
        !effect.source.pluginId || !effect.source.actorId || !input.liveSourceIds.has(effect.source.actorId)) return []
    existing.add(id)
    const recipientId = grant.recipient === 'source' ? effect.source.actorId : input.targetId
    return [{ recipientId, effect: createDnd5eMechanicalEffect({
      id, definitionId: `${effect.definitionId}:completed`, label: `${effect.label}（${grant.continueUntilUsed ? '已满足最短时长，可结束' : '已完成'}）`, kind: 'buff',
      targetId: recipientId, source: { ...effect.source }, tags: ['timed-completion'],
      grantedActivities: grant.activityIds,
      grantedActivitiesSingleUse: grant.singleUse,
      grantedActivityTargetIds: grant.bindTarget ? [grant.bindTarget === 'source' ? effect.source.actorId : input.targetId] : undefined,
      duration: grant.continueUntilUsed ? { type: 'permanent' } : { type: 'rounds', remainingRounds: grant.availableRounds, tickOn: 'target-turn-end' },
      // Continuing the same activity preserves its interruption conditions.
      ...(grant.continueUntilUsed ? { removal: effect.removal, breakOn: effect.breakOn } : {}),
      appliedTurnKey: input.appliedTurnKey, stackingPolicy: 'reject', stackingKey: id,
    }) }]
  })
}
