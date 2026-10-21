import {persistentAreaVolumeRayIntersections} from '../../../shared/persistent-area-ray.mjs'
import {dnd5eWallFreezingSectionAt,dnd5eWallSurfaceIntersectsFootprint} from './wallSurfaceSections'
import {dnd5eInstantAoeColumnHeightFeet,dnd5ePitchedAreaVerticalInterval} from './verticalCombatGeometry'
import type {SkillAoeTargeting} from '../../lib/skillTargeting'
import type {Dnd5eSrdSpellDefinition} from './spells'
import type {Dnd5eCombatEvent} from './headlessCombatEngine'
import {dnd5eWallSurfaceLength,subtractDnd5eWallSurfaceSection,type Dnd5eWallSurfaceSection} from './wallSurfaceSections'
import {validWallSurfaceSections} from '../../../shared/wall-surface-sections.mjs'
import type {BattleMap,Dnd5ePluginArea} from '../../store/maps'
import {subtractPersistentAreaColumnBand} from '../../../shared/persistent-area-columns.mjs'

/** Freeze a Host-selected wall footprint and height band. Cold-path selection is a separate step. */
export function freezeDnd5eWaterWallBand(input:{map:BattleMap;areaId:string;sectionId:string;
  cells:readonly {col:number;row:number}[];bottom:number;top:number}):BattleMap|undefined {
 const area=input.map.dnd5ePluginAreas?.find(item=>item.id===input.areaId)
 if(!area||area.vertical?.mode!=='volume'||!input.sectionId.trim()||input.sectionId.length>256||
   !input.cells.length||input.cells.some(cell=>!Number.isSafeInteger(cell.col)||!Number.isSafeInteger(cell.row)))return undefined
 const id=`${area.id}:frozen:${input.sectionId}`
 if(input.map.dnd5ePluginAreas?.some(item=>item.id===id))return input.map
 const remaining=subtractPersistentAreaColumnBand(area,input.cells,input.bottom,input.top)
 if(!remaining)return undefined
 const selected=new Set(input.cells.map(cell=>`${cell.col}:${cell.row}`))
 const vertical=area.vertical
 const source=vertical.columns??area.cells.map(cell=>({...cell,baseElevationFeet:vertical.baseElevationFeet,heightFeet:vertical.heightFeet}))
 const occupied=new Set(area.cells.map(cell=>`${cell.col}:${cell.row}`))
 const columns=source.flatMap(column=>{
  const bottom=Math.max(input.bottom,column.baseElevationFeet),top=Math.min(input.top,column.baseElevationFeet+column.heightFeet)
  return selected.has(`${column.col}:${column.row}`)&&occupied.has(`${column.col}:${column.row}`)&&top>bottom
    ?[{...column,baseElevationFeet:bottom,heightFeet:top-bottom}]:[]
 })
 if(!columns.length)return input.map
 const frozenCells=[...new Map(columns.map(({col,row})=>[`${col}:${row}`,{col,row}])).values()]
 const frozen:Dnd5ePluginArea={id,pluginId:area.pluginId,featureId:area.featureId,label:`${area.label} · 冰块`,color:'#a6dfef',
  sourceCharacterId:area.sourceCharacterId,sourceTokenId:area.sourceTokenId,sourceKind:area.sourceKind,coreSpellId:area.coreSpellId,
  slotLevel:area.slotLevel,sourceSpellSaveDc:area.sourceSpellSaveDc,createdRound:area.createdRound,
  expiresAfterRound:area.expiresAfterRound,createdWorldMinute:area.createdWorldMinute,expiresAtWorldMinute:area.expiresAtWorldMinute,concentrationId:area.concentrationId,
  permanent:area.permanent,linkedParentAreaId:area.id,anchorMode:'fixed',anchorCell:area.anchorCell,
  rectGeometry:area.rectGeometry,circularGeometry:area.circularGeometry,cells:frozenCells,
  vertical:{mode:'volume',baseElevationFeet:input.bottom,heightFeet:input.top-input.bottom,columns},
  blocking:{movement:true,lineOfEffect:true},entityProfile:{armorClass:5,hitPoints:15,cannotAttack:true,invisible:false},entityCurrentHitPoints:15}
 return {...input.map,dnd5ePluginAreas:[...(input.map.dnd5ePluginAreas??[]).map(item=>item.id===area.id?remaining:item),frozen]}
}

