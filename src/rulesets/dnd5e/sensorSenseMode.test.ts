import {expect,it} from 'vitest'
import {migrateMapsState} from '../../store/maps'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import type {Dnd5eActivityDefinitionV1} from './activities/dnd5eActivityContracts'
import {validateDnd5eActivityDefinitionV1} from './activities/dnd5eActivityValidation'
import {applyDnd5eActivityMapHandoffsV1} from './activities/dnd5eActivityMapInteraction'

it.each(['projection-sight','projection-hearing'] as const)('commits %s only to the owned sensory area and preserves it after reload',mode=>{
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'sense',name:'Sense',activation:{kind:'action'},automation:automationCapabilityFromLegacyStatus('full'),target:{kind:'self'},
  outcomes:[{id:'switch',when:{kind:'always'},operations:[{id:'switch',kind:'set-granting-area-senses',target:'actor',mode}]}]}
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 const map=migrateMapsState({maps:[{id:'map',name:'Map',width:500,height:500,gridSize:50,feetPerCell:5,tokens:[
  {id:'actor',characterId:'owner',type:'player',x:25,y:25,size:1},
  {id:'sensor',type:'obstacle',x:125,y:25,size:0.25,dnd5eSpellEffect:{schemaVersion:1,spellId:'sensor',sourceCharacterId:'owner',sourceTokenId:'actor',createdRound:1,expiresAfterRound:101,shareVisionWithSource:true,visionFromSource:true,hearingFromSource:true,hiddenBody:true}}],
  dnd5ePluginAreas:[{id:'area',pluginId:'test',featureId:'sensor',label:'Sensor',color:'#fff',sourceTokenId:'actor',sourceCharacterId:'owner',anchorMode:'effect-token',anchorTokenId:'sensor',cells:[{col:2,row:0}],createdRound:1,expiresAfterRound:101,triggers:[],grantedActivities:[{activityId:'sense',label:'Sense'}]}]}]}).maps[0]
 const run=(current=map)=>applyDnd5eActivityMapHandoffsV1({map:current,activity,packageId:'test',actionId:'change',actorId:'actor',round:1,selection:{},grantingPersistentAreaId:'area',
  handoffs:{summons:[],movements:[],invocations:[],persistentAreas:[],areaSenseModes:[{kind:'set-granting-area-senses',operationId:'switch',targetId:'actor',mode}]}})
 const result=run();expect(result.ok,JSON.stringify(result)).toBe(true)
 if(!result.ok)throw Error(result.reason)
 const restored=migrateMapsState(JSON.parse(JSON.stringify({maps:[result.map]}))).maps[0]
 expect(restored.tokens.find(t=>t.id==='sensor')?.dnd5eSpellEffect?.sensorSense).toBe(mode==='projection-sight'?'sight':'hearing')
 expect(map.tokens.find(t=>t.id==='sensor')?.dnd5eSpellEffect?.sensorSense).toBeUndefined()
 const foreign=structuredClone(map);foreign.dnd5ePluginAreas![0].sourceCharacterId='foreign'
 expect(run(foreign).ok).toBe(false)
 const missing=structuredClone(map);missing.tokens.find(t=>t.id==='sensor')!.dnd5eSpellEffect!.hearingFromSource=undefined
 expect(run(missing).ok).toBe(false)
})
