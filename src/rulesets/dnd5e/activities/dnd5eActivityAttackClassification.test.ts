import {it,expect,afterEach} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import {createDnd5eCombatant,startDnd5eHeadlessCombat} from '../headlessCombatEngine'
import {registerDnd5eActivityPackage,clearDnd5eActivityRegistryForTests} from './dnd5eActivityRegistry'
import {resolveAndCommitDnd5eActivityCommand} from './dnd5eActivityHeadlessAuthorityBridge'
import {dnd5eActivityActorSnapshotFromCombatantV1} from './dnd5eActivityCombatAuthority'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'
afterEach(clearDnd5eActivityRegistryForTests)
it.each([['spell','ranged'],['spell','melee'],['weapon','ranged'],['weapon','melee']] as const)('preserves %s %s classification independently of feature source', (attackType,delivery)=>{
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'bolt',name:'Synthetic radiant bolt',automation:automationCapabilityFromLegacyStatus('full'),
  legacySource:{kind:'feature',id:'bolt'},activation:{kind:'action'},target:{kind:'creature',count:1,rangeFeet:30,relation:'enemy'},
  consumption:[{kind:'action-economy',economy:'action',amount:1,consumeOn:'resolve'}],
  checks:[{id:'hit',kind:'attack-roll',attackType,delivery,rollId:'hit',rollMode:'normal',attackBonus:{kind:'constant',value:5},scope:'per-target'}],
  outcomes:[{id:'damage',when:{kind:'check',checkId:'hit',result:'success'},operations:[{id:'damage',kind:'damage',target:'target',damageType:'radiant',amount:{kind:'constant',value:5}}]}]}
 registerDnd5eActivityPackage({packageId:'test.bolt-classification',packageVersion:'1.0.0',activities:[activity]})
 const actors=['actor','target'].map((id,i)=>createDnd5eCombatant({id,name:id,controller:i?'dm':'player',initiative:20-i,abilities:{str:10,dex:16,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:i*5,y:0},concentrating:false}))
 const state=startDnd5eHeadlessCombat('bolt',actors)
 const result=resolveAndCommitDnd5eActivityCommand(state,{command:{schemaVersion:1,commandId:'bolt-1',packageId:'test.bolt-classification',packageVersion:'1.0.0',activityId:'bolt',actorId:'actor',targetIds:['target'],expectedRevision:0},currentRevision:0,
 actor:dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.actor),targets:[dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.target)],
 authoritativeRolls:{'hit:target':{values:[15]}},distanceFeetByTargetId:{target:5}})
 expect(result.result.ok,JSON.stringify(result)).toBe(true)
 if(result.phase!=='commit'||!result.result.ok)throw Error('commit failed')
 expect(result.result.state.combatants.target.currentHp).toBe(15)
 expect(result.result.events.find(e=>e.type==='attack-resolved')).toMatchObject({attackMode:attackType==='spell'?'spell':delivery,attackCategory:attackType,attackDelivery:delivery})
 expect(result.result.events.some(e=>e.type==='spell-cast')).toBe(false)
})
