import {readIssuedDnd5eOpportunityPlayerMove,type PreparedDnd5eOpportunityPlayerMove} from './opportunityMoveAction'
import {getRoomSession} from '../../lib/roomSession'
import {captureBountifulOriginalRawIssuer} from './bountifulOriginalRawIssuer'
import {createDnd5eOriginalD20Session} from './damageCommitSession'
import {resolvePreparedDnd5eMonsterAttack} from './monsterAttackAction'
import {cloneDnd5eHostTransactionInput,registerDnd5eHostReceipt,registerDnd5eHostReceiptSlot} from './hostTransactionClone'
import {bountifulPreparedOriginalRoller} from './bountifulPreparedController'
import {bountifulNativeDiceController} from '../../../shared/bountiful-native-dice-controller.mjs'
import type {BountifulHostOperation} from '../../../shared/bountiful-host-operation.mjs'
import {encodeSecondChanceParentWire} from '../../lib/secondChanceParentWire'
import {durableD20RollId} from '../../lib/rollConfirmation'
import {dnd5eBountifulOriginalReadyOwners} from './headlessCombatEngine'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'

type Source=Parameters<typeof resolvePreparedDnd5eMonsterAttack>[0]
type Session=ReturnType<typeof createDnd5eOriginalD20Session<Source,ReturnType<typeof resolvePreparedDnd5eMonsterAttack>>>
type Stage=Extract<ReturnType<Session['run']>,{status:'pending-ally-natural-one'}>
interface Facts{source:Source;operation:BountifulHostOperation;pending:Stage;roomId:string;roller:ReturnType<typeof bountifulPreparedOriginalRoller>}
const issued=new WeakMap<object,Facts>()
const slot=Symbol('bountiful-native-original-parent')
registerDnd5eHostReceiptSlot(slot)
export interface BountifulHostOperationCapability{readonly version:1}
export interface BountifulNativeDiceRoute{readonly version:1}
interface DiceRouteFacts{roomId:string;hostMemberId:string;requestId:string;tokenId:string;characterId:string;memberId:string}
const diceRoutes=new WeakMap<BountifulNativeDiceRoute,DiceRouteFacts>(),rawDiceRoutes=new WeakMap<BountifulHostOperation,BountifulNativeDiceRoute>()
function createDiceRoute(prepared:Pick<Source['prepared'],'map'|'characters'|'actorToken'>,requestId:string){
 const host=getRoomSession();if(!host||host.role!=='dm')throw Error('bountiful-native-route:issuing-host-required')
 const controlled=bountifulNativeDiceController(prepared.map,prepared.characters,prepared.actorToken.id,host.roomId)
 if(!controlled)throw Error('bountiful-native-route:actual-controller-required')
 if(!controlled.character)return undefined
 const route=Object.freeze(registerDnd5eHostReceipt({version:1 as const}))
 diceRoutes.set(route,{roomId:host.roomId,hostMemberId:host.memberId,requestId,tokenId:controlled.token.id,characterId:controlled.character.id,memberId:controlled.character.roomMemberId??host.memberId})
 return route
}
/** Routing is derived from the real private issuer. Team colour is not a
 * controller, and a serialized route object never passes this reader. */
export function readBountifulNativeDiceRoute(route:BountifulNativeDiceRoute|undefined,requestId:string,tokenId?:string){
 if(route===undefined)return undefined
 const facts=diceRoutes.get(route),host=getRoomSession()
 if(!facts||!host||host.role!=='dm'||host.roomId!==facts.roomId||host.memberId!==facts.hostMemberId||requestId!==facts.requestId||tokenId!==undefined&&tokenId!==facts.tokenId)throw Error('bountiful-native-route:issued-current-request-required')
 return {...facts}
}
export function bountifulIssuedRawDiceRoute(operation:BountifulHostOperation|undefined){return operation&&rawDiceRoutes.get(operation)}
export function bountifulNativeExtraDiceRoute(capability:BountifulHostOperationCapability,requestId:string){
 const facts=bountifulIssuedHostOperation(capability)
 if(!/^bountiful-native-parent-extra-d20:[a-f0-9]{64}$/.test(requestId))throw Error('bountiful-native-route:actual-extra-request-required')
 return createDiceRoute(facts.source.prepared,requestId)
}

/** Actual native DiceBox request entry, before a delegated PC has rolled.
 * Prepared facts stay on a DM-only channel. The ordinary public dice request
 * carries no private source and can only use this exact pre-issued raw ID. */
