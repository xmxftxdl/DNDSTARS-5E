const data=value=>!!value&&typeof value==='object'&&!Array.isArray(value)
const text=value=>typeof value==='string'&&value.length>0&&value.length<=2000&&value.trim()===value
const integer=value=>Number.isSafeInteger(value)&&value>=0
/** This is an actual Host operation descriptor, never a SharedPlayerAction. */
export function validBountifulHostOperation(value){
 return data(value)&&Object.keys(value).every(key=>['kind','version','adapterId','parentId','mapId','combatId','hostMemberId','actorTokenId','targetTokenId','actionId','rawRollId','rawCursor'].includes(key))&&value.kind==='native-host-operation'&&value.version===1&&value.adapterId==='monster'&&[value.parentId,value.mapId,value.combatId,value.hostMemberId,value.actorTokenId,value.targetTokenId,value.actionId,value.rawRollId].every(text)&&integer(value.rawCursor)&&value.rawCursor>0&&value.rawCursor<=100000
}

/** Read only the concrete, data-only monster source fields needed by the HTTP
 * authority. This is not a capability decoder or an arbitrary object evaluator. */
export function bountifulHostOperationSourceFacts(wire){
 try{
  const object=ref=>{const node=wire.nodes[ref?.ref];if(node?.kind!=='object'||!Array.isArray(node.entries))throw Error('object');return Object.fromEntries(node.entries)}
  const plain=(value,depth=0)=>{
   if(depth>100)throw Error('depth')
   if(value===undefined||value===null||['string','number','boolean'].includes(typeof value))return value
   if(value?.undefined===true)return undefined
   const node=wire.nodes[value?.ref]
   if(node?.kind==='array')return node.items.map(item=>plain(item,depth+1))
   if(node?.kind==='object')return Object.fromEntries(node.entries.map(([key,item])=>[key,plain(item,depth+1)]))
   throw Error('non-json-field')
  }
  const source=object(wire.root),prepared=object(source.prepared),state=object(prepared.state)
  const actors=object(state.combatants),turns=Object.fromEntries(Object.entries(actors).map(([id,ref])=>{const actor=object(ref),turn=object(actor.turn);return[id,{actionAvailable:plain(turn.actionAvailable),bonusActionAvailable:plain(turn.bonusActionAvailable),reactionAvailable:plain(turn.reactionAvailable)}]}))
  return {transactionId:plain(source.transactionId),map:plain(prepared.map),characters:plain(prepared.characters),actorToken:plain(prepared.actorToken),targetToken:plain(prepared.targetToken),resourceAction:plain(prepared.resourceAction),rolls:plain(source.rolls),combatId:plain(state.combatId),round:plain(state.round),initiativeIndex:plain(state.initiativeIndex),initiativeOrder:plain(state.initiativeOrder),initiativeSlotIds:state.initiativeSlotIds===undefined?undefined:plain(state.initiativeSlotIds),turns}
 }catch{return null}
}

/** Final native publication must carry precisely the materials from its real
 * result. This reader accepts no capability and cannot issue a native parent. */
export function bountifulHostOperationResultFacts(wire){
 try{
  const object=ref=>{const node=wire.nodes[ref?.ref];if(node?.kind!=='object')throw Error('object');return Object.fromEntries(node.entries)}
  const plain=(value,depth=0)=>{
   if(depth>100)throw Error('depth')
   if(value===null||['string','number','boolean'].includes(typeof value))return value
   if(value?.undefined===true)return undefined
   const node=wire.nodes[value?.ref]
   if(node?.kind==='array')return node.items.map(item=>plain(item,depth+1))
   if(node?.kind==='object')return Object.fromEntries(node.entries.map(([key,item])=>[key,plain(item,depth+1)]))
   throw Error('non-json-field')
  }
  const source=object(wire.root),application=object(source.application),result=object(source.result),state=object(result.state)
  return {ok:plain(result.ok),map:plain(application.map),characters:plain(application.characters),combatId:plain(state.combatId),round:plain(state.round),initiativeIndex:plain(state.initiativeIndex)}
 }catch{return null}
}

