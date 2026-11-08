import{readStormFuryMovePlainOriginalSource}from'./bountifulOpportunitySequencePostNativeReplay'
import{readBountifulOpportunitySequenceOriginalClockRoute,type BountifulOpportunitySequenceRawRoute}from'./bountifulOpportunitySequenceSource'
import{resolveDnd5eOpportunityMoveSequenceOriginal}from'./opportunityMoveSequence'
import{cloneDnd5eHostTransactionInput,registerDnd5eHostReceipt,registerDnd5eHostReceiptSlot}from'./hostTransactionClone'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
const slot=Symbol('actual-opportunity-original-clock');registerDnd5eHostReceiptSlot(slot)
const issued=new WeakMap<object,{route:BountifulOpportunitySequenceRawRoute;signature:string;parentId:string;effectTimestamp:number}>(),signature=(v:unknown)=>JSON.stringify(encodeSecondChanceParentWire(v))
type Source=Parameters<typeof readBountifulOpportunitySequenceOriginalClockRoute>[1]
function plain(source:object){const copy=Object.create(Object.getPrototypeOf(source));for(const key of Reflect.ownKeys(source))if(key!==slot)Object.defineProperty(copy,key,Object.getOwnPropertyDescriptor(source,key)!);return copy as Source}
export function bindBountifulOpportunitySequenceOriginalClock<T extends Source>(source:T,route:BountifulOpportunitySequenceRawRoute):T{
 const facts=readBountifulOpportunitySequenceOriginalClockRoute(route,source),receipt=registerDnd5eHostReceipt(Object.freeze({})),copy=cloneDnd5eHostTransactionInput(source);issued.set(receipt,{route,signature:signature(source),...facts});Object.defineProperty(copy,slot,{value:receipt,enumerable:false});return copy
}
export function readBountifulOpportunitySequenceOriginalClock(source:unknown,resolve:unknown){
 if(!source||typeof source!=='object')return undefined;const receipt=(source as Record<symbol,unknown>)[slot];if(receipt===undefined)return undefined
 const proof=receipt&&typeof receipt==='object'?issued.get(receipt):undefined,value=readStormFuryMovePlainOriginalSource(plain(source))as Source
 if(resolve!==resolveDnd5eOpportunityMoveSequenceOriginal||!proof||signature(value)!==proof.signature)throw Error('opportunity-original-clock:exact-issued-source-required')
 const facts=readBountifulOpportunitySequenceOriginalClockRoute(proof.route,value);if(facts.parentId!==proof.parentId||facts.effectTimestamp!==proof.effectTimestamp)throw Error('opportunity-original-clock:changed-native-clock')
 return{parentId:proof.parentId,effectTimestamp:proof.effectTimestamp,current:()=>{try{return!!readBountifulOpportunitySequenceOriginalClock(source,resolve)}catch{return false}}}
}
/** Strip precisely this already-verified mechanical receipt for the existing
 * plain wire. Unknown metadata remains subject to the original codec guard. */
export function readBountifulOpportunitySequenceOriginalClockPlain<T extends object>(source:T):T{if(!readBountifulOpportunitySequenceOriginalClock(source,resolveDnd5eOpportunityMoveSequenceOriginal))return source;return cloneDnd5eHostTransactionInput(plain(source))as T}
