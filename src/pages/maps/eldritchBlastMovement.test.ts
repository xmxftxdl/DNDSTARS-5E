import { afterEach, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import { planEldritchBlastMovement } from './eldritchBlastMovement'
const token = (id:string,x:number):Token => ({id,label:id,x,y:25,color:'',emoji:'',size:1,type:'enemy',hp:30,maxHp:30})
function fixture() {
  const actor=token('actor',25), target=token('target',275)
  const map:BattleMap={id:'pull-map',name:'Pull',width:600,height:300,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[actor,target]}
  return {map,actor,target,push:false,pull:true,positions:new Map<string,{x:number;y:number;elevationFeet?:number}>(),adjudicateFall:async()=>({})}
}
afterEach(()=>setMapGeometryRuntime([]))
it('pulls ten feet and sequentially combines a push and pull',async()=>{
  const input=fixture()
  expect((await planEldritchBlastMovement(input)).fields).toMatchObject({graspOfHadarPullTo:{x:175,y:25},graspOfHadarPullDistanceFeet:10})
  const both=await planEldritchBlastMovement({...fixture(),push:true})
  expect(both.fields).toMatchObject({repellingBlastPushTo:{x:375,y:25},graspOfHadarPullTo:{x:275,y:25}})
})
it('stops at an occupied space and does not spend a blocked pull',async()=>{
  const input=fixture()
  input.map.tokens.push(token('blocker',225))
  expect(await planEldritchBlastMovement(input)).toEqual({fields:{},pulled:false})
})
it('stops at a wall and never overlaps the caster',async()=>{
  const input=fixture()
  const geometry=createEmptyMapGeometry(input.map.id)
  geometry.walls=[{id:'wall',kind:'wall',label:'Wall',points:[{x:250,y:0},{x:250,y:100}],blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,baseHeightFeet:0,heightFeet:10,createdAt:1}]
  setMapGeometryRuntime([geometry])
  expect((await planEldritchBlastMovement(input)).pulled).toBe(false)
  setMapGeometryRuntime([])
  input.target.x=125
  expect((await planEldritchBlastMovement(input)).fields).toMatchObject({graspOfHadarPullTo:{x:75,y:25},graspOfHadarPullDistanceFeet:5})
})
it('records fall metadata and preserves the simulated elevation',async()=>{
  const input=fixture()
  const result=await planEldritchBlastMovement({...input,adjudicateFall:async()=>({toElevationFeet:0,toGroundElevationFeet:0,fallingDamageRolls:[3]})})
  expect(result.fields.graspOfHadarFallingDamageRolls).toEqual([3])
  expect(input.positions.get(input.target.id)?.elevationFeet).toBe(0)
})
