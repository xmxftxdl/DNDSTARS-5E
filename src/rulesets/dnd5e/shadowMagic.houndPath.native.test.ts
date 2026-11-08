import {expect,it} from 'vitest'
import {nativeSummonedHound} from './shadowMagic.summonedHound.native.fixture'
import {resolveDnd5eMonsterMapMove} from './monsterMoveAction'
import {createEmptyMapGeometry,setMapGeometryRuntime} from '../../lib/mapGeometry'
import {findMapGeometryPath} from '../../lib/mapPathfinding'

it('real native Hound takes direct thick-object route even when a longer detour spends less movement',async()=>{
 const f=await nativeSummonedHound(425);try{
  const map={...f.map,tokens:f.map.tokens.map(token=>({...token,y:275}))}
  const geometry=createEmptyMapGeometry(map.id);geometry.obstacles.push({id:'thick-object',kind:'obstacle',label:'Thick object',points:[{x:150,y:250},{x:300,y:250},{x:300,y:300},{x:150,y:300}],surfaceMaterial:'stone',baseHeightFeet:0,heightFeet:20,cover:'total',blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1});setMapGeometryRuntime([geometry])
  const hound=map.tokens.find(token=>token.id===f.houndId)!,to={x:325,y:275}
  const weighted=findMapGeometryPath({map:{...map,tokens:map.tokens.filter(t=>t.id!==hound.id)},geometry,token:hound,to,passThroughObjectsAndCreatures:true})!
  expect(weighted.points.some(point=>point.y!==275),JSON.stringify(weighted)).toBe(true)
  const order=f.snapshot.state.initiativeOrder.map((id,i)=>({tokenId:id,label:id,roll:20-i,color:'',emoji:''}))
  const moved=resolveDnd5eMonsterMapMove({combatId:'hound-direct-route',round:1,map,characters:f.characters,initiativeOrder:order,actorTokenId:hound.id,to})
  expect(moved.ok,JSON.stringify(moved)).toBe(true);if(!moved.ok)throw Error(moved.reason)
  expect(moved.result.ok,JSON.stringify(moved.result)).toBe(true);if(!moved.result.ok)throw Error(moved.result.reason)
  expect(moved.distanceFeet).toBe(20);expect(moved.path.every(point=>point.y===275)).toBe(true)
  expect(moved.result.state.combatants[hound.id].turn.movementSpent).toBe(40)
 }finally{setMapGeometryRuntime([]);f.dispose()}
})
