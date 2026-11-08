import{bountifulDamageZeroSourceFacts as inspectPreparedSourceData}from'./bountiful-damage-zero-original.mjs'
const data=v=>!!v&&typeof v==='object'&&!Array.isArray(v),text=v=>typeof v==='string'&&v.length>0&&v.length<=2000,closed=(v,keys)=>data(v)&&Object.keys(v).every(k=>keys.includes(k))
/** Data inspection only: this helper reads the original prepared graph. It
 * grants no Bountiful, saving-throw, owner-consent or physical-die authority. */
export function stormCastOriginalSourceFacts(wire){try{
 const allowed=['transactionId','prepared','effectRolls','spellcastingSavingThrows','slowSpellDelayD20','savingThrowCounterattacks','savingThrowDisadvantageNegation','opportunityAttackSpell','mountedAttackRedirect','counterspellReaction','sourceActionInterruptionReaction','spellInterceptionReaction','tranquilitySave','targetTranquilitySaves'];const root=wire?.nodes?.[wire?.root?.ref];if(root?.kind!=='object'||!Array.isArray(root.entries)||root.entries.some(([key])=>!allowed.includes(key))||!['prepared','effectRolls'].every(key=>root.entries.some(([name])=>name===key))||new Set(root.entries.map(([key])=>key)).size!==root.entries.length)return null
 const rolls=wire.nodes[root.entries.find(([key])=>key==='effectRolls')?.[1]?.ref];if(rolls?.kind!=='array'||rolls.items.some(v=>!Number.isInteger(v)||v<1||v>100))return null
 const f=inspectPreparedSourceData(wire),transaction=root.entries.find(([name])=>name==='transactionId');return f?.action?.type==='dnd5e-spell-cast'&&f.action.dnd5eSpellCast?{...f,...(transaction?{transactionId:transaction[1]}:{})}:null
}catch{return null}}
export function validStormCastOriginalFrame(frame){
 if(!closed(frame,['id','parentId','ordinal','actorId','spellId','slotLevel','spellDamageTypes','targetIds','options'])||!['id','parentId','actorId','spellId'].every(k=>text(frame[k]))||!Number.isSafeInteger(frame.ordinal)||frame.ordinal<0||!Number.isSafeInteger(frame.slotLevel)||frame.slotLevel<1||frame.slotLevel>9)return false
 if(!Array.isArray(frame.spellDamageTypes)||!frame.spellDamageTypes.length||!frame.spellDamageTypes.some(t=>t==='lightning'||t==='thunder')||frame.spellDamageTypes.some(t=>typeof t!=='string')||new Set(frame.spellDamageTypes).size!==frame.spellDamageTypes.length)return false
 if(!Array.isArray(frame.targetIds)||frame.targetIds.some(id=>!text(id))||new Set(frame.targetIds).size!==frame.targetIds.length||!Array.isArray(frame.options)||!frame.options.length||new Set(frame.options.map(o=>o?.featureId)).size!==frame.options.length)return false
 if(frame.options.some(o=>!closed(o,['featureId','classLevel','damage'])||!text(o.featureId)||!Number.isSafeInteger(o.classLevel)||o.classLevel<6||o.classLevel>20||o.damage!==Math.floor(o.classLevel/2)))return false
 return frame.id===JSON.stringify(['storm-cast-eruption',frame.parentId,frame.ordinal,frame.actorId,frame.spellId,frame.slotLevel])
}
