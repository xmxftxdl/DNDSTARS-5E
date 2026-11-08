import {assertBountifulAfterDiceSource,assertBountifulSpellPostSaveRows} from './bountifulLuckAfterDice'
import type {BountifulSpellOriginalInput} from './bountifulSpellTargetRaw'
const same=(left:unknown,right:unknown)=>JSON.stringify(left)===JSON.stringify(right)
/** Only append real native counterattack inputs for actual save recipients.
 * This does not prove a hit or grant an attack: the concrete spell facade must
 * still validate the source feature, reaction, dice and resulting save bypass. */
export function assertBountifulSpellCounterattackAppend(before:unknown,after:Pick<BountifulSpellOriginalInput,'prepared'|'savingThrowCounterattacks'>){
 const previous=before??[],next=after.savingThrowCounterattacks??[]
 if(!Array.isArray(previous))throw Error('bountiful-spell-stream:invalid-counterattack-prefix')
 if(next.length<previous.length||!same(previous,next.slice(0,previous.length)))throw Error('bountiful-spell-stream:counterattack-prefix-changed')
 for(const use of next.slice(previous.length)){
  if(!after.prepared.targetSavingThrows?.some(row=>row.targetToken.id===use.targetId)||use.sourceId!==after.prepared.actorToken.id||use.attack.actorId!==use.targetId||use.attack.targetId!==use.sourceId||use.ability!==(after.prepared.spell.saveAbility??after.prepared.spell.unwillingSaveAbility)||!Number.isSafeInteger(use.occurrence)||use.occurrence<0||!use.featureId)throw Error('bountiful-spell-stream:actual-counterattack-context-required')
 }
}

/** A stored earlier raw boundary may be a prefix of the actual later native
 * continuation. Only typed target/capture appends and existing late choices
 * differ. This grants no replacement state or replay ledger authority. */
export function assertBountifulStoredReadySourcePrefix(before:object,after:object){
 const prior=Object.fromEntries(Object.entries(before)),next=Object.fromEntries(Object.entries(after))
 const stripped=(value:Record<string,unknown>)=>Object.fromEntries(Object.entries(value).filter(([key])=>!['hostOriginalD20Replay','targetSavingThrows','hostOriginalSpellSavingThrows','savingThrowCounterattacks'].includes(key)))
 assertBountifulAfterDiceSource('spell',stripped(prior),stripped(next))
 const previousCounters=prior.savingThrowCounterattacks??[],nextCounters=next.savingThrowCounterattacks??[]
 if(!Array.isArray(previousCounters)||!Array.isArray(nextCounters)||nextCounters.length<previousCounters.length||!same(previousCounters,nextCounters.slice(0,previousCounters.length)))throw Error('bountiful-ready-prefix:changed-counterattacks')
 const beforeRows=prior.targetSavingThrows,afterRows=next.targetSavingThrows
 if(beforeRows!==undefined){if(!Array.isArray(beforeRows)||!Array.isArray(afterRows)||afterRows.length<beforeRows.length)throw Error('bountiful-ready-prefix:changed-raw-targets');assertBountifulSpellPostSaveRows(beforeRows,afterRows.slice(0,beforeRows.length))}
 const beforeBook=prior.hostOriginalSpellSavingThrows,afterBook=next.hostOriginalSpellSavingThrows
 if(beforeBook!==undefined&&(!Array.isArray(beforeBook)||!Array.isArray(afterBook)||afterBook.length<beforeBook.length||!same(beforeBook,afterBook.slice(0,beforeBook.length))))throw Error('bountiful-ready-prefix:changed-raw-captures')
}
