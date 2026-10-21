import {expect,it} from 'vitest'
import {createEmptyMapGeometry,normalizeMapGeometry} from '../../lib/mapGeometry'
import {prepareLooseEarthTransfer} from './looseEarthTransfer'
import type {BattleMap} from '../../store/maps'
import {polygonSignedArea} from '../../lib/convexPolygonPartition'

it.each(['token','wall','obstacle','area'].flatMap(kind=>[false,true].map(onStep=>({kind,onStep}))))('checks collision height at the actual overlap: $kind, onStep=$onStep',({kind,onStep})=>{
 const geometry=createEmptyMapGeometry('map',1)
 const rectangle=(left:number,right:number)=>[{x:left,y:90},{x:right,y:90},{x:right,y:110},{x:left,y:110}]
 const common={cover:'none' as const,blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,createdAt:1}
 geometry.obstacles.push({id:'soil',kind:'obstacle',label:'Soil',points:rectangle(95,105),surfaceMaterial:'loose-earth',terrainElevationFeet:0,baseHeightFeet:-1,heightFeet:1,terrainRegion:true,...common},
  {id:'step',kind:'obstacle',label:'Step',points:rectangle(115,170),terrainElevationFeet:2,baseHeightFeet:2,heightFeet:0,terrainRegion:true,...common})
 const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:10,feetPerCell:1,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]}
 const x=onStep?125:105
 if(kind==='token')map.tokens.push({id:'body',type:'enemy',label:'Body',x,y:100,size:1,color:'',emoji:'',elevationFeet:1.5})
 if(kind==='wall')geometry.walls.push({id:'wall',kind:'wall',label:'Wall',points:[{x,y:90},{x,y:110}],baseHeightFeet:1.5,heightFeet:1,...common,blocksMovement:true})
 if(kind==='obstacle')geometry.obstacles.push({id:'beam',kind:'obstacle',label:'Beam',points:rectangle(x-5,x+5),baseHeightFeet:1.5,heightFeet:1,...common,blocksMovement:true})
 if(kind==='area')map.dnd5ePluginAreas=[{id:'barrier',blocking:{movement:true},cells:[{col:onStep?12:10,row:9}],vertical:{mode:'volume',baseElevationFeet:1.5,heightFeet:1}} as any]
 const before=structuredClone({map,geometry})
 expect(!!prepareLooseEarthTransfer({map,geometry,anchor:{x:100,y:100},angleDegrees:0,distanceFeet:3,
  maximumSideFeet:5,maximumDisplacementFeet:5,executionId:'collision',now:2})).toBe(!onStep)
 expect({map,geometry}).toEqual(before)
})

