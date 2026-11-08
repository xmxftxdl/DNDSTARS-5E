import{captureDnd5eSpellDamageZeroOriginalOperation}from'./damageZeroSpellOriginalOperation'
import{createDnd5eOriginalD20Session}from'./damageCommitSession'
import{resolvePreparedDnd5eSpellCast}from'./spellAction'
import{originalD20ReplaySourceKey}from'./allyNaturalOneCheckpoint'
import{decodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{restoreSecondChancePreparedHostFactsAsync}from'../../pages/maps/secondChancePreparedHostFacts'
import{readDnd5eSpellDamageZeroOriginalOperation,type Dnd5eSpellDamageZeroOriginalOperation}from'./damageZeroSpellOriginalOperation'
import{encodeSecondChanceParentWire,type SecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{captureSecondChancePreparedHostFacts}from'../../pages/maps/secondChancePreparedHostFacts'
import{getRoomSession}from'../../lib/roomSession'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
type RawRow={key:'original'|'bless'|'bane';index:number;requestId:string;count:number;sides:number;rollKind:'saving-throw'|'other';label:string;raw?:{memberId:string;values:number[]};confirmed?:{memberId:string;values:number[]}}
export interface BountifulSpellDamageZeroOriginalRawBook{ok:true;sourceKind:'spell-damage-zero-original-v1';roomId:string;hostMemberId:string;parentId:string;mapId:string;combatId:string;source:SecondChanceParentWire;frame:ReturnType<typeof readDnd5eSpellDamageZeroOriginalOperation>['frame'];prefixSignature:string;effectTimestamp:number;characterId:string;memberId:string;rows:RawRow[]}
export type BountifulSpellDamageZeroOriginalRawLoader=(identity:{parentId:string;mapId:string;combatId:string})=>Promise<BountifulSpellDamageZeroOriginalRawBook>
type Gateway=Pick<SharedRoomGatewayPort,'publishEvent'>
declare const originalRoute:unique symbol
type BountifulSpellDamageZeroPrimaryDiceRoute={readonly[originalRoute]:true}
export type BountifulSpellDamageZeroOriginalDiceRoute=BountifulSpellDamageZeroPrimaryDiceRoute
const handles=new WeakMap<object,{operation:Dnd5eSpellDamageZeroOriginalOperation;read:()=>Promise<BountifulSpellDamageZeroOriginalRawBook>}>()
const activeRoutes=new Map<string,WeakRef<BountifulSpellDamageZeroOriginalDiceRoute>>()
const routes=new WeakMap<object,{read:()=>Promise<BountifulSpellDamageZeroOriginalRawBook>;requestId:string;operation:Dnd5eSpellDamageZeroOriginalOperation;roomId:string;memberId:string}>()
const host=()=>{const s=getRoomSession();if(s?.role!=='dm'||!s.roomId||!s.memberId)throw Error('spell-zero-raw:current-host-required');return s}
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
/** The data reader is never a route issuer: only the actual native operation
 * can bind the protected source and the server's canonical roller slots. */
export async function createBountifulSpellDamageZeroOriginalRaw(operation:Dnd5eSpellDamageZeroOriginalOperation,gateway:Gateway,load:BountifulSpellDamageZeroOriginalRawLoader,labels:{original:string;bless?:string;bane?:string},loadParent?:BountifulSpellDamageZeroOriginalParentLoader){return createRaw(operation,gateway,load,labels,loadParent)}
async function createRaw(operation:Dnd5eSpellDamageZeroOriginalOperation,gateway:Gateway,load:BountifulSpellDamageZeroOriginalRawLoader,labels:{original:string;bless?:string;bane?:string},loadParent?:BountifulSpellDamageZeroOriginalParentLoader){
 const session=host(),native=readDnd5eSpellDamageZeroOriginalOperation(operation),prepared=native.source.prepared
 const identity={parentId:prepared.action.id,mapId:prepared.map.id,combatId:prepared.state.combatId};let wire=encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(native.source))
 if(Object.hasOwn(native.source,'hostOriginalD20Replay')){
  const source=native.source as typeof native.source&{hostOriginalD20Replay?:{parentId:string;sourceKey:string;effectTimestamp:number;facts:unknown[]}}, {hostOriginalD20Replay:replay,...plain}=source
  if(!replay||JSON.stringify(Object.keys(replay).sort())!==JSON.stringify(['effectTimestamp','facts','parentId','sourceKey'])||replay.parentId!==identity.parentId||replay.effectTimestamp!==native.effectTimestamp||replay.sourceKey!==originalD20ReplaySourceKey(identity.parentId,prepared.state,prepared.action,native.effectTimestamp)||!Array.isArray(replay.facts)||replay.facts.length||Object.hasOwn(plain,'hostDamageZeroSavingThrows'))throw Error('spell-zero-raw:exact-restored-clock-required')
  const book=await (loadParent??load)(identity);if(book.effectTimestamp!==native.effectTimestamp||!equal(book.source,encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(plain))))throw Error('spell-zero-raw:exact-restored-source-required');wire=book.source
 }
 const expected=[{key:'original',count:native.frame.mode==='normal'?1:2,sides:20,rollKind:'saving-throw'},...(native.frame.blessed?[{key:'bless',count:1,sides:4,rollKind:'saving-throw'}]:[]),...(native.frame.baned?[{key:'bane',count:1,sides:4,rollKind:'saving-throw'}]:[])]
 const guard=()=>{const current=host();if(current.roomId!==session.roomId||current.memberId!==session.memberId)throw Error('spell-zero-raw:changed-host');const actual=readDnd5eSpellDamageZeroOriginalOperation(operation);if(!equal(actual,native))throw Error('spell-zero-raw:changed-operation')}
 const read=async()=>{guard();const book=await load(identity);guard();if(!book?.ok||book.sourceKind!=='spell-damage-zero-original-v1'||book.roomId!==session.roomId||book.hostMemberId!==session.memberId||book.parentId!==identity.parentId||book.mapId!==identity.mapId||book.combatId!==identity.combatId||!equal(book.source,wire)||!equal(book.frame,native.frame)||book.prefixSignature!==native.prefixSignature||book.effectTimestamp!==native.effectTimestamp||!Array.isArray(book.rows)||book.rows.length!==expected.length||book.rows.some((row,index)=>row.index!==index||row.key!==expected[index].key||row.count!==expected[index].count||row.sides!==expected[index].sides||row.rollKind!==expected[index].rollKind||row.label!==(labels[row.key]??labels.original)||!/^bountiful-spell-damage-zero-original:[a-f0-9]{64}$/.test(row.requestId)))throw Error('spell-zero-raw:exact-private-native-source-required');return book}
 guard();await gateway.publishEvent('bountiful-native-raw-source-dm-to-host',{sourceKind:'spell-damage-zero-original-v1',phase:'register',...identity,source:wire,frame:native.frame,prefixSignature:native.prefixSignature,effectTimestamp:native.effectTimestamp,labels});const book=await read()
 const issued=book.rows.map(row=>{const route=Object.freeze({})as BountifulSpellDamageZeroOriginalDiceRoute;routes.set(route,{read,requestId:row.requestId,operation,roomId:session.roomId!,memberId:session.memberId!});activeRoutes.set(row.requestId,new WeakRef(route));return route})
 const handle={routes:issued,read,
  recordHostRaw:async(route:BountifulSpellDamageZeroOriginalDiceRoute,values:readonly number[])=>{const binding=routes.get(route);if(!binding||!issued.includes(route))throw Error('spell-zero-raw:actual-issued-route-required');await read();await gateway.publishEvent('bountiful-native-raw-source-dm-to-host',{sourceKind:'spell-damage-zero-original-v1',phase:'host-raw',...identity,requestId:binding.requestId,rawValues:[...values]});await read()},
  confirm:async(route:BountifulSpellDamageZeroOriginalDiceRoute,rawValues:readonly number[],values:readonly number[])=>{const binding=routes.get(route);if(!binding||!issued.includes(route))throw Error('spell-zero-raw:actual-issued-route-required');await read();await gateway.publishEvent('bountiful-native-raw-source-dm-to-host',{sourceKind:'spell-damage-zero-original-v1',phase:'confirm',...identity,requestId:binding.requestId,rawValues:[...rawValues],values:[...values]});return read()}}
 handles.set(handle,{operation,read});return handle
}
export async function readBountifulSpellDamageZeroOriginalDiceRoute(route:BountifulSpellDamageZeroOriginalDiceRoute){
 const binding=routes.get(route),current=host();if(!binding||current.roomId!==binding.roomId||current.memberId!==binding.memberId)throw Error('spell-zero-raw:actual-issued-route-required');readDnd5eSpellDamageZeroOriginalOperation(binding.operation);const book=await binding.read(),row=book.rows.find(row=>row.requestId===binding.requestId);if(!row)throw Error('spell-zero-raw:missing-issued-pool');return{roomId:book.roomId,parentId:book.parentId,mapId:book.mapId,combatId:book.combatId,requestId:row.requestId,count:row.count,sides:row.sides,rollKind:row.rollKind,label:row.label,rollerTokenId:book.frame.targetId,targetCharacterId:book.characterId,memberId:book.memberId,hostMemberId:book.hostMemberId,rawValues:row.raw?.values.slice(),values:row.confirmed?.values.slice()}
}

