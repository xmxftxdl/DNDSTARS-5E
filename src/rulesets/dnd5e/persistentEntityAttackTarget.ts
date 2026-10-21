import {dnd5eWallSurfaceAttackPoint} from './wallSurfaceSections'
import type {BattleMap, Dnd5ePluginArea} from '../../store/maps'
import type {StoneWallPanel} from './stoneWall'
import {wallArmorClass} from './wallObjectRules'

export type PersistentEntityAttackPanel = Omit<StoneWallPanel, 'hitPoints' | 'maxHitPoints'> & { hitPoints: number | null; maxHitPoints: number | null }
export function persistentEntityAttackPanel(area:Dnd5ePluginArea|undefined,panelId:string|undefined):PersistentEntityAttackPanel|undefined {
  const wall=area?.stoneWall?.panels.find(p=>p.id===panelId&&p.hitPoints>0)
  if(wall)return wall
  const anchor=area?.anchorCell??area?.cells[0]
  if (area?.projectionDefense === 'untouchable-illusion' && panelId === 'entity' && anchor) {
    return {id:'entity',start:anchor,end:anchor,cells:area.cells,hitPoints:null,maxHitPoints:null}
  }
  const hp=area?.entityCurrentHitPoints??area?.entityProfile?.hitPoints??0
  if(!area?.entityProfile||area.stoneWall||panelId!=='entity'||!anchor||hp<=0)return undefined
  return {id:'entity',start:anchor,end:anchor,cells:area.cells,hitPoints:hp,maxHitPoints:area.entityProfile.hitPoints}
}
export function persistentEntityAttackArmorClass(area:Dnd5ePluginArea):number | null {
  if (area.projectionDefense === 'untouchable-illusion') return null
  return area.entityProfile&&!area.stoneWall?area.entityProfile.armorClass:wallArmorClass(area)
}

/** Grid distance to a projection uses its occupied cells, not only its logical anchor. */
export function persistentProjectionAttackPoint(map: BattleMap, area: Dnd5ePluginArea, origin: { x: number; y: number; elevationFeet?:number }):{x:number;y:number;elevationFeet?:number}|undefined {
  if(area.wallSurfaceSections!=null)return dnd5eWallSurfaceAttackPoint(map,area,origin)
  if (area.projectionDefense !== 'untouchable-illusion' || !area.cells.length) return undefined
  return area.cells.map(cell => ({
    x: map.gridOffsetX + (cell.col + .5) * map.gridSize,
    y: map.gridOffsetY + (cell.row + .5) * map.gridSize,
  })).reduce((best, point) => {
    const distance = (p: typeof point) => Math.max(Math.abs(p.x - origin.x), Math.abs(p.y - origin.y))
    return distance(point) < distance(best) ? point : best
  })
}
