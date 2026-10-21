import type {BattleMap,Dnd5ePluginArea} from '../../store/maps'
import {tokenCenterForAnchorCell} from '../../lib/gridCombat'
import {mapGeometryFootprintTouchesSurface,type MapGeometryState} from '../../lib/mapGeometry'

/** Host-owned child area: obscuration follows the moving effect, never its damage footprint. */
export function applyDnd5eSurfaceCloudAfterMove(input:{map:BattleMap;previous:Dnd5ePluginArea;next:Dnd5ePluginArea;geometry?:MapGeometryState;round:number}):BattleMap {
 const {map,previous,next}=input,cloud=next.movement?.surfaceCloud
 if(!cloud || !previous.anchorCell || !next.anchorCell) return map
 const moved=previous.anchorCell.col!==next.anchorCell.col || previous.anchorCell.row!==next.anchorCell.row ||
   previous.vertical?.mode==='volume' && next.vertical?.mode==='volume' && previous.vertical.baseElevationFeet!==next.vertical.baseElevationFeet
 if(!moved) return map
 const dx=next.anchorCell.col-previous.anchorCell.col,dy=next.anchorCell.row-previous.anchorCell.row
 const raised=previous.cells.some(cell=>mapGeometryFootprintTouchesSurface({geometry:input.geometry,halfSizePixels:map.gridSize/2,
  from:tokenCenterForAnchorCell(cell,{size:1},map),to:tokenCenterForAnchorCell({col:cell.col+dx,row:cell.row+dy},{size:1},map),materials:cloud.materials,
  fromElevationFeet:previous.vertical?.mode==='volume'?previous.vertical.baseElevationFeet:undefined,
  toElevationFeet:next.vertical?.mode==='volume'?next.vertical.baseElevationFeet:undefined}))
 const id=`${next.id}:surface-cloud`,existing=map.dnd5ePluginAreas?.find(area=>area.id===id && area.linkedParentAreaId===next.id)
 if(!raised && !existing) return map
 const radius=cloud.radiusFeet/Math.max(1,map.feetPerCell??5),extent=Math.ceil(radius),cells:{col:number;row:number}[]=[]
 for(let x=-extent;x<=extent;x++)for(let y=-extent;y<=extent;y++){
  const col=next.anchorCell.col+x,row=next.anchorCell.row+y
  if(Math.hypot(x,y)>radius+1e-7 || col<0 || row<0 || col>=Math.ceil(map.width/map.gridSize) || row>=Math.ceil(map.height/map.gridSize))continue
  cells.push({col,row})
 }
 const base=next.vertical?.mode==='volume'?next.vertical.baseElevationFeet:0
 const center=base+(next.vertical?.mode==='volume'?next.vertical.heightFeet/2:0)
 const area:Dnd5ePluginArea={id,pluginId:next.pluginId,featureId:next.featureId,label:`${next.label} · 扬尘`,color:'#b8a17c',
  sourceCharacterId:next.sourceCharacterId,sourceTokenId:next.sourceTokenId,sourceKind:next.sourceKind,coreSpellId:next.coreSpellId,castingClassId:next.castingClassId,
  linkedParentAreaId:next.id,concentrationId:next.concentrationId,anchorMode:'fixed',anchorCell:{...next.anchorCell},cells,
  relation:'any',includeSelf:true,createdRound:raised?input.round:existing!.createdRound,expiresAfterRound:next.expiresAfterRound,
  createdWorldMinute:next.createdWorldMinute,expiresAtWorldMinute:next.expiresAtWorldMinute,
  remainingExplorationSeconds:raised?6:existing?.remainingExplorationSeconds??6,
  vertical:{mode:'volume',baseElevationFeet:Math.max(-1000,center-cloud.radiusFeet),heightFeet:cloud.radiusFeet*2,shape:'sphere'},
  obscuration:{kind:'heavy'},lifecycle:{timing:'source-turn-start',expireAfterAdvances:1},
  lifecycleAdvances:raised?0:existing?.lifecycleAdvances,lifecycleLastTurnKey:raised?undefined:existing?.lifecycleLastTurnKey}
 return {...map,dnd5ePluginAreas:[...(map.dnd5ePluginAreas??[]).filter(candidate=>candidate.id!==id),area]}
}
