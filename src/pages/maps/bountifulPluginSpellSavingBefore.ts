import{assertPluginTempestuousEarlyRoomPreludeCurrent,capturePluginTempestuousEarlyRoomOriginalWitness,readPluginTempestuousEarlyRoomOriginalWitness,beginPluginTempestuousEarlyRoomPrelude,disposePluginTempestuousEarlyRoomPrelude,type PluginTempestuousEarlyRoomPrelude,type PluginTempestuousEarlyRoomOriginalWitness}from'./pluginTempestuousEarlyRoomPrelude'
import{reprepareDnd5ePluginTempestuousOriginal,type PluginTempestuousRecoveryWorld}from'../../rulesets/dnd5e/pluginTempestuousOriginalRecovery'
import{encodeSecondChanceParentWire,decodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{restoreSecondChancePreparedHostFactsAsync}from'./secondChancePreparedHostFacts'
import{getRoomSession}from'../../lib/roomSession'
import{resolvePreparedDnd5ePluginSpellCast}from'../../rulesets/dnd5e/pluginSpellTransaction'
import type{BountifulPluginSpellSavingOriginalBook}from'../../ports/dnd5ePluginSpellSavingOriginalTransport'

type Source=Parameters<typeof resolvePreparedDnd5ePluginSpellCast>[0]
type Prepared=Source['prepared']
declare const beforeBrand:unique symbol
export type BountifulPluginSpellSavingBefore={readonly[beforeBrand]:true}
type Loader=(id:{parentId:string;mapId:string;combatId:string})=>Promise<BountifulPluginSpellSavingOriginalBook>
const records=new WeakMap<object,{early:PluginTempestuousEarlyRoomPrelude;witness:PluginTempestuousEarlyRoomOriginalWitness;ownerBook:string;collectionId:string;witnessCollectionId?:string;recovered:boolean}>(),preparedBefore=new WeakMap<Prepared,BountifulPluginSpellSavingBefore>()
const signature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value))

/** Only a live actual EarlyRoom operation can be registered for the same
 * genuine prepared identity. Its actual transport book is checked first. */
export async function registerBountifulPluginSpellSavingBefore(prepared:Prepared,early:PluginTempestuousEarlyRoomPrelude,resumeLoad?:Loader){
 await assertPluginTempestuousEarlyRoomPreludeCurrent(early)
 const witness=capturePluginTempestuousEarlyRoomOriginalWitness(early),actual=readPluginTempestuousEarlyRoomOriginalWitness(witness),book=JSON.parse(actual.owner.book)as{ownerDecision?:{decision?:{kind?:string}}}
 const resumed=resumeLoad?await resumeLoad({parentId:prepared.action.id,mapId:prepared.map.id,combatId:prepared.state.combatId}):undefined,collectionId=actual.collectionId??resumed?.beforeAnchor?.inputs.collectionId
 if(actual.source.prepared!==prepared||!collectionId||actual.landing||book.ownerDecision?.decision?.kind!=='use'||resumed&&JSON.stringify(resumed.beforeAnchor?.owner)!==actual.owner.book)throw Error('plugin-spell-saving-before:actual-started-simple-before-required')
 const token=Object.freeze({})as BountifulPluginSpellSavingBefore;records.set(token,{early,witness,ownerBook:actual.owner.book,collectionId,witnessCollectionId:actual.collectionId,recovered:!!resumeLoad});preparedBefore.set(prepared,token);return token
}

export function readBountifulPluginSpellSavingBefore(token:BountifulPluginSpellSavingBefore){
 const row=records.get(token);if(!row)throw Error('plugin-spell-saving-before:actual-live-before-required');const actual=readPluginTempestuousEarlyRoomOriginalWitness(row.witness)
 if(actual.owner.book!==row.ownerBook||actual.collectionId!==row.witnessCollectionId)throw Error('plugin-spell-saving-before:changed-private-before')
 const owner=JSON.parse(row.ownerBook)as{parentId:string;mapId:string;combatId:string;timing:'before';effectTimestamp:number}
 return{source:actual.source,mechanical:actual.mechanical,identity:{parentId:owner.parentId,mapId:owner.mapId,combatId:owner.combatId,timing:'before'as const},effectTimestamp:owner.effectTimestamp,ownerBook:row.ownerBook,collectionId:row.collectionId}
}
export function bountifulPluginSpellSavingBeforeForPrepared(prepared:Prepared){const token=preparedBefore.get(prepared);if(token)readBountifulPluginSpellSavingBefore(token);return token}
export function bountifulPluginSpellSavingRecoveredEarly(prepared:Prepared){const token=bountifulPluginSpellSavingBeforeForPrepared(prepared),row=token&&records.get(token);return row&&row.recovered?row.early:undefined}

