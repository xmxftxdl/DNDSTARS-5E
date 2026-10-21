import {it,expect} from 'vitest'
import {fortressAreaPlacement} from './fortressAreaPlacement'
import {cellsForAoe,aoeOrientFromCell} from '../../lib/skillTargeting'
const map={id:'map',name:'Map',width:3000,height:3000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]}
it.each([0,37,90,225])('uses the same rotated footprint and physical center at %s degrees',angle=>{
 const anchorCell={col:30,row:30},template={shape:'rect' as const,origin:'point' as const,widthFeet:120,heightFeet:120,rotatable:true,gridAligned:false}
 const cells=cellsForAoe(template,aoeOrientFromCell(template,anchorCell,anchorCell,{rectAngleDegrees:angle}),anchorCell)
 const area={anchorCell,cells,targetIds:[],areaPlacementDistanceFeet:0,rectGeometry:{widthFeet:120,lengthFeet:120,gridAligned:false,direction:{dc:0,dr:-1}},areaPlacement:{x:1525,y:1525,angleDegrees:angle,elevationFeet:0}}
 const result=fortressAreaPlacement(map,area)!
 expect(result.rotationDegrees).toBe(angle)
 const rad=angle*Math.PI/180
 expect(result.origin.x+600*Math.cos(rad)-600*Math.sin(rad)).toBeCloseTo(1525,8)
 expect(result.origin.y+600*Math.sin(rad)+600*Math.cos(rad)).toBeCloseTo(1525,8)
 expect(fortressAreaPlacement(map,{...area,cells:cells.slice(1)})).toBeUndefined()
 expect(fortressAreaPlacement(map,{...area,areaPlacement:{...area.areaPlacement,x:1550}})).toBeUndefined()
})
