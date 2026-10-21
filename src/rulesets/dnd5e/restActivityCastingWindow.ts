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
