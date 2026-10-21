import {expect,it,vi} from 'vitest'
import type {ReactElement,ReactNode} from 'react'
vi.mock('react-konva',()=>({Group:'Group',Line:'Line',Text:'Text'}))
vi.mock('konva',()=>({default:{}}))
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import type {BattleMap} from '../../store/maps'
import {ControlledWaterSceneLayer,controlledWaterSceneMarkers} from './ControlledWaterSceneLayer'
function elements(node:ReactNode):ReactElement<Record<string,any>>[]{
 if(Array.isArray(node))return node.flatMap(elements)
 if(!node||typeof node!=='object'||!('props'in node))return []
 const e=node as ReactElement<Record<string,any>>;return [e,...elements(e.props.children)]
}
function fixture(){
 const map:BattleMap={id:'map',name:'Map',width:1000,height:1000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,
  tokens:[{id:'actor',type:'player',characterId:'owner',label:'Actor',x:100,y:100,size:1,color:'',emoji:''}]}
 const geometry=createEmptyMapGeometry(map.id,1);geometry.vision.ambientLight='bright'
 geometry.obstacles.push({id:'water',kind:'obstacle',label:'Water',points:[{x:200,y:100},{x:400,y:100},{x:400,y:300},{x:200,y:300}],baseHeightFeet:0,heightFeet:5,
  cover:'none',blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,createdAt:1,
  controlledWater:{id:'water',positionFeet:{x:30,y:20,z:0},dimensionsFeet:{x:20,y:20,z:5},color:'#0088ff',opacity:0.5,alterations:[],appliedActionIds:[]}})
 return {map,geometries:[geometry],actorTokenId:'actor',casterId:'owner',actionId:'first',worldMinute:10,
  selection:{waterId:'water',region:{center:{x:225,y:125},dimensionsFeet:{x:5,y:5,z:5},baseElevationFeet:0},change:{kind:'appearance' as const,color:'#ff0000',opacity:1}}}
}

it('renders exact polygons and restores base water at expiry without mutating saved data',()=>{
 const scene=fixture(),geometry=scene.geometries[0],water=geometry.obstacles[0].controlledWater!
 water.alterations=[{id:'ice',casterId:'owner',kind:'freeze',appliedAtWorldMinute:10,expiresAtWorldMinute:70},
 {id:'color',casterId:'owner',kind:'appearance',color:'#ff0000',opacity:0.8,appliedAtWorldMinute:10,expiresAtWorldMinute:70}]
 const before=structuredClone(geometry),input={map:scene.map,geometry,worldMinute:69,isDM:true,visionSourceTokenIds:[],inv:1}
 const nodes=elements(ControlledWaterSceneLayer(input)),ice=nodes.find(n=>n.props.name==='controlled-water-ice')!
 expect(ice.props.points).toEqual(geometry.obstacles[0].points.flatMap(p=>[p.x,p.y]))
 expect(ice.props.fill).toBe('#ff0000');expect(ice.props.opacity).toBe(0.8)
 const restored=elements(ControlledWaterSceneLayer({...input,worldMinute:70})).find(n=>n.props.name==='controlled-water-liquid')!
 expect(restored.props.fill).toBe('#0088ff');expect(restored.props.opacity).toBe(0.5)
 expect(geometry).toEqual(before)
})
it('hides water markers behind an opaque wall from players but allows DM inspection',()=>{
 const scene=fixture(),geometry=scene.geometries[0]
 geometry.vision.enabled=true
 const input={map:scene.map,geometry,worldMinute:10,isDM:false,visionSourceTokenIds:['actor']}
 expect(controlledWaterSceneMarkers(input)).toHaveLength(1)
 geometry.walls.push({id:'wall',kind:'wall',label:'Wall',points:[{x:180,y:0},{x:180,y:1000}],blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,baseHeightFeet:0,heightFeet:20,createdAt:1})
 expect(controlledWaterSceneMarkers(input)).toEqual([])
 expect(controlledWaterSceneMarkers({...input,isDM:true})).toHaveLength(1)
})
