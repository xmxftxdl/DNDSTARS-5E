import{captureDnd5eCompletedLongCastingWitness,restoreDnd5eCompletedLongCastingWitness,captureDnd5eCompletedExplorationCastingWitness,restoreDnd5eCompletedExplorationCastingWitness,type Dnd5eCompletedLongCastingWitness,type Dnd5eCompletedExplorationCastingWitness}from'./longCastingContinuity'
import type { Character } from '../../types/character'
import type { SharedCampaignTimeState } from '../../lib/campaignTime'
import type { Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { registerDnd5eHostReceipt } from './hostTransactionClone'
import { dnd5eLongCastingCanComplete, dnd5eLongCastingHasDuration, type Dnd5eLongCastingReceipt, type Dnd5eLongCastingBinding } from './longCastingContinuity'
import { normalizeDnd5eRestActivityWindow, openDnd5eRestActivityWindow, dnd5eRestActivityReceiptKey } from './restActivityWindows'

declare const brand: unique symbol
export interface Dnd5eRestCastingWindowReceipt { readonly [brand]: true }
export interface Dnd5eRestCastingBinding {
  packageId: string
  packageVersion: string
  activityId: string
  restEventId: string
  casting: Dnd5eLongCastingBinding
}
const issued = new WeakMap<Dnd5eRestCastingWindowReceipt, {
  binding: string
  characterId: string
  completedWorldMinute: number
  castingReceipt: Dnd5eLongCastingReceipt
}>()
const signature = (binding: Dnd5eRestCastingBinding) => JSON.stringify([
  binding.packageId, binding.packageVersion, binding.activityId, binding.restEventId,
  binding.casting.requestId, binding.casting.spellId, binding.casting.mapId,
  binding.casting.actorTokenId, binding.casting.actorCharacterId,
])

/** Host-only continuation of a rest window, not permission to execute an Activity.
 * The caller must still validate entitlement, definition and resource costs.
 * A wire copy of this receipt cannot extend a rest event. */
export function captureDnd5eRestCastingWindow(input: {
  character: Character
  clock: SharedCampaignTimeState
  binding: Dnd5eRestCastingBinding
  castingReceipt: Dnd5eLongCastingReceipt
}): Dnd5eRestCastingWindowReceipt | undefined {
  const { character, clock, binding } = input
  const window = openDnd5eRestActivityWindow(character, clock.worldMinute)
  if (!window || window.eventId !== binding.restEventId ||
    character.dnd5eWorldTimeAppliedMinute !== clock.worldMinute ||
    binding.casting.actorCharacterId !== character.id ||
    window.receipts[dnd5eRestActivityReceiptKey(binding.packageId, binding.activityId)] ||
    !clock.advances.some(advance => `${advance.kind}-complete` === window.event &&
      advance.toWorldMinute === window.completedWorldMinute &&
      (advance.beneficiaryCharacterIds == null || advance.beneficiaryCharacterIds.includes(character.id)))) return undefined
  const receipt = registerDnd5eHostReceipt(Object.freeze({})) as Dnd5eRestCastingWindowReceipt
  issued.set(receipt, { binding: signature(binding), characterId: character.id,
    completedWorldMinute: window.completedWorldMinute, castingReceipt: input.castingReceipt })
  return receipt
}

/** Returns the original window only after the bound Host cast finishes.
 * Uses the current character ledger, so another choice or rest cannot be undone. */
export function openDnd5eRestCastingWindow(input: {
  receipt: Dnd5eRestCastingWindowReceipt | undefined
  character: Character
  clock: SharedCampaignTimeState
  binding: Dnd5eRestCastingBinding
  state: Dnd5eHeadlessCombatState
  requiredSeconds?: number
}) {
  const stored = input.receipt && issued.get(input.receipt)
  const { character, clock, binding, state } = input
  const window = normalizeDnd5eRestActivityWindow(character.dnd5eRestActivityWindow, character.id)
  if (!stored || stored.binding !== signature(binding) || stored.characterId !== character.id ||
    !window || window.eventId !== binding.restEventId || window.completedWorldMinute !== stored.completedWorldMinute ||
    !Number.isSafeInteger(clock.worldMinute) || clock.worldMinute < stored.completedWorldMinute ||
    character.dnd5eWorldTimeAppliedMinute !== clock.worldMinute ||
    state.combatants[binding.casting.actorTokenId]?.campaignWorldMinute !== clock.worldMinute ||
    window.receipts[dnd5eRestActivityReceiptKey(binding.packageId, binding.activityId)] ||
    (input.requiredSeconds !== undefined && !dnd5eLongCastingHasDuration(stored.castingReceipt,binding.casting,input.requiredSeconds)) ||
    !dnd5eLongCastingCanComplete(stored.castingReceipt, binding.casting, state)) return undefined
  return window
}

export interface Dnd5eCompletedRestCastingWitness{
 schemaVersion:1;binding:Dnd5eRestCastingBinding;characterId:string;completedWorldMinute:number;requiredSeconds:number;
 casting:{kind:'combat';witness:Dnd5eCompletedLongCastingWitness}|{kind:'exploration';witness:Dnd5eCompletedExplorationCastingWitness}
}
function completedRestBindingClosed(value:Dnd5eRestCastingBinding):boolean{
 const allowed=['packageId','packageVersion','activityId','restEventId','casting'],castingKeys=['requestId','spellId','mapId','actorTokenId','actorCharacterId']
 const text=(value:unknown)=>typeof value==='string'&&value.length>0&&value.length<=640&&value.trim()===value
 return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>allowed.includes(key))&&allowed.slice(0,4).every(key=>text((value as unknown as Record<string,unknown>)[key]))&&!!value.casting&&typeof value.casting==='object'&&!Array.isArray(value.casting)&&Object.keys(value.casting).every(key=>castingKeys.includes(key))&&castingKeys.every(key=>text((value.casting as unknown as Record<string,unknown>)[key]))
}
/** Only a genuine issued rest window whose actual cast has finished can be
 * captured. A wire copy or an incomplete window cannot produce a witness. */
