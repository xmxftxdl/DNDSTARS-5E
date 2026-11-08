import type {Character} from '../../types/character'
import type {BattleMap} from '../../store/maps'
import type {Dnd5eCombatEvent} from './headlessCombatEngine'
import {prepareDnd5eMapInventoryDrop} from './mapInventoryDrop'
/** A source-bound physical weapon remains the same recoverable object, with its lease and bound Effects. */
export function prepareDnd5eRelentlessSourceBoundThrows(input:{map:BattleMap;characters:readonly Character[];events:readonly Dnd5eCombatEvent[];characterIdByCombatantId:Readonly<Record<string,string>>}){
 let map=input.map,characters=[...input.characters]
 const createdTokenIds:string[]=[]
 const consumed=new Set<string>()
 for(const event of input.events){
  if(event.type!=='relentless-weapon-reaction-resolved'||!event.attackMade||!event.thrown||!event.weaponId)continue
  const character=characters.find(c=>c.id===input.characterIdByCombatantId[event.actorId])
  const entry=character?.dnd5eInventory?.entries.find(candidate=>candidate.item.equipment?.id===event.weaponId)
  const weapon=entry?.item.equipment?.dnd5e
  if(!character||!entry?.sourceEffectTag||weapon?.kind!=='weapon'||weapon.vanishesAfterRelease||weapon.consumesQuantityOnAttack)continue
  const key=event.actorId+':'+event.index
  if(consumed.has(key))throw Error('duplicate-counterattack-inventory-cost')
  consumed.add(key)
  const target=map.tokens.find(token=>token.id===event.targetId)
  if(!target)throw Error('relentless-thrown-target-unavailable')
  const dropped=prepareDnd5eMapInventoryDrop({map,characters,actorTokenId:event.actorId,instanceId:entry.instanceId,expectedInventoryRevision:character.dnd5eInventory!.revision??0,requestId:'relentless-throw:'+entry.instanceId.slice(0,90)+':'+(character.dnd5eInventory!.revision??0),combatActive:false})
  if(!dropped.ok)throw Error('relentless-thrown-'+dropped.reason)
  map={...dropped.map,tokens:dropped.map.tokens.map(token=>token.id===dropped.objectTokenId?{...token,x:target.x,y:target.y,elevationFeet:target.elevationFeet}:token)}
  characters=dropped.characters;createdTokenIds.push(dropped.objectTokenId)
 }
 return {map,characters,createdTokenIds}
}

/** Preserve unknown owners; remove only this reaction's generated objects when their known lease ended. */
export function expireDnd5eRelentlessThrownObjects(map:BattleMap,characters:readonly Character[]):BattleMap {
 const tokens=map.tokens.filter(token=>{
  if(!token.id.startsWith('dropped:relentless-throw:'))return true
  const entry=token.dnd5eObjectState?.inventoryItem?.instance
  if(!entry?.sourceEffectTag||entry.spellAlteration)return true
  const owner=characters.find(character=>character.id===entry.sourceEffectOwnerId)
  return !owner||(owner.dnd5eCombatState?.activeEffects??[]).some(effect=>effect.tags?.includes(entry.sourceEffectTag!))
 })
 return tokens.length===map.tokens.length?map:{...map,tokens}
}
