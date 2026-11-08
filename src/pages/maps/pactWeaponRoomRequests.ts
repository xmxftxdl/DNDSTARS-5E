import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {Character} from '../../types/character'
import type {BattleMap} from '../../store/maps'
import type {SharedCampaignTimeState} from '../../lib/campaignTime'
import type {SharedPlayerActionState,SharedCombatState} from '../../lib/sharedCombatTypes'
import {createSharedPlayerActionEnvelope} from '../../lib/playerActionSync'
import {getRoomSession} from '../../lib/roomSession'
import {commitPactWeaponRitual} from '../../rulesets/dnd5e/pactWeaponRitualHost'
import {commitPactWeaponLifecycle} from '../../rulesets/dnd5e/pactWeaponLifecycleHost'
import {commitPactWeaponSummon} from '../../rulesets/dnd5e/pactWeaponSummonHost'

type Snapshot<T>=T&{_sync?:{revision?:number}}
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
export type PactRoomCommand={kind:'start-binding';inventoryInstanceId:string;expectedPactRevision:number}|{kind:'summon';expectedPactRevision:number;expectedCombatRevision?:number;templateId?:string}|{[K in 'start-release'|'complete'|'dismiss']:{kind:K;expectedPactRevision:number}}['start-release'|'complete'|'dismiss']
type Request=SharedPlayerActionState&{pactWeapon?:PactRoomCommand}
const revision=(snapshot:Snapshot<object>)=>{const value=snapshot._sync?.revision;if(!Number.isSafeInteger(value)||value!<0)throw Error('pact-room:revision-required');return value!}
const parse=(value:unknown,stored=false):PactRoomCommand=>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('pact-room:invalid-command')
 const command=value as Record<string,unknown>,kind=command.kind
 if(kind==='summon'&&command.templateId!==undefined&&(typeof command.templateId!=='string'||!command.templateId.trim()||command.templateId.length>200))throw Error('pact-room:invalid-command')
 if(!['start-binding','start-release','complete','dismiss','summon'].includes(String(kind))||Object.keys(command).some(key=>!['kind','expectedPactRevision',...(kind==='start-binding'?['inventoryInstanceId']:[]),...(kind==='summon'?['expectedCombatRevision','templateId']:[])].includes(key))||!Number.isSafeInteger(command.expectedPactRevision)||Number(command.expectedPactRevision)<0||kind==='start-binding'&&(typeof command.inventoryInstanceId!=='string'||!command.inventoryInstanceId.trim())||kind==='summon'&&(stored||command.expectedCombatRevision!==undefined)&&(!Number.isSafeInteger(command.expectedCombatRevision)||Number(command.expectedCombatRevision)<0))throw Error('pact-room:invalid-command')
 return command as PactRoomCommand
}
const currentHost=()=>{const session=getRoomSession(),stamp=session&&{roomId:session.roomId,memberId:session.memberId,role:session.role};const guard=()=>{const now=getRoomSession();if(!stamp||stamp.role!=='dm'||now?.roomId!==stamp.roomId||now.memberId!==stamp.memberId||now.role!=='dm')throw Error('pact-room:host-room-required')};guard();return{stamp:stamp!,guard}}
export async function submitPactWeaponRequest(input:{mapId:string;actorTokenId:string;characterId:string;requestId:string;command:PactRoomCommand},gateway:Pick<SharedRoomGatewayPort,'loadResource'|'appendPlayerActionRequest'>){
 let command=parse(input.command);const session=getRoomSession(),stamp=session&&{roomId:session.roomId,memberId:session.memberId}
 if(!session||!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(input.requestId))throw Error('pact-room:session-or-request-required')
 const combat=command.kind==='summon'?await gateway.loadResource<Snapshot<SharedCombatState>>('combat'):null
 const now=getRoomSession();if(!stamp||now?.roomId!==stamp.roomId||now.memberId!==stamp.memberId)throw Error('pact-room:session-changed')
 if(command.kind==='summon')command={...command,expectedCombatRevision:combat?revision(combat):0}
 const action=createSharedPlayerActionEnvelope({mapId:input.mapId,actorTokenId:input.actorTokenId,characterId:input.characterId,roomMemberId:session.memberId,sourceMode:'player',combatId:combat?.active?combat.combatId:undefined,round:combat?.active?combat.round:0,initiativeIndex:combat?.active?combat.initiativeIndex:0,nextSeq:()=>0,patch:{type:'dnd5e-pact-weapon',pactWeapon:command}})
 if(!action)throw Error('pact-room:actor-required')
 action.id='pact-room:'+input.requestId
 await gateway.appendPlayerActionRequest(action)
 return action.id
}
/** The argument is only a queue ID. Principal, owner and command are reloaded from
 * authenticated append storage. Action result and acknowledgement share one CAS. */