/** No caller book snapshot can create a transport handle. */
export async function readBountifulSpellDamageZeroOriginalRawHandle(handle:object){const issued=handles.get(handle);if(!issued)throw Error('spell-zero-raw:actual-issued-handle-required');readDnd5eSpellDamageZeroOriginalOperation(issued.operation);return{operation:issued.operation,book:await issued.read()}}

/** The request index only finds an existing opaque route; strings and JSON
 * cannot issue one. Every use rechecks its actual operation and private book. */
export async function readBountifulSpellDamageZeroOriginalPlayerDiceOwner(route:BountifulSpellDamageZeroOriginalDiceRoute|undefined,requestId:string,rollerTokenId:string|undefined,count:number,sides:number){
 if(route===undefined)return undefined
 const spec=await readBountifulSpellDamageZeroOriginalDiceRoute(route)
 if(spec.requestId!==requestId||spec.rollerTokenId!==rollerTokenId||spec.count!==count||spec.sides!==sides)throw Error('spell-zero-raw:exact-issued-dice-owner-required')
 return{characterId:spec.targetCharacterId,memberId:spec.memberId,hostMemberId:spec.hostMemberId,rawValues:spec.rawValues,values:spec.values}
}
async function issuedPool(input:{requestId:string;rollerTokenId?:string;sides?:number}){
 const route=activeRoutes.get(input.requestId)?.deref();if(!route){activeRoutes.delete(input.requestId);return undefined}
 const spec=await readBountifulSpellDamageZeroOriginalDiceRoute(route)
 if(spec.requestId!==input.requestId||spec.rollerTokenId!==input.rollerTokenId||input.sides!==undefined&&spec.sides!==input.sides)throw Error('spell-zero-raw:exact-issued-presentation-required')
 return spec
}
export async function hasIssuedBountifulSpellDamageZeroOriginalRequest(input:{requestId:string;rollerTokenId?:string}){return(await issuedPool(input))!==undefined}
export async function recordBountifulSpellDamageZeroOriginalHostRaw(input:{requestId:string;rollerTokenId?:string;sides:number;values:readonly number[]},gateway:Gateway){
 const spec=await issuedPool(input);if(!spec)return false
 if(spec.count!==input.values.length)throw Error('spell-zero-raw:exact-issued-host-raw-required')
 if(spec.memberId===spec.hostMemberId){await gateway.publishEvent('bountiful-native-raw-source-dm-to-host',{sourceKind:'spell-damage-zero-original-v1',phase:'host-raw',parentId:spec.parentId,mapId:spec.mapId,combatId:spec.combatId,requestId:spec.requestId,rawValues:[...input.values]})}
 else if(!spec.rawValues||!equal(spec.rawValues,input.values))throw Error('spell-zero-raw:locked-physical-player-required')
 return true
}
export async function recordBountifulSpellDamageZeroOriginalHostConfirmation(input:{requestId:string;rollerTokenId?:string;sides:number;rawValues:readonly number[];values:readonly number[]},gateway:Gateway){
 const spec=await issuedPool(input);if(!spec)return false
 if(spec.count!==input.rawValues.length||spec.count!==input.values.length||!spec.rawValues||!equal(spec.rawValues,input.rawValues))throw Error('spell-zero-raw:exact-locked-host-confirmation-required')
 await gateway.publishEvent('bountiful-native-raw-source-dm-to-host',{sourceKind:'spell-damage-zero-original-v1',phase:'confirm',parentId:spec.parentId,mapId:spec.mapId,combatId:spec.combatId,requestId:spec.requestId,rawValues:[...input.rawValues],values:[...input.values]});return true
}

