import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'
import type { Character } from '../../types/character'
import { cellKey, mapCellExtent, tokenOccupiedCellsAt } from '../../lib/gridCombat'
import { mapGeometryMovementBlocked, mapGeometryPlacementBlocked, mapGeometryRuntimeForMap, mapGeometryTokenElevation, type MapGeometryState } from '../../lib/mapGeometry'
import { dnd5ePersistentAreaConditionEffects } from './persistentAreaConditionEffects'
import { captureDnd5eAreaObjects } from './persistentAreaObjectCapture'
import { dnd5eTokenIntersectsPersistentAreaAt } from './persistentAreaGeometry'
import { mapGeometryVolumeMovementBlocked, mapGeometryEntityBodyHeightFeet, mapGeometryTerrainElevationAtPoint } from '../../lib/mapGeometry'

export interface Dnd5ePersistentAreaCarriedMovement {
  targetId: string
  from: { x: number; y: number }
  to: { x: number; y: number }
  distanceFeet: number
  fromElevationFeet?: number
  toElevationFeet?: number
  groundElevationFeet?: number
}

/** Host plan only. Never infers ownership from an unscoped legacy restrained condition. */
export function planDnd5ePersistentAreaCarry(input: {
  map: BattleMap
  characters: readonly Character[]
  area: Dnd5ePluginArea
  nextArea: Dnd5ePluginArea
  geometry?: MapGeometryState
  /** Host-authored area-center path; includes mandatory vertical drops. */
  areaPath?: readonly {x:number;y:number;elevationFeet:number}[]
  /** Transient sweep contact only: this creature must be settled before publishing the move. */
  pendingContactTargetId?: string
  pendingContactTargetIds?: readonly string[]
}): Dnd5ePersistentAreaCarriedMovement[] | undefined {
  if (!input.area.movement?.carryRestrainedTargets) return []
  const carried = []
  for (const token of input.map.tokens) {
    if (!['player', 'enemy', 'npc'].includes(token.type)) continue
    const character = token.characterId && !token.dnd5eSimulacrum
      ? input.characters.find(candidate => candidate.id === token.characterId) : undefined
    if (token.characterId && !token.dnd5eSimulacrum && !character) return undefined
    const effects = (character?.dnd5eCombatState ?? token.dnd5eCombatState)?.activeEffects
    const bound=dnd5ePersistentAreaConditionEffects({ effects, areaId: input.area.id,
      sourceId: input.area.sourceTokenId, condition: 'restrained' })
    const ceiling=input.area.vertical?.mode==='volume'?input.area.vertical.baseElevationFeet+input.area.vertical.heightFeet:undefined
    const atCeiling=ceiling!=null && Math.abs((token.elevationFeet??0)-ceiling)<1e-7 &&
      bound.some(effect=>effect.modifiers?.magicallyHeldAloft===true && effect.areaLifetime?.mapId===input.map.id &&
        (effect.areaLifetime.generation??0)===(input.area.boundEffectGeneration??0))
    const contactArea=atCeiling?{...input.area,occupantModifiers:{...input.area.occupantModifiers,magicallyHeldAloft:true as const}}:input.area
    if (bound.length && dnd5eTokenIntersectsPersistentAreaAt(token, input.map, contactArea, token)) carried.push(token)
  }
  if (!carried.length) return []
  const before = input.area.anchorCell ?? input.area.cells[0]
  const after = input.nextArea.anchorCell ?? input.nextArea.cells[0]
  if (!before || !after) return undefined
  // Vertical relocation also needs fall/landing settlement; never silently leave carried creatures behind.
  const base = (area: Dnd5ePluginArea) => area.vertical?.mode === 'volume' ? area.vertical.baseElevationFeet : 0
  const dz=base(input.nextArea)-base(input.area)
  const vertical=input.area.movement.allowVertical===true
  if (dz && !vertical) return undefined
  const dc = after.col - before.col, dr = after.row - before.row
  if (!Number.isFinite(dc) || !Number.isFinite(dr) ||
    (!input.areaPath && (!Number.isInteger(dc) || !Number.isInteger(dr)))) return undefined
  if(input.areaPath){
    const first=input.areaPath[0],last=input.areaPath.at(-1)
    if(!first||!last||Math.abs(first.x-(input.map.gridOffsetX+(before.col+.5)*input.map.gridSize))>1e-6||
      Math.abs(first.y-(input.map.gridOffsetY+(before.row+.5)*input.map.gridSize))>1e-6||
      Math.abs(first.elevationFeet-base(input.area))>1e-6||
      Math.abs(last.x-(input.map.gridOffsetX+(after.col+.5)*input.map.gridSize))>1e-6||
      Math.abs(last.y-(input.map.gridOffsetY+(after.row+.5)*input.map.gridSize))>1e-6)return undefined
  }
  if (!dc && !dr && !dz) return []
  const ids = new Set(carried.map(token => token.id))
  // Use the same intake rules as sweep settlement; this preview never publishes object moves.
  const capturedPreview = input.areaPath ? captureDnd5eAreaObjects(input.map, input.area, input.areaPath, input.geometry) : input.map
  if (!capturedPreview) return undefined
  const capturedObjectIds = new Set(capturedPreview.tokens.filter(token => {
    const capture = token.dnd5eObjectState?.areaCapture
    return token.type === 'obstacle' && capture?.mapId === input.map.id &&
      capture.areaId === input.area.id && capture.sourceTokenId === input.area.sourceTokenId
  }).map(token => token.id))
  const blockers = input.map.tokens.filter(token => !ids.has(token.id) && token.id !== input.area.anchorTokenId &&
    !capturedObjectIds.has(token.id) &&
    !(input.areaPath && (token.id === input.pendingContactTargetId || input.pendingContactTargetIds?.includes(token.id)) &&
      dnd5eTokenIntersectsPersistentAreaAt(token, input.map, input.nextArea, token)) &&
    (token.type !== 'obstacle' || token.obstacleKind !== 'marker'))
  const extent = mapCellExtent(input.map)
  const geometry = input.geometry ?? mapGeometryRuntimeForMap(input.map.id)
  const result: Dnd5ePersistentAreaCarriedMovement[] = []
  for (const token of carried) {
    const to = { x: token.x + dc * input.map.gridSize, y: token.y + dr * input.map.gridSize }
    const fromElevationFeet=mapGeometryTokenElevation(geometry,token),toElevationFeet=fromElevationFeet+dz
    const groundElevationFeet=mapGeometryTerrainElevationAtPoint(geometry,to)
    const height=mapGeometryEntityBodyHeightFeet(token)??5
    const occupied=new Set(blockers.filter(other=>{
      const bottom=mapGeometryTokenElevation(geometry,other),top=bottom+(mapGeometryEntityBodyHeightFeet(other)??5)
      return toElevationFeet<top-1e-7&&toElevationFeet+height>bottom+1e-7
    }).flatMap(other=>tokenOccupiedCellsAt(other,input.map,other)).map(cellKey))
    if(vertical){
      const path=input.areaPath?.map(point=>({x:token.x+point.x-input.areaPath![0].x,y:token.y+point.y-input.areaPath![0].y,
        elevationFeet:fromElevationFeet+point.elevationFeet-input.areaPath![0].elevationFeet}))??[{...token,elevationFeet:fromElevationFeet},{...to,elevationFeet:toElevationFeet}]
      const first=path[0],last=path[path.length-1]
      if(!first||!last||Math.abs(last.x-to.x)>1e-7||Math.abs(last.y-to.y)>1e-7||Math.abs(last.elevationFeet-toElevationFeet)>1e-7)return undefined
      if(toElevationFeet<groundElevationFeet-1e-7)return undefined
      for(let i=1;i<path.length;i++){
        if(mapGeometryVolumeMovementBlocked({geometry,map:input.map,from:path[i-1],to:path[i],
          fromElevationFeet:path[i-1].elevationFeet,toElevationFeet:path[i].elevationFeet,halfSizePixels:token.size*input.map.gridSize/2,heightFeet:height}).blocked)return undefined
      }
    }else if (fromElevationFeet !== mapGeometryTokenElevation(geometry, { ...token, ...to })) return undefined
    if (tokenOccupiedCellsAt(token, input.map, to).some(cell => cell.col < 0 || cell.row < 0 ||
      cell.col >= extent.cols || cell.row >= extent.rows || occupied.has(cellKey(cell))) ||
      mapGeometryPlacementBlocked({ geometry, map: input.map, token:{...token,elevationFeet:toElevationFeet}, at: to }).blocked ||
      (!vertical&&mapGeometryMovementBlocked({ geometry, map: input.map, token, to }).blocked)) return undefined
    result.push({ targetId: token.id, from: { x: token.x, y: token.y }, to,
      distanceFeet: Math.max(Math.abs(dz),Math.max(Math.abs(dc), Math.abs(dr)) * Math.max(1, input.map.feetPerCell ?? 5)),
      ...(vertical?{fromElevationFeet,toElevationFeet,groundElevationFeet}:{}) })
  }
  return result
}
