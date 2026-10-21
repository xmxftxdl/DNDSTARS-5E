import {prepareStructureExpiry} from '../../../shared/structure-expiry.mjs'
import {mapGeometryTerrainElevationAtPoint,type MapGeometryState} from '../../lib/mapGeometry'
import type {BattleMap} from '../../store/maps'

export function prepareDnd5eStructureExpiry(map:BattleMap,geometry:MapGeometryState,worldMinute:number,replacedIds:readonly string[]=[]){
 return prepareStructureExpiry(map,geometry,worldMinute,replacedIds,mapGeometryTerrainElevationAtPoint)
}
