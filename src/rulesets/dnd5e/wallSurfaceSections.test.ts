import {expect,it} from 'vitest'
import type {Dnd5ePluginArea} from '../../store/maps'
import {dnd5eWallSurfacePoint,dnd5eWallFreezingSectionAt,subtractDnd5eWallSurfaceSection,dnd5eWallSurfaceLength} from './wallSurfaceSections'
const area={anchorCell:{col:3,row:4},rectGeometry:{lengthFeet:30,widthFeet:1,gridAligned:false,direction:{dc:Math.cos(.63),dr:Math.sin(.63)}},vertical:{mode:'volume',baseElevationFeet:10,heightFeet:20}} as Dnd5ePluginArea
it.each([2.5,5,10])('selects the same 5ft rotated wall section on a %s-foot grid',feetPerCell=>{
 const map={gridSize:50,feetPerCell,gridOffsetX:17,gridOffsetY:-11},d=area.rectGeometry!.direction
 const point={x:17+3.5*50+d.dc*3*50/feetPerCell,y:-11+4.5*50+d.dr*3*50/feetPerCell}
 const along=dnd5eWallSurfacePoint(area,map,point)!
 expect(along).toBeCloseTo(18)
 expect(dnd5eWallFreezingSectionAt(area,along,17)).toEqual({startFeet:15,endFeet:20,bottomFeet:15,topFeet:20})
})
it('handles ring seam, wall ends and out-of-height contacts',()=>{
 const ring={...area,rectGeometry:undefined,circularGeometry:{radiusFeet:10,innerRadiusFeet:9}}
 const map={gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0},length=dnd5eWallSurfaceLength(ring)!
 expect(dnd5eWallSurfacePoint(ring,map,{x:270,y:225})).toBe(0)
 const end=dnd5eWallFreezingSectionAt(ring,length-.01,29.9)!
 expect(end.endFeet).toBeCloseTo(length);expect(end.endFeet-end.startFeet).toBeGreaterThanOrEqual(5)
 expect(end.topFeet).toBe(30)
 expect(dnd5eWallFreezingSectionAt(area,30,10)?.endFeet).toBe(30)
 expect(dnd5eWallFreezingSectionAt(area,31,10)).toBeUndefined()
 expect(dnd5eWallFreezingSectionAt(area,10,30)).toBeUndefined()
})
it('partitions non-multiple lengths and heights without overlap or tiny extra HP sections',()=>{
 const odd={...area,rectGeometry:{...area.rectGeometry!,lengthFeet:28},vertical:{mode:'volume' as const,baseElevationFeet:10,heightFeet:13}}
 const parts=[]
 for(let s=0;s<5;s++)for(let z=0;z<2;z++)parts.push(dnd5eWallFreezingSectionAt(odd,s*5,10+z*5)!)
 expect(parts.reduce((sum,p)=>sum+(p.endFeet-p.startFeet)*(p.topFeet-p.bottomFeet),0)).toBe(28*13)
 for(const a of parts)for(const b of parts)if(a!==b)expect(Math.min(a.endFeet,b.endFeet)<=Math.max(a.startFeet,b.startFeet)||Math.min(a.topFeet,b.topFeet)<=Math.max(a.bottomFeet,b.bottomFeet)).toBe(true)
 expect(dnd5eWallFreezingSectionAt(odd,27.9,22.9)).toEqual({startFeet:20,endFeet:28,bottomFeet:15,topFeet:23})
 expect(dnd5eWallFreezingSectionAt(odd,25,20)).toEqual(dnd5eWallFreezingSectionAt(odd,20,15))
})
it('preserves exact disjoint remnants and never restores a previously removed patch',()=>{
 const original=[{startFeet:0,endFeet:30,bottomFeet:10,topFeet:30}]
 const cut={startFeet:10,endFeet:15,bottomFeet:15,topFeet:20}
 const parts=subtractDnd5eWallSurfaceSection(original,cut)
 expect(parts).toHaveLength(4)
 const surface=(items:typeof parts)=>items.reduce((n,p)=>n+(p.endFeet-p.startFeet)*(p.topFeet-p.bottomFeet),0)
 expect(surface(parts)).toBe(575)
 expect(subtractDnd5eWallSurfaceSection(parts,cut)).toEqual(parts)
 expect(subtractDnd5eWallSurfaceSection(parts,original[0])).toEqual([])
 expect(surface(original)).toBe(600)
})
