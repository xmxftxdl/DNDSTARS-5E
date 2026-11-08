import {it,expect} from 'vitest'
import {encodeSecondChanceParentWire,decodeSecondChanceParentWire} from '../../../src/lib/secondChanceParentWire'
import {createBountifulOriginalDieReceipt,applyBountifulStampedDieResponse,bountifulOriginalDiePhase,bountifulOriginalDieRollId,decisionFromBountifulOriginalDieReceipt,type BountifulOriginalDieReceipt,type BountifulStampedDieResponse} from './bountifulLuckReceipt'

const create=()=>createBountifulOriginalDieReceipt({identity:{roomId:'room',mapId:'map',combatId:'combat',parentId:'parent',occurrence:0,round:1,initiativeIndex:0,reactionEconomySignature:'{}',roller:{tokenId:'roller',characterId:'roller-char',memberId:'roller-member'},hostMemberId:'host',revisions:{characters:3,maps:2,combat:4}},originalAdapterId:'ability-check',originalRoomAction:{id:'parent',mapId:'map',combatId:'combat',status:'pending',actorTokenId:'roller',characterId:'roller-char',roomMemberId:'roller-member',sourceMode:'player',type:'dnd5e-ability-check'},originalParent:encodeSecondChanceParentWire({originalRawDice:[1,1],mode:'advantage',parentId:'parent'}),request:{actorId:'roller',kind:'attack',originalRolls:[1,1],dieIndex:0,options:[{ownerId:'first',featureId:'feat'},{ownerId:'second',featureId:'feat'}]},controllers:{first:{characterId:'first-char',memberId:'first-member'},second:{characterId:'second-char',memberId:'second-member'}}})
const row=(_receipt:BountifulOriginalDieReceipt,overrides:Partial<BountifulStampedDieResponse>):BountifulStampedDieResponse=>({id:'request',roomId:'room',mapId:'map',combatId:'combat',parentId:'parent',occurrence:0,roomMemberId:'first-member',sourceMode:'player',actorTokenId:'first',characterId:'first-char',command:{phase:'reaction',ownerId:'first',featureId:'feat',decision:'use'},...overrides})

it('persists all original faces and requires an explicit first-owner decline before asking the next owner',()=>{
 const receipt=create(),before=structuredClone(receipt)
 expect(bountifulOriginalDiePhase(receipt)).toBe('owner-choice')
 expect(()=>decisionFromBountifulOriginalDieReceipt(receipt,receipt.request)).toThrow('decision-still-pending')
 expect(()=>applyBountifulStampedDieResponse(receipt,row(receipt,{roomMemberId:'second-member',actorTokenId:'second',characterId:'second-char',command:{phase:'reaction',ownerId:'second',featureId:'feat',decision:'use'}}))).toThrow('owner-choice-not-authorized')
 const first=applyBountifulStampedDieResponse(receipt,row(receipt,{command:{phase:'reaction',ownerId:'first',featureId:'feat',decision:'decline'}}))
 const restored=JSON.parse(JSON.stringify(first)) as BountifulOriginalDieReceipt
 const second=applyBountifulStampedDieResponse(restored,row(restored,{id:'second',roomMemberId:'second-member',actorTokenId:'second',characterId:'second-char',command:{phase:'reaction',ownerId:'second',featureId:'feat',decision:'use'}}))
 expect(bountifulOriginalDiePhase(second)).toBe('roller')
 expect(decodeSecondChanceParentWire(second.originalParent)).toEqual({originalRawDice:[1,1],mode:'advantage',parentId:'parent'})
 expect(receipt).toEqual(before)
})

it('requires the original roller and a separate Host confirmation, retaining a forced new 1 as final',()=>{
 let receipt=create();receipt=applyBountifulStampedDieResponse(receipt,row(receipt,{}));const rollRequestId=bountifulOriginalDieRollId(receipt)
 expect(()=>applyBountifulStampedDieResponse(receipt,row(receipt,{id:'wrong',command:{phase:'roll',rollRequestId,value:20}}))).toThrow('original-roller-required')
 receipt=applyBountifulStampedDieResponse(receipt,row(receipt,{id:'roll',roomMemberId:'roller-member',actorTokenId:'roller',characterId:'roller-char',command:{phase:'roll',rollRequestId,value:1}}))
 expect(bountifulOriginalDiePhase(receipt)).toBe('host-confirmation')
 expect(()=>decisionFromBountifulOriginalDieReceipt(receipt,receipt.request)).toThrow('decision-still-pending')
 const confirm=row(receipt,{id:'confirm',roomMemberId:'host',sourceMode:'player',actorTokenId:'roller',characterId:'roller-char',command:{phase:'confirm',rollRequestId,rawValue:1,value:1}})
 receipt=applyBountifulStampedDieResponse(receipt,confirm)
 expect(decisionFromBountifulOriginalDieReceipt(receipt,receipt.request)).toEqual({ownerId:'first',featureId:'feat',replacement:1})
 expect(applyBountifulStampedDieResponse(receipt,confirm)).toEqual(receipt)
 expect(()=>decisionFromBountifulOriginalDieReceipt(receipt,{...receipt.request,dieIndex:1})).toThrow('changed-real-checkpoint')
})

it('all explicit declines produce no replacement or reaction cost and cannot be swapped to a later use',()=>{
 let receipt=create();receipt=applyBountifulStampedDieResponse(receipt,row(receipt,{command:{phase:'reaction',ownerId:'first',featureId:'feat',decision:'decline'}}))
 receipt=applyBountifulStampedDieResponse(receipt,row(receipt,{id:'second',roomMemberId:'second-member',actorTokenId:'second',characterId:'second-char',command:{phase:'reaction',ownerId:'second',featureId:'feat',decision:'decline'}}))
 expect(bountifulOriginalDiePhase(receipt)).toBe('declined');expect(decisionFromBountifulOriginalDieReceipt(receipt,receipt.request)).toBeUndefined()
 expect(receipt.rawReroll).toBeUndefined();expect(receipt.hostReroll).toBeUndefined()
 expect(()=>applyBountifulStampedDieResponse(receipt,row(receipt,{id:'late'}))).toThrow('owner-choice-not-authorized')
})

it.each([{parentId:'other'},{occurrence:1},{combatId:'other'},{roomId:'other'}])('rejects cross-parent stamped identity %j',changed=>{
 const receipt=create();expect(()=>applyBountifulStampedDieResponse(receipt,row(receipt,changed))).toThrow('wrong-original-parent')
})
