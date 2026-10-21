import {expect,it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import {formatDnd5eCombatLogDetails} from '../../lib/combatLogDetails'
import {createDnd5eMechanicalEffect} from './activeEffects'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,commitDnd5eActivityExecution,dnd5ePersistentDetectionReports,dnd5eCombatantPairKey,dnd5eDirectedCombatantPairKey,resolveDnd5eHeadlessAction} from './headlessCombatEngine'
import {resolveDnd5eActivity} from './activities/dnd5eActivityExecutor'
import {dnd5eActivityActorSnapshotFromCombatantV1} from './activities/dnd5eActivityCombatAuthority'
import type {Dnd5eActivityDefinitionV1} from './activities/dnd5eActivityContracts'

it('detects only unprotected nearby undead without concentration or identity disclosure',()=>{
 const make=(id:string,type:string,initiative:number)=>createDnd5eCombatant({id,name:id,controller:id==='actor'?'player':'dm',initiative,creatureType:type,abilities:{str:10,dex:10,con:10,int:10,wis:16,cha:10},proficiencyBonus:2,armorClass:10,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
 const state=startDnd5eHeadlessCombat('sense',[make('actor','humanoid',20),make('secret-lich','undead',10),make('celestial','celestial',5)])
 state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('actor','secret-lich')]:60,[dnd5eCombatantPairKey('actor','celestial')]:5}
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'sense',name:'Sense',activation:{kind:'action'},target:{kind:'self'},automation:automationCapabilityFromLegacyStatus('full'),outcomes:[{id:'sense',when:{kind:'always'},operations:[{id:'sense',kind:'mechanic',handlerId:'core.persistent-detection',target:'actor',parameters:{mode:'undead-presence','range-feet':60,'duration-rounds':1,'duration-mode':'source-turn-end'}}]}]}
 const actor=dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.actor)
 const resolution=resolveDnd5eActivity({activity,actor,targets:[actor],rolls:{},distanceFeetByTargetId:{actor:0}})
 expect(resolution.ok).toBe(true)
 const committed=commitDnd5eActivityExecution(state,{actorId:'actor',activityId:activity.id,targetIds:['actor'],resolution,source:{kind:'feature',id:'sense',packageId:'test.sense'}})
 expect(committed.ok,JSON.stringify(committed)).toBe(true)
 if(!committed.ok)throw Error('commit failed')
 const restored=JSON.parse(JSON.stringify(committed.state)) as typeof state
 const reports=()=>dnd5ePersistentDetectionReports(restored,'actor')
 expect(restored.combatants.actor.concentrating).toBe(false)
 expect(reports()[0].presences.map(p=>p.targetId)).toEqual(['secret-lich'])
 const details=formatDnd5eCombatLogDetails([{type:'spell-detection-updated',actorId:'actor',spellId:'sense',mode:'undead-presence',presences:reports()[0].presences}],{resolveName:id=>id})
 expect(details.join('')).toContain('感知到亡灵存在')
 expect(details.join('')).not.toContain('secret-lich')
 // Ordinary invisibility/darkness is not physical total cover.
 restored.lineOfSightBlockedByCombatantPair={[dnd5eCombatantPairKey('actor','secret-lich')]:true}
 restored.combatants['secret-lich'].conditions=['invisible']
 expect(reports()[0].presences.map(p=>p.targetId)).toEqual(['secret-lich'])
 restored.distanceFeetByCombatantPair![dnd5eCombatantPairKey('actor','secret-lich')]=61
 expect(reports()[0].presences).toEqual([])
 const emptyDetails=formatDnd5eCombatLogDetails([{type:'spell-detection-updated',actorId:'actor',spellId:'sense',mode:'undead-presence',presences:[]}],{resolveName:id=>id})
 expect(emptyDetails.join('')).toContain('未感知到亡灵存在')
 restored.distanceFeetByCombatantPair![dnd5eCombatantPairKey('actor','secret-lich')]=60
 restored.physicalLineOfSightBlockedByCombatantPair={[dnd5eDirectedCombatantPairKey('actor','secret-lich')]:true}
 expect(reports()[0].presences).toEqual([])
 restored.physicalLineOfSightBlockedByCombatantPair={}
 restored.combatants['secret-lich'].classState.activeEffects=[createDnd5eMechanicalEffect({definitionId:'protection',label:'Protection',targetId:'secret-lich',source:{kind:'spell',actorId:'secret-lich'},modifiers:{spellTargetingImmunitySchools:['divination']}})]
 expect(reports()[0].presences).toEqual([])
 let current=committed.state
 for(const [index,id] of ['actor','secret-lich','celestial','actor'].entries()) {
  const next=resolveDnd5eHeadlessAction(current,{type:'end-turn',actorId:id})
  expect(next.ok).toBe(true);current=next.state
  expect(dnd5ePersistentDetectionReports(current,'actor').length).toBe(index===3?0:1)
 }
})