/** Freeze an exact surface section; map cells remain only the broad-phase footprint. */
export function freezeDnd5eWaterWallSection(input:{map:BattleMap;areaId:string;sectionId:string;section:Dnd5eWallSurfaceSection}):BattleMap|undefined{
 const area=input.map.dnd5ePluginAreas?.find(item=>item.id===input.areaId),cut=input.section
 if(!area||area.vertical?.mode!=='volume'||!validWallSurfaceSections(area,[cut]))return undefined
 const id=`${area.id}:frozen:${input.sectionId}`
 if(input.map.dnd5ePluginAreas?.some(item=>item.id===id))return input.map
 const length=dnd5eWallSurfaceLength(area)!
 const source=area.wallSurfaceSections??[{startFeet:0,endFeet:length,bottomFeet:area.vertical.baseElevationFeet,topFeet:area.vertical.baseElevationFeet+area.vertical.heightFeet}]
 const frozenSections=source.flatMap(part=>{
  const p={startFeet:Math.max(part.startFeet,cut.startFeet),endFeet:Math.min(part.endFeet,cut.endFeet),bottomFeet:Math.max(part.bottomFeet,cut.bottomFeet),topFeet:Math.min(part.topFeet,cut.topFeet)}
  return p.startFeet<p.endFeet&&p.bottomFeet<p.topFeet?[p]:[]
 })
 if(!frozenSections.length)return input.map
 const built=freezeDnd5eWaterWallBand({...input,cells:area.cells,bottom:cut.bottomFeet,top:cut.topFeet})
 if(!built||built===input.map)return built
 const remaining=subtractDnd5eWallSurfaceSection(source,cut)
 return {...built,dnd5ePluginAreas:built.dnd5ePluginAreas?.map(item=>item.id===area.id?
  {...area,wallSurfaceSections:remaining,geometryDepleted:remaining.length?undefined:true,cells:remaining.length?area.cells:[]}:
  item.id===id?{...item,vertical:area.vertical,wallSurfaceSections:frozenSections}:item)}
}

/** Apply only Host-produced cold spell paths; replay never recreates consumed water. */
export function freezeDnd5eWaterWallsFromEvents(input:{map:BattleMap;events?:readonly Dnd5eCombatEvent[];round:number;worldMinute?:number}):BattleMap{
 let map=input.map
 for(const event of input.events??[]){
  if(event.type!=='cold-spell-path-resolved'&&event.type!=='cold-spell-volume-resolved')continue
  if(event.type==='cold-spell-volume-resolved'&&(!Number.isFinite(event.bottomFeet)||!Number.isFinite(event.topFeet)||event.topFeet<=event.bottomFeet))continue
  for(const original of input.map.dnd5ePluginAreas??[]){
   if(!original.blocking?.freezesOnColdSpell||original.modeState?.paused||original.vertical?.mode!=='volume'||
    (!original.permanent&&(input.round>original.expiresAfterRound||input.worldMinute!=null&&original.expiresAtWorldMinute!=null&&input.worldMinute>=original.expiresAtWorldMinute)))continue
   const length=dnd5eWallSurfaceLength(original);if(!length)continue
   const cols=Math.max(1,Math.floor(length/5)),rows=Math.max(1,Math.floor(original.vertical.heightFeet/5))
   if(cols*rows>1024)continue
   for(let col=0;col<cols;col++)for(let row=0;row<rows;row++){
    const area=map.dnd5ePluginAreas?.find(item=>item.id===original.id)
    if(!area||!area.cells.length)continue
    const section=dnd5eWallFreezingSectionAt(original,Math.min(col*5,length),original.vertical.baseElevationFeet+row*5)
    if(!section)continue
    const existing=area.wallSurfaceSections??[{startFeet:0,endFeet:length,bottomFeet:original.vertical.baseElevationFeet,topFeet:original.vertical.baseElevationFeet+original.vertical.heightFeet}]
    const clipped=existing.flatMap(p=>{
     const part={startFeet:Math.max(p.startFeet,section.startFeet),endFeet:Math.min(p.endFeet,section.endFeet),bottomFeet:Math.max(p.bottomFeet,section.bottomFeet),topFeet:Math.min(p.topFeet,section.topFeet)}
     return part.startFeet<part.endFeet&&part.bottomFeet<part.topFeet?[part]:[]
    })
    if(!clipped.length)continue
    const patch={...area,wallSurfaceSections:clipped}
    const intersects=event.type==='cold-spell-path-resolved'
     ?persistentAreaVolumeRayIntersections({map,area:patch,from:event.from,to:event.to,fromElevationFeet:event.fromElevationFeet,toElevationFeet:event.toElevationFeet}).length>0
     :event.cells.some(cell=>dnd5eWallSurfaceIntersectsFootprint({map,area:patch,
       position:{x:map.gridOffsetX+(cell.col+.5)*map.gridSize,y:map.gridOffsetY+(cell.row+.5)*map.gridSize},
       halfSizePixels:map.gridSize/2,bottomFeet:event.bottomFeet,topFeet:event.topFeet}))
    if(!intersects)continue
    map=freezeDnd5eWaterWallSection({map,areaId:area.id,sectionId:`surface-${col}-${row}`,section})??map
   }
  }
 }
 return map
}

