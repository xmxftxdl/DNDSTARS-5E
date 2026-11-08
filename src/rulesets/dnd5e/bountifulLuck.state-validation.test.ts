import {it,expect} from 'vitest'
import {encodeSecondChanceParentWire} from '../../../src/lib/secondChanceParentWire'
import {createBountifulOriginalDieReceipt,applyBountifulStampedDieResponse} from './bountifulLuckReceipt'
import {validateBountifulOriginalParents,validateBountifulLuckCommand,projectBountifulOriginalPrompts} from '../../../shared/bountiful-luck-state.mjs'
const fixture=()=>{const row=createBountifulOriginalDieReceipt({identity:{roomId:'room',mapId:'map',combatId:'combat',parentId:'parent',occurrence:0,round:1,initiativeIndex:0,reactionEconomySignature:'{}',roller:{tokenId:'roller',characterId:'roller-char',memberId:'roller-member'},hostMemberId:'host',revisions:{characters:3,maps:2,'map-geometry':0}},originalAdapterId:'ability-check',originalRoomAction:{id:'parent',mapId:'map',combatId:'combat',status:'pending',actorTokenId:'roller',characterId:'roller-char',roomMemberId:'roller-member',sourceMode:'player',type:'dnd5e-ability-check'},originalParent:encodeSecondChanceParentWire({rawOriginal:1,parent:'parent'}),request:{actorId:'roller',kind:'saving-throw',originalRolls:[1],dieIndex:0,options:[{ownerId:'owner',featureId:'feat'}]},controllers:{owner:{characterId:'owner-char',memberId:'owner-member'}}});return{row,id:JSON.stringify(['bountiful-original-parent','parent',0])}}
it('preserves a valid source-bound raw parent while exposing only the actual owner prompt',()=>{
 const {row,id}=fixture();expect(validateBountifulOriginalParents({[id]:row})).toBe(true)
 expect(projectBountifulOriginalPrompts({[id]:row},'stranger')).toEqual([])
 expect(projectBountifulOriginalPrompts({[id]:row},'roller-member')).toEqual([])
 const prompts=projectBountifulOriginalPrompts({[id]:row},'owner-member')
 expect(prompts).toHaveLength(1);expect(prompts[0]).toMatchObject({phase:'owner-choice',rollerTokenId:'roller'})
 expect(JSON.stringify(prompts)).not.toContain('originalParent');expect(JSON.stringify(prompts)).not.toContain('controllers')
})
it('after explicit use, the owner gets no dice prompt and only the original roller can receive it',()=>{
 const {row,id}=fixture(),used=applyBountifulStampedDieResponse(row,{id:'choice',roomId:'room',mapId:'map',combatId:'combat',parentId:'parent',occurrence:0,roomMemberId:'owner-member',sourceMode:'player',actorTokenId:'owner',characterId:'owner-char',command:{phase:'reaction',ownerId:'owner',featureId:'feat',decision:'use'}})
 expect(validateBountifulOriginalParents({[id]:used})).toBe(true)
 expect(projectBountifulOriginalPrompts({[id]:used},'owner-member')).toEqual([])
 expect(projectBountifulOriginalPrompts({[id]:used},'roller-member')).toMatchObject([{phase:'roll',count:1,sides:20,rollerTokenId:'roller'}])
})
it.each(['non-one','raw-before-use','forged-owner','foreign-wire','self-owner'] as const)('rejects forged persisted raw parent %s',boundary=>{
 const {row,id}=fixture()
 if(boundary==='non-one')row.request.originalRolls=[2]
 if(boundary==='raw-before-use')row.rawReroll={requestId:'forged',memberId:'roller-member',value:20}
 if(boundary==='forged-owner')row.ownerDecisions=[{ownerId:'owner',featureId:'feat',memberId:'stranger',decision:'use'}]
 if(boundary==='foreign-wire')row.originalParent={schemaVersion:1,root:{ref:9},nodes:[]}
 if(boundary==='self-owner')row.request.options=[{ownerId:'roller',featureId:'feat'}]
 expect(validateBountifulOriginalParents({[id]:row})).toBe(false)
})
it('append commands accept only explicit phases and exact per-die values, never a replacement source or supplied principal',()=>{
 const good={parentId:'parent',occurrence:0,command:{phase:'roll',rollRequestId:'roll',value:1}}
 expect(validateBountifulLuckCommand(good)).toBe(true)
 expect(validateBountifulLuckCommand({...good,roomMemberId:'host'})).toBe(false)
 expect(validateBountifulLuckCommand({...good,originalRolls:[20]})).toBe(false)
 expect(validateBountifulLuckCommand({...good,command:{...good.command,value:0}})).toBe(false)
 expect(validateBountifulLuckCommand({...good,command:{...good.command,value:21}})).toBe(false)
})
