import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import{getRoomSession}from'../../lib/roomSession'
import{projectBountifulOriginalPrompts,type BountifulOriginalPrompt}from'../../../shared/bountiful-luck-state.mjs'
import{submitBountifulNativeLuckyChoice}from'./bountifulLuckClientCommands'
export type BountifulNativeLuckyPrompt=Omit<BountifulOriginalPrompt,'phase'|'round'|'initiativeIndex'|'rollerCharacterId'|'originalRolls'|'dieIndex'>&{phase:'native-lucky-choice';round:number;initiativeIndex:number;rollerCharacterId:string;originalRolls:readonly number[];dieIndex:number}
const data=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v),text=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=2000,nat=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0
const keys=['receiptId','parentId','occurrence','mapId','combatId','phase','round','initiativeIndex','rollerTokenId','rollerCharacterId','originalRolls','dieIndex']
export function isBountifulNativeLuckyPrompt(v:unknown):v is BountifulNativeLuckyPrompt{
 if(!data(v)||Object.keys(v).some(k=>!keys.includes(k))||v.phase!=='native-lucky-choice'||!['receiptId','parentId','mapId','combatId','rollerTokenId','rollerCharacterId'].every(k=>text(v[k]))||!nat(v.occurrence)||!nat(v.round)||v.round<1||!nat(v.initiativeIndex)||!nat(v.dieIndex)||!Array.isArray(v.originalRolls)||v.originalRolls.length<1||v.originalRolls.length>2||v.originalRolls.some(x=>typeof x!=='number'||!Number.isInteger(x)||x<1||x>20)||v.originalRolls[v.dieIndex]!==1)return false
 return v.receiptId===JSON.stringify(['bountiful-original-parent',v.parentId,v.occurrence])
}
/** Small presentation DTOs only. This reader neither registers a source nor grants a native/physical outcome. */
export function bountifulNativeLuckyPromptsForMember(combat:unknown,mapId:string,memberId:string):readonly BountifulNativeLuckyPrompt[]{
 if(!data(combat)||combat.mapId!==mapId||!text(memberId))return[]
 const rows=Array.isArray(combat.bountifulLuckPrompts)?combat.bountifulLuckPrompts:combat.bountifulOriginalParents?projectBountifulOriginalPrompts(combat.bountifulOriginalParents,memberId):[]
 return rows.filter(isBountifulNativeLuckyPrompt).filter(p=>p.mapId===mapId).map(p=>({...p,originalRolls:[...p.originalRolls]}))
}
const signature=(p:BountifulNativeLuckyPrompt)=>JSON.stringify([p.receiptId,p.parentId,p.occurrence,p.mapId,p.combatId,p.rollerTokenId,p.rollerCharacterId,p.round,p.initiativeIndex,p.originalRolls,p.dieIndex])
/** Reread the actual member's projection before appending the existing authenticated command transport. */
export async function submitCurrentBountifulNativeLuckyChoice(input:{prompt:BountifulNativeLuckyPrompt;decision:'use'|'decline'},gateway:Pick<SharedRoomGatewayPort,'loadResource'|'appendPlayerActionRequest'>){
 const session=getRoomSession(),before=session?{roomId:session.roomId,memberId:session.memberId,role:session.role}:null;if(!before?.roomId||!before.memberId||!['dm','player'].includes(before.role)||!isBountifulNativeLuckyPrompt(input.prompt)||!['use','decline'].includes(input.decision))throw Error('native-lucky-room:actual-member-choice-required')
 const wanted=signature(input.prompt),mapId=input.prompt.mapId;const combat=await gateway.loadResource<unknown>('combat'),current=getRoomSession();if(!current||current.roomId!==before.roomId||current.memberId!==before.memberId||current.role!==before.role)throw Error('native-lucky-room:member-changed')
 const matches=bountifulNativeLuckyPromptsForMember(combat,mapId,current.memberId).filter(p=>signature(p)===wanted);if(matches.length!==1)throw Error('native-lucky-room:current-owned-choice-required')
 const p=matches[0];return submitBountifulNativeLuckyChoice({mapId:p.mapId,context:{parentId:p.parentId,occurrence:p.occurrence,combatId:p.combatId,actorTokenId:p.rollerTokenId,characterId:p.rollerCharacterId},decision:input.decision,round:p.round,initiativeIndex:p.initiativeIndex},gateway)
}