/** A private source is replay input only. Recovery reruns the canonical native
 * facade and must reproduce the exact issued frame, prefix and parent clock.
 * It never deserializes a result or registers caller snapshots as authority. */
export async function restoreBountifulSpellDamageZeroOriginalRaw(identity:{parentId:string;mapId:string;combatId:string},gateway:Gateway,load:BountifulSpellDamageZeroOriginalRawLoader,labels:{original:string;bless?:string;bane?:string}){
 const session=host(),book=await load(identity);if(!book?.ok||book.sourceKind!=='spell-damage-zero-original-v1'||book.roomId!==session.roomId||book.hostMemberId!==session.memberId||book.parentId!==identity.parentId||book.mapId!==identity.mapId||book.combatId!==identity.combatId||!Number.isSafeInteger(book.effectTimestamp)||book.effectTimestamp<0)throw Error('spell-zero-raw:exact-restored-parent-required')
 const restored=await restoreSecondChancePreparedHostFactsAsync(decodeSecondChanceParentWire(book.source)) as Parameters<typeof resolvePreparedDnd5eSpellCast>[0]
 if(!restored?.prepared||restored.prepared.action.id!==identity.parentId||restored.prepared.map.id!==identity.mapId||restored.prepared.state.combatId!==identity.combatId||Object.hasOwn(restored,'hostDamageZeroSavingThrows')||Object.hasOwn(restored,'hostOriginalD20Replay')||!equal(encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(restored)),book.source))throw Error('spell-zero-raw:exact-restored-source-required')
 const source={...restored,hostOriginalD20Replay:{parentId:identity.parentId,sourceKey:originalD20ReplaySourceKey(identity.parentId,restored.prepared.state,restored.prepared.action,book.effectTimestamp),effectTimestamp:book.effectTimestamp,facts:[]}},native=createDnd5eOriginalD20Session(source,resolvePreparedDnd5eSpellCast,book.frame.targetId,'saving-throw')
 try{const result=native.run(source.prepared.state);if(result.status!=='pending-damage-zero-saving-throw')throw Error('spell-zero-raw:actual-restored-zero-phase-required');const operation=captureDnd5eSpellDamageZeroOriginalOperation(result),actual=readDnd5eSpellDamageZeroOriginalOperation(operation);if(!equal(actual.frame,book.frame)||actual.prefixSignature!==book.prefixSignature||actual.effectTimestamp!==book.effectTimestamp)throw Error('spell-zero-raw:exact-restored-native-prefix-required');const raw=await createRaw(operation,gateway,load,labels);return{operation,raw,source}}
 finally{native.cancel()}
}

export function isBountifulSpellDamageZeroOriginalDiceRoute(value:unknown):value is BountifulSpellDamageZeroOriginalDiceRoute{return !!value&&typeof value==='object'&&routes.has(value)}

export type BountifulSpellDamageZeroOriginalParentLoader=(identity:{parentId:string;mapId:string;combatId:string})=>Promise<{ok:true;source:SecondChanceParentWire;effectTimestamp:number}>
