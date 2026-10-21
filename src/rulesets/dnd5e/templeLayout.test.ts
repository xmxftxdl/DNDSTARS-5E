import {it,expect} from 'vitest'
import {createEmptyMapGeometry,normalizeMapGeometry,mapGeometryPhysicalProjectileImpact,mapGeometryPlacementBlocked} from '../../lib/mapGeometry'
import {prepareDnd5eTempleStructure} from './templeStructure'
import {validTempleLayout,type TempleLayout} from './templeLayout'
import {prepareDnd5eTempleDisintegration} from './templeDisintegration'
import {requestTempleLayout} from '../../components/map/templeLayoutSelection'
const layout:TempleLayout={door:{side:'east',offsetFeet:5,widthFeet:5,heightFeet:10},
 windows:[{side:'north',offsetFeet:10,widthFeet:5,bottomFeet:3,heightFeet:5}]}
it('creates exact rotated openings with solid sills/lintels; reloading and disintegration retain ownership',()=>{
 const map={id:'temple',name:'Temple',width:2000,height:2000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]}
 const input={map,geometry:createEmptyMapGeometry(map.id),origin:{x:500,y:500},widthFeet:30,depthFeet:20,heightFeet:15,elevationFeet:0,
  rotationDegrees:0,structureId:'temple:layout',casterId:'caster',authorizedCreatureIds:[],worldMinute:0,createdAt:1,
  hostileCreatureTypes:['fiend' as const],lighting:'bright' as const,sourceSaveDc:18,sourceWisdomModifier:5,layout}
 const built=prepareDnd5eTempleStructure(input);expect(built.ok).toBe(true);if(!built.ok)throw Error(built.reason)
 const geometry=normalizeMapGeometry(JSON.parse(JSON.stringify(built.geometry)))!
 expect(geometry.doors).toHaveLength(1);expect(geometry.windows).toHaveLength(1)
 expect(mapGeometryPlacementBlocked({map,geometry,token:{id:'visitor',type:'enemy',label:'Visitor',x:600,y:600,size:1,emoji:'',color:'',elevationFeet:0},at:{x:600,y:600}}).blocked).toBe(false)
 expect(geometry.doors[0].points[0].x).toBeCloseTo(799.75)
 expect(geometry.structureLifetimes![0].entityIds).toContain('temple:layout:window:0')
 const ray=(x:number,height:number)=>mapGeometryPhysicalProjectileImpact({map,geometry,from:{x,y:450},to:{x,y:550},elevationFeet:height})
 expect(ray(625,5)).toBeUndefined()
 expect(ray(625,1)).toBeDefined();expect(ray(625,12)).toBeDefined();expect(ray(575,5)).toBeDefined()
 const removed=prepareDnd5eTempleDisintegration({map,geometry,targetEntityId:'temple:layout:window:0',worldMinute:1})
 expect(removed.ok).toBe(true);if(removed.ok){expect(removed.geometry.windows).toHaveLength(0);expect(removed.geometry.obstacles).toHaveLength(0)}
 const rotated=prepareDnd5eTempleStructure({...input,rotationDegrees:90})
 expect(rotated.ok).toBe(true);if(rotated.ok){expect(rotated.geometry.windows![0].points[0].x).toBeCloseTo(499.75);expect(rotated.geometry.windows![0].points[0].y).toBeCloseTo(600)}
 expect(input.geometry.obstacles).toHaveLength(0)
})
it('rejects overlapping, nonfinite, duplicate and out-of-bounds selections',()=>{
 expect(validTempleLayout(layout,30,20,15)).toBe(true)
 for(const windows of [[...layout.windows,...layout.windows],[{...layout.windows[0],offsetFeet:29}],[{...layout.windows[0],bottomFeet:12}],
  [{...layout.windows[0],widthFeet:NaN}],[{...layout.windows[0],side:'east' as const,offsetFeet:5,bottomFeet:0}]])
  expect(validTempleLayout({...layout,windows},30,20,15)).toBe(false)
})
it('collects an actor-selected entrance and repeated windows, retrying invalid geometry and allowing cancellation',async()=>{
 const answers=[{id:'east',values:{offset:'5',width:'5',height:'10'}},
  {id:'north',values:{offset:'29',width:'5',height:'5',bottom:'3'}},
  {id:'north',values:{offset:'10',width:'5',height:'5',bottom:'3'}},{id:'done',values:{}}]
 const prompts:string[]=[]
 const result=await requestTempleLayout({widthFeet:30,depthFeet:20,heightFeet:15,choose:async request=>{prompts.push(request.prompt);return answers.shift() as {id:string;values:Record<string,string>}}})
 expect(result?.door).toMatchObject(layout.door);expect(result?.windows).toEqual(layout.windows)
 expect(prompts[2]).toContain('重叠')
 expect(await requestTempleLayout({widthFeet:30,depthFeet:20,heightFeet:15,choose:async()=>({id:'cancel',values:{}})})).toBeUndefined()
})
