import{bountifulDamageZeroSourceFacts}from'./bountiful-damage-zero-original.mjs'
/** Pure source projection. Neither this graph reader nor its return value is
 * a Native operation, a raw issuer or permission to publish a result. */
export function bountifulMonsterDamageZeroSourceFacts(wire){try{
 const facts=bountifulDamageZeroSourceFacts(wire);if(!facts)return null
 const object=ref=>{const node=wire.nodes?.[ref?.ref];if(node?.kind!=='object'||!Array.isArray(node.entries)||node.entries.some(row=>!Array.isArray(row)||row.length!==2||typeof row[0]!=='string'||['__proto__','prototype','constructor'].includes(row[0]))||new Set(node.entries.map(row=>row[0])).size!==node.entries.length)throw Error('object');return Object.fromEntries(node.entries)}
 const plain=(value,seen=new Set(),depth=0)=>{if(depth>100)throw Error('depth');if(value===undefined||value===null||['string','number','boolean'].includes(typeof value))return value;if(value?.undefined===true)return undefined;if(!Number.isSafeInteger(value?.ref)||seen.has(value.ref))throw Error('ref');const next=new Set(seen);next.add(value.ref);const node=wire.nodes?.[value.ref];if(node?.kind==='array')return node.items.map(v=>plain(v,next,depth+1));if(node?.kind==='object')return Object.fromEntries(Object.entries(object(value)).map(([k,v])=>[k,plain(v,next,depth+1)]));throw Error('data')}
 let source=object(wire.root);if(source.secondChanceHostOriginalVersion===1)source=object(source.input);const prepared=object(source.prepared),monster=object(prepared.monster)
 return{...facts,transactionId:plain(source.transactionId),resourceAction:plain(prepared.resourceAction),monsterId:plain(monster.id),rolls:plain(source.rolls)}
}catch{return null}}
