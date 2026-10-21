import type {BattleMap,Dnd5ePluginArea} from '../../store/maps'
import {tokenOccupiedCellsAt} from '../../lib/gridCombat'
import type {Dnd5eHeadlessCombatState} from './headlessCombatEngine'
import type {Dnd5ePersistentAreaConditionDeclaration} from './persistentAreaTypes'
import {dnd5ePersistentAreaConditionEffects} from './persistentAreaConditionEffects'

/** Runs only on the Host's successful trigger result, before its atomic map plan. */
export function createPersistentAreaDestructibleRestraint(input:{map:BattleMap;state:Dnd5eHeadlessCombatState;area:Dnd5ePluginArea;targetId:string;declaration:NonNullable<Dnd5ePersistentAreaConditionDeclaration['destructibleRestraint']>}):Dnd5ePluginArea|undefined{
 const target=input.state.combatants[input.targetId],token=input.map.tokens.find(t=>t.id===input.targetId)
 if(!target||!token)return undefined
 const effects=dnd5ePersistentAreaConditionEffects({effects:target.classState.activeEffects,areaId:input.area.id,sourceId:input.area.sourceTokenId,condition:'restrained'})
 if(effects.length!==1)return undefined
 const id=`${input.area.id}:restraint:${input.targetId}`
 if(input.map.dnd5ePluginAreas?.some(area=>area.id===id))return undefined
 const cells=tokenOccupiedCellsAt(token,input.map,target.position)
 if(!cells.length)return undefined
 const declaration=input.declaration
 const area:Dnd5ePluginArea={id,pluginId:input.area.pluginId,featureId:input.area.featureId,
  sourceCharacterId:input.area.sourceCharacterId,sourceTokenId:input.area.sourceTokenId,
  sourceKind:input.area.sourceKind,coreSpellId:input.area.coreSpellId,slotLevel:input.area.slotLevel,
  castingClassId:input.area.castingClassId,label:declaration.label,color:input.area.color,
  createdRound:input.state.round,expiresAfterRound:input.state.round,permanent:true,
  linkedParentAreaId:input.area.id,cells,anchorCell:cells[0],anchorMode:'fixed',
  vertical:{mode:'ground'},entityProfile:{armorClass:declaration.armorClass,hitPoints:declaration.hitPoints,cannotAttack:true,invisible:false},
  entityCurrentHitPoints:declaration.hitPoints}
 const effect=effects[0]
 // Rebind this target only; sibling captives stay attached to their own objects.
 effect.areaLifetime={mapId:input.map.id,areaId:id,sourceActorId:input.area.sourceTokenId}
 const tags=effect.tags?.filter(tag=>!tag.startsWith('persistent-area:'))
 effect.tags=tags?.length?tags:undefined
 target.classState.activeEffects=target.classState.activeEffects?.map(current=>current.id===effect.id?effect:current)
 return area
}
