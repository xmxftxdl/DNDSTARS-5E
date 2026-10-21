import type { resolveDnd5eDeathSaveReaction, Dnd5eDeathSaveReactionDecision } from './deathSaveReactionFlow'
import { dnd5eActivityChoiceIsRelevantV1 } from './activities/dnd5eActivityChoices'
import { dnd5eCombatantPairKey, dnd5eDirectedCombatantPairKey } from './headlessCombatPrimitives'
import { dnd5eCombatantCanSee } from './headlessCombatEngine'

export interface Dnd5eDeathSaveChoicePrompt {
  id:string;packageId:string;activityId:string;name:string;prompt:string
  options:readonly {id:string;label:string;description?:string}[]
  defaultOptionId:string
}

/** Uses the existing room choice transport, including actor ownership. */
export async function chooseDnd5eDeathSaveReaction(
  request:Parameters<Parameters<typeof resolveDnd5eDeathSaveReaction>[0]['choose']>[0],
  prompt:(request:Dnd5eDeathSaveChoicePrompt)=>Promise<string|null|undefined>,
):Promise<Dnd5eDeathSaveReactionDecision>{
  const first=request.candidates[0]
  if(!first)return {kind:'decline'}
  const selected=await prompt({id:'ability',packageId:first.packageId,activityId:first.activity.id,name:'死亡豁免替代',
    prompt:'选择替代能力，或继续进行死亡豁免。',defaultOptionId:'decline',options:[
      ...request.candidates.map((candidate,index)=>({id:`ability-${index}`,label:candidate.activity.name,description:candidate.activity.description})),
      {id:'decline',label:'进行死亡豁免'},{id:'cancel',label:'取消本次操作'}]})
  if(selected==='decline')return {kind:'decline'}
  const candidate=request.candidates.find((_entry,index)=>selected===`ability-${index}`)
  if(!candidate)return {kind:'cancel'}
  const base={packageId:candidate.packageId,activityId:candidate.activity.id,name:candidate.activity.name}
  const choices:Record<string,string>={}
  for(const choice of candidate.activity.choices??[]){
    if(!dnd5eActivityChoiceIsRelevantV1(candidate.activity,choice,choices))continue
    const value=await prompt({...base,id:`choice-${choice.id}`,prompt:choice.label,defaultOptionId:'cancel',
      options:[...choice.options.map(option=>({id:`option-${option.id}`,label:option.label,description:option.description})),{id:'cancel',label:'取消本次操作'}]})
    const option=choice.options.find(entry=>value===`option-${entry.id}`)
    if(!option)return {kind:'cancel'}
    choices[choice.id]=option.id
  }
  const target=candidate.activity.target,actor=request.state.combatants[request.actorId]
  if(target.kind==='self')return {kind:'replace',...base,targetIds:[request.actorId],choices}
  if(target.kind!=='creature'||!actor)return {kind:'cancel'}
  const targets=Object.values(request.state.combatants).filter(other=>{
    if(other.id===actor.id && !target.includeSelf)return false
    if(target.relation==='ally' && other.controller!==actor.controller || target.relation==='enemy' && other.controller===actor.controller)return false
    const distance=other.id===actor.id?0:request.state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(actor.id,other.id)]
    if(target.rangeFeet!=null && (distance==null || !Number.isFinite(distance) || distance>target.rangeFeet || distance<(target.minimumRangeFeet??0)))return false
    if(target.requiresLineOfSight && !dnd5eCombatantCanSee(request.state,actor.id,other.id))return false
    if(target.requiresTargetSeeActor && !dnd5eCombatantCanSee(request.state,other.id,actor.id))return false
    return !target.requiresLineOfEffect || request.state.lineOfEffectBlockedByCombatantPair?.[dnd5eDirectedCombatantPairKey(actor.id,other.id)]!==true
  })
  const selectedTargets=new Set<string>()
  // A bounded interactive toggle menu keeps names visible and permits deselection.
  for(let step=0;step<1024;step++){
    const value=await prompt({...base,id:`targets-${step}`,prompt:`选择受影响生物（已选 ${selectedTargets.size}，最多 ${target.count}）；点击名字切换选择。`,defaultOptionId:'cancel',
      options:[...targets.flatMap((other,index)=>selectedTargets.has(other.id)||selectedTargets.size<target.count
        ?[{id:`target-${index}`,label:`${selectedTargets.has(other.id)?'✓ ':''}${other.name}`}]:[]),
        ...(selectedTargets.size>=(target.minimumCount??1)?[{id:'done',label:selectedTargets.size?'确认目标':'不影响任何生物'}]:[]),{id:'cancel',label:'取消本次操作'}]})
    if(value==='done' && selectedTargets.size>=(target.minimumCount??1))return {kind:'replace',...base,targetIds:[...selectedTargets],choices}
    const other=targets.find((_entry,index)=>value===`target-${index}`)
    if(!other)return {kind:'cancel'}
    if(selectedTargets.has(other.id))selectedTargets.delete(other.id)
    else if(selectedTargets.size<target.count)selectedTargets.add(other.id)
    else return {kind:'cancel'}
  }
  return {kind:'cancel'}
}
