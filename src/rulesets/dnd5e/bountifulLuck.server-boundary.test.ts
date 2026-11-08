import {it,expect} from 'vitest'
import {stampPlayerActionStateForRoomMember,projectSecondChanceCombatForMember,validateSharedStateShape} from '../../../scripts/shared-server-core.mjs'
import {validateAndMigrateSharedResource} from '../../../src/lib/sharedResourceValidation'
import {createBountifulOriginalDieReceipt,applyBountifulStampedDieResponse,bountifulOriginalDieRollId} from './bountifulLuckReceipt'
import {encodeSecondChanceParentWire} from '../../../src/lib/secondChanceParentWire'
const fixture=()=>{const row=createBountifulOriginalDieReceipt({identity:{roomId:'room',mapId:'map',combatId:'combat',parentId:'parent',occurrence:0,round:1,initiativeIndex:0,reactionEconomySignature:'{}',roller:{tokenId:'roller',characterId:'roller-char',memberId:'roller-member'},hostMemberId:'host',revisions:{characters:3,maps:2,'map-geometry':0}},originalAdapterId:'ability-check',originalRoomAction:{id:'parent',mapId:'map',combatId:'combat',status:'pending',actorTokenId:'roller',characterId:'roller-char',roomMemberId:'roller-member',sourceMode:'player',type:'dnd5e-ability-check'},originalParent:encodeSecondChanceParentWire({actualOriginalDice:[1],neverPublic:'private-original'}),request:{actorId:'roller',kind:'saving-throw',originalRolls:[1],dieIndex:0,options:[{ownerId:'owner',featureId:'feat'}]},controllers:{owner:{characterId:'owner-char',memberId:'owner-member'}}});return{row,id:JSON.stringify(['bountiful-original-parent','parent',0])}}
it('the actual server and client state boundaries agree on strict private original receipts',()=>{
 const {row,id}=fixture(),combat={active:true,mapId:'map',combatId:'combat',round:1,initiativeIndex:0,initiativeOrder:[],updatedAt:1,bountifulOriginalParents:{[id]:row}}
 expect(validateSharedStateShape('combat',combat).ok).toBe(true)
 expect(validateAndMigrateSharedResource('combat',combat).status).not.toBe('invalid')
 row.request.originalRolls=[2]
 expect(validateSharedStateShape('combat',combat).ok).toBe(false)
 expect(validateAndMigrateSharedResource('combat',combat).status).toBe('invalid')
})
it('the actual server never exposes the source parent or controllers through combat projection',()=>{
 const {row,id}=fixture(),combat={mapId:'map',combatId:'combat',bountifulOriginalParents:{[id]:row}}
 const owner=projectSecondChanceCombatForMember(combat,{memberId:'owner-member'}),other=projectSecondChanceCombatForMember(combat,{memberId:'unrelated'})
 expect(owner.bountifulLuckPrompts).toMatchObject([{phase:'owner-choice',ownerId:'owner'}])
 expect(other.bountifulLuckPrompts).toEqual([])
 for(const projected of [owner,other]){expect(projected.bountifulOriginalParents).toBeUndefined();expect(JSON.stringify(projected)).not.toContain('private-original');expect(JSON.stringify(projected)).not.toContain('owner-member')}
})
it('the actual append stamp overrides supplied principals, including a real Host confirmation arriving as player-mode transport',()=>{
 const {row}=fixture(),scope={roomId:'room',mapId:'map',combatId:'combat',parentId:'parent',occurrence:0}
 const used=applyBountifulStampedDieResponse(row,{...scope,id:'use',roomMemberId:'owner-member',sourceMode:'player',actorTokenId:'owner',characterId:'owner-char',command:{phase:'reaction',ownerId:'owner',featureId:'feat',decision:'use'}})
 const rollId=bountifulOriginalDieRollId(used),rolled=applyBountifulStampedDieResponse(used,{...scope,id:'roll',roomMemberId:'roller-member',sourceMode:'player',actorTokenId:'roller',characterId:'roller-char',command:{phase:'roll',rollRequestId:rollId,value:1}})
 const supplied={...scope,id:'confirm',roomMemberId:'spoofed',sourceMode:'dm' as const,actorTokenId:'roller',characterId:'roller-char',command:{phase:'confirm' as const,rollRequestId:rollId,rawValue:1,value:1}}
 const stamped=stampPlayerActionStateForRoomMember('player-action-requests',{requests:[supplied]},{memberId:'host'}).requests[0]
 expect(stamped.roomMemberId).toBe('host');expect(stamped.sourceMode).toBe('player')
 expect(applyBountifulStampedDieResponse(rolled,stamped).hostReroll).toMatchObject({memberId:'host',rawValue:1,value:1})
})