export async function processPactWeaponRequest(input:{mapId:string;requestId:string},gateway:Gateway){
 const {stamp,guard}=currentHost()
 const[queue,characters,maps,combat]=await Promise.all([gateway.loadResource<Snapshot<{requests:Request[]}>>('player-action-requests'),gateway.loadResource<Snapshot<{characters:Character[]}>>('characters'),gateway.loadResource<Snapshot<{maps:BattleMap[]}>>('maps'),gateway.loadResource<Snapshot<SharedCombatState>>('combat')]);guard()
 const request=queue?.requests.find(row=>row.id===input.requestId),map=maps?.maps.find(row=>row.id===input.mapId),owner=characters?.characters.find(row=>row.id===request?.characterId)
 if(!queue||!characters||!maps||!request||request.type!=='dnd5e-pact-weapon'||request.mapId!==input.mapId||!map||!owner||owner.roomId!==stamp.roomId||map.tokens.filter(row=>row.id===request.actorTokenId&&row.characterId===owner.id).length!==1)throw Error('pact-room:request-context-unavailable')
 if(!request.roomMemberId||request.roomMemberId!==owner.roomMemberId&&request.roomMemberId!==stamp.memberId)throw Error('pact-room:authenticated-owner-required')
 const command=parse(request.pactWeapon,true),transactionId='room:'+request.id
 const privateOwner=owner as Character&{dnd5ePactWeaponAuthority?:{summons?:{transactionId:string}[];lifecycle?:{transactionId:string}[]};dnd5ePactWeaponRitualAuthority?:{receipts?:{transactionId:string}[]}}
 if(request.status!=='pending'&&(request.status!=='done'||![...(privateOwner.dnd5ePactWeaponAuthority?.summons??[]),...(privateOwner.dnd5ePactWeaponAuthority?.lifecycle??[]),...(privateOwner.dnd5ePactWeaponRitualAuthority?.receipts??[])].some(receipt=>receipt.transactionId===transactionId)))throw Error('pact-room:completed-request-without-receipt')
 if(command.kind==='summon'&&request.status==='pending'&&command.expectedCombatRevision!==(combat?revision(combat):0))throw Error('pact-room:combat-scope-changed')
 let wrote=false
 const atomicGateway:Gateway={loadResource:gateway.loadResource.bind(gateway),saveResourcesAtomically:async(writes,options)=>{guard();if(writes.find(write=>write.name==='characters')?.expectedRevision!==revision(characters)||writes.find(write=>write.name==='maps')?.expectedRevision!==revision(maps))throw Error('pact-room:owner-context-changed');if(command.kind==='summon'&&(writes.find(write=>write.name==='combat')?.expectedRevision??options?.readRevisions?.combat)!==command.expectedCombatRevision)throw Error('pact-room:combat-scope-changed');const result=await gateway.saveResourcesAtomically([...writes,{name:'player-action-requests',expectedRevision:revision(queue),data:{...queue,requests:queue.requests.map(row=>row.id===request.id?{...row,status:'done'}:row)}}],options);wrote=true;guard();return result}}
 const common={mapId:map.id,expectedPactRevision:command.expectedPactRevision,transactionId}
 let receipt:unknown
 if(command.kind==='dismiss')receipt=await commitPactWeaponLifecycle({...common,ownerCharacterId:owner.id,kind:'dismiss'},atomicGateway)
 else if(command.kind==='summon')receipt=await commitPactWeaponSummon({...common,actorTokenId:request.actorTokenId,templateId:command.templateId},atomicGateway)
 else receipt=await commitPactWeaponRitual({...common,ownerCharacterId:owner.id,...command},atomicGateway)
 guard()
 if(!wrote){
  const refreshed=await gateway.loadResource<Snapshot<{requests:Request[]}>>('player-action-requests');guard()
  if(refreshed?.requests.find(row=>row.id===request.id)?.status!=='done')throw Error('pact-room:receipt-without-atomic-ack')
 }
 return{kind:'pact-weapon-request-processed' as const,requestId:request.id,receipt}
}
/** Wake from real campaign-state/reload events. No real-time timer or inferred
 * six-second permission: only the persisted Host clock can finish the hour. */
export async function completeDuePactWeaponRituals(input:{mapId:string},gateway:Gateway){
 const {stamp,guard}=currentHost(),[characters,maps,clock]=await Promise.all([gateway.loadResource<Snapshot<{characters:(Character&{dnd5ePactWeaponAuthority?:{state:{revision:number;ritual?:{ritualId:string}}};dnd5ePactWeaponRitualAuthority?:{sessions:{id:string;startedSecond:number;phase:string}[]}})[]}>>('characters'),gateway.loadResource<Snapshot<{maps:BattleMap[]}>>('maps'),gateway.loadResource<Snapshot<SharedCampaignTimeState>>('campaign-time')]);guard()
 if(!characters||!maps||!clock)throw Error('pact-room:scheduler-snapshot-unavailable')
 const map=maps.maps.find(row=>row.id===input.mapId);if(!map)throw Error('pact-room:map-unavailable')
 const now=clock.worldMinute*60+(clock.worldSecondRemainder??0),completed=[]
 for(const owner of characters.characters){
  const ritualId=owner.dnd5ePactWeaponAuthority?.state.ritual?.ritualId,active=owner.dnd5ePactWeaponRitualAuthority?.sessions.find(row=>row.id===ritualId&&row.phase==='active')
  if(owner.roomId!==stamp.roomId||!active||now-active.startedSecond<3600||map.tokens.filter(token=>token.characterId===owner.id).length!==1)continue
  guard();completed.push(await commitPactWeaponRitual({kind:'complete',mapId:map.id,ownerCharacterId:owner.id,expectedPactRevision:owner.dnd5ePactWeaponAuthority!.state.revision,transactionId:'scheduled-complete:'+active.id},gateway));guard()
 }
 return completed
}

