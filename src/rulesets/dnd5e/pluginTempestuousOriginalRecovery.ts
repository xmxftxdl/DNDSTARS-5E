import{encodeSecondChanceParentWire,decodeSecondChanceParentWire,type SecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{prepareDnd5eRandomTargetPluginSpellCast}from'./randomPluginSpellTargets'
import{resolvePreparedDnd5ePluginSpellCast}from'./pluginSpellTransaction'
import type{Character}from'../../types/character'
import type{BattleMap}from'../../store/maps'
import type{SharedPlayerActionState}from'../../lib/sharedCombatTypes'
import type{Dnd5eTurnEconomyCounts}from'../../lib/sharedCombatTypes'
import type{Dnd5eEffectiveRulesContextV1}from'./effectiveRulesContext'
type Source=Parameters<typeof resolvePreparedDnd5ePluginSpellCast>[0]
export interface PluginTempestuousRecoveryWorld{maps:readonly BattleMap[];characters:readonly Character[];combat:{active:boolean;mapId?:string;combatId?:string;round:number;initiativeIndex:number;initiativeOrder:Parameters<typeof prepareDnd5eRandomTargetPluginSpellCast>[0]['initiativeOrder'];dnd5eTurnEconomyByToken:Readonly<Record<string,Dnd5eTurnEconomyCounts>>;effectiveRules:Dnd5eEffectiveRulesContextV1};requests:readonly SharedPlayerActionState[];processed:readonly string[];ack?:{actionId?:string;status?:string}|null}
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v),same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
/** Re-executes a real canonical factory from original input data after a
 * caller has freshly read the protected Host book. This pure mechanical
 * reconstruction is not authentication, a raw issuer or world permission. */
export function reprepareDnd5ePluginTempestuousOriginal(book:unknown,world:PluginTempestuousRecoveryWorld):Source{
 if(!record(book)||book.ok!==true||book.sourceKind!=='tempestuous-plugin-preparation-v1'||typeof book.parentId!=='string'||typeof book.mapId!=='string'||typeof book.combatId!=='string'||!Number.isSafeInteger(book.effectTimestamp)||Number(book.effectTimestamp)<=0)throw Error('plugin-tempestuous-recovery:actual-protected-book-required')
 const wire=book.source;if(!record(wire)||wire.schemaVersion!==1||!Array.isArray(wire.nodes))throw Error('plugin-tempestuous-recovery:actual-protected-wire-required')
 const expected=decodeSecondChanceParentWire(wire as unknown as SecondChanceParentWire)as Source
 if(!record(expected)||!expected.prepared||!expected.currentRoom||expected.now!==book.effectTimestamp||Object.keys(expected).some(k=>!['prepared','currentRoom','currentCombatState','rolls','now'].includes(k)))throw Error('plugin-tempestuous-recovery:closed-original-input-required')
 const p=expected.prepared,actual=world.requests.find(row=>row.id===book.parentId),map=expected.currentRoom.maps.find(row=>row.id===book.mapId)
 if(p.action.id!==book.parentId||p.action.mapId!==book.mapId||p.action.combatId!==book.combatId||p.action.sourceMode!=='player'||p.castingTime!=='action'||!map||!actual||!same(p.action,actual)||world.processed.includes(p.action.id)||world.ack?.actionId===p.action.id&&['accepted','rejected'].includes(world.ack.status??'')||!world.combat.active||world.combat.mapId!==book.mapId||world.combat.combatId!==book.combatId||world.combat.round!==p.state.round||world.combat.initiativeIndex!==p.state.initiativeIndex||!same(expected.currentRoom.maps,world.maps)||!same(expected.currentRoom.characters,world.characters))throw Error('plugin-tempestuous-recovery:exact-current-world-and-parent-required')
 if(!Number.isSafeInteger(p.transaction.createdAt)||p.transaction.createdAt<=0||p.roomMaps!==undefined&&!same(p.roomMaps,world.maps))throw Error('plugin-tempestuous-recovery:actual-original-clock-and-maps-required')
 const worldMinute=p.state.combatants[p.actorToken.id]?.campaignWorldMinute
 const prepared=prepareDnd5eRandomTargetPluginSpellCast({action:p.action,map,characters:expected.currentRoom.characters,...(p.roomMaps!==undefined?{roomMaps:p.roomMaps}:{}),initiativeOrder:world.combat.initiativeOrder,turnEconomy:world.combat.dnd5eTurnEconomyByToken[p.action.actorTokenId],turnEconomyByToken:world.combat.dnd5eTurnEconomyByToken,effectiveRules:world.combat.effectiveRules,roomRequiredPlugins:world.combat.effectiveRules.requiredPlugins,now:p.transaction.createdAt,...(worldMinute!==undefined?{worldMinute}:{} ),chooseRandomTarget:()=>{throw Error('plugin-tempestuous-recovery:random-target-original-not-supported')}})
 if(!prepared.ok)throw Error('plugin-tempestuous-recovery:canonical-prepare:'+prepared.reason)
 const source={...expected,prepared:prepared.prepared}
 if(!same(encodeSecondChanceParentWire(source),book.source))throw Error('plugin-tempestuous-recovery:exact-reexecuted-original-required')
 return source
}
