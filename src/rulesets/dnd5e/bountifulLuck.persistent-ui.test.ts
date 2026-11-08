import {it,expect,vi} from 'vitest'
import {createBountifulPersistentRoomUI} from './bountifulLuckPersistentRoomUI'
import {submitBountifulOwnerChoice,submitBountifulOwnedDiceResult} from './bountifulLuckClientCommands'
import {createBountifulOriginalDieReceipt,applyBountifulStampedDieResponse,bountifulOriginalDieRollId} from './bountifulLuckReceipt'
import {encodeSecondChanceParentWire} from '../../../src/lib/secondChanceParentWire'
import {stampPlayerActionStateForRoomMember} from '../../../scripts/shared-server-core.mjs'
import {createDmDiceConfirmationQueue} from '../../../src/presentation/maps/dmDiceConfirmationQueue'
import {registerDnd5eRulesPlugin} from '../../../src/rulesets/dnd5e/pluginApi'
import {normalizeCharacter} from '../../../src/store/characters'
import type {BattleMap} from '../../../src/store/maps'
import type {SharedRoomGatewayPort} from '../../../src/ports/sharedRoomGateway'
const session=vi.hoisted(()=>({value:{roomId:'room',memberId:'host',role:'dm'}}))
vi.mock('../../../src/lib/roomSession',()=>({getRoomSession:()=>session.value}))
const fixture=()=>{
 const receipt=createBountifulOriginalDieReceipt({identity:{roomId:'room',mapId:'map',combatId:'combat',parentId:'parent',occurrence:0,round:1,initiativeIndex:0,reactionEconomySignature:'{}',roller:{tokenId:'roller-token',characterId:'roller',memberId:'roller-member'},hostMemberId:'host',revisions:{characters:3,maps:2,'map-geometry':0}},originalAdapterId:'ability-check',originalRoomAction:{id:'parent',mapId:'map',combatId:'combat',status:'pending',actorTokenId:'roller-token',characterId:'roller',roomMemberId:'roller-member',sourceMode:'player',type:'dnd5e-ability-check'},originalParent:encodeSecondChanceParentWire({raw:[1]}),request:{actorId:'roller-token',kind:'ability-check',skill:'stealth',originalRolls:[1],dieIndex:0,options:[{ownerId:'owner-token',featureId:'test.ui-bountiful:feat-luck'}]},controllers:{'owner-token':{characterId:'owner',memberId:'owner-member'}}})
 const characters=['roller','owner'].map(id=>normalizeCharacter({id,name:id,roomMemberId:id+'-member',race:'半身人',charClass:'战士',level:1}))
 const map:BattleMap={id:'map',name:'Map',width:200,height:200,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:characters.map((row,index)=>({id:row.id+'-token',characterId:row.id,label:row.name,x:25+index*50,y:25,type:'player',color:'',emoji:'',size:1}))}
 return {receipt,characters,map}
}
it('owner UI exposes explicit pending/use/decline and never turns its returned string into an authenticated decision',async()=>{
 const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.ui-bountiful',name:'UI feat',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Test',license:'Private'},setup(api){api.registerFeat({id:'luck',name:'慷慨吉运',description:'Test',summary:'Test',automation:'manual'})}})
 try{
  const f=fixture(),requests:unknown[]=[],append=vi.fn(async()=>{})
  const ui=createBountifulPersistentRoomUI({...f,characters:()=>f.characters,gateway:{loadResource:async()=>null,appendPlayerActionRequest:append},round:()=>1,initiativeIndex:()=>0,choose:async request=>{requests.push(request);expect(request.defaultOptionId).toBe('pending');expect(request.actor?.id).toBe('owner');expect(request.options.map(option=>option.id)).toEqual(['pending','decline','test.ui-bountiful:feat-luck']);return 'test.ui-bountiful:feat-luck'},rollD20:async()=>{throw Error('not a dice phase')},confirmRetainedD20:async()=>{throw Error('not a dice phase')}})
  await ui.showChoice(f.receipt);expect(requests).toHaveLength(1);expect(append).not.toHaveBeenCalled()
 }finally{dispose()}
})
it('actual client envelopes leave pending unsubmitted and server stamp binds a use to the responding owner',async()=>{
 const queued:unknown[]=[],context={parentId:'parent',occurrence:0,combatId:'combat',actorTokenId:'owner-token',characterId:'owner',ownerId:'owner-token',featureId:'feat'}
 const gateway={appendPlayerActionRequest:async(action:unknown)=>{queued.push(stampPlayerActionStateForRoomMember('player-action-requests',{requests:[action]},{memberId:'owner-member'}).requests[0])}}
 await submitBountifulOwnerChoice({mapId:'map',context,optionId:'pending',round:1,initiativeIndex:0},gateway);expect(queued).toEqual([])
 await submitBountifulOwnerChoice({mapId:'map',context,optionId:'feat',round:1,initiativeIndex:0},gateway)
 expect(queued).toMatchObject([{type:'dnd5e-bountiful-luck',roomMemberId:'owner-member',actorTokenId:'owner-token',bountifulLuck:{command:{phase:'reaction',decision:'use'}}}])
})
it('a restored raw1 goes through the actual DM confirmation queue without a new roll or a new owner choice',async()=>{
 const f=fixture(),base=applyBountifulStampedDieResponse(f.receipt,{id:'choice',roomId:'room',mapId:'map',combatId:'combat',parentId:'parent',occurrence:0,roomMemberId:'owner-member',sourceMode:'player',actorTokenId:'owner-token',characterId:'owner',command:{phase:'reaction',ownerId:'owner-token',featureId:'test.ui-bountiful:feat-luck',decision:'use'}})
 const rolled=applyBountifulStampedDieResponse(base,{id:'raw',roomId:'room',mapId:'map',combatId:'combat',parentId:'parent',occurrence:0,roomMemberId:'roller-member',sourceMode:'player',actorTokenId:'roller-token',characterId:'roller',command:{phase:'roll',rollRequestId:bountifulOriginalDieRollId(base),value:1}})
 const rows:unknown[]=[],present=vi.fn(async(request:{values:number[]})=>request.values),confirm=createDmDiceConfirmationQueue(present)
 const ui=createBountifulPersistentRoomUI({...f,characters:()=>f.characters,gateway:{loadResource:async()=>null,appendPlayerActionRequest:async row=>{rows.push(row)}},round:()=>1,initiativeIndex:()=>0,choose:async()=>{throw Error('no repeated owner prompt')},rollD20:async()=>{throw Error('no repeated raw die')},confirmRetainedD20:async(id,label,targetName,raw)=>(await confirm({id,label,targetName,sides:20,values:[raw],visibility:'public'}))[0]})
 await ui.requestRoll(JSON.parse(JSON.stringify(rolled)),async()=>rolled)
 expect(present).toHaveBeenCalledOnce();expect(rows).toMatchObject([{actorTokenId:'roller-token',characterId:'roller',bountifulLuck:{command:{phase:'confirm',rawValue:1,value:1}}}])
})
it('player DiceBox posts only the exact server-projected owned raw request',async()=>{
 const f=fixture(),rollRequestId=bountifulOriginalDieRollId(f.receipt),rows:unknown[]=[]
 const gateway:Pick<SharedRoomGatewayPort,'loadResource'|'appendPlayerActionRequest'>={loadResource:async<T>()=>({bountifulLuckPrompts:[{parentId:'parent',occurrence:0,mapId:'map',combatId:'combat',phase:'roll',rollerTokenId:'roller-token',rollerCharacterId:'roller',rollRequestId}]})as T,appendPlayerActionRequest:async row=>{rows.push(row)}}
 const input={mapId:'map',combatId:'combat',requestId:rollRequestId,characterId:'owner',values:[1],round:1,initiativeIndex:0}
 await submitBountifulOwnedDiceResult(input,gateway);expect(rows).toEqual([])
 await submitBountifulOwnedDiceResult({...input,characterId:'roller'},gateway)
 expect(rows).toMatchObject([{actorTokenId:'roller-token',characterId:'roller',bountifulLuck:{command:{phase:'roll',value:1}}}])
})