export interface Dnd5eSpellAreaExposure {
 area:SkillAoeTargeting;origin:{x:number;y:number};originElevationFeet:number;
 aim:{x:number;y:number};aimElevationFeet:number;sourceHeightFeet:number
 cells?:readonly {col:number;row:number}[]
}

/** Host-selected template cells expose water even without creature damage events. */
export function freezeDnd5eWaterWallsFromSpellArea(input:{map:BattleMap;spell:Dnd5eSrdSpellDefinition;
 damageType?:Dnd5eSrdSpellDefinition['damageType'];cells?:readonly {col:number;row:number}[];
 exposure?:Dnd5eSpellAreaExposure;elevationFeet:number;actorId:string;round:number;worldMinute?:number}):BattleMap {
 const cold=(input.damageType??input.spell.damageType)==='cold'||input.spell.additionalDamageComponents?.some(part=>part.damageType==='cold')
 if(!cold)return input.map
 return freezeDnd5eWaterWallsFromArea({...input,columnHeightFeet:dnd5eInstantAoeColumnHeightFeet(input.spell.id)})
}

/** Shared Host geometry path for native spells and resolved imported spell Activities. */
export function freezeDnd5eWaterWallsFromArea(input:{map:BattleMap;cells?:readonly {col:number;row:number}[];
 exposure?:Dnd5eSpellAreaExposure;elevationFeet:number;columnHeightFeet?:number;actorId:string;round:number;worldMinute?:number}):BattleMap {
 const cells=input.exposure?.cells??input.cells
 if(!cells?.length)return input.map
 const exposure=input.exposure,area=exposure?.area
 const base=exposure?.originElevationFeet??input.elevationFeet
 const height=area?.volumeHeightFeet??input.columnHeightFeet
 if(height)return freezeDnd5eWaterWallsFromEvents({...input,events:[{type:'cold-spell-volume-resolved',actorId:input.actorId,
  cells,bottomFeet:base,topFeet:base+height}]})
 if(!exposure||!area)return input.map
 if(area.shape==='circle'||area.shape==='rect'){
  const bottom=area.shape==='circle'?base-area.radiusFeet:base
  const top=area.shape==='circle'?base+area.radiusFeet+(area.origin==='self'?exposure.sourceHeightFeet:0):base+Math.max(area.widthFeet,area.heightFeet)
  return freezeDnd5eWaterWallsFromEvents({...input,events:[{type:'cold-spell-volume-resolved',actorId:input.actorId,cells,bottomFeet:bottom,topFeet:top}]})
 }
 const events:Dnd5eCombatEvent[]=[]
 for(const cell of cells){
  const span=dnd5ePitchedAreaVerticalInterval({area,map:input.map,
   targetToken:{x:input.map.gridOffsetX+(cell.col+.5)*input.map.gridSize,y:input.map.gridOffsetY+(cell.row+.5)*input.map.gridSize},
   targetBottom:base-area.lengthFeet,targetHeight:area.lengthFeet*2,
   effectOrigin:exposure.origin,effectOriginElevationFeet:base,effectAim:exposure.aim,effectAimElevationFeet:exposure.aimElevationFeet})
  if(span&&span.top>span.bottom)events.push({type:'cold-spell-volume-resolved',actorId:input.actorId,cells:[cell],bottomFeet:span.bottom,topFeet:span.top})
 }
 return freezeDnd5eWaterWallsFromEvents({...input,events})
}
