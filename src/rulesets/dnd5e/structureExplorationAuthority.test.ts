import {expect,it} from 'vitest'
import {mutatePlayerExplorationMoveState} from '../../../scripts/player-exploration-move.mjs'
import {createEmptyMapGeometry,mapGeometryMovementBlocked,mapGeometryPlacementBlocked} from '../../lib/mapGeometry'
import {placeDnd5eStructureStairs} from './structureStairs'
import {placeDnd5eStructureFloors} from './structureFloors'
import type {BattleMap} from '../../store/maps'
import {structureSolidBodyBlocked} from '../../../shared/structure-solid-collision.mjs'

it('preserves concave openings, floor contact and clearance while detecting swept body edges',()=>{
 const slab={points:[{x:0,y:0},{x:100,y:0},{x:100,y:20},{x:20,y:20},{x:20,y:100},{x:0,y:100}],baseHeightFeet:10,heightFeet:1}
 const p=(x:number,y:number,z:number)=>({x,y,elevationFeet:z})
 expect(structureSolidBodyBlocked(slab,p(50,50,8),p(80,80,8),5,5)).toBe(false)
 expect(structureSolidBodyBlocked(slab,p(30,50,8),p(24,50,8),5,5)).toBe(true)
 expect(structureSolidBodyBlocked(slab,p(10,30,11),p(10,80,11),5,5)).toBe(false)
 expect(structureSolidBodyBlocked(slab,p(10,30,5),p(10,80,5),5,5)).toBe(false)
 expect(structureSolidBodyBlocked(slab,p(50,50,0),p(10,50,12),5,5)).toBe(true)
})

it('rejects ascending through an intact ceiling even when the path stays inside its perimeter',()=>{
 const {current,geometry,run}=fixture()
 const ceiling=placeDnd5eStructureFloors({map:current.maps[0],geometry,structureId:'ceiling',origin:{x:0,y:0},rotationDegrees:0,elevationFeet:0,createdAt:1,
  floors:[{id:'slab',x:0,y:0,widthFeet:10,depthFeet:10,topFeet:7,thicknessInches:6}]})
 geometry.obstacles=ceiling.obstacles
 const path=[25,75].map(x=>({x,y:25}))
 const probe={map:current.maps[0],geometry,token:current.maps[0].tokens[0]}
 expect(mapGeometryMovementBlocked({...probe,to:path[1],fromElevationFeet:0,toElevationFeet:12})).toMatchObject({blocked:true})
 expect(mapGeometryPlacementBlocked({...probe,at:path[1],elevationFeet:5})).toMatchObject({blocked:true})
 expect(run(current,path)).toMatchObject({ok:false,error:'exploration-move-wall-blocked'})
 geometry.obstacles.filter(o=>o.id.startsWith('ceiling:')).forEach(o=>o.dnd5eDurability!.hitPoints=0)
 expect(run(current,path)).toMatchObject({ok:true,acceptedElevationFeet:5})
 expect(mapGeometryMovementBlocked({...probe,to:path[1],fromElevationFeet:0,toElevationFeet:5})).toMatchObject({blocked:false})
})

function fixture(){
 const token={id:'hero',type:'player' as const,characterId:'pc',label:'Hero',color:'',emoji:'',size:1,x:25,y:25,elevationFeet:0}
 const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[token]}
 const placement={map,geometry:createEmptyMapGeometry(map.id,1),structureId:'keep',origin:{x:25,y:25},rotationDegrees:0,elevationFeet:0,createdAt:1}
 let geometry=placeDnd5eStructureStairs({...placement,stairs:[{id:'flight',from:{x:0,y:0,elevationFeet:0},to:{x:20,y:0,elevationFeet:20},widthFeet:5,thicknessInches:6}]})
 geometry=placeDnd5eStructureFloors({...placement,geometry,floors:[{id:'floor',x:22.5,y:-2.5,widthFeet:20,depthFeet:10,topFeet:20,thicknessInches:6}]})
 const current={maps:[map]},context={characterState:{characters:[{id:'pc',rulesetId:'dnd5e-2014-srd-5.1',roomMemberId:'owner',currentHp:20}]},geometryState:{maps:[geometry]}}
 const run=(state:typeof current,path:{x:number;y:number}[])=>mutatePlayerExplorationMoveState(state,{operation:'move-owned-token',mapId:'map',tokenId:'hero',characterId:'pc',expectedPosition:path[0],targetPosition:path.at(-1),path},100,{memberId:'owner'},context)
 return {current,context,geometry,run}
}
it('authoritatively ascends, stays on the upper floor across moves, and descends without client-provided elevations',()=>{
 const {current,run}=fixture(),before=structuredClone(current)
 const up=run(current,[25,75,125,175,225,275].map(x=>({x,y:25})))
 expect(up).toMatchObject({ok:true,changed:true})
 const state=(up as any).next
 expect(state.maps[0].tokens[0]).toMatchObject({x:275,y:25,elevationFeet:20})
 const across=run(state,[{x:275,y:25},{x:325,y:25}]) as any
 expect(across.next.maps[0].tokens[0].elevationFeet).toBe(20)
 const down=run(across.next,[325,275,225,175,125,75,25].map(x=>({x,y:25}))) as any
 expect(down).toMatchObject({ok:true})
 expect(down.next.maps[0].tokens[0].elevationFeet).toBe(0)
 expect(current).toEqual(before)
})
it('rejects a stair route through an occupied height and cannot gain elevation from destroyed stairs',()=>{
 const {current,geometry,run}=fixture()
 current.maps[0].tokens.push({...current.maps[0].tokens[0],id:'blocker',characterId:'other',x:75,elevationFeet:5})
 expect(run(current,[25,75,125,175,225].map(x=>({x,y:25})))).toMatchObject({ok:false,error:'exploration-move-path-occupied'})
 current.maps[0].tokens.pop()
 geometry.obstacles.filter(o=>o.stairPath).forEach(o=>o.dnd5eDurability!.hitPoints=0)
 const outcome=run(current,[25,75,125,175,225].map(x=>({x,y:25}))) as any
 expect(outcome).toMatchObject({ok:true})
 expect(outcome.next.maps[0].tokens[0].elevationFeet).toBe(0)
})
