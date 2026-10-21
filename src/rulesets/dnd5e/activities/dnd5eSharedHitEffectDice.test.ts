import {expect,it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import {resolveDnd5eActivity} from './dnd5eActivityExecutor'
import {validateDnd5eActivityDefinitionV1} from './dnd5eActivityValidation'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'

const actor={id:'actor',controller:'players' as const,level:3,proficiencyBonus:2,abilities:{str:10,dex:16,con:12,int:10,wis:10,cha:16},armorClass:13,conditions:[],currentHp:20,maxHp:20}
const target={...actor,id:'target',controller:'dm' as const}
const die={kind:'dice' as const,rollId:'shared',count:1,sides:6}
const definition:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'hit-defense',name:'Hit defense',activation:{kind:'free'},
 invocation:{kind:'triggered',event:'attack-hit',confirmation:'actor-choice',retention:'single-event'},
 target:{kind:'creature',relation:'enemy',count:1},automation:automationCapabilityFromLegacyStatus('full'),
 effects:[{schemaVersion:1,id:'defense',name:'Defense',stacking:'replace',duration:{kind:'rounds',rounds:1,expiresAt:'source-turn-start'},modifiers:[{kind:'armor-class',mode:'add',value:die}]}],
 outcomes:[{id:'hit',when:{kind:'always'},operations:[
  {id:'damage',kind:'damage',target:'target',damageType:'slashing',critical:'double-dice',amount:die},
  {id:'defense',kind:'apply-effect',target:'actor',effectId:'defense'}]}]}

it.each([false,true])('reuses base hit dice for AC while critical=%s doubles damage only',critical=>{
 expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
 const result=resolveDnd5eActivity({activity:JSON.parse(JSON.stringify(definition)),actor,targets:[target],confirmedBy:'actor',rolls:{shared:{values:critical?[3,5]:[3]}},
  triggerContext:{eventId:'hit',event:'attack-hit',eligibleActorIds:['actor'],eligibleTargetIds:['target'],source:{kind:'attack',mode:'melee',category:'weapon',result:critical?'critical-hit':'hit'}}})
 expect(result.ok,JSON.stringify(result)).toBe(true)
 if(!result.ok)return
 expect(result.proposals).toContainEqual(expect.objectContaining({kind:'deal-damage',amount:critical?8:3}))
 expect(result.proposals).toContainEqual(expect.objectContaining({kind:'apply-effect',targetId:'actor',modifierGroups:[{armorClassBonus:3}]}))
})

it('rejects an oversized ordinary pool and an invalid critical die',()=>{
 for(const [critical,values] of [[false,[3,5]],[true,[3,7]]] as const){
  const result=resolveDnd5eActivity({activity:definition,actor,targets:[target],confirmedBy:'actor',rolls:{shared:{values}},
   triggerContext:{eventId:'hit',event:'attack-hit',eligibleActorIds:['actor'],eligibleTargetIds:['target'],source:{kind:'attack',mode:'melee',category:'weapon',result:critical?'critical-hit':'hit'}}})
  expect(result.ok).toBe(false)
 }
})
