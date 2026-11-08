import{bountifulSpellDamageZeroBonusChoicesAppend}from'./bountifulSpellDamageZeroSavingLateSource'
import{bountifulDamageZeroBardicChoicesAppend}from'./bountifulDamageZeroSavingLateSource'
import type {BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {encodeSecondChanceParentWire,decodeSecondChanceParentWire,type SecondChanceParentWire} from '../../../src/lib/secondChanceParentWire'
import {captureSecondChancePreparedHostFacts,restoreSecondChancePreparedHostFactsAsync} from '../../../src/pages/maps/secondChancePreparedHostFacts'

export type BountifulContinuationReceipt=BountifulOriginalDieReceipt&{continuation?:{hostMemberId:string;source:SecondChanceParentWire}}

/** A restored equipment input carries a UI cursor, not a new facade choice.
 * Only the exact current protected journal may authorize that transport field;
 * the pure source comparator below continues rejecting arbitrary late fields. */
export function bountifulEquipmentInputWithoutTransport(receipt:BountifulOriginalDieReceipt,original:Record<string,unknown>,next:Record<string,unknown>):Record<string,unknown>{
 if(!Object.prototype.hasOwnProperty.call(next,'hostBountifulRollCursor'))return next
 if(Object.prototype.hasOwnProperty.call(original,'hostBountifulRollCursor')){
  if(original.hostBountifulRollCursor!==next.hostBountifulRollCursor)throw Error('bountiful-after-dice:foreign-equipment-transport-cursor')
  return next
 }
 const cursor=receipt.postOriginalCursor,expected=cursor?.cursor??original.hostOriginalDiceCursor
 if(receipt.originalAdapterId!=='equipment'||receipt.identity.occurrence!==0||typeof expected!=='number'||!Number.isSafeInteger(expected)||expected<1||expected>100000||next.hostBountifulRollCursor!==expected||cursor&&(cursor.hostMemberId!==receipt.identity.hostMemberId||cursor.rawRollId!==original.hostOriginalRollId||typeof original.hostOriginalDiceCursor!=='number'||cursor.cursor<original.hostOriginalDiceCursor||cursor.stageSignature!==JSON.stringify([receipt.postOriginalD20??[],receipt.postOriginalEquipmentD20??null])))throw Error('bountiful-after-dice:foreign-equipment-transport-cursor')
 const clean={...next};delete clean.hostBountifulRollCursor;return clean
}
type AbilityInput=Parameters<typeof import('../../../src/rulesets/dnd5e/abilityCheckAction').resolvePreparedDnd5eAbilityCheck>[0]
const lateAbilityChoices=['bardicInspirationRoll','peerlessSkillRoll','darkOnesOwnLuckRoll','cuttingWords','optionalBonusDice','strokeOfLuck','postD20Adjustment'] as const satisfies readonly (keyof AbilityInput)[]
type EquipmentInput=Parameters<typeof import('../../../src/rulesets/dnd5e/equipmentAttackAction').resolvePreparedDnd5eEquipmentAttack>[0]
// These fields are actual post-original-d20 choices of the concrete equipment
// facade. The full facade revalidates resources, dice and targets before any
// normal ACK can publish. Pre-roll redirects/mode/prepared state stay pinned.
const lateEquipmentChoices=['halflingLuckyD20','halflingLuckyD20Second','savageAttacksRoll','wholeWeaponDamageReroll','missedWeaponAttackReroll','blessRoll','baneRoll','bardicInspirationRoll','grantedDieWeaponDamageRoll','grantedDieArmorClassRoll','strokeOfLuck','cuttingWords','cuttingWordsDamage','postD20Adjustment','shieldSpellReaction','uncannyDodge','deflectMissilesD10','stunningStrikeSaveD20','stunningStrikeSaveD20Second','stunningStrikeSaveHalflingLuckyD20','stunningStrikeSaveHalflingLuckyD20Second','stunningStrikeSaveBlessRoll','stunningStrikeSaveBaneRoll','stunningStrikeSaveRerollResourceKey','stunningStrikeSaveRerollD20','stunningStrikeSaveRerollD20Second','stunningStrikeBardicInspirationRoll','stunningStrikeDarkOnesOwnLuckRoll','openingAttackSavingThrow','hurlThroughHellDamageRolls','standAgainstTide','declarativeIntentRolls','declarativeIntentPayloads','declarativeTargetReaction','classDamageRolls','inventoryEffectRolls','damageMitigationInterrupts','shieldSpellcastingSavingThrows','airborneFallDamageRollsByCombatantId'] as const satisfies readonly (keyof EquipmentInput)[]
type SpellInput=Parameters<typeof import('../../../src/rulesets/dnd5e/spellAction').resolvePreparedDnd5eSpellCast>[0]
const lateSpellChoices=["openingAttackSavingThrow","attackBlessRoll","attackBaneRoll","attackPostD20Adjustment","cuttingWords","cuttingWordsDamage","standAgainstTide","shieldSpellReaction","shieldSpellReactionTargetIds","shieldSuccessfulSaveNegationTargetIds","savingThrowBlessRoll","savingThrowBaneRoll","savingThrowPostD20Adjustment","savingThrowRerollResourceKey","savingThrowRerollD20","savingThrowRerollD20Second","bardicInspirationRoll","darkOnesOwnLuckRoll","optionalBonusDice","damageMitigationInterrupts","hurlThroughHellDamageRolls","overchannelSelfDamageRolls","legendaryResistanceTargetIds","forcedMovements","additionalEffectRolls","delayedEffectRolls","empoweredRerolls","spellDamageDieRerolls","spellDamageMaxDieBonus","bestowCurseDamageRolls","sourceSlotSpellHealingTargets","airborneFallDamageRollsByCombatantId"] as const satisfies readonly (keyof SpellInput)[]
type ClassInput=Parameters<typeof import('./classFeatureAction').resolvePreparedDnd5eClassFeature>[0]
const latePresenceChoices=['savingThrowBlessRoll','savingThrowBaneRoll','savingThrowHalflingLuckyD20','savingThrowHalflingLuckyD20Second','savingThrowRerollResourceKey','savingThrowRerollD20','savingThrowRerollD20Second','bardicInspirationRoll','darkOnesOwnLuckRoll'] as const satisfies readonly(keyof ClassInput)[]
const lateFields:Readonly<Record<string,readonly string[]>>={equipment:['damageRolls'],spell:['effectRolls']}
/** Only previously empty damage dice may arrive after the original-d20 choice.
 * Original raw d20s, target, source, modifiers, prepared state and every other
 * input field remain byte-for-byte pinned to the Host's original parent. */
export function assertBountifulAfterDiceSource(adapterId:string,original:Record<string,unknown>,next:Record<string,unknown>){
 const allow=lateFields[adapterId]??[]
 const keys=new Set([...Object.keys(original),...Object.keys(next)])
 for(const key of keys){
  if(JSON.stringify(original[key])===JSON.stringify(next[key]))continue
  if(adapterId==='opportunity-move'&&key==='stage'&&original.stage==='opportunity'&&next.stage===undefined&&next.movement&&typeof next.movement==='object')continue
  if(adapterId==='opportunity-move'&&key==='movement'&&original.movement===undefined&&original.stage==='opportunity'&&next.stage===undefined&&next.movement&&typeof next.movement==='object'&&!Array.isArray(next.movement)&&!Object.keys(next.movement).some(key=>key==='prepared'||key==='transactionId'))continue
  if(adapterId==='opportunity-move'&&key==='opportunity'){
   const before=original[key],after=next[key],record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
   if(record(before)&&record(after)&&Array.isArray(before.damageRolls)&&before.damageRolls.length===0&&Array.isArray(after.damageRolls)&&after.damageRolls.length<=128&&after.damageRolls.every(face=>typeof face==='number'&&Number.isInteger(face)&&face>=1&&face<=10000)&&JSON.stringify({...before,damageRolls:after.damageRolls})===JSON.stringify(after))continue
   throw Error('bountiful-after-dice:changed-opportunity-original')
  }
  if((adapterId==='equipment'||adapterId==='spell')&&key==='hostDamageZeroSavingThrows'&&(adapterId==='spell'?bountifulSpellDamageZeroBonusChoicesAppend:bountifulDamageZeroBardicChoicesAppend)(original[key],next[key]))continue
   if(adapterId==='equipment'&&key==='prepared'){

   const before=original[key],after=next[key]
   const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
   if(record(before)&&record(after)){
    const priorIds=before.declarativeIntentFeatureIds,nextIds=after.declarativeIntentFeatureIds
    if(Array.isArray(priorIds)&&Array.isArray(nextIds)&&priorIds.every(id=>typeof id==='string')&&nextIds.every(id=>typeof id==='string')&&new Set(nextIds).size===nextIds.length&&JSON.stringify(priorIds.filter(id=>nextIds.includes(id)))===JSON.stringify(nextIds)&&JSON.stringify({...before,declarativeIntentFeatureIds:nextIds})===JSON.stringify(after))continue
   }
   throw Error('bountiful-after-dice:changed-original-input')
  }
  if(adapterId==='spell'&&key==='targetSavingThrows'&&Array.isArray(original[key])&&Array.isArray(next[key])){assertBountifulSpellPostSaveRows(original[key],next[key]);continue}
  // These are concrete actual-facade post-d20 fields. Only a previously absent
  // choice may arrive; the real facade still checks the held bonus/resource.
  if(adapterId==='class-feature'&&original[key]===undefined&&latePresenceChoices.some(field=>field===key)){
   const prepared=original.prepared;if(!prepared||typeof prepared!=='object'||!('intimidatingPresence'in prepared)||!prepared.intimidatingPresence)throw Error('bountiful-class-after-dice:actual-presence-required');continue
  }
  if(adapterId==='spell'&&original[key]===undefined&&lateSpellChoices.some(field=>field===key))continue
  if(adapterId==='ability-check'&&original[key]===undefined&&lateAbilityChoices.some(field=>field===key))continue
  if(adapterId==='equipment'&&original[key]===undefined&&lateEquipmentChoices.some(field=>field===key))continue
  if(!allow.includes(key)||!Array.isArray(original[key])||original[key].length!==0||!Array.isArray(next[key])||next[key].length>128||next[key].some((face:unknown)=>typeof face!=='number'||!Number.isInteger(face)||face<1||face>10000))throw Error('bountiful-after-dice:changed-original-input')
 }
}
export function encodeBountifulAfterDiceSource(source:unknown){return encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(source))}
export async function readBountifulAfterDiceSource(receipt:BountifulContinuationReceipt){
 if(!receipt.continuation)return undefined
 if(receipt.continuation.hostMemberId!==receipt.identity.hostMemberId)throw Error('bountiful-after-dice:foreign-host')
 return restoreSecondChancePreparedHostFactsAsync(decodeSecondChanceParentWire(receipt.continuation.source))
}