/** Detached graph copy retaining only the already witnessed prepared graph.
 * Complete graph signatures, including aliases, are checked before Native use. */
export function projectBountifulPluginSpellSavingBeforeSource(token:BountifulPluginSpellSavingBefore,candidate:Source):Source{
 const actual=readBountifulPluginSpellSavingBefore(token),original=actual.source
 if(signature(candidate.prepared)!==signature(original.prepared))throw Error('plugin-spell-saving-before:changed-original-preparation')
 const copy=structuredClone({...candidate,now:actual.effectTimestamp}),grafts=new WeakMap<object,object>(),seen=new WeakSet<object>()
 const pair=(original:unknown,copy:unknown)=>{if(!original||!copy||typeof original!=='object'||typeof copy!=='object'||grafts.has(copy))return;grafts.set(copy,original);if(original instanceof Map&&copy instanceof Map){const a=[...original],b=[...copy];a.forEach(([key,value],index)=>{pair(key,b[index][0]);pair(value,b[index][1])})}else if(original instanceof Set&&copy instanceof Set){const a=[...original],b=[...copy];a.forEach((value,index)=>pair(value,b[index]))}else for(const key of Object.keys(original))pair(Reflect.get(original,key),Reflect.get(copy,key))}
 pair(original.prepared,copy.prepared)
 const retain=(value:unknown):unknown=>{if(!value||typeof value!=='object')return value;const original=grafts.get(value);if(original)return original;if(seen.has(value))return value;seen.add(value);if(value instanceof Map){const entries=[...value];value.clear();for(const[key,item]of entries)value.set(retain(key),retain(item))}else if(value instanceof Set){const entries=[...value];value.clear();for(const item of entries)value.add(retain(item))}else for(const key of Object.keys(value))Reflect.set(value,key,retain(Reflect.get(value,key)));return value}
 const source=retain(copy)as Source
 if(signature({...source,rolls:undefined})!==signature({...original,rolls:undefined}))throw Error('plugin-spell-saving-before:only-future-original-slots-required')
 return source
}

export function assertBountifulPluginSpellSavingBeforeBook(token:BountifulPluginSpellSavingBefore,book:Pick<BountifulPluginSpellSavingOriginalBook,'effectTimestamp'|'beforeAnchor'>){
 const actual=readBountifulPluginSpellSavingBefore(token),anchor=book.beforeAnchor
 if(!anchor||book.effectTimestamp!==actual.effectTimestamp||signature(anchor.identity)!==signature(actual.identity)||JSON.stringify(anchor.owner)!==actual.ownerBook||anchor.inputs.collectionId!==actual.collectionId)throw Error('plugin-spell-saving-before:exact-current-authenticated-before-required')
 return actual
}

const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)])):value
const sameData=(a:unknown,b:unknown)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b))
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)

/** Reconstruct the genuine Native EarlyRoom producer against the independently
 * authenticated Saving reader. The saved DTO is never an early-token issuer:
 * a fresh current-rule Native preparation/prefix must match every field first. */
