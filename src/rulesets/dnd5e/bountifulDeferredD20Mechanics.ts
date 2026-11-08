import {dnd5ePluginFeatureCurrentEnvelopeFullV1} from './plugins/pluginContentCatalog'
import type {Dnd5eCombatant,Dnd5eCombatEvent} from './headlessCombatEngine'
import type {AllyNaturalOneKind} from './allyNaturalOneCheckpoint'
import type {BountifulMechanicalD20Choice} from './bountifulLuckDeferredD20'
import {dnd5ePluginFeatureDefinition} from './pluginApi'
import {dnd5eDeclarativeResourceKey} from './plugins/pluginDeclarativeCompiler'
import {DND5E_CORE_INSPIRATION_FEATURE_ID,DND5E_CORE_INSPIRATION_RESOURCE_KEY} from '../../lib/d20InterruptPolicy'

/** Invoked at the actual original-d20 checkpoint inside the real Headless
 * transaction, after BL/native Lucky and before hit/save resolution. Every
 * selected face and cost is rechecked; returned ones never revisit raw dice. */
export function consumeDnd5eBountifulDeferredD20(actor:Dnd5eCombatant,kind:AllyNaturalOneKind,original:readonly number[],facts:readonly BountifulMechanicalD20Choice[],events:Dnd5eCombatEvent[],alreadyReplaced:ReadonlySet<number>,metadata?:import('./allyNaturalOneCheckpoint').OriginalD20ReadyMetadata):number[]{
 const values=[...original],visited=new Set<number>(),mode=metadata?.rollMode??(original.length===1?'normal':undefined)
 if(facts.length&&(!mode||original.length!==(mode==='normal'?1:2)))throw Error('bountiful-followup:actual-roll-mode-required')
 for(const fact of facts){
  if(fact.actorId!==actor.id||!Number.isInteger(fact.dieIndex)||fact.dieIndex<0||fact.dieIndex>=values.length||alreadyReplaced.has(fact.dieIndex)||visited.has(fact.dieIndex)||values[fact.dieIndex]!==fact.originalValue||!Number.isInteger(fact.selectedValue)||fact.selectedValue<1||fact.selectedValue>20||fact.rerollValues.some(face=>!Number.isInteger(face)||face<1||face>20))throw Error('bountiful-followup:changed-real-original-die')
  const candidates=[fact.originalValue,...fact.rerollValues]
  const retained=fact.selectionPolicy==='highest'?Math.max(...candidates):fact.selectionPolicy==='lowest'?Math.min(...candidates):fact.selectionPolicy==='must-use-latest'?candidates.at(-1):candidates[fact.selectedIndex]
  if(retained!==fact.selectedValue||candidates[fact.selectedIndex]!==fact.selectedValue)throw Error('bountiful-followup:changed-real-choice')
  const core=fact.featureId===DND5E_CORE_INSPIRATION_FEATURE_ID
  let costs:readonly {resourceKey:string;amount:number}[]
  if(core){
   if(mode!=='normal'||values.length!==1||fact.rerollValues.length!==1||fact.selectionPolicy!=='highest')throw Error('bountiful-followup:invalid-core-inspiration-mode')
   costs=[{resourceKey:DND5E_CORE_INSPIRATION_RESOURCE_KEY,amount:1}]
  }else{
   const feature=dnd5ePluginFeatureDefinition(fact.featureId),ability=feature?.declarativeAbility,mechanic=ability?.mechanic
   if(!feature||!dnd5ePluginFeatureCurrentEnvelopeFullV1(feature.id)||feature.automation!=='full'||ability?.automation!=='full'||!actor.pluginFeatureIds.includes(feature.id)||mechanic?.kind!=='d20-choice-reroll'||!mechanic.rollKinds.includes(kind)||!mechanic.scopes.includes('self-roll')||(mechanic.requiresAdvantage===true&&mode!=='advantage')||(mode==='advantage'&&mechanic.requiresAdvantage!==true)||mode==='disadvantage'||(mechanic.attackAbilities!=null&&(!metadata?.attackAbility||!mechanic.attackAbilities.includes(metadata.attackAbility)))||mechanic.triggerD20Values&&!mechanic.triggerD20Values.includes(fact.originalValue)||mechanic.additionalDice!==fact.rerollValues.length||mechanic.selection!==fact.selectionPolicy)throw Error('bountiful-followup:current-feature-unavailable')
   costs=(ability.cost?.resources??[]).map(cost=>({resourceKey:cost.scope==='core'?cost.resourceId:dnd5eDeclarativeResourceKey(feature.ownerPluginId,cost),amount:cost.amount}))
  }
  if(JSON.stringify(costs)!==JSON.stringify(fact.resourceCosts)||new Set(costs.map(cost=>cost.resourceKey)).size!==costs.length||costs.some(cost=>!Number.isSafeInteger(cost.amount)||cost.amount<1||(cost.resourceKey===DND5E_CORE_INSPIRATION_RESOURCE_KEY?!Number.isSafeInteger(actor.inspiration)||(actor.inspiration??0)<cost.amount:(actor.classResources[cost.resourceKey]?.current??0)<cost.amount)))throw Error('bountiful-followup:current-cost-unavailable')
  for(const cost of costs){
   if(cost.resourceKey===DND5E_CORE_INSPIRATION_RESOURCE_KEY){
    actor.inspiration=(actor.inspiration??0)-cost.amount
    events.push({type:'class-state-changed',actorId:actor.id,stateKey:DND5E_CORE_INSPIRATION_RESOURCE_KEY,active:actor.inspiration>0,value:actor.inspiration})
   }else{
    actor.classResources={...actor.classResources,[cost.resourceKey]:{...actor.classResources[cost.resourceKey],current:actor.classResources[cost.resourceKey].current-cost.amount}}
    const pool=actor.classResources[cost.resourceKey]
    events.push({type:'class-resource-spent',actorId:actor.id,resourceKey:cost.resourceKey,current:pool.current,max:pool.max})
   }
  }
  values[fact.dieIndex]=fact.selectedValue;visited.add(fact.dieIndex)
  events.push({type:'class-state-changed',actorId:actor.id,stateKey:fact.featureId+':deferred-d20',active:true,value:fact.selectedValue})
 }
 return values
}
