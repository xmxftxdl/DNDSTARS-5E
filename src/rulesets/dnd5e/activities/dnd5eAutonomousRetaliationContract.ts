import {registeredDnd5eRulesPlugins} from '../plugins/pluginRuntimeIndex'
import {dnd5eActivityEffectMatches} from './dnd5eActivityEffectSelector'
import type { Dnd5eActivityDefinitionV1, Dnd5eActivityOperationV1 } from './dnd5eActivityContracts'
import { collectDnd5eFormulaRollDeclarations } from './dnd5eFormula'
import type { Dnd5eHeadlessCombatState } from '../headlessCombatEngine'

/** A maintained effect may retaliate without its bearer taking an action. */
export function isDnd5eAutonomousBoundHpRetaliation(activity: Dnd5eActivityDefinitionV1): boolean {
  if (!activity.requiresEffectGrant || !['free', 'special'].includes(activity.activation?.kind) ||
    activity.target?.kind !== 'creature' || activity.target.count !== 1 ||
    activity.invocation?.kind !== 'triggered' || activity.invocation.event !== 'reaction-window' ||
    activity.invocation.confirmation !== 'automatic' || activity.checks?.length || activity.choices?.length || activity.consumption?.length ||
    !Array.isArray(activity.requirements) || !activity.requirements.some(requirement =>
      requirement?.kind === 'effect-bound-temporary-hit-points' && requirement.subject === 'actor') ||
    !Array.isArray(activity.outcomes) || !activity.outcomes.length) return false
  try {
    return activity.outcomes.every(outcome => Array.isArray(outcome?.operations) && outcome.operations.length > 0 &&
      outcome.operations.every((operation: Dnd5eActivityOperationV1) => operation?.kind === 'damage' && operation.target === 'target' &&
        collectDnd5eFormulaRollDeclarations([operation.amount]).length === 0))
  } catch { return false }
}

export function dnd5eBoundHpRetaliationGrant(actor: Dnd5eHeadlessCombatState['combatants'][string],
  packageId: string, activity: Dnd5eActivityDefinitionV1) {
  if (!isDnd5eAutonomousBoundHpRetaliation(activity)) return undefined
  const pool = actor.classState.temporaryHitPointsSource
  if (!(actor.temporaryHp > 0) || !pool?.effectDefinitionId) return undefined
  return actor.classState.activeEffects?.find(effect => !effect.suspendedBy?.length &&
    effect.source.pluginId === packageId && effect.source.actorId === pool.actorId &&
    effect.grantedActivities?.includes(activity.id) &&
    [effect.definitionId, effect.stackingKey].some(id => id === pool.effectDefinitionId || id?.startsWith(`${pool.effectDefinitionId}:`)))
}

/** An automatic melee-hit consequence maintained by a concrete source-owned Effect. */
export function isDnd5eAutonomousMaintainedRetaliation(activity:Dnd5eActivityDefinitionV1):boolean{
 if(!activity.requiresEffectGrant||!['free','special'].includes(activity.activation?.kind)||activity.target?.kind!=='creature'||activity.target.count!==1||
 activity.invocation?.kind!=='triggered'||activity.invocation.event!=='reaction-window'||activity.invocation.confirmation!=='automatic'||activity.checks?.length||activity.choices?.length||activity.consumption?.length||!activity.requirements?.some(p=>p.kind==='active-effect'&&p.subject==='actor'&&p.source==='self'&&p.present)||
 !activity.requirements.some(p=>p.kind==='attack-delivery'&&p.delivery==='melee')||!activity.requirements.some(p=>p.kind==='distance'&&p.maximumFeet!=null&&p.maximumFeet<=5)||
 !activity.requirements.some(p=>p.kind==='target-identity'&&p.identity==='other')||!activity.outcomes?.length)return false
 return activity.outcomes.every(outcome=>outcome.when.kind==='always'&&outcome.operations.length>0&&outcome.operations.every(op=>op.kind==='damage'&&op.target==='target'))
}
export function dnd5eAutonomousRetaliationGrant(actor:Dnd5eHeadlessCombatState['combatants'][string],packageId:string,activity:Dnd5eActivityDefinitionV1){
 const bound=dnd5eBoundHpRetaliationGrant(actor,packageId,activity);if(bound)return bound
 if(!isDnd5eAutonomousMaintainedRetaliation(activity))return undefined
 return actor.classState.activeEffects?.find(effect=>!effect.suspendedBy?.length&&effect.source.pluginId===packageId&&effect.grantedActivities?.includes(activity.id)&&
 activity.requirements?.some(predicate=>predicate.kind==='active-effect'&&predicate.subject==='actor'&&predicate.source==='self'&&predicate.present&&
 dnd5eActivityEffectMatches(predicate,{definitionId:effect.definitionId,sourceActorId:effect.source.actorId,sourceCharacterId:effect.source.characterId,sourceRulesId:effect.source.rulesId,sourcePluginId:effect.source.pluginId,sourcePluginAvailable:registeredDnd5eRulesPlugins().some(plugin=>plugin.id===effect.source.pluginId),tags:effect.tags},actor.id,undefined,actor.classState.wardingBondParticipantCharacterId)))
}