export async function restoreBountifulPluginSpellSavingBefore(source:Source,book:BountifulPluginSpellSavingOriginalBook,load:Loader){
 const anchor=book.beforeAnchor;if(!anchor)throw Error('plugin-spell-saving-before:current-anchor-required')
 const owner=anchor.owner,wire=owner.source
 if(!object(wire)||!object(owner.frame)||!Array.isArray(owner.features)||!object(owner.ownerDecision))throw Error('plugin-spell-saving-before:closed-private-owner-required')
 const original=await restoreSecondChancePreparedHostFactsAsync(decodeSecondChanceParentWire(wire as unknown as Parameters<typeof decodeSecondChanceParentWire>[0]))as Source
 // Pair the detached original graph to this same restored prepared identity.
 if(signature(original.prepared)!==signature(source.prepared))throw Error('plugin-spell-saving-before:exact-cold-preparation-required')
 if(!object(owner.scope)||!object(owner.scope.publicDependencies))throw Error('plugin-spell-saving-before:closed-original-dependencies-required')
 const dependencies=owner.scope.publicDependencies,doc=(key:string)=>{const row=dependencies[key];if(!object(row)||typeof row.signature!=='string')throw Error('plugin-spell-saving-before:exact-original-document-required');return JSON.parse(row.signature)},combat=doc('combat')
 const canonical=reprepareDnd5ePluginTempestuousOriginal(owner,{maps:doc('maps').maps,characters:doc('characters').characters,combat,requests:doc('player-action-requests').requests,processed:doc('player-action-processed')?.actionIds??[],ack:doc('player-action-ack')}as PluginTempestuousRecoveryWorld)
 const prepared=canonical.prepared,empty=structuredClone(original),pairs=new WeakMap<object,object>(),seen=new WeakSet<object>()
 const pair=(to:unknown,from:unknown)=>{if(!to||!from||typeof to!=='object'||typeof from!=='object'||pairs.has(from))return;pairs.set(from,to);if(to instanceof Map&&from instanceof Map){const a=[...to],b=[...from];a.forEach(([key,value],index)=>{pair(key,b[index][0]);pair(value,b[index][1])})}else if(to instanceof Set&&from instanceof Set){const a=[...to],b=[...from];a.forEach((value,index)=>pair(value,b[index]))}else for(const key of Object.keys(to))pair(Reflect.get(to,key),Reflect.get(from,key))}
 pair(prepared,empty.prepared)
 const graft=(value:unknown):unknown=>{if(!value||typeof value!=='object')return value;const target=pairs.get(value);if(target)return target;if(seen.has(value))return value;seen.add(value);if(value instanceof Map){const items=[...value];value.clear();for(const[key,item]of items)value.set(graft(key),graft(item))}else if(value instanceof Set){const items=[...value];value.clear();for(const item of items)value.add(graft(item))}else for(const key of Object.keys(value))Reflect.set(value,key,graft(Reflect.get(value,key)));return value}
 const emptySource=graft(empty)as Source,host=getRoomSession(),identity={parentId:prepared.action.id,mapId:prepared.map.id,combatId:prepared.state.combatId}
 if(host?.role!=='dm'||host.roomId!==book.roomId||host.memberId!==book.hostMemberId)throw Error('plugin-spell-saving-before:actual-cold-host-required')
 const current=async()=>{const next=await load(identity);if(!next.beforeAnchor||!sameData(next.beforeAnchor,anchor)||getRoomSession()?.memberId!==host.memberId||getRoomSession()?.role!=='dm')throw Error('plugin-spell-saving-before:changed-current-cold-anchor');return next.beforeAnchor}
 const early=await beginPluginTempestuousEarlyRoomPrelude({source:emptySource,request:async(operation,payload)=>{
  const actual=await current()
  if(operation==='read'){if(!sameData(payload,actual.identity))throw Error('plugin-spell-saving-before:exact-cold-read-required');return structuredClone(actual.owner)}
  if(operation==='prepare'){
   const expected={sourceKind:owner.sourceKind,phase:'prepare',...actual.identity,source:owner.source,features:owner.features,frame:owner.frame,prefixSignature:owner.prefixSignature,effectTimestamp:owner.effectTimestamp}
   if(!sameData(payload,expected))throw Error('plugin-spell-saving-before:actual-new-native-prefix-required');return{ok:true}
  }
  throw Error('plugin-spell-saving-before:no-new-owner-or-inputs')
 },landing:async()=>{throw Error('plugin-spell-saving-before:no-new-landing')},geometry:null,characters:()=>prepared.characters,parentTransactionId:()=>prepared.action.id,authorityUnchanged:()=>getRoomSession()?.role==='dm'&&getRoomSession()?.memberId===host.memberId,choose:async()=>{throw Error('plugin-spell-saving-before:no-new-owner-choice')},rollLanding:async()=>{throw Error('plugin-spell-saving-before:no-new-landing-die')}})
 if(!early)throw Error('plugin-spell-saving-before:actual-cold-native-before-required')
 try{const token=await registerBountifulPluginSpellSavingBefore(prepared,early,load);return{source:projectBountifulPluginSpellSavingBeforeSource(token,{...emptySource,rolls:source.rolls}),early}}catch(error){disposePluginTempestuousEarlyRoomPrelude(early);throw error}
}
