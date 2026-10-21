import {MAP_GEOMETRY_MAX_ENTITIES,normalizeMapGeometry,type MapGeometryDoor,type MapGeometryObstacle,type MapGeometryWindow} from '../../lib/mapGeometry'
import {validTempleLayout,templeLayoutWallParts,type TempleLayout,type TempleOpening} from './templeLayout'
import {validateDnd5eTempleSite} from './templePlacement'
import {normalizeTempleWard,type TempleHostileType} from '../../../shared/temple-ward.mjs'

/** Creates the temple shell after Host site validation. Spell-specific ward effects are attached separately. */
export function prepareDnd5eTempleStructure(input:Parameters<typeof validateDnd5eTempleSite>[0]&{
 structureId:string;casterId:string;authorizedCreatureIds:readonly string[];worldMinute:number;createdAt:number;
 /** Host campaign roster, allowing known creatures that have no token on this map. */
 characters?:readonly Pick<import('../../types/character').Character,'id'>[];
 layout?:TempleLayout;
 hostileCreatureTypes:readonly TempleHostileType[];lighting:'none'|'dim'|'bright';sourceSaveDc:number;sourceWisdomModifier:number;
}){
 const site=validateDnd5eTempleSite(input)
 if(!site.ok)return site
 const fail=(reason:string)=>({ok:false as const,reason})
 const templeWard=normalizeTempleWard({hostileCreatureTypes:input.hostileCreatureTypes,lighting:input.lighting,saveDc:input.sourceSaveDc,healingBonus:Math.max(1,input.sourceWisdomModifier)})
 if(!Number.isSafeInteger(input.sourceWisdomModifier)||!templeWard)return fail('temple-ward-invalid')
 if(!/^[a-z0-9][a-z0-9._:-]{0,95}$/.test(input.structureId)||!input.casterId||input.casterId.length>160||
  !Number.isSafeInteger(input.worldMinute)||input.worldMinute<0||!Number.isSafeInteger(input.worldMinute+1440)||!Number.isFinite(input.createdAt))return fail('temple-structure-invalid')
 const delegates=input.authorizedCreatureIds
 if(delegates.length>256||new Set(delegates).size!==delegates.length||delegates.some(id=>typeof id!=='string'||!id||id.trim()!==id||
  !input.characters?.some(character=>character.id===id)&&
  !input.map.tokens.some(t=>t.type!=='obstacle'&&!t.dnd5eSpellEffect&&(t.characterId??t.id)===id)))return fail('temple-delegate-invalid')
 const {widthFeet:w,depthFeet:d,heightFeet:h}=input
 if(input.layout&&!validTempleLayout(input.layout,w,d,h))return fail('temple-layout-invalid')
 const scale=input.map.gridSize/(input.map.feetPerCell??5),angle=input.rotationDegrees*Math.PI/180
 const point=(x:number,y:number)=>({x:input.origin.x+(x*Math.cos(angle)-y*Math.sin(angle))*scale,
  y:input.origin.y+(x*Math.sin(angle)+y*Math.cos(angle))*scale})
 const thickness=Math.min(.05,w/100,d/100,h/100),doorWidth=Math.min(5,w),doorLeft=(w-doorWidth)/2,doorRight=doorLeft+doorWidth,doorHeight=Math.min(10,h)
 const obstacles:MapGeometryObstacle[]=[]
 const slab=(name:string,x:number,y:number,width:number,depth:number,bottom:number,height:number)=>{
  if(width<=0||depth<=0||height<=0)return
  obstacles.push({id:input.structureId+':'+name,kind:'obstacle',label:'神庙·'+name,
   points:[point(x,y),point(x+width,y),point(x+width,y+depth),point(x,y+depth)],
   baseHeightFeet:input.elevationFeet+bottom,heightFeet:height,cover:'total',
   blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:input.createdAt})
 }
 if(!input.layout){
 slab('west',0,0,thickness,d,0,h);slab('east',w-thickness,0,thickness,d,0,h)
 slab('south',0,d-thickness,w,thickness,0,h)
 slab('north-left',0,0,doorLeft,thickness,0,h);slab('north-right',doorRight,0,w-doorRight,thickness,0,h)
 slab('lintel',doorLeft,0,doorWidth,thickness,doorHeight,h-doorHeight)
 }else{
  for(const [index,part] of templeLayoutWallParts(input.layout,w,d,h).entries()){
   const horizontal=part.side==='north'||part.side==='south'
   slab('shell:'+index,horizontal?part.offset:part.side==='west'?0:w-thickness,
    horizontal?(part.side==='north'?0:d-thickness):part.offset,horizontal?part.width:thickness,
    horizontal?thickness:part.width,part.bottom,part.height)
  }
 }
 // The floor's top is the declared walking surface, not a raised obstruction.
 slab('floor',0,0,w,d,-thickness,thickness);slab('roof',0,0,w,d,h-thickness,thickness)
 const door:MapGeometryDoor={id:input.structureId+':door',kind:'door',label:'神庙入口',points:[point(doorLeft,thickness/2),point(doorRight,thickness/2)],
  baseHeightFeet:input.elevationFeet,heightFeet:doorHeight,blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,
  state:'closed',openState:'closed',lockState:'unlocked',physicalState:'intact',secret:false,createdAt:input.createdAt}
 const openingPoints=(opening:TempleOpening):MapGeometryDoor['points']=>{
  const horizontal=opening.side==='north'||opening.side==='south'
  const fixed=opening.side==='north'||opening.side==='west'?thickness/2:(horizontal?d:w)-thickness/2
  return [opening.offsetFeet,opening.offsetFeet+opening.widthFeet].map(value=>horizontal?point(value,fixed):point(fixed,value)) as MapGeometryDoor['points']
 }
 const windows:MapGeometryWindow[]=[]
 if(input.layout){
  door.points=openingPoints({...input.layout.door,bottomFeet:0});door.heightFeet=input.layout.door.heightFeet
  windows.push(...input.layout.windows.map((opening,index):MapGeometryWindow=>({id:input.structureId+':window:'+index,kind:'window',label:'神庙窗户',
   points:openingPoints(opening),baseHeightFeet:input.elevationFeet+opening.bottomFeet,heightFeet:opening.heightFeet,
   windowType:'opening',windowState:'open',blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,createdAt:input.createdAt})))
 }
 if(input.geometry.obstacles.length+input.geometry.walls.length+input.geometry.doors.length+(input.geometry.windows?.length??0)+
  (input.geometry.lights?.length??0)+obstacles.length+windows.length+1>MAP_GEOMETRY_MAX_ENTITIES)return fail('temple-layout-budget-exceeded')
 const geometry=normalizeMapGeometry({...input.geometry,obstacles:[...input.geometry.obstacles,...obstacles],doors:[...input.geometry.doors,door],
  windows:[...input.geometry.windows??[],...windows],
  structureLifetimes:[...input.geometry.structureLifetimes??[],{id:input.structureId,casterId:input.casterId,createdWorldMinute:input.worldMinute,
   expiresWorldMinute:input.worldMinute+1440,entityIds:[...obstacles.map(o=>o.id),door.id,...windows.map(window=>window.id)],replacementGroup:'temple-of-the-gods',siteKey:site.siteKey,
   objectBoundary:{points:site.corners,bottomFeet:input.elevationFeet,topFeet:input.elevationFeet+h},doorAccess:{authorizedCreatureIds:[...delegates]},templeWard}]})
 return geometry?{ok:true as const,geometry,doorId:door.id}:fail('temple-structure-invalid')
}
