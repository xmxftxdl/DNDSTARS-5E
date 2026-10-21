import {expect,it,beforeEach} from 'vitest'
import type {BattleMap} from '../../../store/maps'
import {setMapGeometryRuntime} from '../../../lib/mapGeometry'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import {applyDnd5eActivityMapHandoffsV1,dnd5eActivityContinuationTeleportCells} from './dnd5eActivityMapInteraction'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'
import {validateDnd5eActivityDefinitionV1} from './dnd5eActivityValidation'
beforeEach(()=>setMapGeometryRuntime([]))
const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'walk',name:'Walk',activation:{kind:'action'},target:{kind:'self'},automation:automationCapabilityFromLegacyStatus('full'),outcomes:[]}
function fixture(feetPerCell=5){
 const map:BattleMap={id:'walk-map',name:'Map',width:500,height:500,gridSize:50,feetPerCell,gridOffsetX:0,gridOffsetY:0,showGrid:true,
  tokens:[{id:'actor',type:'enemy',label:'Actor',x:75,y:75,size:1,emoji:'',color:''}],
  dnd5ePluginAreas:[{id:'rubble',pluginId:'test',featureId:'rubble',label:'Rubble',sourceTokenId:'source',sourceCharacterId:'',
   color:'#888',createdRound:1,expiresAfterRound:1,permanent:true,cells:[{col:2,row:1}],movementCostMultiplier:2}]}
  const movement={kind:'move' as const,operationId:'walk',targetId:'actor',mode:'voluntary' as const,distanceFeet:feetPerCell,usesActorMovement:true,requiresDifferentDestination:true as const}
 return {map,movement}
}
it.each([5,10])('charges actual terrain cost while limiting physical movement to %s feet',feet=>{
 const {map,movement}=fixture(feet)
 const run=(remaining:number)=>applyDnd5eActivityMapHandoffsV1({map,activity,packageId:'test',actionId:'walk',actorId:'actor',round:1,
  actorMovementRemainingFeet:remaining,handoffs:{movements:[movement],persistentAreas:[],summons:[],invocations:[]},selection:{movementCellsByOperationId:{walk:{col:2,row:1}}}})
 const before=structuredClone(map),result=run(30-feet)
 expect(result.ok,JSON.stringify(result)).toBe(true)
 if(result.ok){expect(result.actorMovementRemainingFeet).toBe(30-feet*2);expect(result.map.tokens[0].x).toBe(125)}
 expect(map).toEqual(before)
 expect(run(0).ok).toBe(false)
 expect(dnd5eActivityContinuationTeleportCells({map,actorToken:map.tokens[0],movement,actorMovementRemainingFeet:30-feet})).toContainEqual({col:2,row:1})
 expect(dnd5eActivityContinuationTeleportCells({map,actorToken:map.tokens[0],movement,actorMovementRemainingFeet:0})).not.toContainEqual({col:2,row:1})
})
it('does not grant free movement to callers without a Host budget',()=>{
 const {map,movement}=fixture()
 const result=applyDnd5eActivityMapHandoffsV1({map,activity,packageId:'test',actionId:'walk',actorId:'actor',round:1,
  handoffs:{movements:[movement],persistentAreas:[],summons:[],invocations:[]},selection:{movementCellsByOperationId:{walk:{col:2,row:1}}}})
 expect(result.ok).toBe(false)
})

it.each([5,10])('adjacent-space policy follows %s-foot grid and charges actual terrain cost',feet=>{
 const {map,movement}=fixture(feet)
 const adjacent={...movement,distanceFeet:5,destinationPolicy:'adjacent-space' as const}
 if(feet===10)expect(dnd5eActivityContinuationTeleportCells({map,actorToken:map.tokens[0],movement:{...movement,distanceFeet:5},actorMovementRemainingFeet:25})).toEqual([])
 const run=(col:number,remaining=25)=>applyDnd5eActivityMapHandoffsV1({map,activity,packageId:'test',actionId:'adjacent',actorId:'actor',round:1,
  actorMovementRemainingFeet:remaining,handoffs:{movements:[adjacent],persistentAreas:[],summons:[],invocations:[]},selection:{movementCellsByOperationId:{walk:{col,row:1}}}})
 const result=run(2)
 expect(result.ok,JSON.stringify(result)).toBe(true)
 if(result.ok){expect(result.actorMovementRemainingFeet).toBe(30-2*feet);expect(result.map.tokens[0].x).toBe(125)}
 expect(run(1).ok).toBe(false)
 expect(run(3).ok).toBe(false)
 expect(run(2,0).ok).toBe(false)
 expect(dnd5eActivityContinuationTeleportCells({map,actorToken:map.tokens[0],movement:adjacent,actorMovementRemainingFeet:25})).toContainEqual({col:2,row:1})
 expect(dnd5eActivityContinuationTeleportCells({map,actorToken:map.tokens[0],movement:adjacent,actorMovementRemainingFeet:0})).not.toContainEqual({col:2,row:1})
})

it('adjacent-space forced movement neither spends movement nor silently stays in place when surrounded',()=>{
 const {map,movement}=fixture(10)
 const adjacent={...movement,mode:'forced' as const,usesActorMovement:undefined,distanceFeet:5,destinationPolicy:'adjacent-space' as const}
 const run=(m:BattleMap)=>applyDnd5eActivityMapHandoffsV1({map:m,activity,packageId:'test',actionId:'evade',actorId:'actor',round:1,
  actorMovementRemainingFeet:30,handoffs:{movements:[adjacent],persistentAreas:[],summons:[],invocations:[]},selection:{movementCellsByOperationId:{walk:{col:2,row:1}}}})
 const result=run(map);expect(result.ok,JSON.stringify(result)).toBe(true)
 if(result.ok)expect(result.actorMovementRemainingFeet).toBe(30)
 for(let row=0;row<3;row++)for(let col=0;col<3;col++)if(col!==1||row!==1)map.tokens.push({...map.tokens[0],id:`block-${col}-${row}`,x:col*50+25,y:row*50+25})
 expect(dnd5eActivityContinuationTeleportCells({map,actorToken:map.tokens[0],movement:adjacent})).toEqual([])
 expect(run(map).ok).toBe(false)
})

it('validates adjacent-space as an explicit positional policy',()=>{
 const operation={id:'step',kind:'move',target:'actor',mode:'forced',requiresDifferentDestination:true,destinationPolicy:'adjacent-space',distanceFeet:{kind:'constant',value:5}}
 const validate=(patch:Record<string,unknown>)=>validateDnd5eActivityDefinitionV1({...activity,outcomes:[{id:'move',when:{kind:'always'},operations:[{...operation,...patch}]}]} as Dnd5eActivityDefinitionV1)
 expect(validate({})).toEqual([])
 for(const patch of [{mode:'teleport'},{requiresDifferentDestination:undefined},{destinationPolicy:'anything'},{cardinalDirection:'north'}])expect(validate(patch).join(' ')).toContain('destinationPolicy')
})
