import { expect, it } from 'vitest'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import type { BattleMap } from '../../store/maps'
import { prepareDnd5eAreaFlameReach } from './areaFlameReach'
function fixture() {
  const map: BattleMap = { id:'water',name:'Water',width:1500,height:1500,gridSize:50,feetPerCell:5,
    gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[] }
  return {map,geometry:createEmptyMapGeometry(map.id,1),rect:{widthFeet:10,lengthFeet:30,direction:{dc:1,dr:0},gridAligned:false},
    center:{x:500,y:500},baseElevationFeet:0,heightFeet:10,groundSpreadFeet:30}
}
it('measures ground spread from the actual rectangle rather than its center or bounding square',()=>{
  const reaches=prepareDnd5eAreaFlameReach(fixture())!
  expect(reaches({x:600,y:500},9)).toBe(true)
  expect(reaches({x:600,y:500},10)).toBe(false)
  expect(reaches({x:950,y:500},0)).toBe(true)
  expect(reaches({x:950.1,y:500},0)).toBe(false)
  expect(reaches({x:500,y:850},0)).toBe(true)
  expect(reaches({x:950,y:850},0)).toBe(false)
  expect(reaches({x:900,y:500},5)).toBe(false)
})
it('retains rotation and rejects blocked ground runoff',()=>{
  const input=fixture()
  input.rect.direction={dc:0,dr:1}
  expect(prepareDnd5eAreaFlameReach(input)!({x:500,y:950},0)).toBe(true)
  expect(prepareDnd5eAreaFlameReach(input)!({x:950,y:500},0)).toBe(false)
  input.rect.direction={dc:1,dr:0}
  input.geometry.walls.push({id:'wall',kind:'wall',label:'Wall',points:[{x:750,y:0},{x:750,y:1500}],baseHeightFeet:0,heightFeet:20,
    blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,createdAt:1})
  expect(prepareDnd5eAreaFlameReach(input)!({x:900,y:500},0)).toBe(false)
  input.geometry.walls[0].points=[{x:550,y:0},{x:550,y:1500}]
  expect(prepareDnd5eAreaFlameReach(input)!({x:600,y:500},0)).toBe(false)
  expect(prepareDnd5eAreaFlameReach(input)!({x:900,y:500},0)).toBe(false)
})
it('rejects invalid and mismatched Host geometry',()=>{
  const input=fixture()
  expect(prepareDnd5eAreaFlameReach({...input,groundSpreadFeet:-1})).toBeUndefined()
  expect(prepareDnd5eAreaFlameReach({...input,heightFeet:0})).toBeUndefined()
  expect(prepareDnd5eAreaFlameReach({...input,geometry:createEmptyMapGeometry('other',1)})).toBeUndefined()
})
it('flows around an open wall end using distance from the area, not accumulated path length',()=>{
  const input=fixture()
  input.geometry.walls.push({id:'short-wall',kind:'wall',label:'Wall',points:[{x:750,y:400},{x:750,y:600}],baseHeightFeet:0,heightFeet:20,
    blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,createdAt:1})
  const reaches=prepareDnd5eAreaFlameReach(input)!
  expect(reaches({x:850,y:500},0)).toBe(true)
  expect(reaches({x:950,y:500},0)).toBe(true)
  expect(reaches({x:950.1,y:500},0)).toBe(false)
  expect(reaches({x:850,y:500},5)).toBe(false)
  const before=structuredClone(input)
  expect(reaches({x:850,y:500},0)).toBe(true)
  expect(input).toEqual(before)
})
it('does not enter an enclosed room even though its fire is within the radial bound',()=>{
  const input=fixture()
  input.geometry.walls.push({id:'room',kind:'wall',label:'Room',points:[{x:750,y:400},{x:950,y:400},{x:950,y:600},{x:750,y:600},{x:750,y:400}],baseHeightFeet:0,heightFeet:20,
    blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,createdAt:1})
  expect(prepareDnd5eAreaFlameReach(input)!({x:850,y:500},0)).toBe(false)
})
it('does not detour outside the footprint to get around a wall',()=>{
  const input=fixture()
  input.geometry.walls.push({id:'wide-wall',kind:'wall',label:'Wall',points:[{x:750,y:100},{x:750,y:900}],baseHeightFeet:0,heightFeet:20,
    blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,createdAt:1})
  expect(prepareDnd5eAreaFlameReach(input)!({x:850,y:500},0)).toBe(false)
})
it('checks ground flow at ground height, not at a creature eye height',()=>{
  const input=fixture()
  input.geometry.walls.push({id:'low-wall',kind:'wall',label:'Low wall',points:[{x:750,y:0},{x:750,y:1500}],baseHeightFeet:0,heightFeet:1,
    blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,createdAt:1})
  expect(prepareDnd5eAreaFlameReach(input)!({x:850,y:500},0)).toBe(false)
  input.geometry.walls[0].baseHeightFeet=1
  expect(prepareDnd5eAreaFlameReach(input)!({x:850,y:500},0)).toBe(true)
})

it.each([-5,5])('follows lower ground but respects a raised solid terrain edge (elevation %s)',elevation=>{
  const input=fixture()
  input.geometry.obstacles.push({id:'step',kind:'obstacle',label:'Step',terrainRegion:true,terrainElevationFeet:elevation,
    points:[{x:700,y:0},{x:1500,y:0},{x:1500,y:1500},{x:700,y:1500}],baseHeightFeet:elevation,heightFeet:0,
    cover:'none',blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,createdAt:1})
  const before=structuredClone(input)
  expect(prepareDnd5eAreaFlameReach(input)!({x:850,y:500},elevation)).toBe(elevation<0)
  expect(prepareDnd5eAreaFlameReach(input)!({x:850,y:500},elevation+1)).toBe(false)
  expect(input).toEqual(before)
})
it('checks barriers at intermediate descending terrain height rather than endpoint elevation',()=>{
  const input=fixture()
  input.geometry.obstacles.push({id:'ridge',kind:'obstacle',label:'Lower shelf',terrainRegion:true,terrainElevationFeet:-5,
    points:[{x:720,y:0},{x:780,y:0},{x:780,y:1500},{x:720,y:1500}],baseHeightFeet:-5,heightFeet:0,
    cover:'none',blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,createdAt:1})
  input.geometry.obstacles.push({...input.geometry.obstacles[0],id:'lower-ground',terrainElevationFeet:-10,baseHeightFeet:-10,points:[{x:780,y:0},{x:1500,y:0},{x:1500,y:1500},{x:780,y:1500}]})
  input.geometry.walls.push({id:'ridge-wall',kind:'wall',label:'Wall',points:[{x:750,y:0},{x:750,y:1500}],baseHeightFeet:-5,heightFeet:4,
    blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1})
  expect(prepareDnd5eAreaFlameReach(input)!({x:850,y:500},-10)).toBe(false)
  input.geometry.walls[0].baseHeightFeet=0;input.geometry.walls[0].heightFeet=2
  expect(prepareDnd5eAreaFlameReach(input)!({x:850,y:500},-10)).toBe(true)
})