export async function issueBountifulMonsterOriginalRollSource(input:{parentId:string;prepared:Source['prepared'];rawRollId:string;rawCursor:number;count:1|2},gateway:Pick<SharedRoomGatewayPort,'publishEvent'>){
 const host=getRoomSession(),prepared=input.prepared
 if(!host||host.role!=='dm'||!input.parentId||!Number.isSafeInteger(input.rawCursor)||input.rawCursor<1||input.rawCursor>100000||![1,2].includes(input.count))throw Error('bountiful-native-raw:actual-host-request-required')
 const id=durableD20RollId({mapId:prepared.map.id,sourceMode:'dm',transactionId:input.parentId,occurrenceIndex:input.rawCursor-1})
 if(input.rawRollId!==id&&input.rawRollId!==id+':pool:'+input.count+'d20')throw Error('bountiful-native-raw:actual-request-namespace-required')
 if(!dnd5eBountifulOriginalReadyOwners(prepared.state,{actorId:prepared.actorToken.id,kind:'attack'}).length)return undefined
 const operation:BountifulHostOperation={kind:'native-host-operation',version:1,adapterId:'monster',parentId:input.parentId,mapId:prepared.map.id,combatId:prepared.state.combatId,hostMemberId:host.memberId,actorTokenId:prepared.actorToken.id,targetTokenId:prepared.targetToken.id,actionId:prepared.resourceAction.id,rawRollId:input.rawRollId,rawCursor:input.rawCursor}
 await gateway.publishEvent('bountiful-native-raw-source-dm-to-host',{operation,source:encodeSecondChanceParentWire({prepared}),count:input.count})
 const current=getRoomSession()
 if(!current||current.role!=='dm'||current.roomId!==host.roomId||current.memberId!==host.memberId)throw Error('bountiful-native-raw:host-changed')
 const diceRoute=createDiceRoute(prepared,input.rawRollId);if(diceRoute)rawDiceRoutes.set(operation,diceRoute)
 return operation
}

/** Called only at the real Host raw callback. A pool keeps its real token.
 * Character-backed dice keep their canonical owner; the server additionally
 * demands that member's actual authenticated raw evidence before publication. */
export function captureBountifulMonsterOriginalOperation(input:{parentId:string;source:Source;rawRollId:string;rawCursor:number}):BountifulHostOperationCapability|undefined{
 const host=getRoomSession()
 if(!host||host.role!=='dm'||input.source.transactionId!==input.parentId)throw Error('bountiful-host-operation:actual-host-parent-required')
 const source=cloneDnd5eHostTransactionInput(input.source),prepared=source.prepared,actor=prepared.actorToken
 const ownership=bountifulNativeDiceController(prepared.map,prepared.characters,actor.id,host.roomId)
 if(!ownership)throw Error('bountiful-host-operation:canonical-current-controller-required')
 const character=ownership.character
 if(character?.ownerAccountId&&(character.roomMemberId??host.memberId)===host.memberId&&character.ownerAccountId!==host.accountId)throw Error('bountiful-host-operation:foreign-account-controller')
 const controller:ReturnType<typeof bountifulPreparedOriginalRoller>=character?{tokenId:actor.id,characterId:character.id,memberId:character.roomMemberId??host.memberId}:{tokenId:actor.id,memberId:host.memberId,kind:'host-token'}
 const roll=source.rolls[0],raw=roll?.d20Second===undefined?[roll?.d20]:[roll?.d20,roll.d20Second]
 if(raw.some(face=>typeof face!=='number'||!Number.isInteger(face)||face<1||face>20))throw Error('bountiful-host-operation:actual-original-raw-required')
 const faces=raw.filter((face):face is number=>typeof face==='number')
 captureBountifulOriginalRawIssuer({mapId:prepared.map.id,parentId:input.parentId,mode:'dm',rollId:input.rawRollId,cursor:input.rawCursor,raw:faces})
 const session=createDnd5eOriginalD20Session(source,resolvePreparedDnd5eMonsterAttack,actor.id,'attack')
 let pending:ReturnType<typeof session.run>
 try{pending=session.run(prepared.state)}finally{session.cancel()}
 if(pending.status!=='pending-ally-natural-one')return undefined
 if(pending.occurrence!==0||pending.request.actorId!==actor.id||JSON.stringify(pending.request.originalRolls)!==JSON.stringify(faces))throw Error('bountiful-host-operation:earlier-original-must-settle')
 const operation:BountifulHostOperation={kind:'native-host-operation',version:1,adapterId:'monster',parentId:input.parentId,mapId:prepared.map.id,combatId:prepared.state.combatId,hostMemberId:host.memberId,actorTokenId:actor.id,targetTokenId:prepared.targetToken.id,actionId:prepared.resourceAction.id,rawRollId:input.rawRollId,rawCursor:input.rawCursor}
 const capability=Object.freeze(registerDnd5eHostReceipt({version:1 as const}))
 issued.set(capability,{source,operation,pending,roomId:host.roomId,roller:controller})
 Object.defineProperty(source.prepared,slot,{value:capability,enumerable:false})
 return capability
}