/** Reindex reachable wire nodes after replacing only the concrete monster
 * rolls[].damageRolls slots. Every other field, alias, Map and Set stays bound. */
function withoutMonsterDamage(wire){
 const entry=(ref,key)=>wire.nodes[ref?.ref]?.kind==='object'?wire.nodes[ref.ref].entries.find(row=>row[0]===key)?.[1]:undefined
 const rolls=wire.nodes[entry(wire.root,'rolls')?.ref]
 if(rolls?.kind!=='array'||!rolls.items.length||rolls.items.length>128)throw Error('rolls')
 const slots=new Set()
 for(const roll of rolls.items){const node=wire.nodes[roll?.ref];if(node?.kind!=='object'||!node.entries.some(row=>row[0]==='damageRolls'))throw Error('damage');slots.add(roll.ref)}
 const seen=new Map(),nodes=[]
 const value=encoded=>{
  if(!data(encoded)||!Object.prototype.hasOwnProperty.call(encoded,'ref'))return encoded
  const index=encoded.ref;if(seen.has(index))return{ref:seen.get(index)}
  const node=wire.nodes[index],id=nodes.length;seen.set(index,id);nodes.push(null)
  if(node?.kind==='object')nodes[id]={kind:'object',entries:node.entries.map(([key,item])=>[key,slots.has(index)&&key==='damageRolls'?'authenticated-monster-damage-slot':value(item)])}
  else if(['array','set'].includes(node?.kind))nodes[id]={kind:node.kind,items:node.items.map(value)}
  else if(node?.kind==='map')nodes[id]={kind:'map',entries:node.entries.map(([key,item])=>[value(key),value(item)])}
  else if(node?.kind==='date')nodes[id]={kind:'date',value:node.value}
  else throw Error('node')
  return{ref:id}
 }
 const root=value(wire.root);return{root,nodes}
}
export function bountifulMonsterDamageContinuationMatches(before,after){
 try{
  const a=bountifulHostOperationSourceFacts(before),b=bountifulHostOperationSourceFacts(after)
  return !!a&&!!b&&a.rolls.length===b.rolls.length&&a.rolls.every((roll,index)=>Array.isArray(roll.damageRolls)&&roll.damageRolls.length===0&&Array.isArray(b.rolls[index].damageRolls)&&b.rolls[index].damageRolls.length<=128&&b.rolls[index].damageRolls.every(group=>Array.isArray(group)&&group.length<=128&&group.every(face=>Number.isInteger(face)&&face>=1&&face<=10000)))&&JSON.stringify(withoutMonsterDamage(before))===JSON.stringify(withoutMonsterDamage(after))
 }catch{return false}
}

/** Only the real prepared source is shared by pre-raw issuance and the later
 * concrete facade input. Original dice and cost decisions have separate facts. */
export function bountifulHostPreparedWireSignature(wire){
 try{
  const root=wire.nodes[wire.root?.ref],prepared=root?.kind==='object'?root.entries.find(row=>row[0]==='prepared')?.[1]:undefined
  if(!prepared||!Object.prototype.hasOwnProperty.call(prepared,'ref'))return null
  const seen=new Map(),nodes=[]
  const value=encoded=>{
   if(!data(encoded)||!Object.prototype.hasOwnProperty.call(encoded,'ref'))return encoded
   const index=encoded.ref;if(seen.has(index))return{ref:seen.get(index)}
   const node=wire.nodes[index],id=nodes.length;seen.set(index,id);nodes.push(null)
   if(node?.kind==='object')nodes[id]={kind:'object',entries:node.entries.map(([key,item])=>[key,value(item)])}
   else if(['array','set'].includes(node?.kind))nodes[id]={kind:node.kind,items:node.items.map(value)}
   else if(node?.kind==='map')nodes[id]={kind:'map',entries:node.entries.map(([key,item])=>[value(key),value(item)])}
   else if(node?.kind==='date')nodes[id]={kind:'date',value:node.value}
   else throw Error('node')
   return{ref:id}
  }
  const ref=value(prepared);return JSON.stringify({root:ref,nodes})
 }catch{return null}
}
