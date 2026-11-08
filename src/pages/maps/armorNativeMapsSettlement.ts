import type {SharedPlayerActionState,SharedPlayerActionAckState} from '../../lib/sharedCombatTypes'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {Dnd5eActionResult} from '../../rulesets/dnd5e/headlessCombatEngine'
import {getRoomSession} from '../../lib/roomSession'
import {decodeSecondChanceParentWire,type SecondChanceParentWire} from '../../lib/secondChanceParentWire'
import {sameActivityParentData} from './postNativeActivityParent'
import {restoreArmorNativeIssuedParent} from './armorNativeRoomIssuer'
import type {resumeArmorNativeRoomParent} from './armorNativeRoomSettlement'
type Settled=Awaited<ReturnType<typeof resumeArmorNativeRoomParent>>
export type ArmorNativeMapsSettlement={kind:'armor-native-parent-pending'|'armor-native-parent-published';parentId:string;mapId:string;combatId:string;parentTransactionId:string;result?:Dnd5eActionResult}
/** Control flow only. The outer boundary must reread the private persisted
 * original parent before treating publication as already committed. */
export class ArmorNativeMapsSettlementSignal extends Error{readonly settlement:ArmorNativeMapsSettlement;constructor(settlement:ArmorNativeMapsSettlement){super(settlement.kind);this.name='ArmorNativeMapsSettlementSignal';this.settlement=settlement}}
export async function verifyArmorNativeMapsSettlement(input:{settlement:ArmorNativeMapsSettlement;mapId:string;combatId:string;parentTransactionId:string},gateway:Pick<SharedRoomGatewayPort,'loadResource'>){
 const session=getRoomSession(),guard=()=>{const now=getRoomSession();if(!session||session.role!=='dm'||now?.role!=='dm'||now.roomId!==session.roomId||now.memberId!==session.memberId)throw Error('armor-native-maps:authenticated-host-required')};guard()
 const {settlement:s}=input
 if(s.mapId!==input.mapId||s.combatId!==input.combatId||s.parentTransactionId!==input.parentTransactionId)throw Error('armor-native-maps:original-identity-required')
 const journal=await gateway.loadResource<{parents:Record<string,{roomId:string;hostMemberId:string;mapId:string;combatId:string;parentTransactionId:string;phase:string;completed?:SecondChanceParentWire}>}>('armor-native-parents');guard()
 const p=journal?.parents[s.parentId]
 if(!p||p.roomId!==session!.roomId||p.hostMemberId!==session!.memberId||p.mapId!==s.mapId||p.combatId!==s.combatId||p.parentTransactionId!==s.parentTransactionId)throw Error('armor-native-maps:original-private-parent-required')
 if(s.kind==='armor-native-parent-pending'){if(p.phase!=='waiting')throw Error('armor-native-maps:parent-not-pending');await restoreArmorNativeIssuedParent(s.parentId,{...gateway,saveResourcesAtomically:async()=>{throw Error('armor-native-maps:read-only-verifier')}});guard();return s}
 if(p.phase!=='consumed'||!p.completed)throw Error('armor-native-maps:unverified-publication')
 const completed=decodeSecondChanceParentWire(p.completed) as Extract<Settled,{status:'published'}>['settlement']
 if(!completed?.result?.ok||completed.result.state.combatId!==s.combatId||completed.application.map.id!==s.mapId||!sameActivityParentData(completed.result,s.result))throw Error('armor-native-maps:unverified-publication')
 return{...s,result:completed.result}
}

export async function readCommittedArmorNativePlayerAck(input:{action:SharedPlayerActionState;settlement:ArmorNativeMapsSettlement},gateway:Pick<SharedRoomGatewayPort,'loadResource'>):Promise<SharedPlayerActionAckState>{
 const {action,settlement}=input;if(!action.combatId||settlement.kind!=='armor-native-parent-published')throw Error('armor-native-maps:published-original-command-required')
 await verifyArmorNativeMapsSettlement({settlement,mapId:action.mapId,combatId:action.combatId,parentTransactionId:action.id},gateway)
 const [journal,ack,processed,queue]=await Promise.all([gateway.loadResource<{parents:Record<string,{originalRoomAction?:SharedPlayerActionState}>}>('armor-native-parents'),gateway.loadResource<SharedPlayerActionAckState>('player-action-ack'),gateway.loadResource<{actionIds:string[]}>('player-action-processed'),gateway.loadResource<{requests:SharedPlayerActionState[]}>('player-action-requests')])
 const saved=journal?.parents[settlement.parentId]?.originalRoomAction,strip=(value:SharedPlayerActionState)=>{const row={...value};delete row.roomMemberId;return row}
 if(!saved?.roomMemberId||saved.sourceMode!=='player'||!sameActivityParentData(strip(saved),strip(action))||ack?.actionId!==action.id||ack.status!=='accepted'||ack.recipientMemberId!==saved.roomMemberId||!processed?.actionIds.includes(action.id)||!queue||queue.requests.some(row=>row.id===action.id))throw Error('armor-native-maps:matching-original-atomic-ack-required')
 return ack
}
