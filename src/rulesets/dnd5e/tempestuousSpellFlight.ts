import{findMapGeometryPath}from'../../lib/mapPathfinding'
import{mapGeometryRuntimeForMap,mapGeometryTokenElevation,mapGeometryTerrainElevationAtPoint,type MapGeometryState}from'../../lib/mapGeometry'
import{snapTokenToGridCenter}from'../../lib/gridCombat'
import type{BattleMap,Token}from'../../store/maps'
export interface TempestuousSpellFlightIntent{timing:'before'|'after';featureId:string;to:{x:number;y:number};elevationFeet?:number}
/** Geometry only. This does not grant a movement mode, bonus action, cast,
 * source entitlement, immunity, original operation, or world publication. */
export function planDnd5eTempestuousSpellFlight(input:{map:BattleMap;actorToken:Token;intent:TempestuousSpellFlightIntent;geometry?:MapGeometryState|null}){
 const reject=(reason:string)=>({ok:false as const,reason}),{map,actorToken,intent}=input
 if(!intent||!['before','after'].includes(intent.timing)||typeof intent.featureId!=='string'||!intent.featureId||Object.keys(intent).some(key=>!['timing','featureId','to','elevationFeet'].includes(key))||!intent.to||Object.keys(intent.to).some(key=>!['x','y'].includes(key))||!Number.isFinite(intent.to.x)||!Number.isFinite(intent.to.y)||intent.elevationFeet!==undefined&&(!Number.isFinite(intent.elevationFeet)||intent.elevationFeet<-1000||intent.elevationFeet>10000)||!map.tokens.some(t=>t.id===actorToken.id&&t===actorToken))return reject('tempestuous-invalid-movement-intent')
 const geometry=input.geometry===undefined?mapGeometryRuntimeForMap(map.id):input.geometry??undefined
 if(geometry&&geometry.mapId!==map.id)return reject('tempestuous-invalid-geometry')
 const to=snapTokenToGridCenter(intent.to.x,intent.to.y,actorToken,map),fromElevationFeet=mapGeometryTokenElevation(geometry,actorToken),toElevationFeet=intent.elevationFeet??fromElevationFeet,toGroundElevationFeet=mapGeometryTerrainElevationAtPoint(geometry,to)
 if(toElevationFeet<toGroundElevationFeet||to.x===actorToken.x&&to.y===actorToken.y&&toElevationFeet===fromElevationFeet)return reject('tempestuous-movement-destination-required')
 const path=findMapGeometryPath({geometry,map:{...map,tokens:map.tokens.filter(token=>token.id!==actorToken.id)},token:actorToken,to,canFly:true,canClimb:true,targetElevationFeet:toElevationFeet,maximumTerrainStepFeet:10000})
 if(!path)return reject('tempestuous-movement-blocked')
 const elevations=[fromElevationFeet,...path.elevationsFeet,toElevationFeet],verticalFeet=elevations.slice(1).reduce((sum,height,index)=>sum+Math.abs(height-elevations[index]),0),distanceFeet=path.distanceFeet+verticalFeet
 if(distanceFeet>10.001)return reject('tempestuous-movement-exceeds-ten-feet')
 return{ok:true as const,plan:{timing:intent.timing,featureId:intent.featureId,from:{x:actorToken.x,y:actorToken.y,elevationFeet:fromElevationFeet},to:{...to,elevationFeet:toElevationFeet,groundElevationFeet:toGroundElevationFeet},path:path.points,pathElevationsFeet:path.elevationsFeet,distanceFeet,movementCostFeet:path.movementCostFeet+verticalFeet}}
}
