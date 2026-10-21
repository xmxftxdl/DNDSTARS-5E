import {expect,it} from 'vitest'
import {normalizeMapGeometryEntity,type MapGeometryObstacle} from '../../lib/mapGeometry'
import {partitionByConvexPolygon,polygonSignedArea} from '../../lib/convexPolygonPartition'
import {partitionDnd5eControlledWaterVolume} from './controlledWaterPartition'
import {changeDnd5eControlledWater,dismissDnd5eWaterAlteration} from './controlledWater'
const body=():MapGeometryObstacle=>({id:'pool',kind:'obstacle',label:'Pool',points:[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}],
 baseHeightFeet:0,heightFeet:10,cover:'none',blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,createdAt:1,
 controlledWater:{id:'pool',positionFeet:{x:5,y:5,z:0},dimensionsFeet:{x:10,y:10,z:10},color:'#0088ff',opacity:0.5,alterations:[],appliedActionIds:[]}})
const volume=(b:MapGeometryObstacle)=>Math.abs(polygonSignedArea(b.points))*0.01*b.heightFeet
it('partitions a subvolume without overlap, loss, extra water or input mutation',()=>{
 const source=body(),before=structuredClone(source)
 const cut=partitionDnd5eControlledWaterVolume({body:source,feetPerPixel:0.1,partitionId:'cast',center:{x:50,y:50},dimensionsFeet:{x:5,y:5,z:5},baseElevationFeet:2})!
 expect(cut.selected.reduce((sum,b)=>sum+volume(b),0)).toBeCloseTo(125)
 const all=[...cut.selected,...cut.remainder]
 expect(all.reduce((sum,b)=>sum+volume(b),0)).toBeCloseTo(volume(source))
 expect(new Set(all.map(b=>b.id)).size).toBe(all.length)
 for(let i=0;i<all.length;i++){
  expect(normalizeMapGeometryEntity(JSON.parse(JSON.stringify(all[i])))).toEqual(all[i])
  for(let j=i+1;j<all.length;j++){
   const height=Math.min(all[i].baseHeightFeet+all[i].heightFeet,all[j].baseHeightFeet+all[j].heightFeet)-Math.max(all[i].baseHeightFeet,all[j].baseHeightFeet)
   if(height>0)expect(Math.abs(polygonSignedArea(partitionByConvexPolygon(all[i].points,all[j].points)!.inside))).toBeLessThan(1e-6)
  }
 }
 expect(source).toEqual(before)
})
it('conserves irregular shoreline volume and rejects empty or oversized requests',()=>{
 const source=body();source.points=[{x:0,y:0},{x:100,y:0},{x:100,y:40},{x:40,y:40},{x:40,y:100},{x:0,y:100}]
 const input={body:source,feetPerPixel:0.1,partitionId:'cast',center:{x:40,y:40},dimensionsFeet:{x:5,y:5,z:5},baseElevationFeet:8}
 const cut=partitionDnd5eControlledWaterVolume(input)!
 expect([...cut.selected,...cut.remainder].reduce((sum,b)=>sum+volume(b),0)).toBeCloseTo(volume(source))
 expect(cut.selected.reduce((sum,b)=>sum+volume(b),0)).toBeLessThan(50)
 expect(partitionDnd5eControlledWaterVolume({...input,center:{x:900,y:900}})).toBeUndefined()
 expect(partitionDnd5eControlledWaterVolume({...input,dimensionsFeet:{x:6,y:1,z:1}})).toBeUndefined()
})
it('counts a split spell once and dismisses all its fragments while preserving another spell',()=>{
 const source=body();source.points=source.points.map(p=>({x:p.x/2,y:p.y/2}));source.heightFeet=5
 source.controlledWater!.dimensionsFeet={x:5,y:5,z:5}
 const first=changeDnd5eControlledWater({waters:[source.controlledWater!],waterId:'pool',casterId:'caster',actionId:'old',worldMinute:10,distanceFeet:5,visible:true,change:{kind:'shape',description:'波纹'}})
 if(!first.ok)throw Error(first.reason);source.controlledWater=first.waters[0]
 const cut=partitionDnd5eControlledWaterVolume({body:source,feetPerPixel:0.1,partitionId:'split',center:{x:25,y:25},dimensionsFeet:{x:2,y:2,z:2},baseElevationFeet:1})!
 const waters=[...cut.selected,...cut.remainder].map(b=>b.controlledWater!)
 expect(waters.filter(w=>w.alterations.length).length).toBeGreaterThan(2)
 const next=changeDnd5eControlledWater({waters,waterId:waters[0].id,casterId:'caster',actionId:'new',worldMinute:20,distanceFeet:5,visible:true,change:{kind:'appearance',color:'#ff0000',opacity:1}})
 if(!next.ok)throw Error(next.reason)
 const dismissed=dismissDnd5eWaterAlteration(next.waters,'caster','old',21)
 if(!dismissed.ok)throw Error(dismissed.reason)
 expect(dismissed.waters.flatMap(w=>w.alterations).map(e=>e.id)).toEqual(['new'])
 const corrupt=structuredClone(next.waters);corrupt.at(-1)!.alterations[0].casterId='other'
 expect(dismissDnd5eWaterAlteration(corrupt,'caster','old',21)).toMatchObject({ok:false})
})