/** Only completed, actual prior targets may acquire concrete post-save choices.
 * Original raw d20s, target and pre-original choices are never replaced. The
 * actual facade must still validate every bonus and debit before the next raw. */
export function assertBountifulSpellPostSaveRows(before:readonly unknown[],after:readonly unknown[]){
 const late=['blessRoll','baneRoll','rerollResourceKey','rerollD20','rerollD20Second','bardicInspirationRoll','darkOnesOwnLuckRoll','legendaryResistance','postD20Adjustment'] as const satisfies readonly (keyof import('./headlessCombatEngine').Dnd5eSpellTargetSavingThrowRoll)[]
 if(before.length!==after.length)throw Error('bountiful-spell-post-save:changed-target-count')
 for(let index=0;index<before.length;index++){
  const isDataRow=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
  const prior=before[index],next=after[index]
  if(!isDataRow(prior)||!isDataRow(next)||typeof prior.targetId!=='string'||!prior.targetId||typeof prior.d20!=='number'||!Number.isInteger(prior.d20)||prior.d20<0||prior.d20>20)throw Error('bountiful-spell-post-save:changed-target')
  if(prior.d20===0){if(JSON.stringify(prior)!==JSON.stringify(next))throw Error('bountiful-spell-post-save:changed-unrolled-sentinel');continue}
  for(const field of new Set([...Object.keys(prior),...Object.keys(next)])){
   const key=field
   if(JSON.stringify(prior[key])===JSON.stringify(next[key]))continue
   if(prior[key]===undefined&&late.some(allowed=>allowed===key))continue
   throw Error('bountiful-spell-post-save:changed-original-row')
  }
 }
}
