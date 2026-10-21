import type {BattleMap} from '../../store/maps'
import type {Dnd5eStructureObjectBinding} from './structureObjectBinding'
import {droppedDnd5eCompanionObjects} from './companionCarriedObjects'
import {expireStructureMapObjects} from '../../../shared/structure-object-expiry.mjs'
export function expireDnd5eStructureMapObjects(map:BattleMap,expired:readonly Dnd5eStructureObjectBinding[]):BattleMap {
 return expireStructureMapObjects(map,expired,droppedDnd5eCompanionObjects)
}
