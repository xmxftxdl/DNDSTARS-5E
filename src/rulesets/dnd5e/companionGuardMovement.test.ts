import {afterEach,expect,it} from 'vitest'
import type {BattleMap,Token} from '../../store/maps'
import {createEmptyMapGeometry,setMapGeometryRuntime} from '../../lib/mapGeometry'
import {prepareDnd5eOwnedCompanionMovement} from './companionMovementAction'
import {planDnd5eMonsterTurn} from './monsterTurnPlanner'
import {resolveDnd5eMonsterMapMove} from './monsterMoveAction'

afterEach(()=>setMapGeometryRuntime([]))
function fixture(minX=0,maxX=600,maxY=150){
 const actor:Token={id:'guard',label:'Guard',emoji:'',color:'',type:'enemy',size:1,x:25,y:25,hp:22,maxHp:22,poolId:'srd-5.1:zombie',
  dnd5eSummon:{schemaVersion:1,pluginId:'test',featureId:'summon',sourceCharacterId:'owner',sourceTokenId:'owner-token',createdRound:1,expiresAfterRound:600,side:'enemy',commandPolicy:'persistent-order'},
  dnd5eCombatState:{companionCommand:{schemaVersion:1,sourceOwnerId:'owner-token',sourceFeatureId:'summon',command:'attack',issuedRound:1,persistentOrder:true,
   guardArea:{mapId:'scene',minX,minY:0,maxX,maxY}}}}
 const map:BattleMap={id:'scene',name:'Scene',width:800,height:400,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[actor,
  {id:'intruder',label:'Intruder',emoji:'',color:'',type:'player',size:1,x:275,y:25,hp:100,maxHp:100,poolId:'srd-5.1:goblin'}]}
 const input={map,characters:[],actorTokenId:actor.id,combatId:'guard-test',round:1,
  initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index}))}
 return {map,actor,input}
}
it('walks into an empty guard region before defending and retains its order',()=>{
 const {map,actor,input}=fixture(200,400)
 map.tokens[1].x=675
 const before=structuredClone(map)
 const prepared=prepareDnd5eOwnedCompanionMovement(input)
 expect(prepared?.movement?.result.ok).toBe(true)
 expect(prepared?.destination).toEqual({x:225,y:25})
 expect(planDnd5eMonsterTurn(map,actor)).toMatchObject({moved:true,newPosition:{x:225,y:25},dodged:true,attacked:false})
 expect(map).toEqual(before)
})
it('approaches a distant region across multiple turns without recursive replanning at zero movement',()=>{
 const {map,actor}=fixture(500,700)
 map.tokens[1].x=775
 const plan=planDnd5eMonsterTurn(map,actor)
 expect(plan).toMatchObject({moved:true,newPosition:{x:225,y:25},dodged:true,attacked:false})
})
it('moves to attack an intruder and stops pursuing after it leaves the region',()=>{
 const {map,actor}=fixture()
 expect(planDnd5eMonsterTurn(map,actor)).toMatchObject({moved:true,attacked:true,targetTokenId:'intruder'})
 map.tokens[1].x=675
 expect(planDnd5eMonsterTurn(map,actor)).toMatchObject({moved:false,attacked:false,dodged:true})
})
it('rejects a detour outside the guard corridor while the same ordinary move remains legal',()=>{
 const {map,actor,input}=fixture(0,400,100)
 const geometry=createEmptyMapGeometry(map.id,1)
 geometry.walls.push({id:'partition',kind:'wall',label:'Partition',points:[{x:150,y:0},{x:150,y:100}],
  blocksVision:false,blocksMovement:true,blocksLineOfEffect:false,baseHeightFeet:0,heightFeet:20,createdAt:1})
 setMapGeometryRuntime([geometry])
 const to={x:175,y:25}
 const guarded=resolveDnd5eMonsterMapMove({...input,to})
 expect(guarded.ok&&guarded.result.ok).toBe(false)
 const plan=planDnd5eMonsterTurn(map,actor)
 // Approaching the partition is legal; routing around it outside the region is not.
 expect(plan).toMatchObject({moved:true,newPosition:{x:125,y:25},attacked:false})
 const approach=resolveDnd5eMonsterMapMove({...input,to:plan.newPosition!,dash:plan.dashed})
 expect(approach.ok&&approach.result.ok,JSON.stringify(approach)).toBe(true)
 const ordinary=structuredClone(map)
 ordinary.tokens[0].dnd5eCombatState!.companionCommand=undefined
 ordinary.tokens[0].dnd5eSummon=undefined
 const allowed=resolveDnd5eMonsterMapMove({...input,map:ordinary,to,dash:true})
 expect(allowed.ok&&allowed.result.ok,JSON.stringify(allowed)).toBe(true)
})
it('does not allow a submitted move to leave the selected guard region',()=>{
 const {input}=fixture(0,200)
 const result=resolveDnd5eMonsterMapMove({...input,to:{x:225,y:25}})
 expect(result.ok&&result.result.ok).toBe(false)
})
