import { cellToPixel, type GridCell } from '../../lib/gridCombat'
import { mapGeometryTokenElevation, mapGeometryPointInPolygon, type MapGeometryState } from '../../lib/mapGeometry'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { prepareDnd5eTempleDisintegrationTarget } from '../../rulesets/dnd5e/templeDisintegration'
import type { Dnd5eTempleDisintegrationDeclaration } from '../../rulesets/dnd5e/templeDisintegrationDeclaration'

/** Cell highlighting and selection use the same exposed surface candidates. */
export function templeDisintegrationCellTargets(input: {
  map: BattleMap; geometry: MapGeometryState; actorTokenId: string; characters: readonly Character[]; worldMinute: number
}): Array<{cell: GridCell; declaration: Dnd5eTempleDisintegrationDeclaration}> {
  const actor = input.map.tokens.find(token => token.id === input.actorTokenId)
  if (!actor || !Number.isSafeInteger(input.worldMinute) || input.worldMinute < 0 || input.map.gridSize <= 0) return []
  const ids = new Set(input.geometry.structureLifetimes?.filter(record => record.templeWard &&
    record.createdWorldMinute <= input.worldMinute && (record.expiresWorldMinute == null || record.expiresWorldMinute > input.worldMinute))
    .flatMap(record => record.entityIds))
  const entities = [...input.geometry.obstacles, ...input.geometry.doors, ...input.geometry.walls, ...input.geometry.windows ?? []]
    .filter(entity => ids.has(entity.id))
  if (!entities.length) return []
  const { gridSize, gridOffsetX, gridOffsetY } = input.map
  const reach = 60 * gridSize / (input.map.feetPerCell ?? 5)
  const minCol = Math.max(0, Math.floor((actor.x-reach-gridOffsetX)/gridSize))
  const maxCol = Math.min(Math.ceil((input.map.width-gridOffsetX)/gridSize)-1, Math.floor((actor.x+reach-gridOffsetX)/gridSize))
  const minRow = Math.max(0, Math.floor((actor.y-reach-gridOffsetY)/gridSize))
  const maxRow = Math.min(Math.ceil((input.map.height-gridOffsetY)/gridSize)-1, Math.floor((actor.y+reach-gridOffsetY)/gridSize))
  const eye = mapGeometryTokenElevation(input.geometry,actor)+2.5
  const result: Array<{cell: GridCell; declaration: Dnd5eTempleDisintegrationDeclaration}> = []
  for(let row=minRow;row<=maxRow;row++)for(let col=minCol;col<=maxCol;col++){
    const cell={row,col},aim=cellToPixel(cell,input.map)
    const candidates: Array<{entityId:string;point:{x:number;y:number;elevationFeet:number};distance:number}> = []
    for(const entity of entities){
      for(let index=0;index<entity.points.length;index++){
        const a=entity.points[index],b=entity.points[(index+1)%entity.points.length]
        const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy
        if(!length)continue
        const t=Math.max(0,Math.min(1,((aim.x-a.x)*dx+(aim.y-a.y)*dy)/length))
        const point={x:a.x+t*dx,y:a.y+t*dy,elevationFeet:Math.max(entity.baseHeightFeet,Math.min(eye,entity.baseHeightFeet+entity.heightFeet))}
        const distance=Math.hypot(point.x-aim.x,point.y-aim.y)
        if(distance<=gridSize*.8)candidates.push({entityId:entity.id,point,distance})
      }
      if(entity.points.length>2&&mapGeometryPointInPolygon(aim,entity.points)){
        for(const elevationFeet of [entity.baseHeightFeet,entity.baseHeightFeet+entity.heightFeet])
          candidates.push({entityId:entity.id,point:{...aim,elevationFeet},distance:0})
      }
    }
    candidates.sort((a,b)=>a.distance-b.distance||Math.abs(a.point.elevationFeet-eye)-Math.abs(b.point.elevationFeet-eye)||a.entityId.localeCompare(b.entityId))
    const selected=candidates.find(candidate=>prepareDnd5eTempleDisintegrationTarget({...input,targetEntityId:candidate.entityId,
      targetPosition:candidate.point,targetElevationFeet:candidate.point.elevationFeet,rangeFeet:60}).ok)
    if(selected)result.push({cell,declaration:{schemaVersion:1,entityId:selected.entityId,point:selected.point}})
  }
  return result
}
