import { groveCellVisionSegments, groveVolumeOverlaps } from '../../../shared/grove-volume.mjs'
import { mapGeometryLineOfSightBlocked, mapGeometryTokenElevation, type MapGeometryState } from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import type { Dnd5eDetectedPresence } from './headlessCombatEngine'
import type { Dnd5eGroveVolume } from './druidGroveVolume'
import { magicDetectionBarrierBlocks } from '../../lib/magicDetectionBarrier'

function detectionGeometry(geometry: MapGeometryState | undefined): MapGeometryState | undefined {
  if (!geometry) return undefined
  // Legacy entities without physical data retain their existing blocking policy.
  // Explicit physical data is independent of opacity, including transparent lead barriers.
  const project = <T extends {blocksVision: boolean; magicDetectionBarrier?: import('../../lib/magicDetectionBarrier').MagicDetectionBarrier}>(entity: T): T =>
    entity.magicDetectionBarrier ? {...entity, blocksVision: magicDetectionBarrierBlocks(entity.magicDetectionBarrier)} : entity
  return {...geometry, walls: geometry.walls.map(project), doors: geometry.doors.map(project),
    windows: geometry.windows?.map(project), obstacles: geometry.obstacles.map(project)}
}

/** Closest points on each constant-height slice of the protected volume. */
function groveDetectionPoints(volume: Dnd5eGroveVolume, token: Token, z: number) {
  if (groveVolumeOverlaps(volume, token, z)) return [{x:token.x,y:token.y,z}]
  const edges=groveCellVisionSegments(volume,{x:volume.minX,y:volume.minY,size:volume.widthPixels},volume.baseElevationFeet,volume.heightFeet)
  const points:Array<{x:number;y:number;z:number}>=[]
  const slices=new Set<string>()
  for(const edge of edges){
    const low=edge.baseHeightFeet, high=low+edge.heightFeet
    const atZ=Math.max(low,Math.min(high,z))
    const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y
    const t=Math.max(0,Math.min(1,((token.x-edge.a.x)*dx+(token.y-edge.a.y)*dy)/(dx*dx+dy*dy)))
    points.push({x:edge.a.x+t*dx,y:edge.a.y+t*dy,z:atZ})
    const key=`${low}:${high}`
    if(!slices.has(key)){
      slices.add(key)
      // Include horizontal faces when the detector is above or below them.
      const x=Math.max(volume.minX,Math.min(volume.minX+volume.widthPixels-1e-7,token.x))
      const y=Math.max(volume.minY,Math.min(volume.minY+volume.widthPixels-1e-7,token.y))
      if(groveVolumeOverlaps(volume,{x,y},(low+high)/2))points.push({x,y,z:atZ})
    }
  }
  return points
}

/** Host-only ambient facts; areas are never fabricated as combatant Tokens. */
export function projectDnd5eMapMagicPresences(input: {
  map: BattleMap; tokens: readonly Token[]; geometry?: MapGeometryState; round: number; worldMinute?: number
  detectorHeightFeetById?: Readonly<Record<string, number>>
}): Record<string,Dnd5eDetectedPresence[]> {
  const groups=new Map<string,NonNullable<BattleMap['dnd5ePluginAreas']>[number]>()
  for(const area of input.map.dnd5ePluginAreas??[]){
    if(!area.groveVolume||!area.effectGroup)continue
    if(!area.permanent&&(area.expiresAfterRound<input.round||
      (input.worldMinute!=null&&area.expiresAtWorldMinute!=null&&area.expiresAtWorldMinute<=input.worldMinute)))continue
    const key=JSON.stringify([area.pluginId,area.sourceCharacterId,area.effectGroup.castId])
    if(!groups.has(key))groups.set(key,area)
  }
  const result:Record<string,Dnd5eDetectedPresence[]>={}
  const feetPerPixel=(input.map.feetPerCell??5)/input.map.gridSize
  const physicalMap={...input.map,dnd5ePluginAreas:[]}
  const geometry = detectionGeometry(input.geometry)
  for(const token of input.tokens){
    const height = input.detectorHeightFeetById?.[token.id] ?? 5
    const z=mapGeometryTokenElevation(input.geometry,token)+height / 2
    result[token.id]=[]
    for(const [key,area] of groups){
      const candidates=groveDetectionPoints(area.groveVolume!,token,z).map(point=>({point,
        distance:Math.hypot((point.x-token.x)*feetPerPixel,(point.y-token.y)*feetPerPixel,point.z-z)})).sort((a,b)=>a.distance-b.distance)
      const nearest=candidates.find(({point,distance})=>distance<1e-7||!mapGeometryLineOfSightBlocked({
        map:physicalMap,geometry,from:token,to:point,
        fromElevationFeet:z,toElevationFeet:point.z,fromEyeHeightFeet:0,toEyeHeightFeet:0}))
      if(!nearest)continue
      result[token.id].push({targetId:`map-magic:${input.map.id}:${key}`,distanceFeet:nearest.distance,
        categories:['magic','magic-area'],sourceRulesIds:[area.featureId],auraVisible:false})
    }
  }
  return result
}
