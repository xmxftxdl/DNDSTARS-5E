import {expect,it} from 'vitest'
import {normalizeSharedCampaignTime} from '../../lib/campaignTime'
import {recordCampaignLongRestLocations} from '../../../shared/campaign-rest-locations.mjs'
import type {BattleMap} from '../../store/maps'
import {dnd5eLastLongRestDestination} from './restTeleportationDestination'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import type {Dnd5eActivityDefinitionV1} from './activities/dnd5eActivityContracts'
import {resolveDnd5eActivity} from './activities/dnd5eActivityExecutor'
import {applyDnd5eActivityMapHandoffsV1,resolveDnd5eActivityAreaMapSelectionV1} from './activities/dnd5eActivityMapInteraction'

it('resolves only the current plane and rejects missing, remapped or out-of-bounds destinations',()=>{
 const source={id:'source',dnd5ePlane:'material',width:1000,height:1000,tokens:[]} as unknown as BattleMap
 const destination={...source,id:'camp',tokens:[{id:'hero',type:'player',characterId:'hero',x:325,y:325}]} as BattleMap
 const clock=normalizeSharedCampaignTime(null)
 clock.restLocations=recordCampaignLongRestLocations(undefined,[destination],['hero'],480)
 const input={clock,sourceMap:source,maps:[source,destination],characterId:'hero'}
 expect(dnd5eLastLongRestDestination(input)).toEqual({mapId:'camp',x:325,y:325,elevationFeet:0})
 for(const patch of [{characterId:'other'},{maps:[source]},{maps:[source,{...destination,dnd5ePlane:'feywild'}]},
  {sourceMap:{...source,dnd5ePlane:undefined}},{maps:[source,{...destination,width:100}]}])expect(dnd5eLastLongRestDestination({...input,...patch})).toBeUndefined()
})

it('creates a native portal from the declared Activity, with no map changes when no rest destination exists',()=>{
 const map:BattleMap={id:'source',name:'Source',dnd5ePlane:'material',width:1000,height:1000,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,
  tokens:[{id:'hero',characterId:'hero',type:'player',label:'Hero',x:325,y:325,size:1,color:'#fff',emoji:''}]}
 const destination={...map,id:'camp',tokens:[{...map.tokens[0],x:125,y:125}]}
 const clock=normalizeSharedCampaignTime(null)
 clock.restLocations=recordCampaignLongRestLocations(undefined,[destination],['hero'],480)
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'return',name:'Return',activation:{kind:'free'},target:{kind:'area',relation:'any',origin:'self',shape:'sphere',radiusFeet:5,includeSelf:true},
  automation:automationCapabilityFromLegacyStatus('full'),outcomes:[{id:'portal',when:{kind:'always'},operations:[{id:'portal',kind:'create-persistent-area',label:'Portal',durationRounds:1,concentration:false,teleportationPortal:{destination:'last-long-rest'}}]}]}
 const areaSelection=resolveDnd5eActivityAreaMapSelectionV1({activity,map,actorToken:map.tokens[0],anchorCell:{col:6,row:6}})!
 const result=resolveDnd5eActivity({activity,actor:{id:'hero',controller:'player',level:14,proficiencyBonus:5,armorClass:10,currentHp:20,maxHp:20,conditions:[],abilities:{str:10,dex:10,con:10,int:10,wis:16,cha:10}},targets:[],rolls:{},areaPlacement:areaSelection.areaPlacement,areaPlacementDistanceFeet:0})
 expect(result.ok).toBe(true);if(!result.ok)throw Error('execution failed')
 const input={map,activity,actorId:'hero',packageId:'test.rest',actionId:'return',round:1,worldMinute:480,sourceLimitMaps:[map,destination],restAuthority:{clock,eventId:'short-rest:1'},areaSelection,selection:{},
  handoffs:{summons:[],movements:[],invocations:[],persistentAreas:result.proposals.filter(p=>p.kind==='create-persistent-area')}}
 const before=JSON.stringify(map)
 const applied=applyDnd5eActivityMapHandoffsV1(input)
 expect(applied.ok,JSON.stringify(applied)).toBe(true)
 if(applied.ok)expect(applied.map.dnd5ePluginAreas?.[0]).toMatchObject({coreSpellId:'teleportation-circle',teleportationExit:{mapId:'camp',x:125,y:125,exploration:true}})
 expect(applyDnd5eActivityMapHandoffsV1({...input,restAuthority:{clock:{...clock,restLocations:[]},eventId:'short-rest:1'}}).ok).toBe(false)
 expect(JSON.stringify(map)).toBe(before)
})
