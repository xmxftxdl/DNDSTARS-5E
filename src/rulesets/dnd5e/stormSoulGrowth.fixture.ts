import type {Character} from '../../types/character'
import {normalizeCharacter} from '../../store/characters'
import {buildDnd5eLevelAdvancementPlan,applyDnd5eLevelAdvancement} from './levelAdvancement'
import {restoreClassResources} from '../../lib/classResources'
import {syncDnd5eHitPoints} from './hitPoints'
export function growActualStormSoulBarbarian(subclassId:string,environment='sea',targetLevel=6){
 let actor=normalizeCharacter({id:'storm-breather',name:'Storm Breather',charClass:'野蛮人',level:1,dnd5eClassLevels:{barbarian:1},dnd5eRaceId:'human',race:'人类',hitPointMaximumMode:'fixed',abilities:{str:16,dex:12,con:14,int:10,wis:10,cha:10},savingThrows:['str','con'],skills:['athletics','perception']})
 for(let level=2;level<=targetLevel;level++){
  const selected=level>=3?subclassId:undefined
  const plan=buildDnd5eLevelAdvancementPlan(actor,'barbarian',1,selected)
  if(!plan)throw Error('Actual Barbarian level plan required '+level)
  const choose=(options:readonly {id:string}[],count:number)=>options.map(o=>o.id).sort((a,b)=>Number(b===environment)-Number(a===environment)).slice(0,count)
  const result=applyDnd5eLevelAdvancement(actor,{schemaVersion:1,classId:'barbarian',subclassId:selected,levelsGained:1,hitPointMethod:'fixed',hitPointRolls:[],asiChoices:plan.asiLevels.map(classLevel=>({classLevel,choice:{kind:'ability-score' as const,increases:{str:2}}})),classChoiceSelections:Object.fromEntries(plan.choiceRequirements.map(r=>[r.key,choose(r.options,r.targetLimit)])),contentChoiceSelections:Object.fromEntries(plan.contentAdvancements.map(c=>[c.contentId,Object.fromEntries(c.requirements.map(r=>[r.id,choose(r.options,r.count)]))]))})
  if(!result.ok)throw Error('Barbarian'+level+':'+result.reason)
  actor=restoreClassResources(result.character,'long-rest')
 }
 return syncDnd5eHitPoints(actor)
}

/** Advance the exact persisted Sea6 actor; do not borrow another actor's build. */
export function advanceActualStormSoulEnvironment(actor:Character,subclassId:string,environment:string){
 const plan=buildDnd5eLevelAdvancementPlan(actor,'barbarian',1,subclassId)
 if(!plan)throw Error('Actual next Barbarian level plan required')
 const choose=(options:readonly {id:string}[],count:number)=>options.map(o=>o.id).sort((a,b)=>Number(b===environment)-Number(a===environment)).slice(0,count)
 const result=applyDnd5eLevelAdvancement(actor,{schemaVersion:1,classId:'barbarian',subclassId,levelsGained:1,hitPointMethod:'fixed',hitPointRolls:[],asiChoices:plan.asiLevels.map(classLevel=>({classLevel,choice:{kind:'ability-score' as const,increases:{str:2}}})),classChoiceSelections:Object.fromEntries(plan.choiceRequirements.map(r=>[r.key,choose(r.options,r.targetLimit)])),contentChoiceSelections:Object.fromEntries(plan.contentAdvancements.map(c=>[c.contentId,Object.fromEntries(c.requirements.map(r=>[r.id,choose(r.options,r.count)]))]))})
 if(!result.ok)throw Error('Actual next Barbarian level:'+result.reason)
 return syncDnd5eHitPoints(result.character)
}
