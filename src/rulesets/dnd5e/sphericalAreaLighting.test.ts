import { describe, expect, it } from 'vitest'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import { createEmptyMapGeometry, mapGeometryIlluminationAtPoint, mapGeometrySpellLightingSources } from '../../lib/mapGeometry'
import { resolveDnd5eCoreSpellLightingConflicts } from './coreSpellAreas'
import { dnd5ePersistentAreaAffectsTokenVerticallyAt } from './persistentAreaGeometry'
import { normalizeDnd5ePersistentAreaVerticalSnapshot, normalizeDnd5ePersistentAreaLighting } from './persistentAreaTypes'

const map: BattleMap = { id:'sphere', name:'Test', width:2000,height:2000,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[] }
const area: Dnd5ePluginArea = { id:'dark',pluginId:'test',featureId:'dark',sourceCharacterId:'caster',sourceTokenId:'caster',label:'Dark',color:'#000',cells:[{col:12,row:12}],anchorCell:{col:12,row:12},anchorMode:'fixed',createdRound:1,expiresAfterRound:100,vertical:{mode:'volume',shape:'sphere',baseElevationFeet:-60,heightFeet:120},lighting:{kind:'magical-darkness',radiusFeet:60,spellLevel:8,suppressesMagicalLightThroughLevel:8,lightSuppressionScope:'within-area'} }
const light = (level:number): Dnd5ePluginArea => ({...area,id:'light',lighting:{kind:'light',spellLevel:level,brightRadiusFeet:10,dimRadiusFeet:10,color:'#fff'}})
const target: Token = {id:'target',label:'Target',type:'enemy',size:1,color:'',emoji:'',x:625,y:625,elevationFeet:0}
const illumination=(areas:Dnd5ePluginArea[],x=625,geometry?:ReturnType<typeof createEmptyMapGeometry>)=>mapGeometryIlluminationAtPoint({map:{...map,dnd5ePluginAreas:areas},point:{x,y:625},geometry})

describe('spherical areas and local magical darkness',()=>{
 it('preserves the sphere and local suppression at the persisted boundary',()=>{
  expect(normalizeDnd5ePersistentAreaVerticalSnapshot(JSON.parse(JSON.stringify(area.vertical)))).toEqual(area.vertical)
  expect(normalizeDnd5ePersistentAreaLighting(JSON.parse(JSON.stringify(area.lighting)))).toEqual(area.lighting)
  expect(normalizeDnd5ePersistentAreaVerticalSnapshot({...area.vertical,shape:'cube'})).toBeUndefined()
  expect(normalizeDnd5ePersistentAreaLighting({...area.lighting,lightSuppressionScope:'everywhere'})).toBeUndefined()
 })
 it('excludes diagonal and vertical points outside a sphere, retaining intersecting bodies',()=>{
  const affects=(x:number,z:number,size=1)=>dnd5ePersistentAreaAffectsTokenVerticallyAt({map,area,token:{...target,size,elevationFeet:z},position:{x:625+x*10,y:625}})
  expect(affects(0,59)).toBe(true)
  expect(affects(0,61)).toBe(false)
  expect(affects(50,50)).toBe(false)
  expect(affects(40,40)).toBe(true)
  expect(affects(63,0)).toBe(false)
  expect(affects(63,0,2)).toBe(true)
  const raised={...area,vertical:{mode:'volume' as const,shape:'sphere' as const,baseElevationFeet:50,heightFeet:120}}
  expect(dnd5ePersistentAreaAffectsTokenVerticallyAt({map,area:raised,token:{...target,elevationFeet:44},position:target})).toBe(false)
  expect(dnd5ePersistentAreaAffectsTokenVerticallyAt({map,area:raised,token:{...target,elevationFeet:46},position:target})).toBe(true)
 })
 it('follows a moving anchor in all three dimensions',()=>{
  const moving={...area,anchorMode:'source-token' as const,vertical:{...area.vertical!,mode:'volume' as const,baseElevationFeet:-60,heightFeet:120,shape:'sphere' as const,anchorOffsetFeet:-60}}
  const caster={...target,id:'caster',x:1525,elevationFeet:100}
  const changed={...map,tokens:[caster]}
  expect(dnd5ePersistentAreaAffectsTokenVerticallyAt({map:changed,area:moving,token:target,position:target})).toBe(false)
  expect(dnd5ePersistentAreaAffectsTokenVerticallyAt({map:changed,area:moving,token:{...target,elevationFeet:100},position:caster})).toBe(true)
  expect(mapGeometrySpellLightingSources({...changed,dnd5ePluginAreas:[{...moving,anchorTokenId:'caster'}]})[0]).toMatchObject({point:{x:1525,y:625},elevationFeet:100})
 })
 it('keeps both sources alive in either casting order and relights outside the dark area',()=>{
  const low=light(8)
  for(const [existing,incoming] of [[[low],area],[[area],low]] as const){const result=resolveDnd5eCoreSpellLightingConflicts(existing,incoming);expect(result.applied).toBe(true);expect(result.removedAreas).toHaveLength(0);expect(result.areas).toHaveLength(2)}
  const offset={...low,anchorCell:{col:24,row:12}}
  expect(mapGeometrySpellLightingSources({...map,dnd5ePluginAreas:[area,offset]})).toHaveLength(2)
  const geometry=createEmptyMapGeometry(map.id,1);geometry.vision.ambientLight='darkness'
  expect(illumination([area,offset],1275,geometry)).toBe('bright')
  expect(illumination([area,offset],1225,geometry)).toBe('magical-darkness')
 })
 it('admits higher-level illumination only inside its bright or dim radius, even in daylight',()=>{
  expect(illumination([area,light(8)])).toBe('magical-darkness')
  expect(illumination([area,light(9)])).toBe('bright')
  expect(illumination([area,light(9)],775)).toBe('dim')
  expect(illumination([area,light(9)],875)).toBe('magical-darkness')
  expect(illumination([area,light(9),{...area,id:'other',lighting:{kind:'magical-darkness',spellLevel:9,radiusFeet:60}}])).toBe('magical-darkness')
 })
 it('keeps darkness behind a wall that blocks the higher-level light',()=>{
  const geometry=createEmptyMapGeometry(map.id,1)
  geometry.walls=[{id:'wall',kind:'wall',label:'wall',points:[{x:650,y:500},{x:650,y:750}],blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,baseHeightFeet:0,heightFeet:20,createdAt:1}]
  expect(illumination([area,light(9)],675,geometry)).toBe('magical-darkness')
 })
})
