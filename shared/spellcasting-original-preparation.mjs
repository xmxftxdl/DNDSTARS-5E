import{bountifulDamageZeroQualifiedWire}from'./bountiful-damage-zero-original.mjs'
import{stormCastOriginalSourceFacts}from'./storm-cast-original.mjs'
const data=v=>!!v&&typeof v==='object'&&!Array.isArray(v),text=v=>typeof v==='string'&&v.length>0&&v.length<=2000
export function validSpellcastingOriginalRequirement(r){return data(r)&&Object.keys(r).length===6&&Object.keys(r).every(k=>['actorId','effectId','ability','dc','rollMode','requiredDiceCount'].includes(k))&&text(r.actorId)&&text(r.effectId)&&['str','dex','con','int','wis','cha'].includes(r.ability)&&Number.isSafeInteger(r.dc)&&r.dc>=0&&r.dc<=10000&&['normal','advantage','disadvantage'].includes(r.rollMode)&&r.requiredDiceCount===(r.rollMode==='normal'?1:2)}
/** Data inspection only. The native missing-phase issuer still establishes the
 * actual mode, prefix, ownership and original operation before any raw phase. */
export function spellcastingOriginalPreparationFacts(wire,requirement,timestamp){try{
 if(!validSpellcastingOriginalRequirement(requirement)||!Number.isSafeInteger(timestamp)||timestamp<=0)return null
 const root=wire?.nodes?.[wire?.root?.ref],allowed=['prepared','effectRolls','spellcastingSavingThrows','slowSpellDelayD20','savingThrowCounterattacks','savingThrowDisadvantageNegation','opportunityAttackSpell','mountedAttackRedirect','counterspellReaction','sourceActionInterruptionReaction','spellInterceptionReaction','tranquilitySave','targetTranquilitySaves','hostOriginalD20Replay']
 if(root?.kind!=='object'||!Array.isArray(root.entries)||root.entries.some(([key])=>!allowed.includes(key))||new Set(root.entries.map(([key])=>key)).size!==root.entries.length)return null
 const prior=root.entries.find(([key])=>key==='spellcastingSavingThrows')?.[1];if(prior!==undefined&&prior?.undefined!==true){const n=wire.nodes[prior?.ref];if(n?.kind!=='array'||n.items.length)return null}
 const qualified=bountifulDamageZeroQualifiedWire(wire);if(!qualified)return null
 const replay=qualified.replay;if(replay!==undefined&&(!data(replay)||Object.keys(replay).length!==4||Object.keys(replay).some(key=>!['parentId','sourceKey','effectTimestamp','facts'].includes(key))||replay.effectTimestamp!==timestamp||typeof replay.sourceKey!=='string'||!Array.isArray(replay.facts)||replay.facts.length))return null
 const facts=stormCastOriginalSourceFacts(qualified.base);if(!facts||facts.action.actorTokenId!==requirement.actorId||facts.actorToken?.id!==requirement.actorId||replay!==undefined&&replay.parentId!==facts.action.id)return null
 const character=facts.characters?.find(c=>c.id===facts.actorToken.characterId),effect=character?.dnd5eCombatState?.activeEffects?.find(e=>e.id===requirement.effectId)
 if(!effect||effect.spellcastingSave?.ability!==requirement.ability||effect.spellcastingSave?.dc!==requirement.dc)return null
 return{...facts,effect,replay}
 }catch{return null}}
/** Exact prepared graph projection: retain every reference, array order, value
 * and supported wire node; strip only the containing source's other fields. */
export function spellcastingPreparedWire(wire){try{const top=wire.nodes[wire.root.ref];if(top?.kind!=='object')return null;const entry=top.entries.find(([key])=>key==='prepared');if(!entry)return null;const nodes=[],seen=new Map(),visit=(v,depth=0)=>{if(depth>200)throw Error('depth');if(v===null||['string','number','boolean'].includes(typeof v))return v;if(v?.undefined===true)return{undefined:true};if(!Number.isSafeInteger(v?.ref)||v.ref<0||v.ref>=wire.nodes.length)throw Error('ref');if(seen.has(v.ref))return{ref:seen.get(v.ref)};const ref=nodes.length;seen.set(v.ref,ref);nodes.push(null);const n=wire.nodes[v.ref];let out;if(n.kind==='object')out={kind:n.kind,entries:n.entries.map(([k,x])=>[k,visit(x,depth+1)])};else if(n.kind==='array'||n.kind==='set')out={kind:n.kind,items:n.items.map(x=>visit(x,depth+1))};else if(n.kind==='map')out={kind:n.kind,entries:n.entries.map(([k,x])=>[visit(k,depth+1),visit(x,depth+1)])};else if(n.kind==='date')out={kind:n.kind,value:n.value};else throw Error('kind');nodes[ref]=out;return{ref}};const root=visit(entry[1]);return{schemaVersion:1,root,nodes}}catch{return null}}