export function captureDnd5eCompletedRestCastingWitness(input:Parameters<typeof openDnd5eRestCastingWindow>[0]&{requiredSeconds:number}):Dnd5eCompletedRestCastingWitness|undefined{
 const stored=input.receipt&&issued.get(input.receipt),window=openDnd5eRestCastingWindow(input)
 if(!stored||!window)return undefined
 const binding=input.binding.casting,seconds=input.requiredSeconds
 const combat=input.state.active?captureDnd5eCompletedLongCastingWitness(stored.castingReceipt,binding,input.state,seconds):undefined
 const exploration=!input.state.active?captureDnd5eCompletedExplorationCastingWitness(stored.castingReceipt,binding,input.state,seconds):undefined
 if(!combat&&!exploration)return undefined
 return{schemaVersion:1,binding:structuredClone(input.binding),characterId:input.character.id,completedWorldMinute:stored.completedWorldMinute,requiredSeconds:seconds,casting:combat?{kind:'combat',witness:combat}:{kind:'exploration',witness:exploration!}}
}
/** Host-only restore of the completed stage retained inside the same private
 * parent. Current rest ledger, original event, owner, binding, duration and
 * campaign snapshot must still agree; this cannot reopen an already used rest. */
export function restoreDnd5eCompletedRestCastingWitness(witness:Dnd5eCompletedRestCastingWitness,input:Omit<Parameters<typeof openDnd5eRestCastingWindow>[0],'receipt'>&{requiredSeconds:number}):Dnd5eRestCastingWindowReceipt|undefined{
 if(!witness||Object.keys(witness).some(key=>!['schemaVersion','binding','characterId','completedWorldMinute','requiredSeconds','casting'].includes(key))||witness.schemaVersion!==1||!completedRestBindingClosed(witness.binding)||!completedRestBindingClosed(input.binding)||signature(witness.binding)!==signature(input.binding)||witness.characterId!==input.character.id||witness.characterId!==input.binding.casting.actorCharacterId||witness.requiredSeconds!==input.requiredSeconds)return undefined
 const window=normalizeDnd5eRestActivityWindow(input.character.dnd5eRestActivityWindow,input.character.id),choice=witness.casting
 if(!window||window.eventId!==input.binding.restEventId||window.completedWorldMinute!==witness.completedWorldMinute||window.receipts[dnd5eRestActivityReceiptKey(input.binding.packageId,input.binding.activityId)]||!input.clock.advances.some(advance=>advance.toWorldMinute===window.completedWorldMinute&&advance.kind+'-complete'===window.event&&(advance.beneficiaryCharacterIds==null||advance.beneficiaryCharacterIds.includes(input.character.id)))||!choice||Object.keys(choice).some(key=>!['kind','witness'].includes(key)))return undefined
 const restored=choice.kind==='combat'?restoreDnd5eCompletedLongCastingWitness(choice.witness,input.binding.casting,input.state,input.requiredSeconds):choice.kind==='exploration'?restoreDnd5eCompletedExplorationCastingWitness(choice.witness,input.binding.casting,input.state,input.requiredSeconds):undefined
 if(!restored)return undefined
 const receipt=registerDnd5eHostReceipt(Object.freeze({}))as Dnd5eRestCastingWindowReceipt
 issued.set(receipt,{binding:signature(input.binding),characterId:input.character.id,completedWorldMinute:window.completedWorldMinute,castingReceipt:restored})
 return openDnd5eRestCastingWindow({...input,receipt})?receipt:undefined
}
