import type {BattleMap} from '../../store/maps'
import {createEmptyMapGeometry,mapGeometryTerrainElevationAtPoint,mapGeometryTokenElevation,type MapGeometryState} from '../../lib/mapGeometry'
import {settleAreaEndFlames} from '../../../shared/persistent-area-end-flames.mjs'

/** Stage map and geometry together; callers commit only after the area removal is accepted. */
export function prepareDnd5eEndedAreaFlames(input:{before:BattleMap;after:BattleMap;geometry?:MapGeometryState;worldMinute:number}){
  // Scenes without authored geometry still contain token-mounted flames.
  const geometry=input.geometry??createEmptyMapGeometry(input.after.id,0)
  const result=settleAreaEndFlames({...input,geometry,groundAt:mapGeometryTerrainElevationAtPoint,tokenElevation:mapGeometryTokenElevation})
  return {map:result.map,lights:result.geometry.lights??[],changedTokenIds:result.changedTokenIds,changedLightIds:result.changedLightIds}
}
