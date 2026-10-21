import { expect, it } from 'vitest'
import { mapGeometryCanSeeToken, mapGeometryCanSeePoint, mapGeometryVisibilityPolygon } from './mapGeometry'
import { createDnd5eMechanicalEffect } from '../rulesets/dnd5e/activeEffects'
import type { BattleMap, Token } from '../store/maps'

const map: BattleMap = { id:'map', name:'map', width:500, height:500, gridSize:50,
  gridOffsetX:0, gridOffsetY:0, showGrid:true, feetPerCell:5, tokens:[] }
const token = (id:string,x:number):Token => ({ id,label:id,x,y:125,size:1,type:'player',color:'',emoji:'' })
const viewer:Token = { ...token('victim',125), dnd5eCombatState:{activeEffects:[{
  ...createDnd5eMechanicalEffect({definitionId:'test:prison',label:'Prison',source:{kind:'spell'},targetId:'victim'}),
  initialSpaceBoundary:{mapId:'map',x:125,y:125,halfWidthUnits:25,bottomFeet:0,topFeet:5},
}]} }

it('enforces personal confinement even with dynamic vision disabled; observers stay unaffected',()=>{
  const outside=token('outside',225)
  expect(mapGeometryCanSeeToken({map,viewer,target:outside})).toBe(false)
  expect(mapGeometryCanSeeToken({map,viewer:outside,target:viewer})).toBe(true)
  expect(mapGeometryCanSeeToken({map,viewer,target:token('inside',130)})).toBe(true)
})
it('uses the fixed volume for exact point targeting, including height and map identity',()=>{
  expect(mapGeometryCanSeePoint({map,viewer,point:{x:130,y:125,elevationFeet:0}})).toBe(true)
  expect(mapGeometryCanSeePoint({map,viewer,point:{x:225,y:125,elevationFeet:0}})).toBe(false)
  expect(mapGeometryCanSeePoint({map,viewer,point:{x:130,y:125,elevationFeet:10}})).toBe(false)
  expect(mapGeometryCanSeePoint({map:{...map,id:'other'},viewer,point:{x:130,y:125}})).toBe(false)
})
it('restores normal visibility while the effect is suspended or removed',()=>{
  const suspended=structuredClone(viewer)
  suspended.dnd5eCombatState!.activeEffects![0].suspendedBy=['suppression']
  expect(mapGeometryCanSeeToken({map,viewer:suspended,target:token('outside',225)})).toBe(true)
  suspended.dnd5eCombatState!.activeEffects=[]
  expect(mapGeometryCanSeeToken({map,viewer:suspended,target:token('outside',225)})).toBe(true)
})

it('clips rendered visibility to the original footprint and preserves suspended visibility',()=>{
  const polygon=mapGeometryVisibilityPolygon({map,viewer,forceEnabled:true})
  expect(polygon.length).toBeGreaterThanOrEqual(3)
  expect(polygon.every(p=>p.x>=100-1e-6&&p.x<=150+1e-6&&p.y>=100-1e-6&&p.y<=150+1e-6)).toBe(true)
  expect(mapGeometryVisibilityPolygon({map:{...map,id:'other'},viewer,forceEnabled:true})).toEqual([])
  const suspended=structuredClone(viewer)
  suspended.dnd5eCombatState!.activeEffects![0].suspendedBy=['suppression']
  expect(mapGeometryVisibilityPolygon({map,viewer:suspended,forceEnabled:true}).some(p=>p.x>150)).toBe(true)
})
