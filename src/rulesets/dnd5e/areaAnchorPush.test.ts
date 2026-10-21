import {settleDnd5eConcentrationChecks} from '../../pages/maps/settleDnd5eCombatResult'
import {expect,it,afterEach} from 'vitest'
import {dnd5eAreaAnchorPush} from './areaAnchorPush'
import {collectDnd5ePersistentAreaTriggers} from './pluginAreas'
import {prepareDnd5ePersistentAreaTrigger,resolvePreparedDnd5ePersistentAreaTrigger} from './pluginAreaTransactions'
import {previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange,resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange} from './headlessCombatEngine'
import {createEmptyMapGeometry,setMapGeometryRuntime} from '../../lib/mapGeometry'
import type {BattleMap,Dnd5ePluginArea,Token} from '../../store/maps'
afterEach(()=>setMapGeometryRuntime([]))
function fixture(){
 const target:Token={id:'target',type:'enemy',label:'Target',x:125,y:125,elevationFeet:5,size:1,hp:50,maxHp:50,color:'',emoji:''}
 const area:Dnd5ePluginArea={id:'wind',pluginId:'test',featureId:'wind',label:'Wind',color:'',sourceTokenId:'caster',sourceCharacterId:'',anchorCell:{col:2,row:2},anchorMode:'fixed',cells:[{col:2,row:2}],createdRound:1,expiresAfterRound:10,includeSelf:true,relation:'any',vertical:{mode:'volume',baseElevationFeet:0,heightFeet:5},triggers:[{id:'end',label:'End',timing:'turn-end',proximityFeet:5,oncePerTurn:true,savingThrow:{ability:'str',dc:15,onSuccess:'half'},damage:{count:1,sides:8,type:'bludgeoning'},forcedMovement:{mode:'push-from-area-anchor',distanceFeet:10,appliesOn:'failed-save'}}]}
 const map:BattleMap={id:'push3d',name:'Map',width:1000,height:1000,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,feetPerCell:5,tokens:[{...target,id:'caster',x:25,y:25,elevationFeet:0},target],dnd5ePluginAreas:[area]}
 return {map,area,target,push:()=>dnd5eAreaAnchorPush({map,area,targetTokenId:target.id,distanceFeet:10})}
}
it('pushes up/down away from volume center without using the caster elevation',()=>{
 const {area,target,push}=fixture()
 expect(push()).toMatchObject({position:{x:125,y:125},elevationFeet:15,distanceFeet:10})
 area.vertical={mode:'volume',baseElevationFeet:15,heightFeet:5};target.elevationFeet=10
 expect(push()).toMatchObject({elevationFeet:0,distanceFeet:10})
 target.elevationFeet=0
 expect(push()).toMatchObject({elevationFeet:0,distanceFeet:0})
})
it('rejects overhead obstruction and occupied destinations without mutating the input',()=>{
 const {map,push,target}=fixture(),geometry=createEmptyMapGeometry(map.id,1)
 geometry.obstacles=[{id:'ceiling',kind:'obstacle',label:'Ceiling',points:[{x:50,y:50},{x:200,y:50},{x:200,y:200},{x:50,y:200}],baseHeightFeet:11,heightFeet:1,cover:'total',blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,createdAt:1}]
 setMapGeometryRuntime([geometry]);const before=JSON.stringify(map)
 expect(push()).toMatchObject({elevationFeet:5,distanceFeet:0})
 expect(JSON.stringify(map)).toBe(before)
 setMapGeometryRuntime([]);map.tokens.push({...target,id:'above',elevationFeet:10})
 expect(push()).toMatchObject({elevationFeet:5,distanceFeet:0})
})
it('settles failed-save damage and vertical push, then feeds the existing Host fall pipeline',async()=>{
 const {map}=fixture(),candidate=collectDnd5ePersistentAreaTriggers({map,round:1,timing:'turn-end',turnKey:'1:target',targetTokenId:'target'})[0]
 const prepared=prepareDnd5ePersistentAreaTrigger({combatId:'push3d',round:1,map,characters:[],candidate,initiativeOrder:map.tokens.map(t=>({tokenId:t.id,roll:10,label:t.label,color:'',emoji:''}))})
 expect(prepared.ok).toBe(true);if(!prepared.ok)throw Error(prepared.reason)
 const resolved=resolvePreparedDnd5ePersistentAreaTrigger({prepared:prepared.prepared,d20:1,damageRolls:[7]})
 expect(resolved.result.ok).toBe(true)
 expect(resolved.result.state.combatants.target).toMatchObject({currentHp:43,elevationFeet:15})
 const falls=previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(prepared.prepared.state,resolved.result.state,['target'])
 expect(falls).toEqual(expect.arrayContaining([expect.objectContaining({combatantId:'target',fallingDamageDice:1})]))
 const landed=resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(prepared.prepared.state,resolved.result.state,{target:[4]},['target'])
 expect(landed.ok).toBe(true)
 expect(landed.state.combatants.target).toMatchObject({currentHp:39,elevationFeet:0})
 const success=resolvePreparedDnd5ePersistentAreaTrigger({prepared:prepared.prepared,d20:20,damageRolls:[7]})
 expect(success.result.state.combatants.target).toMatchObject({currentHp:47,elevationFeet:5})
 if(!resolved.result.ok||!resolved.application)throw Error('missing successful push')
 let requests=0
 const settled=await settleDnd5eConcentrationChecks({priorState:prepared.prepared.state,result:resolved.result,map:resolved.application.map,characters:[],priorApplication:resolved.application,characterIdByCombatantId:{},
  rollUnsupportedAirborneFalls:async(falls)=>{requests++;expect(falls[0]).toMatchObject({combatantId:'target',fallingDamageDice:1});return {target:[4]}},
  rollD20:async()=>10,rollD4:async()=>1,rollDice:async()=>{throw Error('unexpected extra damage roll')}})
 expect(requests).toBe(1)
 expect(settled.result.state.combatants.target).toMatchObject({currentHp:39,elevationFeet:0,airborne:false})
 expect(settled.application.map.tokens.find(t=>t.id==='target')).toMatchObject({hp:39,elevationFeet:0})

})
