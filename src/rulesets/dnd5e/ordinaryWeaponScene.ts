import type{Dnd5eHeadlessCombatState}from'./headlessCombatEngine'
import{registerDnd5eHostReceipt,registerDnd5eHostReceiptSlot}from'./hostTransactionClone'
export interface OrdinaryWeaponSceneFacts{roomId:string;hostMemberId:string;mapId:string;actorId:string;characterId:string;parentTransactionId:string;versions:Readonly<Record<string,number>>;combatBoundary:string;clockSignature:string}
declare const sceneBrand:unique symbol
export interface OrdinaryWeaponSceneAuthority{readonly[sceneBrand]:true}
const authorities=new WeakMap<object,OrdinaryWeaponSceneFacts>(),contexts=new WeakMap<object,OrdinaryWeaponSceneFacts|false>(),slot=Symbol('host-ordinary-weapon-scene')
registerDnd5eHostReceiptSlot(slot)
/** Internal Host issuer; data copies and player payloads never gain this capability. */
export function issueDnd5eOrdinaryWeaponSceneAuthority(facts:OrdinaryWeaponSceneFacts):OrdinaryWeaponSceneAuthority{const value=registerDnd5eHostReceipt(Object.freeze({}))as OrdinaryWeaponSceneAuthority;authorities.set(value,structuredClone(facts));return value}
export function readDnd5eOrdinaryWeaponSceneAuthority(value:OrdinaryWeaponSceneAuthority){const facts=authorities.get(value);if(!facts)throw Error('ordinary-weapon-scene:unissued-authority');return structuredClone(facts)}
export function bindDnd5ePreparedOrdinaryWeaponScene<T extends{state:Dnd5eHeadlessCombatState;action:{id:string;mapId:string;actorTokenId?:string;characterId:string;combatId?:string}}>(prepared:T,authority?:OrdinaryWeaponSceneAuthority):T{
 if(authority){const facts=readDnd5eOrdinaryWeaponSceneAuthority(authority);if(prepared.action.combatId||facts.parentTransactionId!==prepared.action.id||facts.mapId!==prepared.action.mapId||facts.actorId!==prepared.action.actorTokenId||facts.characterId!==prepared.action.characterId)throw Error('ordinary-weapon-scene:prepared-identity-mismatch');Object.defineProperty(prepared,slot,{value:authority,enumerable:true,configurable:true});contexts.set(prepared.state,facts)}else if(!prepared.action.combatId)contexts.set(prepared.state,false)
 return prepared
}
export function restoreDnd5ePreparedOrdinaryWeaponScene(prepared:{state:Dnd5eHeadlessCombatState;action:{id:string;mapId:string;actorTokenId?:string;characterId:string;combatId?:string}}){bindDnd5ePreparedOrdinaryWeaponScene(prepared,(prepared as unknown as Record<symbol,OrdinaryWeaponSceneAuthority>)[slot])}
export function copyDnd5eOrdinaryWeaponScene<T extends Dnd5eHeadlessCombatState>(source:Dnd5eHeadlessCombatState,target:T):T{if(contexts.has(source))contexts.set(target,contexts.get(source)!);return target}
export function dnd5eOrdinaryWeaponScene(state:Dnd5eHeadlessCombatState){return contexts.get(state)}
export const DND5E_ORDINARY_SCENE_USAGE='host:ordinary-scene:once-used'
export function dnd5eWeaponActivityTurnKey(state:Dnd5eHeadlessCombatState,combatKey:string){return contexts.get(state)?DND5E_ORDINARY_SCENE_USAGE:combatKey}
/** No rest/time/map reset. Only a genuine engine turn-start creates a new turn. */
export function clearDnd5eOrdinarySceneUsageAtRealTurnStart(state:Dnd5eHeadlessCombatState){if(contexts.has(state))return;for(const actor of Object.values(state.combatants)){const used=actor.classState.declarativeUsedTurnKeys;if(used)actor.classState.declarativeUsedTurnKeys=Object.fromEntries(Object.entries(used).filter(([,value])=>value!==DND5E_ORDINARY_SCENE_USAGE))}}

export function dnd5ePreparedOrdinaryWeaponSceneFacts(value:unknown){const prepared=(value as{prepared?:object}|undefined)?.prepared;if(!prepared)return undefined;const cap=(prepared as Record<symbol,OrdinaryWeaponSceneAuthority>)[slot];return cap?readDnd5eOrdinaryWeaponSceneAuthority(cap):undefined}
export function stripDnd5ePreparedOrdinaryWeaponScene(value:unknown){const prepared=(value as{prepared?:object}|undefined)?.prepared;if(!prepared||!Reflect.deleteProperty(prepared,slot))throw Error('ordinary-weapon-scene:original-capability-required')}
export function restoreDnd5ePreparedOrdinaryWeaponSceneFacts(value:unknown,facts:OrdinaryWeaponSceneFacts){const prepared=(value as{prepared?:Parameters<typeof bindDnd5ePreparedOrdinaryWeaponScene>[0]}|undefined)?.prepared;if(!prepared||Object.keys(facts.versions).length!==5||['characters','maps','combat','map-geometry','campaign-time'].some(name=>!Number.isSafeInteger(facts.versions[name])||facts.versions[name]<0)||!facts.combatBoundary||!facts.clockSignature)throw Error('ordinary-weapon-scene:invalid-original-facts');bindDnd5ePreparedOrdinaryWeaponScene(prepared,issueDnd5eOrdinaryWeaponSceneAuthority(facts));return value}
