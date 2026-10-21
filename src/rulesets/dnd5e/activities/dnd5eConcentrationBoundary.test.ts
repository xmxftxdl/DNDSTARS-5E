import {expect,it} from 'vitest'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction,commitDnd5eActivityExecution} from '../headlessCombatEngine'
import {resolveDnd5eActivity} from './dnd5eActivityExecutor'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'

it.each(['source-turn-start','source-turn-end'] as const)('honors %s for a custom spell concentration and clears its grant at expiry',expiresAt=>{
 const actor=createDnd5eCombatant({id:'caster',name:'Caster',controller:'player',initiative:20,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},
  proficiencyBonus:2,armorClass:10,currentHp:30,maxHp:30,temporaryHp:0,speed:30,concentrating:false,position:{x:0,y:0}})
 const other=createDnd5eCombatant({...actor,id:'other',name:'Other',controller:'dm',initiative:10})
 const state=startDnd5eHeadlessCombat('spell-duration',[actor,other])
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'timed-spell',name:'Timed spell',activation:{kind:'action'},target:{kind:'self'},
  automation:automationCapabilityFromLegacyStatus('full'),
  effects:[{schemaVersion:1,id:'window',name:'Window',stacking:'replace',concentration:true,
    duration:{kind:'rounds',rounds:2,expiresAt},grants:['repeat']}],
  outcomes:[{id:'apply',when:{kind:'always'},operations:[{id:'apply',kind:'apply-effect',target:'actor',effectId:'window'}]}]}
 const snapshot={id:actor.id,controller:actor.controller,level:actor.level,abilities:actor.abilities,proficiencyBonus:actor.proficiencyBonus,armorClass:actor.armorClass,conditions:[]}
 const resolution=resolveDnd5eActivity({activity,actor:snapshot,targets:[snapshot],rolls:{}})
 expect(resolution.ok).toBe(true)
 const committed=commitDnd5eActivityExecution(state,{actorId:actor.id,activityId:activity.id,targetIds:[actor.id],resolution,source:{kind:'spell',id:'custom-timed-spell'}})
 expect(committed.ok,JSON.stringify(committed)).toBe(true)
 let current=committed.state
 for(let elapsed=1;elapsed<=2;elapsed++)for(const id of ['caster','other']){
  const next=resolveDnd5eHeadlessAction(current,{type:'end-turn',actorId:id})
  expect(next.ok).toBe(true);current=JSON.parse(JSON.stringify(next.state))
 }
 expect(current.combatants.caster.concentrating).toBe(expiresAt==='source-turn-end')
 expect(current.combatants.caster.classState.activeEffects?.some(e=>e.grantedActivities?.includes('repeat'))??false).toBe(expiresAt==='source-turn-end')
 if(expiresAt==='source-turn-end'){
  const ended=resolveDnd5eHeadlessAction(current,{type:'end-turn',actorId:'caster'})
  expect(ended.ok).toBe(true);expect(ended.state.combatants.caster.concentrating).toBe(false)
 }
})
