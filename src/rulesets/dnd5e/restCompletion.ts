import {createDnd5eMechanicalEffect,effectiveDnd5eActiveEffects,reconcileDnd5eEffectCompletionRequirements,type Dnd5eActiveEffectInstance} from './activeEffects'

export function dnd5eRestCompletionLockoutId(effect: Pick<Dnd5eActiveEffectInstance,'source'|'definitionId'>): string {
  return `rest-completion:${effect.source.pluginId ?? 'native'}:${effect.source.rulesId ?? effect.definitionId}`
}

export function dnd5eHasRestCompletionLockout(effects: readonly Dnd5eActiveEffectInstance[] | undefined, source: Pick<Dnd5eActiveEffectInstance,'source'|'definitionId'>): boolean {
  const definitionId=dnd5eRestCompletionLockoutId(source)
  // Receipts stay authoritative even if an unrelated presentation effect hides them.
  return (effects??[]).some(effect=>effect.definitionId===definitionId)
}

/** Only callers that actually advanced the duration may supply expiredEffectIds.
 * Lockouts are also receipts: an existing receipt prevents duplicate recovery,
 * regardless of the caster, and normal long-rest cleanup removes it.
 */
export function planDnd5eExpiredRestCompletions(input: {
  targetId:string; effects:readonly Dnd5eActiveEffectInstance[]; expiredEffectIds:readonly string[]
}): {completed: Dnd5eActiveEffectInstance[]; lockouts: Dnd5eActiveEffectInstance[]} {
  const effects=reconcileDnd5eEffectCompletionRequirements(input.effects)
  const effectiveIds=new Set(effectiveDnd5eActiveEffects(effects).map(effect=>effect.id))
  // Both combat and exploration expiry use this plan. A denied rest must not
  // grant recovery or issue a receipt claiming that recovery was received.
  if (effects.some(effect => effectiveIds.has(effect.id) && effect.modifiers?.preventRestBenefits === true)) {
    return { completed: [], lockouts: [] }
  }
  const expired=new Set(input.expiredEffectIds)
  const recorded=new Set(effects.map(effect=>effect.definitionId))
  const completed:Dnd5eActiveEffectInstance[]=[],lockouts:Dnd5eActiveEffectInstance[]=[]
  for(const effect of effects){
    if(!expired.has(effect.id)||effect.duration.type!=='rounds'||effect.completionReward?.kind!=='short-rest'||
      !effect.completionRequirement||effect.completionRequirement.interrupted||!effectiveIds.has(effect.id))continue
    const definitionId=dnd5eRestCompletionLockoutId(effect)
    if(recorded.has(definitionId))continue
    recorded.add(definitionId)
    completed.push(effect)
    lockouts.push({...createDnd5eMechanicalEffect({definitionId,label:`${effect.label}（长休前不能再次受益）`,
      targetId:input.targetId,source:{kind:'system',rulesId:definitionId,pluginId:effect.source.pluginId,magical:false},duration:{type:'permanent'},breakOn:['long-rest-complete'],
      stackingPolicy:'reject',stackingKey:`${definitionId}:${input.targetId}`,modifiers:{}}),legacyCondition:`rule-state:${definitionId}`})
  }
  return {completed,lockouts}
}
