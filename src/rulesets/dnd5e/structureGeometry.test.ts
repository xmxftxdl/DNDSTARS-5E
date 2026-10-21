import { expect, it } from 'vitest'
import type { BattleMap } from '../../store/maps'
import { createEmptyMapGeometry, mapGeometryPhysicalProjectileImpact, normalizeMapGeometry } from '../../lib/mapGeometry'
import { damageGeometryEntity } from '../../../shared/map-geometry-durability.mjs'
import { buildDnd5eStructureSections } from './structureSections'
import { placeDnd5eStructureSections } from './structureGeometry'

const map: BattleMap={id:'structure-map',name:'Map',width:1000,height:1000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]}
const sections=buildDnd5eStructureSections([{id:'wall',from:{x:0,y:0},to:{x:20,y:0},bottomFeet:0,heightFeet:20,thicknessInches:12}],
  {widthFeet:10,heightFeet:10,hitPointsPerInch:30,combatProfile:{armorClass:15,damageImmunities:['poison','psychic']}})
const place=(rotationDegrees=0)=>placeDnd5eStructureSections({map,geometry:createEmptyMapGeometry(map.id,1),structureId:'building',sections,
  origin:{x:100,y:100},rotationDegrees,elevationFeet:0,createdAt:1})

it('uses precise thickness and altitude, reloads defenses, and opens only the destroyed section',()=>{
  const geometry=normalizeMapGeometry(JSON.parse(JSON.stringify(place())))!
  expect(geometry.obstacles).toHaveLength(4)
  expect(geometry.obstacles[0].points).toEqual([{x:100,y:105},{x:200,y:105},{x:200,y:95},{x:100,y:95}])
  const ray=(x:number,elevationFeet:number)=>mapGeometryPhysicalProjectileImpact({map,geometry,from:{x,y:25},to:{x,y:175},elevationFeet})
  expect(ray(150,5)?.entityId).toBe('building:wall.0.0')
  Object.assign(geometry.obstacles[0],damageGeometryEntity(geometry.obstacles[0],360,'bludgeoning'))
  expect(ray(150,5)).toBeUndefined()
  expect(ray(150,15)?.entityId).toBe('building:wall.1.0')
  expect(ray(250,5)?.entityId).toBe('building:wall.0.1')
  expect(geometry.obstacles[1].dnd5eDurability).toMatchObject({hitPoints:360,armorClass:15,damageImmunities:['poison','psychic']})
})
it('rotates all parts around the selected origin without snapping to grid cells',()=>{
  const points=place(90).obstacles[0].points
  expect(points[0].x).toBeCloseTo(95);expect(points[0].y).toBeCloseTo(100)
  expect(points[1].x).toBeCloseTo(95);expect(points[1].y).toBeCloseTo(200)
})
it('rejects out-of-map placements and duplicate ids without partially modifying the map',()=>{
  const geometry=place(),before=JSON.stringify(geometry)
  const input={map,geometry,structureId:'building',sections,origin:{x:100,y:100},rotationDegrees:0,elevationFeet:0,createdAt:1}
  expect(()=>placeDnd5eStructureSections(input)).toThrow('structure-entity-id-conflict')
  expect(()=>placeDnd5eStructureSections({...input,structureId:'second',origin:{x:999,y:999}})).toThrow('structure-outside-map')
  expect(JSON.stringify(geometry)).toBe(before)
})

it('opens the selected doorway without leaving an invisible wall, preserving the lintel and adjacent sections',()=>{
  const input={map,geometry:createEmptyMapGeometry(map.id,1),structureId:'building',sections,
    origin:{x:100,y:100},rotationDegrees:0,elevationFeet:0,createdAt:1}
  const geometry=placeDnd5eStructureSections({...input,openings:[{sectionId:'wall.0.0',kind:'door'}]})
  expect(geometry.obstacles).toHaveLength(3)
  expect(geometry.doors).toHaveLength(1)
  const ray=(x:number,height:number)=>mapGeometryPhysicalProjectileImpact({map,geometry,from:{x,y:25},to:{x,y:175},elevationFeet:height})
  expect(ray(150,5)?.entityId).toBe('building:wall.0.0')
  geometry.doors[0]={...geometry.doors[0],state:'open',openState:'open'}
  expect(ray(150,5)).toBeUndefined()
  expect(ray(150,15)?.entityId).toBe('building:wall.1.0')
  expect(ray(250,5)?.entityId).toBe('building:wall.0.1')
  const reloaded=normalizeMapGeometry(JSON.parse(JSON.stringify(geometry)))!
  expect(reloaded.doors[0]).toMatchObject({openState:'open',dnd5eDurability:{armorClass:15,hitPoints:360}})
  const arch=placeDnd5eStructureSections({...input,openings:[{sectionId:'wall.0.0',kind:'arch'}]})
  expect(arch.doors).toHaveLength(0)
  expect(mapGeometryPhysicalProjectileImpact({map,geometry:arch,from:{x:150,y:25},to:{x:150,y:175},elevationFeet:5})).toBeUndefined()
  expect(()=>placeDnd5eStructureSections({...input,openings:[{sectionId:'unknown',kind:'door'}]})).toThrow('structure-opening-invalid')
  expect(()=>placeDnd5eStructureSections({...input,openings:[{sectionId:'wall.0.0',kind:'door'},{sectionId:'wall.0.0',kind:'arch'}]})).toThrow('structure-opening-invalid')
})
