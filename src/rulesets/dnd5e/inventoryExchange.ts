export type { Dnd5eInventoryExchangeSelection } from './inventoryExchangeSelection'
import { dnd5eEnchantedInventoryInstanceIds } from './activeEffects'
import type { Character } from '../../types/character'
import type { Dnd5eCurrency, Dnd5eInventoryItemTemplate, Dnd5eInventoryMutationResult } from '../../types/inventory'
import { applyDnd5eInventoryMutation, applyDnd5eInventoryGrantBundle, dnd5eInventoryHasAuthorityGrantReceipt, dnd5eInventoryItemTemplate, normalizeDnd5eInventory } from './items'

const COPPER: Record<Dnd5eCurrency, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 }
export function dnd5eInventoryExchangeItemValueCp(item: Dnd5eInventoryItemTemplate): number | undefined {
  const value = item.spellcastingMaterial?.unitValueGp != null ? item.spellcastingMaterial.unitValueGp * 100
    : item.cost ? item.cost.amount * COPPER[item.cost.currency] : NaN
  const rounded = Math.round(value)
  return Number.isSafeInteger(rounded) && rounded > 0 && Math.abs(value - rounded) < 1e-8 ? rounded : undefined
}
function eligible(item: Dnd5eInventoryItemTemplate | undefined, tags: readonly string[]): item is Dnd5eInventoryItemTemplate {
  return !!item && !item.magicItem && !item.headlessEffects?.length && tags.every(tag => item.spellcastingMaterial?.tags.includes(tag))
}

export interface Dnd5eInventoryExchangePolicy {
  inputTags: readonly string[]
  outputTags: readonly string[]
  maximumValueCp: number
  maximumInclusive: boolean
  requiresOriginal: boolean
}

export type Dnd5eInventoryExchangeTemplateSource = 'registered-items' | 'registered-ammunition'

/** Host-only atomic settlement primitive. Caller must authorize the Activity and completed ritual separately. */
export function applyDnd5eInventoryExchange(characters: readonly Character[], input: {
  characterId: string
  receiptId: string
  expectedInventoryRevision: number
  inputs: readonly { instanceId: string; quantity: number }[]
  coins?: readonly { currency: Dnd5eCurrency; amount: number }[]
  output: { templateId: string; quantity: number }
  originalInstanceId?: string
}, policy: {
  inputTags: readonly string[]
  outputTags: readonly string[]
  maximumValueCp: number
  maximumInclusive: boolean
  requiresOriginal: boolean
}, options: { destination?: 'inventory' | 'scene' } = {}): Dnd5eInventoryMutationResult & { sceneItem?: { templateId: string; quantity: number; receiptId: string } } {
  const fail = (reason: Dnd5eInventoryMutationResult['reason']): Dnd5eInventoryMutationResult => ({ ok: false, reason, characters: [...characters] })
  if (!input.receiptId.trim() || input.receiptId.length > 250) return fail('invalid-receipt')
  const receiptId = `exchange:${input.receiptId}`
  if (dnd5eInventoryHasAuthorityGrantReceipt(characters, receiptId)) return { ok: true, characters: [...characters], deduplicated: true }
  const actor = characters.find(character => character.id === input.characterId)
  if (!actor) return fail('character-not-found')
  const inventory = normalizeDnd5eInventory(actor)
  const enchanted = new Set(dnd5eEnchantedInventoryInstanceIds(actor.dnd5eCombatState?.activeEffects))
  if (!Number.isSafeInteger(input.expectedInventoryRevision) || inventory.revision !== input.expectedInventoryRevision) return fail('stale-inventory-revision')
  if (!policy.inputTags.length || !policy.outputTags.length || !Number.isSafeInteger(policy.maximumValueCp) || policy.maximumValueCp < 1) return fail('invalid-target')
  if (input.inputs.length > 100 || (input.coins?.length ?? 0) > 5 ||
    !Number.isSafeInteger(input.output.quantity) || input.output.quantity < 1 || input.output.quantity > 1000) return fail('invalid-quantity')
  const output = dnd5eInventoryItemTemplate(input.output.templateId)
  if (!eligible(output, policy.outputTags)) return fail('invalid-target')
  const unitOutput = dnd5eInventoryExchangeItemValueCp(output)
  const outputValue = unitOutput == null ? NaN : unitOutput * input.output.quantity
  if (!Number.isSafeInteger(outputValue) || (policy.maximumInclusive ? outputValue > policy.maximumValueCp : outputValue >= policy.maximumValueCp)) return fail('invalid-target')
  if (policy.requiresOriginal || input.originalInstanceId) {
    const original = inventory.entries.find(entry => entry.instanceId === input.originalInstanceId)
    if (!original || original.templateId !== output.id || original.quantity < 1 || original.condition?.destroyed || original.planarState === 'ethereal' || enchanted.has(original.instanceId) || original.spellAlteration || original.sourceEffectTag || original.expiresAtWorldMinute != null) return fail('invalid-target')
  }
  const ids = new Set<string>(), currencies = new Set<Dnd5eCurrency>()
  let supplied = 0
  for (const selection of input.inputs) {
    if (ids.has(selection.instanceId) || selection.instanceId === input.originalInstanceId ||
      !Number.isSafeInteger(selection.quantity) || selection.quantity < 1) return fail('invalid-quantity')
    ids.add(selection.instanceId)
    const entry = inventory.entries.find(candidate => candidate.instanceId === selection.instanceId)
    const template = entry && dnd5eInventoryItemTemplate(entry.templateId)
    if (!entry || entry.condition?.destroyed || entry.planarState === 'ethereal' || enchanted.has(entry.instanceId) || !eligible(template, policy.inputTags) || entry.spellAlteration || entry.sourceEffectTag ||
      entry.expiresAtWorldMinute != null || entry.equippedSlot || inventory.entries.some(child => child.containerInstanceId === entry.instanceId)) return fail('invalid-target')
    if (entry.quantity < selection.quantity) return fail('insufficient-quantity')
    const unit = dnd5eInventoryExchangeItemValueCp(template)
    if (unit == null) return fail('invalid-target')
    supplied += unit * selection.quantity
  }
  for (const coin of input.coins ?? []) {
    if (!Object.prototype.hasOwnProperty.call(COPPER, coin.currency) || currencies.has(coin.currency) || !Number.isSafeInteger(coin.amount) || coin.amount < 1) return fail('invalid-currency')
    currencies.add(coin.currency)
    if ((inventory.currency?.[coin.currency] ?? 0) < coin.amount) return fail('insufficient-currency')
    supplied += coin.amount * COPPER[coin.currency]
  }
  if (!Number.isSafeInteger(supplied) || supplied !== outputValue) return fail('invalid-target')
  let staged = [...characters]
  for (const selection of input.inputs) {
    const result = applyDnd5eInventoryMutation(staged, { type: 'discard', characterId: input.characterId, ...selection })
    if (!result.ok) return fail(result.reason)
    staged = result.characters
  }
  for (const coin of input.coins ?? []) {
    const result = applyDnd5eInventoryMutation(staged, { type: 'adjust-currency', characterId: input.characterId, currency: coin.currency, delta: -coin.amount })
    if (!result.ok) return fail(result.reason)
    staged = result.characters
  }
  const granted = applyDnd5eInventoryGrantBundle(staged, { characterId: input.characterId, grants: options.destination === 'scene' ? [] : [input.output], receiptId })
  return granted.ok ? { ...granted, ...(options.destination === 'scene' ? { sceneItem: { ...input.output, receiptId } } : {}) } : fail(granted.reason)
}

