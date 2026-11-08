import { bountifulDamageZeroSourceFacts as inspectPreparedData } from './bountiful-damage-zero-original.mjs'
const data=v=>!!v&&typeof v==='object'&&!Array.isArray(v)
const text=v=>typeof v==='string'&&v.length>0&&v.length<=2000
const closed=(v,keys)=>data(v)&&Object.keys(v).every(k=>keys.includes(k))
/** Pure data inspection only. The imported graph reader supplies no Bountiful,
 * Native operation, owner answer, die or publication authority. */
export function stormFuryOriginalSourceFacts(wire){try{
 const facts=inspectPreparedData(wire);if(!facts)return null
 const object=ref=>{const n=wire.nodes[ref?.ref];if(n?.kind!=='object'||!Array.isArray(n.entries)||new Set(n.entries.map(r=>r[0])).size!==n.entries.length||n.entries.some(r=>!Array.isArray(r)||r.length!==2||typeof r[0]!=='string'||['__proto__','prototype','constructor'].includes(r[0])))throw Error('object');return Object.fromEntries(n.entries)}
 const plain=(v,seen=new Set(),depth=0)=>{if(depth>100)throw Error('depth');if(v===undefined||v===null||['string','number','boolean'].includes(typeof v))return v;if(v?.undefined===true)return undefined;if(!Number.isSafeInteger(v?.ref)||seen.has(v.ref))throw Error('ref');const next=new Set(seen);next.add(v.ref);const n=wire.nodes[v.ref];if(n?.kind==='array')return n.items.map(x=>plain(x,next,depth+1));return Object.fromEntries(Object.entries(object(v)).map(([k,x])=>[k,plain(x,next,depth+1)]))}
 let source=object(wire.root);if(source.secondChanceHostOriginalVersion===1)source=object(source.input)
 if(['hostStormFuryChoices','hostOriginalD20Replay','result','snapshot','application'].some(k=>Object.hasOwn(source,k)))return null
 const prepared=object(source.prepared)
 return{...facts,transactionId:plain(source.transactionId),monsterId:prepared.monster?plain(object(prepared.monster).id):undefined,resourceAction:prepared.resourceAction?plain(prepared.resourceAction):undefined}
 }catch{return null}}
export function validStormFuryOwnerFrame(frame){
 if(!closed(frame,['index','event','attack','options'])||!Number.isSafeInteger(frame.index)||frame.index<0||!data(frame.event)||frame.event.type!=='attack-resolved'||frame.event.hit!==true||!text(frame.event.actorId)||!text(frame.event.targetId)||frame.event.actorId===frame.event.targetId||!(frame.event.attackMode==='melee'||frame.event.attackMode==='unarmed'||frame.event.attackDelivery==='melee')||!data(frame.attack)||!Array.isArray(frame.options)||!frame.options.length)return false
 return new Set(frame.options.map(o=>o.featureId)).size===frame.options.length&&frame.options.every(o=>closed(o,['featureId','ownerId','attackerId','sorcererLevel','damage','damageType','saveAbility','saveDc','maximumPushFeet'])&&text(o.featureId)&&o.ownerId===frame.event.targetId&&o.attackerId===frame.event.actorId&&Number.isInteger(o.sorcererLevel)&&o.sorcererLevel>=14&&o.sorcererLevel<=20&&o.damage===o.sorcererLevel&&o.damageType==='lightning'&&o.saveAbility==='str'&&Number.isInteger(o.saveDc)&&o.saveDc>0&&o.maximumPushFeet===20)
}
export function stormFuryOwnerWindowId(parentId,index){return'storm-fury-owner:'+JSON.stringify([parentId,index])}
export function validStormFuryOwnerDecision(book,decision){return closed(decision,['kind','featureId'])&&(decision.kind==='decline'&&Object.keys(decision).length===1||decision.kind==='use'&&Object.keys(decision).length===2&&book.frame.options.some(o=>o.featureId===decision.featureId))}