/** No public payload can manufacture this issuer result. Reload recovery will
 * use a separately protected, server-authenticated persisted operation. */
export function bountifulIssuedHostOperation(capability:BountifulHostOperationCapability){
 const facts=issued.get(capability),host=getRoomSession()
 if(!facts||!host||host.role!=='dm'||host.roomId!==facts.roomId||host.memberId!==facts.operation.hostMemberId)throw Error('bountiful-host-operation:private-issuer-required')
 return cloneDnd5eHostTransactionInput(facts)
}

/** Remove this issuer's own nonenumerable slot only. The ordinary data codec
 * still rejects every other registered or symbol capability. */
export function encodeBountifulHostOperation(capability:BountifulHostOperationCapability){
 const {source}=bountifulIssuedHostOperation(capability)
 stripBountifulNativePreparedCapability(source)
 return encodeSecondChanceParentWire(source)
}

/** This adapter accepts only later concrete damage dice. It offers no source,
 * state, original d20, target or modifier replacement API. */
export function encodeBountifulHostMonsterDamage(capability:BountifulHostOperationCapability,damage:readonly (readonly (readonly number[])[])[]){
 const {source}=bountifulIssuedHostOperation(capability)
 if(damage.length!==source.rolls.length||source.rolls.some(roll=>roll.damageRolls.length!==0))throw Error('bountiful-host-operation:empty-original-damage-required')
 source.rolls=source.rolls.map((roll,index)=>({...roll,damageRolls:damage[index].map(group=>[...group])}))
 stripBountifulNativePreparedCapability(source)
 return encodeSecondChanceParentWire(source)
}

/** The native facade retains its real statblock action. Only this private,
 * source-bound slot supplies its distinct operation parent identity. JSON tags,
 * shared player fields, and arbitrary replay payloads cannot select this path. */
export function bountifulHostOperationReplayContext(input:unknown):{parentId:string;command:BountifulHostOperation}|undefined{
 const data=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
 if(!data(input)||!data(input.prepared))return undefined
 const capability=Object.getOwnPropertyDescriptor(input.prepared,slot)?.value
 if(capability===undefined)return undefined
 const facts=issued.get(capability),host=getRoomSession()
 if(!facts||!host||host.role!=='dm'||host.roomId!==facts.roomId||host.memberId!==facts.operation.hostMemberId||JSON.stringify({...input,hostOriginalD20Replay:undefined})!==JSON.stringify(facts.source))throw Error('bountiful-host-operation:foreign-native-source')
 return {parentId:facts.operation.parentId,command:structuredClone(facts.operation)}
}

/** Codec recovery recognizes this exact private slot and issuer, never a
 * symbol description or a serialized parent marker. It issues no new fact. */
export function bountifulNativePreparedRecoveryFacts(input:unknown){
 const context=bountifulHostOperationReplayContext(input)
 return context?{parentId:context.parentId}:undefined
}

/** Read-only identity for the concrete native facade's execution registry.
 * The registry itself is private to that facade and exposes no mint/set API. */
export function bountifulNativePreparedExecutionIdentity(input:unknown):object|undefined{
 if(!bountifulHostOperationReplayContext(input))return undefined
 if(!input||typeof input!=='object'||!('prepared'in input)||!input.prepared||typeof input.prepared!=='object')return undefined
 return Object.getOwnPropertyDescriptor(input.prepared,slot)?.value
}

/** Remove only this registered native capability from a trusted data clone.
 * Every unrelated symbol, nonenumerable slot and capability remains visible to
 * the ordinary capability detector and must still be rejected by that codec. */
export function stripBountifulNativePreparedCapability(input:unknown){
 if(!input||typeof input!=='object'||!('prepared'in input)||!input.prepared||typeof input.prepared!=='object')return false
 const prepared=input.prepared,capability=Object.getOwnPropertyDescriptor(prepared,slot)?.value
 if(capability===undefined)return false
 bountifulIssuedHostOperation(capability)
 const descriptors=Object.getOwnPropertyDescriptors(prepared)
 Reflect.deleteProperty(descriptors,slot)
 input.prepared=Object.create(Object.getPrototypeOf(prepared),descriptors)
 return true
}

/** A concrete original-move producer may reuse canonical dice routing. A
 * serialized prepare or arbitrary caller supplied map cannot issue this route. */
export function bountifulOpportunityMoveDiceRoute(prepared:PreparedDnd5eOpportunityPlayerMove,requestId:string){
 const actual=readIssuedDnd5eOpportunityPlayerMove(prepared)
 return createDiceRoute({map:actual.map,characters:actual.characters,actorToken:actual.opportunity.actorToken},requestId)
}
