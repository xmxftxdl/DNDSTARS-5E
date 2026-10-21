import {expect,it} from 'vitest'
import type {BattleMap,Dnd5ePluginArea} from '../../store/maps'
import {wallSurfaceVisualGeometry} from './wallSurfaceVisualGeometry'
const map={gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0} as BattleMap
const area={anchorCell:{col:4,row:4},cells:[{col:4,row:4}],vertical:{mode:'volume',baseElevationFeet:0,heightFeet:20},
 rectGeometry:{lengthFeet:30,widthFeet:1,gridAligned:false,direction:{dc:1,dr:0}},wallSurfaceSections:[{startFeet:10,endFeet:15,bottomFeet:5,topFeet:10}]} as Dnd5ePluginArea
it.each([2.5,5,10])('renders the same five-foot patch on %s-foot grids',feetPerCell=>{
 const shapes=wallSurfaceVisualGeometry(area,{...map,feetPerCell}),scale=50/feetPerCell
 expect(shapes).toHaveLength(1)
 expect(shapes[0].points).toEqual([225-5*scale,225+.5*scale,225,225+.5*scale,225,225-.5*scale,225-5*scale,225-.5*scale])
 expect(shapes[0].heightFraction).toBe(.25)
})
it('renders only the remaining ring arc, with its real one-foot thickness',()=>{
 const ring={...area,rectGeometry:undefined,circularGeometry:{radiusFeet:10,innerRadiusFeet:9},wallSurfaceSections:[{startFeet:0,endFeet:5,bottomFeet:5,topFeet:10}]}
 const [shape]=wallSurfaceVisualGeometry(ring,map)
 const points=shape.points
 for(let i=0;i<points.length;i+=2){
  const radius=Math.hypot(points[i]-225,points[i+1]-225)/10
  expect(Math.min(Math.abs(radius-9),Math.abs(radius-10))).toBeLessThan(1e-8)
  expect(points[i]).toBeGreaterThan(225)
 }
 expect(shape.spine[0]).toBe(320);expect(shape.spine[1]).toBe(225)
 expect(wallSurfaceVisualGeometry({...ring,wallSurfaceSections:[]},map)).toEqual([])
 expect(wallSurfaceVisualGeometry({...ring,geometryDepleted:true,cells:[]},map)).toEqual([])
})