it.each(['up','down','too-far','body-on-step','overhead-clear','ridge','hidden-ridge','covered-ridge','mixed-destination','two-steps'] as const)('moves soil along stepped ground without damage or extra reach: %s',kind=>{
 const geometry=createEmptyMapGeometry('map',1)
 const rectangle=(left:number,right:number)=>[{x:left,y:90},{x:right,y:90},{x:right,y:110},{x:left,y:110}]
 geometry.obstacles.push({id:'soil',kind:'obstacle',label:'Soil',points:rectangle(95,105),surfaceMaterial:'loose-earth',
  terrainElevationFeet:0,baseHeightFeet:-1,heightFeet:1,terrainRegion:true,cover:'none',blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,createdAt:1})
 const elevation=kind==='down'?-2:2
 geometry.obstacles.push({id:'step',kind:'obstacle',label:'Ground',points:rectangle(115,kind==='ridge'?120:170),
  terrainElevationFeet:elevation,baseHeightFeet:elevation,heightFeet:0,terrainRegion:true,cover:'none',blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,createdAt:1})
 if(kind==='mixed-destination')geometry.obstacles[1].points=geometry.obstacles[1].points.map(p=>({...p,y:Math.min(p.y,100)}))
 if(kind==='two-steps')geometry.obstacles.push({...geometry.obstacles[1],id:'middle-step',points:rectangle(108,115),terrainElevationFeet:1,baseHeightFeet:1})
 if(kind==='hidden-ridge'||kind==='covered-ridge'){
  const ridge={...geometry.obstacles[1],id:'tiny-ridge',points:[{x:108,y:93},{x:110,y:93},{x:110,y:93.001},{x:108,y:93.001}]}
  geometry.obstacles.push(ridge)
  if(kind==='covered-ridge')geometry.obstacles.push({...ridge,id:'ground-overlay',terrainElevationFeet:0,baseHeightFeet:0})
 }
 const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:10,feetPerCell:1,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]}
 if(kind==='body-on-step'||kind==='overhead-clear')map.tokens.push({id:'body',type:'enemy',label:'Body',x:130,y:100,size:1,color:'',emoji:'',elevationFeet:kind==='overhead-clear'?10:2})
 const before=structuredClone({map,geometry})
 const result=prepareLooseEarthTransfer({map,geometry,anchor:{x:100,y:100},angleDegrees:0,distanceFeet:kind==='too-far'?4:3,
  maximumSideFeet:5,maximumDisplacementFeet:5,executionId:'step-cast',now:2})
 expect(!!result).toBe(['up','down','overhead-clear','covered-ridge','mixed-destination','two-steps'].includes(kind))
 if(result){
  const soilVolume=(g:typeof geometry)=>g.obstacles.filter(o=>o.surfaceMaterial==='loose-earth').reduce((sum,o)=>sum+Math.abs(polygonSignedArea(o.points))*o.heightFeet,0)
  expect(soilVolume(result)).toBeCloseTo(soilVolume(geometry))
  const bases=new Set(result.obstacles.filter(o=>o.id.startsWith('step-cast:deposit')).map(o=>o.baseHeightFeet))
  expect(bases).toEqual(new Set(kind==='mixed-destination'?[0,2]:[elevation]))
 }
 expect({map,geometry}).toEqual(before)
})

