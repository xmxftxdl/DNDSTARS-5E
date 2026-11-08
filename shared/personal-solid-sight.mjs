import {clippedPrismDistanceToBox} from './clipped-prism-origin.mjs'
import {annularAreaOverlapsBox} from './annular-area-geometry.mjs'
import {groveAreaFootprintOverlaps} from './grove-volume.mjs'
import {persistentAreaHeightSlices} from './persistent-area-columns.mjs'

/** Bounded presence query for the newly introduced personal magical sight. */
export function personalSolidSightMagicSuppressed({map,token,elevationFeet=0,heightFeet=5,elevationAt=()=>0,terrainAt=()=>0,lineOfEffectBlocked=()=>false}) {
 const grid=Math.max(1,map.gridSize),feet=Math.max(1,map.feetPerCell??5)
 const footprint=({'大型':2,'超大型':3,'巨型':4,Large:2,Huge:3,Gargantuan:4})[token.creatureSize]??Math.max(1,Math.round(token.size??1))
 const half=footprint*grid/2
 const bottom=elevationFeet,top=bottom+heightFeet
 const minimum={x:token.x-half,y:token.y-half,elevationFeet:bottom},maximum={x:token.x+half,y:token.y+half,elevationFeet:top}
 const overlap=area=>{
  if(area.vertical?.columns)return persistentAreaHeightSlices(area).some(overlap)
  const anchor=['source-token','target-token','effect-token'].includes(area.anchorMode)?map.tokens.find(t=>t.id===(area.anchorTokenId??area.sourceTokenId)):undefined
  const v=area.vertical,base=anchor&&Number.isFinite(v?.anchorOffsetFeet)?elevationAt(anchor)+v.anchorOffsetFeet:v?.baseElevationFeet??0
  const center=anchor??(area.anchorCell?{x:(map.gridOffsetX??0)+(area.anchorCell.col+.5)*grid,y:(map.gridOffsetY??0)+(area.anchorCell.row+.5)*grid}:undefined)
  if(v?.mode==='ground'&&Math.abs(bottom-terrainAt(token))>1e-4)return false
  if(v?.mode==='volume'&&v.shape!=='sphere'&&(top<=base+1e-4||bottom>=base+v.heightFeet-1e-4))return false
  let intersects
  if(v?.shape==='sphere'&&center){
   const radius=v.heightFeet/2,scale=feet/grid,cZ=base+radius
   const dx=Math.max(0,Math.abs(token.x-center.x)-half)*scale,dy=Math.max(0,Math.abs(token.y-center.y)-half)*scale,dz=Math.max(0,bottom-cZ,cZ-top)
   intersects=dx*dx+dy*dy+dz*dz<=radius*radius
  }else if(area.rectGeometry&&!area.rectGeometry.gridAligned&&v?.mode==='volume'){
   intersects=clippedPrismDistanceToBox(map,area,minimum,maximum)<=1e-7
  }else{
   const firstCol=Math.round((token.x-(map.gridOffsetX??0))/grid-footprint/2),lastCol=firstCol+footprint-1
   const firstRow=Math.round((token.y-(map.gridOffsetY??0))/grid-footprint/2),lastRow=firstRow+footprint-1
   intersects=area.cells?.some(c=>c.col>=firstCol&&c.col<=lastCol&&c.row>=firstRow&&c.row<=lastRow)===true
   if(area.circularGeometry?.innerRadiusFeet!=null)intersects&&=annularAreaOverlapsBox(area,map,token,half)
  }
  if(!intersects)return false
  if(area.groveVolume&&!groveAreaFootprintOverlaps(area.groveVolume,area.cells,map,token,half,Math.max(bottom,base),Math.min(top,base+(v?.heightFeet??heightFeet))-Math.max(bottom,base)))return false
  if(area.occupantModifiers?.requiresLineOfEffectFromAnchor){if(!center)return false;const source={...center,elevationFeet:base+(v?.shape==='sphere'?v.heightFeet/2:0)};if(lineOfEffectBlocked(source,{...token,elevationFeet:bottom}))return false}
  return true
 }
 return (map.dnd5ePluginAreas??[]).some(area=>area.occupantModifiers?.suppressesMagic===true&&
  !area.excludedTargetIds?.includes(token.id)&&(area.includeSelf===true||area.sourceTokenId!==token.id)&&overlap(area))
}

/** Pause only the new magical grant, including its own conditional darkvision. */
export function projectPersonalSolidSightSuppression(value,suppressed) {
 if(!suppressed||!value||typeof value!=='object')return value
 const state=s=>!s||typeof s!=='object'?s:{...s,activeEffects:s.activeEffects?.map(effect=>{
  if(effect.source?.magical!==true||!(effect.modifiers?.throughSolidObjectsRangeFeet>0))return effect
  const {throughSolidObjectsRangeFeet:_solid,darkvisionIfAbsentFeet:_conditional,darkvisionRangeFeet:_activationGrant,...modifiers}=effect.modifiers
  return {...effect,modifiers}
 })}
 return {...value,dnd5eCombatState:state(value.dnd5eCombatState),classState:state(value.classState),
  ...(value.dnd5eProjectedCharacterVision?{dnd5eProjectedCharacterVision:{...value.dnd5eProjectedCharacterVision,classState:state(value.dnd5eProjectedCharacterVision.classState)}}:{})}
}
