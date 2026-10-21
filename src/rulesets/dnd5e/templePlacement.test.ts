import {expect,it} from 'vitest'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import type {BattleMap,Token} from '../../store/maps'
import {validateDnd5eTempleSite} from './templePlacement'
const fixture=()=>{
 const map:BattleMap={id:'temple',name:'Temple',width:2000,height:2000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]}
 return {map,geometry:createEmptyMapGeometry(map.id,1),origin:{x:100,y:100},rotationDegrees:0,elevationFeet:0,widthFeet:120,depthFeet:120,heightFeet:120}
}
it('requires grounded finite dimensions no greater than 120 feet and a complete rotated footprint',()=>{
 const f=fixture();expect(validateDnd5eTempleSite(f).ok).toBe(true)
 for(const widthFeet of [0,-1,121,NaN,Infinity])expect(validateDnd5eTempleSite({...f,widthFeet}).ok).toBe(false)
 expect(validateDnd5eTempleSite({...f,elevationFeet:1})).toMatchObject({ok:false,reason:'temple-site-ground-required'})
 expect(validateDnd5eTempleSite({...f,rotationDegrees:45})).toMatchObject({ok:false,reason:'temple-site-outside-map'})
 expect(validateDnd5eTempleSite({...f,widthFeet:30,depthFeet:20,heightFeet:15,rotationDegrees:15}).ok).toBe(true)
})
it.each(['player','enemy','obstacle'] as const)('rejects an occupied %s footprint, including natural objects and corpses',type=>{
 const f=fixture();const t:Token={id:'body',label:'Body',type,x:400,y:400,size:2,hp:0,maxHp:10,emoji:'',color:''}
 f.map.tokens.push(t)
 expect(validateDnd5eTempleSite(f)).toMatchObject({ok:false,reason:'temple-site-occupied'})
 t.elevationFeet=120
 expect(validateDnd5eTempleSite(f).ok).toBe(true)
 t.elevationFeet=119
 expect(validateDnd5eTempleSite(f).ok).toBe(false)
})
it('detects walls crossing the footprint with both endpoints outside, respecting vertical separation and destruction',()=>{
 const f=fixture();f.geometry.walls.push({id:'wall',kind:'wall',label:'Wall',points:[{x:0,y:400},{x:1900,y:400}],baseHeightFeet:0,heightFeet:10,blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1})
 const before=JSON.stringify(f)
 expect(validateDnd5eTempleSite(f).ok).toBe(false);expect(JSON.stringify(f)).toBe(before)
 f.geometry.walls[0].baseHeightFeet=120;expect(validateDnd5eTempleSite(f).ok).toBe(true)
 f.geometry.walls[0].baseHeightFeet=0;f.geometry.walls[0].dnd5eDurability={hitPoints:0,maxHitPoints:10,damageThreshold:0}
 expect(validateDnd5eTempleSite(f).ok).toBe(true)
})
it('keeps the site identity stable after a JSON round trip',()=>{
 const f=fixture();expect(validateDnd5eTempleSite(JSON.parse(JSON.stringify(f)))).toEqual(validateDnd5eTempleSite(f))
})
it('rejects even a thin raised terrain patch inside the volume, respecting paint order and rotated bounds',()=>{
 const f=fixture()
 const patch={id:'ridge',kind:'obstacle' as const,label:'Ridge',points:[{x:399,y:399},{x:399.1,y:399},{x:399.1,y:401},{x:399,y:401}],
  baseHeightFeet:0,heightFeet:0,cover:'none' as const,terrainElevationFeet:2,terrainRegion:true,blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,createdAt:1}
 f.geometry.obstacles.push(patch)
 expect(validateDnd5eTempleSite(f)).toMatchObject({ok:false,reason:'temple-site-occupied'})
 f.geometry.obstacles.push({...patch,id:'flatten',terrainElevationFeet:0})
 expect(validateDnd5eTempleSite(f).ok).toBe(true)
 f.geometry.obstacles.pop()
 patch.terrainElevationFeet=-2
 expect(validateDnd5eTempleSite(f).ok).toBe(true)
 patch.terrainElevationFeet=2
 patch.points=[{x:350,y:101},{x:351,y:101},{x:351,y:102},{x:350,y:102}]
 expect(validateDnd5eTempleSite({...f,origin:{x:300,y:100},rotationDegrees:45,widthFeet:20,depthFeet:20}).ok).toBe(true)
 patch.points=patch.points.map(p=>({x:p.x-50,y:p.y+80}))
 expect(validateDnd5eTempleSite({...f,origin:{x:300,y:100},rotationDegrees:45,widthFeet:20,depthFeet:20})).toMatchObject({ok:false,reason:'temple-site-occupied'})
})
