import { expect, it } from 'vitest'
import { normalizeGeometryDurability, damageGeometryEntity } from '../../shared/map-geometry-durability.mjs'
import { validateGeometryStructure, compileGeometryCached } from '../../shared/map-geometry-kernel.mjs'
import { createEmptyMapGeometry, normalizeMapGeometry, mapGeometryPhysicalProjectileImpact, mapGeometryPlacementBlocked } from './mapGeometry'

const fixture = () => {
  const geometry = createEmptyMapGeometry('durability', 1)
  geometry.walls.push({ id: 'wall', kind: 'wall', label: 'Wall', points: [{ x: 100, y: 0 }, { x: 100, y: 200 }],
    blocksMovement: true, blocksVision: true, blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    dnd5eDurability: { hitPoints: 20, maxHitPoints: 20, damageThreshold: 5 } })
  return geometry
}
it('preserves explicit defenses through client/server geometry validation and typed damage', () => {
  const geometry = fixture(), wall = geometry.walls[0]
  wall.dnd5eDurability = { hitPoints: 360, maxHitPoints: 360, damageThreshold: 0, armorClass: 15, damageImmunities: ['poison', 'psychic'] }
  expect(validateGeometryStructure(geometry)).toEqual([])
  const restored = normalizeMapGeometry(JSON.parse(JSON.stringify(geometry)))!.walls[0]
  expect(restored.dnd5eDurability).toEqual(wall.dnd5eDurability)
  expect(damageGeometryEntity(restored, 100, 'psychic')?.dnd5eDurability.hitPoints).toBe(360)
  expect(damageGeometryEntity(restored, 100, 'poison')?.dnd5eDurability.hitPoints).toBe(360)
  expect(damageGeometryEntity(restored, 100, 'bludgeoning')?.dnd5eDurability).toMatchObject({ hitPoints: 260, armorClass: 15, damageImmunities: ['poison', 'psychic'] })
  expect(normalizeGeometryDurability({ ...wall.dnd5eDurability, armorClass: 0 })).toBeUndefined()
  expect(normalizeGeometryDurability({ ...wall.dnd5eDurability, damageImmunities: ['unknown'] })).toBeUndefined()
})
it('persists authored durability through the shared geometry format and retains unknown as absent', () => {
  const geometry = fixture()
  expect(validateGeometryStructure(geometry)).toEqual([])
  expect(normalizeMapGeometry(JSON.parse(JSON.stringify(geometry)))?.walls[0].dnd5eDurability).toEqual(geometry.walls[0].dnd5eDurability)
  delete geometry.walls[0].dnd5eDurability
  expect(normalizeMapGeometry(geometry)?.walls[0].dnd5eDurability).toBeUndefined()
  expect(damageGeometryEntity(geometry.walls[0], 6)).toBeUndefined()
})
it.each([{hitPoints:-1,maxHitPoints:20},{hitPoints:21,maxHitPoints:20},{hitPoints:2.5,maxHitPoints:20},
  {hitPoints:0,maxHitPoints:0},{hitPoints:2,maxHitPoints:20,damageThreshold:-1},{hitPoints:2,maxHitPoints:Infinity}])('rejects invalid durability in both client and server validation: %j', value => {
  const geometry = fixture(); geometry.walls[0].dnd5eDurability = value as any
  expect(normalizeGeometryDurability(value)).toBeUndefined()
  expect(normalizeMapGeometry(geometry)).toBeUndefined()
  expect(validateGeometryStructure(geometry).length).toBeGreaterThan(0)
})
it('applies a threshold to the full hit, invalidates collision caches on destruction and restores collision after repair', () => {
  const geometry = fixture(), wall = geometry.walls[0]
  const map = { gridSize: 50, feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0, tokens: [] }
  const ray = () => mapGeometryPhysicalProjectileImpact({ geometry, map, from: { x: 25, y: 75 }, to: { x: 300, y: 75 }, elevationFeet: 1 })
  const original = compileGeometryCached(geometry)
  expect(ray()?.entityId).toBe('wall')
  expect(damageGeometryEntity(wall,4)?.dnd5eDurability.hitPoints).toBe(20)
  expect(damageGeometryEntity(wall,5)?.dnd5eDurability.hitPoints).toBe(15)
  Object.assign(wall,damageGeometryEntity(wall,20))
  expect(ray()).toBeUndefined()
  expect(compileGeometryCached(geometry)).not.toBe(original)
  wall.dnd5eDurability!.hitPoints=1
  expect(ray()?.entityId).toBe('wall')
})
it('removes destroyed obstacle interior collision as well as its edges', () => {
  const geometry=fixture(); geometry.walls=[]
  geometry.obstacles=[{id:'crate',kind:'obstacle',label:'Crate',points:[{x:100,y:0},{x:200,y:0},{x:200,y:200},{x:100,y:200}],
    blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,cover:'total',baseHeightFeet:0,heightFeet:10,createdAt:1,
    dnd5eDurability:{hitPoints:1,maxHitPoints:1,damageThreshold:0}}]
  const token={id:'actor',type:'player' as const,label:'Actor',x:150,y:75,size:1,color:'#fff',emoji:''}
  const map={id:'durability',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[token]}
  expect(mapGeometryPlacementBlocked({geometry,map,token,at:token}).blocked).toBe(true)
  geometry.obstacles[0].dnd5eDurability!.hitPoints=0
  expect(mapGeometryPlacementBlocked({geometry,map,token,at:token}).blocked).toBe(false)
})
