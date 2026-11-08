import {bountifulHostOperationSourceFacts} from './bountiful-host-operation.mjs'
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value)
const topLate=new Set(['savingThrowCounterattacks','shieldSpellcastingSavingThrows','effectRollDice','mechanicRolls','compositeSteps','airborneFallDamageRollsByCombatantId','attackDecoyRolls','optionalBonusDice','damageMitigationInterrupts'])
const topKeys=new Set(['transactionId','prepared','rolls','settleAttackCount','multiattackContinuation',...topLate])
const rollLate=new Set(['blessRoll','baneRoll','bardicInspirationRoll','cuttingWords','cuttingWordsDamage','postD20Adjustment','areaAttackAdvantageReaction','protectionReactionActorId','attackRetargetInterrupt','mountedAttackRedirect','shieldSpellReaction','uncannyDodge','deflectMissilesD10','tranquilitySave','damageRolls','traitDamageRolls','onHitEffectRolls','sizeDamageRolls','standAgainstTide','attackDecoyRoll'])
const rollKeys=new Set(['targetId','d20','d20Second','mode','dmFinalMode',...rollLate])
/** Only fields consumed by the actual monster facade may be appended. The
 * prepared graph, original raw faces, mode, source transaction and number of
 * originals remain exact; all new mechanics still run through that facade. */
function fixedOriginal(wire){
 const root=wire.nodes[wire.root?.ref],entry=(node,key)=>node.entries.find(row=>row[0]===key)?.[1]
 if(root?.kind!=='object'||root.entries.some(([key])=>!topKeys.has(key)))throw Error('native-source-keys')
 const rolls=wire.nodes[entry(root,'rolls')?.ref]
 if(rolls?.kind!=='array'||rolls.items.length!==1)throw Error('single-original-only')
 const slots=new Set()
 for(const ref of rolls.items){const node=wire.nodes[ref?.ref];if(node?.kind!=='object'||node.entries.some(([key])=>!rollKeys.has(key)))throw Error('native-roll-keys');slots.add(ref.ref)}
 const seen=new Map(),nodes=[]
 const visit=encoded=>{
  if(!record(encoded)||!Object.hasOwn(encoded,'ref'))return encoded
  if(seen.has(encoded.ref))return {ref:seen.get(encoded.ref)}
  const node=wire.nodes[encoded.ref],index=nodes.length;seen.set(encoded.ref,index);nodes.push(null)
  if(node?.kind==='object'){
   const ignored=encoded.ref===wire.root.ref?topLate:slots.has(encoded.ref)?new Set([...rollLate,'targetId']):new Set()
   nodes[index]={kind:'object',entries:node.entries.filter(([key,value])=>!ignored.has(key)&&!(record(value)&&value.undefined===true)).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,visit(value)])}
  }else if(['array','set'].includes(node?.kind))nodes[index]={kind:node.kind,items:node.items.map(visit)}
  else if(node?.kind==='map')nodes[index]={kind:node.kind,entries:node.entries.map(([key,value])=>[visit(key),visit(value)])}
  else if(node?.kind==='date')nodes[index]={kind:node.kind,value:node.value}
  else throw Error('native-source-node')
  return {ref:index}
 }
 return {root:visit(wire.root),nodes}
}
export function bountifulMonsterAfterDiceMatches(before,after){
 try{
  const a=bountifulHostOperationSourceFacts(before),b=bountifulHostOperationSourceFacts(after)
  if(!a||!b||a.rolls?.length!==1||b.rolls?.length!==1)return false
  const target=a.targetToken.id
  if([a,b].some(source=>source.rolls[0].targetId!==undefined&&source.rolls[0].targetId!==target))return false
  return JSON.stringify(fixedOriginal(before))===JSON.stringify(fixedOriginal(after))
 }catch{return false}
}
