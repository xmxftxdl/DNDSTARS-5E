import{dnd5eHostTransactionHasCapabilities}from'../rulesets/dnd5e/hostTransactionClone'
type Encoded=null|boolean|string|number|{ref:number}|{undefined:true}
type Node={kind:'object';entries:Array<[string,Encoded]>}|{kind:'array'|'set';items:Encoded[]}|{kind:'map';entries:Array<[Encoded,Encoded]>}|{kind:'date';value:string}
export interface SecondChanceParentWire{schemaVersion:1;root:Encoded;nodes:Node[]}
/** Data only. Capability-bearing originals must go through their real issuer's
 * recovery protocol; this codec never mints or copies a Host brand. */
export function encodeSecondChanceParentWire(input:unknown):SecondChanceParentWire{
 if(dnd5eHostTransactionHasCapabilities(input))throw Error('second-chance-parent:capability-recovery-required')
 const nodes:Node[]=[],seen=new WeakMap<object,number>()
 const encode=(value:unknown):Encoded=>{
  if(value===undefined)return{undefined:true}
  if(value===null||typeof value==='boolean'||typeof value==='string')return value
  if(typeof value==='number'){if(!Number.isFinite(value))throw Error('second-chance-parent:nonfinite-input');return value}
  if(typeof value!=='object')throw Error('second-chance-parent:nondata-input')
  const prior=seen.get(value);if(prior!==undefined)return{ref:prior}
  if(nodes.length>=100000||Object.getOwnPropertySymbols(value).length)throw Error('second-chance-parent:unsupported-input')
  const ref=nodes.length;seen.set(value,ref);nodes.push({kind:'array',items:[]})
  let node:Node
  if(Array.isArray(value))node={kind:'array',items:value.map(encode)}
  else if(value instanceof Map)node={kind:'map',entries:[...value].map(([key,row])=>[encode(key),encode(row)])}
  else if(value instanceof Set)node={kind:'set',items:[...value].map(encode)}
  else if(value instanceof Date)node={kind:'date',value:value.toISOString()}
  else{if(![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error('second-chance-parent:unsupported-prototype');node={kind:'object',entries:Object.entries(value).map(([key,row])=>[key,encode(row)])}}
  nodes[ref]=node;return{ref}
 }
 return{schemaVersion:1,root:encode(input),nodes}
}
export function decodeSecondChanceParentWire(wire:SecondChanceParentWire):unknown{
 if(wire?.schemaVersion!==1||!Array.isArray(wire.nodes)||wire.nodes.length>100000)throw Error('second-chance-parent:invalid-wire')
 const values:unknown[]=wire.nodes.map(node=>node.kind==='object'?{}:node.kind==='array'?[]:node.kind==='set'?new Set():node.kind==='map'?new Map():node.kind==='date'?new Date(node.value):undefined)
 const decode=(value:Encoded):unknown=>{
  if(value===null||typeof value==='boolean'||typeof value==='string'||typeof value==='number'&&Number.isFinite(value))return value
  if(value&&typeof value==='object'&&Object.keys(value).length===1){if('undefined'in value&&value.undefined===true)return undefined;if('ref'in value&&Number.isSafeInteger(value.ref)&&value.ref>=0&&value.ref<values.length)return values[value.ref]}
  throw Error('second-chance-parent:invalid-wire-value')
 }
 for(let index=0;index<wire.nodes.length;index++){
  const node=wire.nodes[index],target=values[index]
  if(node.kind==='object'){
   if(!Array.isArray(node.entries)||new Set(node.entries.map(row=>row[0])).size!==node.entries.length)throw Error('second-chance-parent:invalid-wire-object')
   for(const[key,value]of node.entries){if(typeof key!=='string')throw Error('second-chance-parent:invalid-wire-key');Object.defineProperty(target,key,{value:decode(value),enumerable:true,writable:true,configurable:true})}
  }else if(node.kind==='array'){if(!Array.isArray(node.items))throw Error('second-chance-parent:invalid-wire-array');for(const item of node.items)(target as unknown[]).push(decode(item))}
  else if(node.kind==='set'){if(!Array.isArray(node.items))throw Error('second-chance-parent:invalid-wire-set');for(const value of node.items)(target as Set<unknown>).add(decode(value))}
  else if(node.kind==='map'){if(!Array.isArray(node.entries))throw Error('second-chance-parent:invalid-wire-map');for(const[key,value]of node.entries)(target as Map<unknown,unknown>).set(decode(key),decode(value))}
  else if(node.kind!=='date'||!Number.isFinite((target as Date).valueOf()))throw Error('second-chance-parent:invalid-wire-node')
 }
 return decode(wire.root)
}

