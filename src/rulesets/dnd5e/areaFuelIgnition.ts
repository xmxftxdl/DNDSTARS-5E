import type { MapGeometryLight } from '../../lib/mapGeometry'
import { normalizeControlledFlameState } from '../../../shared/controlled-flame-state.mjs'
import type { BattleMap } from '../../store/maps'
import type { GridCell } from '../../lib/gridCombat'

/** Call on an authority-reconciled map, after ended concentration is removed. */
export function igniteFuelFromPersistentAreas(input: {
  map: BattleMap
  lights: readonly MapGeometryLight[]
  worldMinute?: number
  round: number
}): MapGeometryLight[] {
  let lights=[...input.lights]
  const worldMinute=input.worldMinute
  if(worldMinute==null||!Number.isFinite(worldMinute))return lights
  for(const area of input.map.dnd5ePluginAreas??[]){
    if(area.ignitesUnattendedFuel!==true||area.modeState?.paused||area.vertical?.mode!=='volume'||
      area.vertical.anchorOffsetFeet!=null||
      (!area.permanent&&(area.expiresAtWorldMinute!=null?worldMinute>=area.expiresAtWorldMinute:input.round>area.expiresAfterRound)))continue
    lights=igniteUnattendedFuelInVolume({map:input.map,lights,cells:area.cells,
      baseElevationFeet:area.vertical.baseElevationFeet,heightFeet:area.vertical.heightFeet})
  }
  return lights
}

/** Pure Host projection. Ignited physical fuel outlives the magical area. */
export function igniteUnattendedFuelInVolume(input: {
  map: BattleMap
  cells: readonly GridCell[]
  baseElevationFeet: number
  heightFeet: number
  lights: readonly MapGeometryLight[]
}): MapGeometryLight[] {
  const {map,baseElevationFeet,heightFeet}=input
  const scale=(map.feetPerCell ?? 5)/map.gridSize
  if (!Number.isFinite(scale)||scale<=0||!Number.isFinite(baseElevationFeet)||!Number.isFinite(heightFeet)||heightFeet<=0) return [...input.lights]
  return input.lights.map(light=>{
    const flame=normalizeControlledFlameState(light.controlledFlame)
    if(!flame||flame.id!==light.id||flame.burning||flame.fuelAvailable!==true||flame.custody!=='unattended')return light
    const point=light.points[0],z=light.elevationFeet,half=flame.extentFeet/2
    if(!point||![point.x,point.y,z].every(Number.isFinite)||z>=baseElevationFeet+heightFeet||z+flame.extentFeet<=baseElevationFeet)return light
    const x=(point.x-map.gridOffsetX)*scale,y=(point.y-map.gridOffsetY)*scale,feet=map.feetPerCell??5
    if(!input.cells.some(cell=>Number.isInteger(cell.col)&&Number.isInteger(cell.row)&&
      x+half>cell.col*feet&&x-half<(cell.col+1)*feet&&y+half>cell.row*feet&&y-half<(cell.row+1)*feet))return light
    return {...light,enabled:true,controlledFlame:{...flame,burning:true,alterations:[]}}
  })
}
