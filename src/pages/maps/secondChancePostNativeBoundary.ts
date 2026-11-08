import type{Character}from'../../types/character'
import type{BattleMap}from'../../store/maps'
import type{Dnd5eActionResult,Dnd5eMapResultPlan}from'../../application/combat/dnd5eCombatRules'
import type{SharedPlayerActionState}from'../../lib/sharedCombatTypes'
import{encodeSecondChanceParentWire,decodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{getRoomSession}from'../../lib/roomSession'
export interface SecondChancePostNativeView{
 phase:'native-before-base'|'post-concentration-pre-activities'
 roomId:string;hostMemberId:string;mapId:string;combatId:string;parentTransactionId:string;scGroupIdentity:string
 revisions:{maps:number;characters:number;combat:number;'map-geometry':number;'campaign-time'?:number}
 result:Extract<Dnd5eActionResult,{ok:true}>;application:Dnd5eMapResultPlan
 map:BattleMap;characters:readonly Character[];characterIdByCombatantId:Readonly<Record<string,string>>
 originalRoomAction?:SharedPlayerActionState
}
declare const frameBrand:unique symbol
declare const settlementBrand:unique symbol
export interface SecondChancePostNativeFrame{readonly[frameBrand]:true}
export interface SecondChancePostNativeSettlement{readonly[settlementBrand]:true}
const frames=new WeakMap<object,SecondChancePostNativeView>(),settlements=new WeakMap<object,{frame:SecondChancePostNativeFrame;value:{result:Extract<Dnd5eActionResult,{ok:true}>;application:Dnd5eMapResultPlan}}>()
const clone=<T>(value:T):T=>decodeSecondChanceParentWire(encodeSecondChanceParentWire(value))as T
/** Host-only issuance at the real SC publisher after original/group/version revalidation. */
export function captureSecondChancePostNativeFrame(view:SecondChancePostNativeView):SecondChancePostNativeFrame{
 const session=getRoomSession();if(session?.role!=='dm'||session.roomId!==view.roomId||session.memberId!==view.hostMemberId||view.map.id!==view.mapId||view.application.map.id!==view.mapId||view.result.state.combatId!==view.combatId||!view.scGroupIdentity||Object.values(view.revisions).some(v=>!Number.isSafeInteger(v)||v!<0))throw Error('second-chance-post-native:invalid-frame')
 const frame=Object.freeze({})as SecondChancePostNativeFrame;frames.set(frame,clone(view));return frame
}
export function readSecondChancePostNativeFrame(frame:SecondChancePostNativeFrame):SecondChancePostNativeView{
 const view=frames.get(frame),session=getRoomSession();if(!view||session?.role!=='dm'||session.roomId!==view.roomId||session.memberId!==view.hostMemberId)throw Error('second-chance-post-native:unissued-frame');return clone(view)
}
/** Only the real Base callback seals its outcome; JSON cannot return a ready handle. */
export function captureSecondChancePostNativeSettlement(frame:SecondChancePostNativeFrame,value:{result:Dnd5eActionResult;application:Dnd5eMapResultPlan}):SecondChancePostNativeSettlement{
 const view=readSecondChancePostNativeFrame(frame);if(!value.result.ok||value.result.state.combatId!==view.combatId||value.application.map.id!==view.mapId)throw Error('second-chance-post-native:invalid-settlement')
 const handle=Object.freeze({})as SecondChancePostNativeSettlement;settlements.set(handle,{frame,value:clone({...value,result:value.result})});return handle
}
export function readSecondChancePostNativeSettlement(frame:SecondChancePostNativeFrame,handle:SecondChancePostNativeSettlement){readSecondChancePostNativeFrame(frame);const entry=settlements.get(handle);if(!entry||entry.frame!==frame)throw Error('second-chance-post-native:unissued-settlement');return clone(entry.value)}
