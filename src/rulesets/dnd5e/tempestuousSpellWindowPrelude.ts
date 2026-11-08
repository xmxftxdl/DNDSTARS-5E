import{getRoomSession}from'../../lib/roomSession'

import{dnd5eAvailableTempestuousSpellFlight}from'./headlessCombatEngine'
import{issueTempestuousBeforePreparedOriginalReplay,tempestuousBeforePreparedOriginalInput,readTempestuousBeforePreparedOriginalReplayBookSignature,tempestuousBeforePreparedReplayHasNoLandingBoundary}from'./tempestuousBeforePreparedOriginalReplay'
import type{TempestuousBeforeOriginalPreparationBook}from'./tempestuousBeforeOriginalPreparation'
import{assertDnd5eActualTempestuousSpellWindowPreparationCurrent,type PreparedDnd5eSpellCast}from'./spellAction'
import{dnd5eRulesPluginRegistrySnapshot}from'./pluginApi'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import type{Dnd5eTempestuousLandingOriginalOperation}from'./damageCommitSession'

type CurrentPrelude={token:object;book:string;prepared:string;registry:number}
// Bounded reuse of an already genuine Native replay. The private book remains
// freshly authenticated on every call, including cache hits and absence.
const currentPreludes=new Map<string,CurrentPrelude>(),wireSignature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value))
export type TempestuousSpellWindowPrefixRequest=(input:{parentId:string;mapId:string;combatId:string;spellWindowParentId:string})=>Promise<Record<string,unknown>>
/** The MM input parent permits a lookup only. Any present before prefix is
 * independently restored through its own protected source and actual Native. */
export async function readDnd5eTempestuousSpellWindowPrelude(prepared:PreparedDnd5eSpellCast,spellWindowParentId:string,firstHostNow:number,request:TempestuousSpellWindowPrefixRequest,landing?:{resolve:(operation:Dnd5eTempestuousLandingOriginalOperation)=>Promise<readonly number[]>}){
 if(prepared.action.sourceMode!=='dm')return undefined
 if(!dnd5eAvailableTempestuousSpellFlight(prepared.state,prepared.actorToken.id).length){
  const host=getRoomSession(),key=JSON.stringify([host?.roomId,host?.memberId,{parentId:prepared.action.id,mapId:prepared.map.id,combatId:prepared.state.combatId},spellWindowParentId])
  if(currentPreludes.has(key))throw Error('tempestuous-spell-window:changed-issued-current-prefix')
  return undefined
 }
 const initial=getRoomSession();if(initial?.role!=='dm'||!initial.roomId||!initial.memberId)throw Error('tempestuous-spell-window:actual-host-required')
 const identity={parentId:prepared.action.id,mapId:prepared.map.id,combatId:prepared.state.combatId},reply=await request({...identity,spellWindowParentId}),current=getRoomSession()
 if(current?.role!=='dm'||current.roomId!==initial.roomId||current.memberId!==initial.memberId||Object.keys(reply).some(k=>!['ok','present','parentId','mapId','combatId','spellWindowParentId','effectTimestamp','book'].includes(k))||reply.ok!==true||typeof reply.present!=='boolean'||reply.parentId!==identity.parentId||reply.mapId!==identity.mapId||reply.combatId!==identity.combatId||reply.spellWindowParentId!==spellWindowParentId||reply.effectTimestamp!==firstHostNow)throw Error('tempestuous-spell-window:exact-current-private-parent-required')
 if(reply.present===false){if(Object.hasOwn(reply,'book'))throw Error('tempestuous-spell-window:exact-absence-required');return undefined}
 const book=reply.book as TempestuousBeforeOriginalPreparationBook&{ownerDecision?:unknown};if(!book||book.ok!==true||book.parentId!==identity.parentId||book.mapId!==identity.mapId||book.combatId!==identity.combatId||book.effectTimestamp!==firstHostNow||book.roomId!==initial.roomId||book.hostMemberId!==initial.memberId)throw Error('tempestuous-spell-window:independent-before-source-required')
 if(!book.ownerDecision)throw Error('tempestuous-spell-window:owner-prefix-pending')
 assertDnd5eActualTempestuousSpellWindowPreparationCurrent(prepared)
 const registry=dnd5eRulesPluginRegistrySnapshot(),key=JSON.stringify([initial.roomId,initial.memberId,identity,spellWindowParentId]),bookSignature=wireSignature(book),preparedSignature=wireSignature(prepared),cached=currentPreludes.get(key)
 if(cached&&(cached.registry!==registry||cached.book!==bookSignature||cached.prepared!==preparedSignature))throw Error('tempestuous-spell-window:changed-issued-current-prefix')
 const load=async(input:typeof identity)=>{if(JSON.stringify(input)!==JSON.stringify(identity))throw Error('tempestuous-spell-window:same-before-parent-required');return book},token=cached?.token??await issueTempestuousBeforePreparedOriginalReplay(identity,load,landing),source={prepared,effectRolls:[]as readonly number[],transactionId:prepared.action.id,opportunityAttackSpell:false},checked=tempestuousBeforePreparedOriginalInput(source,token)
 assertDnd5eActualTempestuousSpellWindowPreparationCurrent(prepared)
 if(dnd5eRulesPluginRegistrySnapshot()!==registry)throw Error('tempestuous-spell-window:changed-original-provider')
 if(!cached&&tempestuousBeforePreparedReplayHasNoLandingBoundary(source,token)){if(currentPreludes.size>=8)currentPreludes.delete(currentPreludes.keys().next().value!);currentPreludes.set(key,{token,book:bookSignature,prepared:preparedSignature,registry})}
 if(checked.hostOriginalD20Replay?.effectTimestamp!==firstHostNow)throw Error('tempestuous-spell-window:same-original-clock-required')
 return{token,bookSignature:readTempestuousBeforePreparedOriginalReplayBookSignature(source,token),effectTimestamp:firstHostNow}
}
