import { expect, it } from 'vitest'
import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'
import { resolveRemoteAreaDismissal } from './remoteAreaDismissal'
import { applyDnd5eActivityMapHandoffsV1 } from './activities/dnd5eActivityMapInteraction'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'

const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'dismiss',name:'Dismiss',activation:{kind:'action'},target:{kind:'self'},
  outcomes:[{id:'end',when:{kind:'always'},operations:[{id:'end',kind:'dismiss-granting-area',target:'actor'}]}],
  automation:automationCapabilityFromLegacyStatus('full')}
const actor={id:'new-token',characterId:'hero',type:'player' as const,label:'Hero',emoji:'',color:'',size:1,x:25,y:25}
const base:BattleMap={id:'current',name:'Current',width:500,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[actor]}
const area:Dnd5ePluginArea={id:'soil',pluginId:'local.soil',featureId:'cast',label:'Soil',color:'#ffffff',sourceTokenId:'old-token',sourceCharacterId:'hero',
  cells:[{col:1,row:1}],anchorMode:'fixed',createdRound:1,expiresAfterRound:600,expiresAtWorldMinute:60,sourceLimit:{groupId:'soil',maximum:2},grantedActivities:[{activityId:'dismiss'}]}
it.each(['valid','expired','unknown-clock','wrong-owner','wrong-package','concentration','moving','missing','mixed-operation','duplicate-map'] as const)('validates remote dismissal: %s',mode=>{
  const remote={...base,id:'remote',tokens:[],dnd5ePluginAreas:[{...area}]}
  if(mode==='wrong-owner')remote.dnd5ePluginAreas[0].sourceCharacterId='other'
  if(mode==='wrong-package')remote.dnd5ePluginAreas[0].pluginId='other'
  if(mode==='concentration')remote.dnd5ePluginAreas[0].concentrationId='spell'
  if(mode==='moving')remote.dnd5ePluginAreas[0].anchorMode='source-token'
  const definition=structuredClone(activity)
  if(mode==='mixed-operation')definition.target={kind:'creature',relation:'any',rangeFeet:30,count:1}
  const maps=mode==='missing'?[]:mode==='duplicate-map'?[remote,remote]:[remote]
  const result=resolveRemoteAreaDismissal({maps,actor,actorMapId:base.id,areaMapId:'remote',areaId:area.id,
    packageId:'local.soil',activity:definition,worldMinute:mode==='expired'?60:mode==='unknown-clock'?undefined:59})
  expect(!!result).toBe(mode==='valid')
})
it('stages an authorized remote removal without mutating either map, and requires commit support',()=>{
  const remote={...base,id:'remote',tokens:[],dnd5ePluginAreas:[area]},before=structuredClone(remote)
  for(const supported of [false,true]){
    const result=applyDnd5eActivityMapHandoffsV1({map:base,sourceLimitMaps:[remote],activity,packageId:'local.soil',
      actionId:'action',actorId:actor.id,round:1,worldMinute:59,selection:{},grantingPersistentAreaId:area.id,
      grantingPersistentAreaMapId:remote.id,supportsRemoteAreaDismissal:supported,
      handoffs:{movements:[],summons:[],persistentAreas:[],areaDismissals:[{operationId:'end',actorId:actor.id}]} as any})
    expect(result.ok).toBe(supported)
    if(result.ok){expect(result.otherMapAreaDismissals).toEqual([{mapId:'remote',area}]);expect(result.endedAreaIds).toEqual([])}
    expect(remote).toEqual(before)
  }
})
