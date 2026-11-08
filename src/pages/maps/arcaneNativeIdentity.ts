/** Exact mechanical identity; arrays stay ordered and missing differs from undefined. */
export function sameArcaneNativeData(left:unknown,right:unknown):boolean{
 const canonical=(value:unknown):unknown=>{
  if(value===undefined)return{$undefined:true}
  if(value instanceof Map)return{$map:[...value].map(([key,row])=>[canonical(key),canonical(row)]).sort((a,b)=>JSON.stringify(a[0]).localeCompare(JSON.stringify(b[0])))}
  if(value instanceof Set)return{$set:[...value].map(canonical).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))}
  if(value instanceof Date)return{$date:value.toISOString()}
  if(Array.isArray(value))return value.map(canonical)
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,row])=>[key,canonical(row)]))
  return value
 }
 return JSON.stringify(canonical(left))===JSON.stringify(canonical(right))
}
