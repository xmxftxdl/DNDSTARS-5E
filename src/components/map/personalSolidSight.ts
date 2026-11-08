import type {BattleMap} from '../../store/maps'
import {compileDnd5eEffectiveVisionProfile} from '../../../shared/dnd5e-vision-profile.mjs'
import {mapGeometryCanSeePoint,mapGeometryVisibilityPolygon,mapGeometryTokenElevation,mapGeometryTerrainElevationAtPoint,mapGeometryLineOfEffectBlocked,mapGeometryEntityBodyHeightFeet,type MapGeometryState,type MapGeometryPoint} from '../../lib/mapGeometry'
import {personalSolidSightMagicSuppressed,projectPersonalSolidSightSuppression} from '../../../shared/personal-solid-sight.mjs'

/** Presentation only: never changes the map, light, collisions, or another viewer's senses. */
export function personalSolidSightPolygon(input:{map:BattleMap;geometry?:MapGeometryState;viewerCharacterId?:string|null;isDM:boolean;worldMinute:number}):MapGeometryPoint[]{
 if(input.isDM||!input.viewerCharacterId)return[]
 const rawViewer=input.map.tokens.find(token=>token.characterId===input.viewerCharacterId)
 if(!rawViewer)return[]
 const suppressed=personalSolidSightMagicSuppressed({...input,token:rawViewer,elevationFeet:mapGeometryTokenElevation(input.geometry,rawViewer),heightFeet:mapGeometryEntityBodyHeightFeet(rawViewer)??5,
  elevationAt:point=>mapGeometryTokenElevation(input.geometry,point),terrainAt:point=>mapGeometryTerrainElevationAtPoint(input.geometry,point),lineOfEffectBlocked:(from,to)=>mapGeometryLineOfEffectBlocked({...input,from,to,fromElevationFeet:from.elevationFeet,toElevationFeet:to.elevationFeet})})
 const viewer=projectPersonalSolidSightSuppression(rawViewer,suppressed)
 const blinded=viewer.dnd5eSourceSightDisabled||viewer.dnd5eCombatState?.conditions?.some(condition=>['blinded','失明'].includes(String(condition)))||
  viewer.dnd5eCombatState?.activeEffects?.some(effect=>!effect.suspendedBy?.length&&(effect.standardCondition==='blinded'||['blinded','失明'].includes(effect.legacyCondition??'')))
 if(blinded)return[]
 const range=compileDnd5eEffectiveVisionProfile({token:viewer}).throughSolidObjectsRangeFeet??0
 if(range<=0)return[]
 const boundary=mapGeometryVisibilityPolygon({...input,viewer,forceEnabled:true,rangeOverrideFeet:range})
 const visible=(point:MapGeometryPoint)=>mapGeometryCanSeePoint({...input,viewer,point})
 // A private presentation cutout must also respect darkness and other local
 // perception limits. Stop each ray at its first unseen point; refine its edge.
 return boundary.map(end=>{
  const length=Math.hypot(end.x-viewer.x,end.y-viewer.y)
  if(length===0)return end
  const steps=Math.max(1,Math.ceil(length/Math.max(1,input.map.gridSize/5)))
  let last=0
  for(let i=1;i<=steps;i++){
   const next=i/steps,point={x:viewer.x+(end.x-viewer.x)*next,y:viewer.y+(end.y-viewer.y)*next}
   if(visible(point)){last=next;continue}
   let lower=last,upper=next
   for(let refine=0;refine<8;refine++){const middle=(lower+upper)/2;if(visible({x:viewer.x+(end.x-viewer.x)*middle,y:viewer.y+(end.y-viewer.y)*middle}))lower=middle;else upper=middle}
   return{x:viewer.x+(end.x-viewer.x)*lower,y:viewer.y+(end.y-viewer.y)*lower}
  }
  return end
 })
}
