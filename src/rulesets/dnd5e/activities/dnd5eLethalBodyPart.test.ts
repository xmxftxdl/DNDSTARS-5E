import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, commitDnd5eActivityExecution, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { destroyDnd5eBodyPartAfterLethalDamage } from '../lethalBodyPart'
import { dnd5eActivityActorSnapshotFromCombatantV1 as snapshot } from './dnd5eActivityCombatAuthority'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

const consequence = { part: 'head', vital: true }
const definition: Dnd5eActivityDefinitionV1 = {
 schemaVersion: 1, id: 'lethal-part-test', name: 'Lethal part test', activation: {kind:'action'},
 target:{kind:'creature',relation:'any',count:1},automation:automationCapabilityFromLegacyStatus('full'),
 outcomes:[{id:'damage',when:{kind:'always'},operations:[{id:'hurt',kind:'damage',target:'target',
 amount:{kind:'constant',value:12},damageType:'psychic',magical:true,destroysBodyPartOnDeath:consequence}]}],
}
const make=(id:string,initiative:number)=>createDnd5eCombatant({id,name:id,controller:'dm',initiative,
 abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,
 currentHp:5,maxHp:100,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
it.each(['headed-dead','headless-dead','dying','survives'] as const)('applies a lethal part consequence to the restored body after Polymorph overflow: %s',mode=>{
 const actor=make('actor',20),target=make('target',10)
 target.level=4;target.classState.bodyPartPresence={head:mode!=='headless-dead'}
 if(mode==='dying')target.usesDeathSaves=true
 const initial=startDnd5eHeadlessCombat('part-polymorph',[actor,target])
 const transformed=commitDnd5eActivityExecution(initial,{actorId:actor.id,activityId:'polymorph',targetIds:[target.id],source:{kind:'spell',id:'polymorph'},
  resolution:{ok:true,status:'resolved',checks:[],consumptions:[],proposals:[{kind:'transform-creature',operationId:'shape',targetId:target.id,formId:'srd-5.1:wolf',profile:'polymorph',durationRounds:10,concentration:true,maximumChallengeRating:1}]}})
 expect(transformed.ok).toBe(true)
 expect(transformed.state.combatants.target.currentHp).toBe(11)
 const result=commitDnd5eActivityExecution(transformed.state,{actorId:actor.id,activityId:'mind-damage',targetIds:[target.id],
  resolution:{ok:true,status:'resolved',checks:[],consumptions:[],proposals:[{kind:'deal-damage',operationId:'damage',targetId:target.id,amount:mode==='survives'?12:56,damageType:'psychic',magical:true,destroysBodyPartOnDeath:consequence}]}})
 expect(result.ok).toBe(true)
 const restored=result.state.combatants.target
 expect(restored.classState.wildShapeFormId).toBeUndefined()
 expect(restored.currentHp).toBe(mode==='survives'?4:0)
 expect(restored.deathSaves.dead).toBe(mode==='headed-dead'||mode==='headless-dead')
 expect(restored.classState.missingBodyParts?.includes('head')??false).toBe(mode==='headed-dead')
})
it.each(['dead','dying','immune','temporary-hp','already-dead','headless','unknown'] as const)('only newly lethal damage destroys a known body part: %s',mode=>{
 const actor=make('actor',20),target=make('target',10)
 if(mode!=='unknown')target.classState.bodyPartPresence={head:mode!=='headless'}
 if(mode==='dying')target.usesDeathSaves=true
 if(mode==='immune')target.damageImmunities=['psychic']
 if(mode==='temporary-hp')target.temporaryHp=20
 if(mode==='already-dead'){target.currentHp=0;target.deathSaves.dead=true}
 const state=startDnd5eHeadlessCombat('part',[actor,target])
 const resolution=resolveDnd5eActivity({activity:definition,actor:snapshot(actor),targets:[snapshot(target)],rolls:{}})
 const result=commitDnd5eActivityExecution(state,{actorId:actor.id,activityId:definition.id,targetIds:[target.id],resolution})
 if(mode==='unknown'){expect(result.ok).toBe(false);expect(state.combatants.target.currentHp).toBe(5);return}
 expect(result.ok).toBe(true)
 const after=result.state.combatants.target
 expect(after.classState.missingBodyParts?.includes('head')??false).toBe(mode==='dead')
 expect(after.classState.vitalBodyPartsMissing===true).toBe(mode==='dead')
 expect(after.classState.bodyPresent).not.toBe(false)
 expect(state.combatants.target.classState.missingBodyParts).toBeUndefined()
 if(mode==='dying'){expect(after.currentHp).toBe(0);expect(after.deathSaves.dead).toBe(false)}
 if(mode==='dead'){
  const revival=commitDnd5eActivityExecution(result.state,{actorId:actor.id,activityId:'revive',targetIds:[target.id],
   resolution:{ok:true,status:'resolved',checks:[],consumptions:[],proposals:[{kind:'revive',operationId:'revive',targetId:target.id,hitPoints:1,requiresBody:true}]}})
  expect(revival.ok).toBe(false)
 }
})
it.each([1,20])('deferred death prevention settles before the body-part consequence: d20 %s',d20=>{
 const actor=make('actor',20),target=make('target',10)
 target.currentHp=0;target.classState.bodyPartPresence={head:true}
 target.classState.undeadFortitudePending={dc:10,damage:12}
 destroyDnd5eBodyPartAfterLethalDamage(target,consequence)
 expect(target.classState.missingBodyParts).toBeUndefined()
 const state=JSON.parse(JSON.stringify(startDnd5eHeadlessCombat('part-deferred',[actor,target])))
 const result=resolveDnd5eHeadlessAction(state,{type:'monster-undead-fortitude-save',actorId:target.id,d20})
 expect(result.ok).toBe(true)
 expect(result.state.combatants.target.classState.missingBodyParts?.includes('head')??false).toBe(d20===1)
 expect(result.state.combatants.target.currentHp).toBe(d20===1?0:1)
})
it.each([{part:'',vital:true},{part:'head',vital:'yes'},{part:'head',vital:true,extra:true}])('rejects malformed body-part instructions %j',value=>{
 const invalid=structuredClone(definition)
 Object.assign(invalid.outcomes[0].operations[0],{destroysBodyPartOnDeath:value})
 expect(validateDnd5eActivityDefinitionV1(invalid).join(' ')).toContain('destroysBodyPartOnDeath')
})
