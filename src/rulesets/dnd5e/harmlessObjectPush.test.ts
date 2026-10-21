import {expect,it} from 'vitest'
import type {BattleMap} from '../../store/maps'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import {applyDnd5eActivityMapHandoffsV1} from './activities/dnd5eActivityMapInteraction'
import type {Dnd5eActivityDefinitionV1} from './activities/dnd5eActivityContracts'
import {validateDnd5eActivityDefinitionV1} from './activities/dnd5eActivityValidation'
const limits={minimumWeightPounds:0,maximumWeightPounds:5,additionalWeightPoundsPerSlot:0,baseSlotLevel:0,distanceFeet:10}
const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'push',name:'Push',activation:{kind:'action'},automation:automationCapabilityFromLegacyStatus('full'),target:{kind:'area',origin:'point',shape:'rect',widthFeet:5,lengthFeet:5,heightFeet:5,placeRangeFeet:30,relation:'any'},outcomes:[{id:'push',when:{kind:'always'},operations:[{id:'push',kind:'launch-map-object',limits,harmlessPush:true,amount:{kind:'constant',value:0},damageType:'bludgeoning'}]}]}
it.each(['clear','creature','wall','edge','heavy','unknown','held','damage-payload'] as const)('harmless object push is authoritative and non-damaging: %s',mode=>{
 const map:BattleMap={id:'harmless',name:'Map',width:mode==='edge'?200:1000,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[
  {id:'caster',label:'Caster',type:'player',x:75,y:75,size:1,color:'',emoji:'',hp:20,maxHp:20},
  {id:'object',label:'Object',type:'obstacle',x:175,y:75,size:0.2,color:'',emoji:'',dnd5eObjectState:{schemaVersion:1,weightPounds:mode==='unknown'?undefined:mode==='heavy'?5.1:5,wornOrCarried:mode==='held'}}]}
 if(mode==='creature')map.tokens.push({id:'creature',label:'Creature',type:'enemy',x:250,y:75,size:1,color:'',emoji:'',hp:20,maxHp:20})
 const geometry=createEmptyMapGeometry(map.id,1)
 if(mode==='wall')geometry.walls.push({id:'wall',kind:'wall',label:'Wall',points:[{x:225,y:0},{x:225,y:200}],blocksMovement:true,blocksVision:false,blocksLineOfEffect:false,baseHeightFeet:0,heightFeet:10,createdAt:1})
 const before=structuredClone(map)
 const result=applyDnd5eActivityMapHandoffsV1({map,activity,packageId:'test.push',actionId:'push1',actorId:'caster',round:1,objectFlightGeometry:geometry,
  handoffs:{movements:[],persistentAreas:[],summons:[],invocations:[],mapObjectLaunches:[{kind:'launch-map-object',operationId:'push',limits,castLevel:0,harmlessPush:true,amount:mode==='damage-payload'?1:0,damageType:'bludgeoning'}]},selection:{},
  areaSelection:{anchorCell:{col:3,row:1},cells:[{col:3,row:1}],targetIds:[],areaPlacement:{x:175,y:75,angleDegrees:180,objectLaunchPitchDegrees:90},areaPlacementDistanceFeet:10}})
 expect(map).toEqual(before)
 expect(result.ok).toBe(!['heavy','unknown','held','damage-payload'].includes(mode))
 if(result.ok){
  expect(result.map.tokens.find(t=>t.id==='object')?.x).toBe(mode==='edge'?200:mode==='wall'||mode==='creature'?225:275)
  expect(result.map.tokens.map(t=>t.hp)).toEqual(map.tokens.map(t=>t.hp))
  expect(result.map.dnd5eObjectFlightDepartures??[]).toEqual([])
  expect(result.geometryEntityPatches).toEqual([])
 }
})
it('requires an explicitly harmless zero-damage declaration without a save',()=>{
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 for(const patch of [{amount:{kind:'constant',value:1}},{savingThrowCheckId:'save'},{harmlessPush:false}]){
  const invalid=structuredClone(activity);Object.assign(invalid.outcomes[0].operations[0],patch)
  expect(validateDnd5eActivityDefinitionV1(invalid).length).toBeGreaterThan(0)
 }
})