it.each(['clear','outside-token','inside-token','outside-obstacle','inside-obstacle','outside-height','inside-height','flying-token','overhead-obstacle','below-path-obstacle','inside-below-wall','below-path-wall','vision-area','overhead-area','below-area','inside-volume-area','overhead-column-area','inside-column-area','open-door','inside-closed-door','inside-low-door','inside-window-sill'] as const)('uses the real diagonal swept footprint: %s',kind=>{
 const geometry=createEmptyMapGeometry('map',1)
 geometry.obstacles.push({id:'soil',kind:'obstacle',label:'Soil',points:[{x:95,y:95},{x:105,y:95},{x:105,y:105},{x:95,y:105}],
  surfaceMaterial:'loose-earth',terrainElevationFeet:0,baseHeightFeet:-1,heightFeet:1,terrainRegion:true,
  cover:'none',blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,createdAt:1})
 const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:10,feetPerCell:1,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]}
 const point=kind.startsWith('outside')?{x:133,y:100}:{x:120,y:120}
 if(kind.endsWith('token'))map.tokens.push({id:'body',type:'enemy',label:'Body',emoji:'',color:'',size:1,...point,...(kind==='flying-token'?{elevationFeet:10}:{})})
 if(kind.endsWith('obstacle')||kind.endsWith('height'))geometry.obstacles.push({id:'obstacle',kind:'obstacle',label:'Obstacle',
  points:[{x:point.x-2,y:point.y-2},{x:point.x+2,y:point.y-2},{x:point.x+2,y:point.y+2},{x:point.x-2,y:point.y+2}],
  cover:'none',blocksMovement:kind.endsWith('obstacle'),blocksVision:false,blocksLineOfEffect:false,baseHeightFeet:kind==='overhead-obstacle'?10:kind==='below-path-obstacle'?-10:0,heightFeet:2,
  ...(kind.endsWith('height')?{terrainElevationFeet:2,terrainRegion:true}:{}),createdAt:1})
 if(kind.endsWith('wall')){const y=kind==='inside-below-wall'?100:120;geometry.walls.push({id:'underground-wall',kind:'wall',label:'Wall',points:[{x:80,y},{x:150,y}],baseHeightFeet:-0.8,heightFeet:0.2,blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1})}
 if(kind==='vision-area')map.dnd5ePluginAreas=[{blocking:{vision:true},cells:[{col:12,row:12}]} as any]
 if(kind.endsWith('area')&&kind!=='vision-area'){const base=kind.startsWith('inside')?0:kind==='below-area'?-10:10;map.dnd5ePluginAreas=[{blocking:{movement:true},cells:[{col:12,row:12}],vertical:{mode:'volume',baseElevationFeet:0,heightFeet:30,...(kind.includes('column')?{columns:[{col:12,row:12,baseElevationFeet:base,heightFeet:2}]}:{baseElevationFeet:base,heightFeet:2})}} as any]}
 if(kind.includes('door')||kind==='inside-window-sill'){geometry.walls.push({id:'wall',kind:'wall',label:'Wall',points:[{x:120,y:80},{x:120,y:150}],baseHeightFeet:0,heightFeet:10,blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1});geometry.doors.push({id:'door',kind:'door',label:'Door',secret:false,points:[{x:120,y:100},{x:120,y:140}],parentWallId:'wall',parentWallSegmentIndex:0,baseHeightFeet:kind==='inside-window-sill'?2:0,heightFeet:kind==='inside-low-door'?0.5:8,state:kind==='inside-closed-door'?'closed':'open',blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1} as any)}
 if(kind==='open-door')expect(normalizeMapGeometry(geometry),'fixture geometry must be valid').toBeDefined()
 const before=structuredClone({geometry,map})
 const result=prepareLooseEarthTransfer({map,geometry,anchor:{x:100,y:100},angleDegrees:45,distanceFeet:5,maximumSideFeet:5,executionId:'cast',now:2})
 expect(!!result).toBe(!kind.startsWith('inside'))
 expect({geometry,map}).toEqual(before)
})

it.each(['small-clear','large-blocked','rotated-clear','overhead-clear'] as const)('uses authored object dimensions for soil travel: %s',kind=>{
 const geometry=createEmptyMapGeometry('map',1)
 geometry.obstacles.push({id:'soil',kind:'obstacle',label:'Soil',points:[{x:95,y:95},{x:105,y:95},{x:105,y:105},{x:95,y:105}],
  surfaceMaterial:'loose-earth',terrainElevationFeet:0,baseHeightFeet:-1,heightFeet:1,terrainRegion:true,
  cover:'none',blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,createdAt:1})
 const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:10,feetPerCell:1,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{
  id:'physical-object',type:'obstacle',label:'Stone',x:125,y:kind==='large-blocked'||kind==='overhead-clear'?120:109,size:1,color:'',emoji:'',
  elevationFeet:kind==='overhead-clear'?10:0,dnd5eObjectState:{schemaVersion:1,surfaceProfile:{material:'stone',widthFeet:0.2,
   lengthFeet:kind==='small-clear'?0.2:4,heightFeet:0.2,rotationDegrees:kind==='rotated-clear'?90:0}},
 }]}
 const before=JSON.stringify({map,geometry})
 const result=prepareLooseEarthTransfer({map,geometry,anchor:{x:100,y:100},angleDegrees:0,distanceFeet:5,maximumSideFeet:5,executionId:'cast',now:2})
 expect(!!result).toBe(kind!=='large-blocked')
 if(result)expect(result.obstacles.some(obstacle=>obstacle.id.startsWith('surface-object:'))).toBe(false)
 expect(JSON.stringify({map,geometry})).toBe(before)
})
