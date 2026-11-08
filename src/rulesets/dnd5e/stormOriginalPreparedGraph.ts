import {cloneDnd5eHostTransactionInput} from './hostTransactionClone'
import {encodeSecondChanceParentWire} from '../../lib/secondChanceParentWire'
function sameValue(a:unknown,b:unknown){
 if(Object.is(a,b))return true
 try{return JSON.stringify(encodeSecondChanceParentWire(a))===JSON.stringify(encodeSecondChanceParentWire(b))}catch{return false}
}
/** Restore the whole original graph, including its cross-field references.
 * A genuinely changed late prepared property is retained for the normal strict
 * native/source checks; this function signs or authorizes nothing. */
export function restoreStormOriginalPreparedGraph<T extends object>(original:T,live:T):T{
 const restored=cloneDnd5eHostTransactionInput(original),late=cloneDnd5eHostTransactionInput(live)
 for(const key of new Set([...Reflect.ownKeys(original),...Reflect.ownKeys(live)])){
  if(key==='state')continue
  const before=Object.getOwnPropertyDescriptor(original,key),after=Object.getOwnPropertyDescriptor(live,key)
  // A presentation spread omits private/nonenumerable original metadata. Its
  // absence is not a new prepared choice and must not erase the original graph.
  if(!after&&before&&(typeof key==='symbol'||before.enumerable===false))continue
  const same=before&&after&&before.enumerable===after.enumerable&&before.configurable===after.configurable&&before.writable===after.writable&&before.get===after.get&&before.set===after.set&&
   ('value'in before&&'value'in after?(typeof key==='symbol'?Object.is(before.value,after.value):sameValue(before.value,after.value)):!('value'in before)&&!('value'in after))
  if(same)continue
  if(!after){if(!Reflect.deleteProperty(restored,key))throw Error('storm-original-prepared:late-property-not-removable');continue}
  const descriptor=Object.getOwnPropertyDescriptor(late,key)!
  Object.defineProperty(restored,key,descriptor)
 }
 return restored
}
