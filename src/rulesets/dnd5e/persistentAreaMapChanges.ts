import type {BattleMap} from '../../store/maps'
import type {Dnd5eCombatEvent} from './headlessCombatEngine'

/** Host-result delta, carried with combat events through the normal map commit.
 * Include only changed areas so unrelated areas survive repeated projection. */
export function dnd5ePersistentAreaMapChange(before:BattleMap,after:BattleMap):Dnd5eCombatEvent|undefined{
 if(before.id!==after.id)throw Error('persistent-area-map-mismatch')
 const previous=new Map((before.dnd5ePluginAreas??[]).map(area=>[area.id,area]))
 const next=after.dnd5ePluginAreas??[]
 const ids=new Set(next.map(area=>area.id))
 const removedIds=[...previous.keys()].filter(id=>!ids.has(id))
 const upserts=next.filter(area=>JSON.stringify(previous.get(area.id))!==JSON.stringify(area))
 return removedIds.length||upserts.length
  ?{type:'persistent-area-map-changed',mapId:before.id,removedIds,upserts:structuredClone(upserts)}:undefined
}

export function applyDnd5ePersistentAreaMapChanges(map:BattleMap,events:readonly Dnd5eCombatEvent[]):BattleMap{
 for(const event of events){
  if(event.type!=='persistent-area-map-changed'||event.mapId!==map.id)continue
  const removed=new Set(event.removedIds),upserts=new Map(event.upserts.map(area=>[area.id,area]))
  const areas=(map.dnd5ePluginAreas??[]).filter(area=>!removed.has(area.id)).map(area=>{
   const updated=upserts.get(area.id)
   upserts.delete(area.id)
   return updated?structuredClone(updated):area
  })
  map={...map,dnd5ePluginAreas:[...areas,...structuredClone([...upserts.values()])]}
 }
 return map
}
