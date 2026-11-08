// Host replay freezes command data, but process-local capabilities cannot be
// serialized. Only receipts and symbol slots registered by their issuers survive.
const receipts = new WeakSet<object>()
const slots = new Set<symbol>()
export function registerDnd5eHostReceipt<T extends object>(receipt: T): T {
  receipts.add(receipt)
  return receipt
}
export function registerDnd5eHostReceiptSlot(slot: symbol): void { slots.add(slot) }

type OwnedCloneNode={prototype:object|null;keys:string[];values:unknown[];arrayLength?:number;symbols:{slot:symbol;descriptor:PropertyDescriptor}[]}
type OwnedCloneMetadata={safe:boolean;nodes:WeakMap<object,OwnedCloneNode>}
export function cloneDnd5eHostTransactionInput<T>(input: T): T {
  return cloneDnd5eHostTransactionInputInternal(input)
}
/** Clone ownership is created here, never asserted by a caller or a Source token.
 * Only this owned API walks native output before any restore code can run. */
export function cloneDnd5eHostTransactionInputForOwnedUse<T>(input:T){
  const metadata:OwnedCloneMetadata={safe:true,nodes:new WeakMap()}
  const copy=cloneDnd5eHostTransactionInputInternal(input,metadata)
  return{copy,currentDetachedData:()=>currentOwnedCloneData(copy,metadata)}
}
function recordNativeOwnedCloneData(input:unknown,metadata:OwnedCloneMetadata):void{
  const pending:unknown[]=[input]
  while(pending.length){
    const value=pending.pop()
    if(value===null||typeof value!=='object'){if(typeof value==='function'||typeof value==='symbol')metadata.safe=false;continue}
    if(metadata.nodes.has(value))continue
    // Before restore runs, every reachable native output node was allocated by
    // structuredClone. Unsupported native builtins do not enter the safe graph.
    const prototype=Object.getPrototypeOf(value)
    if(prototype!==Object.prototype&&prototype!==Array.prototype&&prototype!==null){metadata.safe=false;return}
    const keys=Object.keys(value),values:unknown[]=[]
    for(const key of keys){
      const descriptor=Object.getOwnPropertyDescriptor(value,key)
      if(!descriptor||!('value'in descriptor)){metadata.safe=false;return}
      values.push(descriptor.value);pending.push(descriptor.value)
    }
    metadata.nodes.set(value,{prototype,keys,values,symbols:[],...(Array.isArray(value)?{arrayLength:Object.getOwnPropertyDescriptor(value,'length')!.value}:{})})
  }
}
function currentOwnedCloneData(input:unknown,metadata:OwnedCloneMetadata):boolean{
  if(!metadata.safe)return false
  try{
    const seen=new Set<object>(),pending:unknown[]=[input]
    while(pending.length){
      const value=pending.pop()
      if(value===null||typeof value!=='object'){if(typeof value==='function'||typeof value==='symbol')return false;continue}
      // Unknown identities, including receipts and Proxies, are never probed.
      const node=metadata.nodes.get(value);if(!node)return false
      if(seen.has(value))continue
      seen.add(value)
      if(Object.getPrototypeOf(value)!==node.prototype||!Object.isExtensible(value))return false
      const names=Object.getOwnPropertyNames(value),keys=node.arrayLength===undefined?names:names.filter(key=>key!=='length')
      if(names.length!==node.keys.length+(node.arrayLength===undefined?0:1))return false
      if(keys.length!==node.keys.length||keys.some((key,index)=>key!==node.keys[index]))return false
      for(let index=0;index<keys.length;index++){
        const descriptor=Object.getOwnPropertyDescriptor(value,keys[index])
        if(!descriptor||!('value'in descriptor)||!descriptor.enumerable||!descriptor.writable||!descriptor.configurable||!Object.is(descriptor.value,node.values[index]))return false
        pending.push(descriptor.value)
      }
      if(node.arrayLength!==undefined){const length=Object.getOwnPropertyDescriptor(value,'length');if(!length||length.value!==node.arrayLength||!length.writable||length.enumerable||length.configurable)return false}
      // Native clone drops hidden strings and symbols; Host restore recreates
      // only these exact registered data slots, without inspecting their values.
      const symbols=Object.getOwnPropertySymbols(value)
      // Verified stripping may delete a registered slot; remaining slots must
      // retain the issuer-registration order that a second Host clone recreates.
      let previous=-1
      for(const slot of symbols){
        const index=node.symbols.findIndex(row=>row.slot===slot);if(index<=previous)return false
        previous=index
        const expected=node.symbols[index],descriptor=Object.getOwnPropertyDescriptor(value,slot)
        if(!descriptor||!('value'in descriptor)||!Object.is(descriptor.value,expected.descriptor.value)||descriptor.enumerable!==expected.descriptor.enumerable||descriptor.writable!==expected.descriptor.writable||descriptor.configurable!==expected.descriptor.configurable)return false
      }
    }
    return true
  }catch{return false}
}
function cloneDnd5eHostTransactionInputInternal<T>(input:T,metadata?:OwnedCloneMetadata):T {
  const cloned = structuredClone(input)
  if(metadata)recordNativeOwnedCloneData(cloned,metadata)
  const visited = new WeakMap<object, object>()
  const restore = (source: unknown, target: unknown): unknown => {
    if (!source || typeof source !== 'object') return target
    if (receipts.has(source)) { if(metadata)metadata.safe=false;return source }
    if (!target || typeof target !== 'object') return target
    const prior = visited.get(source)
    if (prior) return prior
    visited.set(source, target)
    // A dynamic source key can read an inherited external target. It is not a
    // native allocation: reject by identity without probing it in any way.
    if(metadata&&metadata.safe&&!metadata.nodes.has(target))metadata.safe=false
    if (source instanceof Map && target instanceof Map) {
      if(metadata)metadata.safe=false
      const originals = [...source], copies = [...target]
      target.clear()
      originals.forEach(([key, value], index) => target.set(restore(key, copies[index][0]), restore(value, copies[index][1])))
    } else if (source instanceof Set && target instanceof Set) {
      if(metadata)metadata.safe=false
      const originals = [...source], copies = [...target]
      target.clear()
      originals.forEach((value, index) => target.add(restore(value, copies[index])))
    } else {
      const keys=Object.keys(source)
      // A new source key may invoke an inherited setter and leak the first
      // copy without changing its shape. Such writes must retain clone two.
      if(metadata&&metadata.safe){const node=metadata.nodes.get(target)!;if(keys.some(key=>!node.keys.includes(key)))metadata.safe=false}
      for (const key of keys) {
        const data = source as Record<string, unknown>, copy = target as Record<string, unknown>
        copy[key] = restore(data[key], copy[key])
      }
      for (const slot of slots) {
        const descriptor = Object.getOwnPropertyDescriptor(source, slot)
        if (descriptor && 'value' in descriptor && receipts.has(descriptor.value)) {
          Object.defineProperty(target, slot, { ...descriptor, value: descriptor.value })
          if(metadata&&metadata.safe)metadata.nodes.get(target)?.symbols.push({slot,descriptor})
        }
      }
    }
    return target
  }
  return restore(input, cloned) as T
}

/** Persistence may inspect capabilities, never reconstruct brands from JSON. */
export function dnd5eHostTransactionHasCapabilities(input:unknown):boolean{
 const visited=new WeakSet<object>()
 const visit=(value:unknown):boolean=>{
  if(!value||typeof value!=='object')return false
  if(receipts.has(value))return true
  if(visited.has(value))return false
  visited.add(value)
  if(Object.getOwnPropertySymbols(value).some(slot=>slots.has(slot)))return true
  if(value instanceof Map)return [...value].some(([key,row])=>visit(key)||visit(row))
  if(value instanceof Set)return [...value].some(visit)
  return Object.values(value).some(visit)
 }
 return visit(input)
}
