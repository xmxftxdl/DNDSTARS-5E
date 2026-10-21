import type {BattleMap,Token} from '../../store/maps'
import {mapGeometryPlacementBlocked,mapGeometryTerrainElevationAtPoint,type MapGeometryState} from '../../lib/mapGeometry'
import {mapTokenSweepBlocked} from '../../lib/mapTokenOccupancy'
import {dnd5eEntitySupportElevation} from './entitySupport'
import {dnd5eInventoryItemTemplate} from './items'
import {dnd5eMapPhysicalItemTemplate} from './mapInventoryItemAuthoring'
import {validDnd5eFortressFurnishingCatalog,type Dnd5eFortressFurnishingRecipe,type Dnd5eFortressFurnishingPlacement} from './fortressFurnishingDefinition'

/** Called once within the Host's creation transaction; recipes come from the installed module. */
export function placeDnd5eFortressFurnishings(input:{map:BattleMap;geometry:MapGeometryState;structureId:string;
 catalog:readonly Dnd5eFortressFurnishingRecipe[];placements:readonly Dnd5eFortressFurnishingPlacement[]}){
 if(!validDnd5eFortressFurnishingCatalog(input.catalog)||!Array.isArray(input.placements)||input.placements.length>512)throw Error('fortress-furnishings-invalid')
 const record=input.geometry.structureLifetimes?.find(entry=>entry.id===input.structureId&&entry.replacementGroup==='mighty-fortress')
 if(!record?.objectBoundary||input.geometry.mapId!==input.map.id)throw Error('fortress-furnishings-structure-missing')
 const [a,b,,d]=record.objectBoundary.points,ids=new Set(input.map.tokens.map(token=>token.id)),tokens:Token[]=[]
 for(const placement of input.placements){
  if(!placement||!/^[a-z0-9][a-z0-9_-]{0,60}$/.test(placement.id)||![1,2,3].includes(placement.level)||
   !Number.isFinite(placement.x)||!Number.isFinite(placement.y))throw Error('fortress-furnishings-placement-invalid')
  const recipe=input.catalog.find(entry=>entry.templateId===placement.templateId),template=dnd5eInventoryItemTemplate(placement.templateId)
  if(!recipe||!template||!dnd5eMapPhysicalItemTemplate(template))throw Error('fortress-furnishings-template-unavailable')
  const half=recipe.size*(input.map.feetPerCell??5)/2
  if(placement.x-half<35.5||placement.y-half<35.5||placement.x+half>84.5||placement.y+half>84.5)throw Error('fortress-furnishings-outside-keep')
  const slab=placement.level===1?undefined:input.geometry.obstacles.find(entity=>record.entityIds.includes(entity.id)&&entity.id.startsWith(`${record.id}:floor:keep-level-${placement.level}.`))
  const z=placement.level===1?record.objectBoundary.bottomFeet:slab?(slab.baseHeightFeet+slab.heightFeet):undefined
  if(z==null)throw Error('fortress-furnishings-floor-missing')
  const id=`${input.structureId}:furniture:${placement.id}`
  if(ids.has(id))throw Error('fortress-furnishings-id-conflict')
  ids.add(id)
  const token:Token={id,type:'obstacle',label:template.name,size:recipe.size,color:'#a78b67',emoji:'',
   x:a.x+(b.x-a.x)*placement.x/120+(d.x-a.x)*placement.y/120,y:a.y+(b.y-a.y)*placement.x/120+(d.y-a.y)*placement.y/120,elevationFeet:z,
   dnd5eObjectState:{schemaVersion:1,magical:true,structureBinding:{schemaVersion:1,mapId:input.map.id,structureId:input.structureId},
    ...(template.weightLb!=null?{weightPounds:template.weightLb}:{}),inventoryItem:{templateId:template.id,quantity:1,receiptId:id}}}
  const map={...input.map,tokens:[...input.map.tokens,...tokens]}
  if(mapGeometryPlacementBlocked({map,geometry:input.geometry,token,at:token,elevationFeet:z}).blocked||
   mapTokenSweepBlocked({map,geometry:input.geometry,mover:token,from:token,to:token,fromElevationFeet:z,toElevationFeet:z})||
   Math.abs(dnd5eEntitySupportElevation({map,geometry:input.geometry,token,elevationFeet:z,
    terrainElevationFeet:mapGeometryTerrainElevationAtPoint(input.geometry,token)})-z)>1e-4)throw Error('fortress-furnishings-placement-blocked')
  tokens.push(token)
 }
 return {map:{...input.map,tokens:[...input.map.tokens,...tokens]},tokenIds:tokens.map(token=>token.id)}
}
