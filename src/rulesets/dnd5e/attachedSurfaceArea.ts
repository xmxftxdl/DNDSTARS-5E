import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'
import type { MapGeometryState } from '../../lib/mapGeometry'
import { resolveAttachedVerticalSurface } from './verticalMaterialSurface'
import { verticalSurfaceCells } from './verticalSurfaceCells'
import {resolveAttachedHorizontalSurface,horizontalSurfaceCells} from './horizontalMaterialSurface'
import {mapGeometryWithObjectSurfaces} from './mapObjectSurfaceGeometry'
import type {Character} from '../../types/character'

/** Presentation follows the authoritative solid without rewriting lifetime or source quota. */
export function projectAttachedSurfaceArea(area: Dnd5ePluginArea, map: BattleMap, geometry: MapGeometryState | undefined, characters:readonly Character[]=[]): Dnd5ePluginArea | undefined {
  if(area.visual?.horizontalSurface||area.visual?.verticalSurface?.attachment||area.visual?.verticalSurface?.fragments)geometry=mapGeometryWithObjectSurfaces(map,geometry,characters)
  if(area.visual?.horizontalSurface){
    if(!geometry)return undefined
    const surface=resolveAttachedHorizontalSurface(area.visual.horizontalSurface,geometry,map.gridSize/(map.feetPerCell??5))
    if(!surface)return undefined
    const cells=horizontalSurfaceCells(surface,map)
    if(!cells.length)return undefined
    return {...area,cells,anchorCell:cells[0],visual:{...area.visual,horizontalSurface:surface},
      vertical:{mode:'volume',baseElevationFeet:surface.elevationFeet,heightFeet:area.vertical?.mode==='volume'?area.vertical.heightFeet:1}}
  }
  const saved=area.visual?.verticalSurface
  if(!saved?.attachment&&!saved?.fragments)return area
  if(!geometry)return undefined
  const surface=resolveAttachedVerticalSurface(saved,geometry,map.gridSize/(map.feetPerCell??5))
  if(!surface)return undefined
  const cells=verticalSurfaceCells(surface,map)
  if(!cells.length)return undefined
  return {...area,cells,anchorCell:cells[0],visual:{...area.visual!,verticalSurface:surface},
    vertical:{mode:'volume',baseElevationFeet:surface.baseElevationFeet,heightFeet:surface.heightFeet}}
}
