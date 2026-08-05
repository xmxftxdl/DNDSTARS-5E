import type { CombatTransaction } from '../../lib/combatTransaction'
import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import {
  applyDnd5eInventoryMutation,
  normalizeDnd5eInventory,
} from '../../rulesets/dnd5e/items'
import type { Character } from '../../types/character'
import type { Dnd5eInventoryMutationFailure } from '../../types/inventory'

export type Dnd5eAuthoritativeItemUseResult =
  | {
      ok: true
      characters: Character[]
      source: Character
      target: Character
      healingRolled?: number
      healingApplied?: number
      spellSlotLevel?: number
      spellSlotsRecovered?: number
      requiresDmAdjudication?: string
      spentEconomy?: 'action' | 'bonusAction'
      deduplicated?: boolean
      transaction?: CombatTransaction
    }
  | {
      ok: false
      reason: Dnd5eInventoryMutationFailure | 'character-not-found' | 'item-not-found' | 'target-not-found'
      transaction?: CombatTransaction
    }

/**
 * Pure Host-side item settlement. The caller owns target/range validation and
 * publishes the returned character snapshot together with map/combat state.
 */
export function resolveDnd5eAuthoritativeItemUse(input: {
  characters: readonly Character[]
  sourceCharacterId: string
  targetCharacterId?: string
  instanceId: string
  healingRolls?: number[]
  spellSlotLevel?: number
  turnEconomy?: Dnd5eTurnEconomyCounts
  transaction: CombatTransaction
}): Dnd5eAuthoritativeItemUseResult {
  const source = input.characters.find((character) => character.id === input.sourceCharacterId)
  if (!source) return { ok: false, reason: 'character-not-found', transaction: input.transaction }
  const inventory = normalizeDnd5eInventory(source)
  if (!inventory.entries.some((entry) => entry.instanceId === input.instanceId)) {
    return { ok: false, reason: 'item-not-found', transaction: input.transaction }
  }
  const targetCharacterId = input.targetCharacterId ?? source.id
  if (!input.characters.some((character) => character.id === targetCharacterId)) {
    return { ok: false, reason: 'target-not-found', transaction: input.transaction }
  }
  const result = applyDnd5eInventoryMutation(input.characters, {
    type: 'use',
    characterId: source.id,
    targetCharacterId,
    instanceId: input.instanceId,
    healingRolls: input.healingRolls,
    spellSlotLevel: input.spellSlotLevel,
    receiptId: input.transaction.id,
    expectedInventoryRevision: inventory.revision ?? 0,
  }, {
    turnEconomy: input.turnEconomy,
    transaction: input.transaction,
  })
  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason ?? 'item-not-found',
      transaction: result.transaction,
    }
  }
  const nextSource = result.characters.find((character) => character.id === source.id)
  const nextTarget = result.characters.find((character) => character.id === targetCharacterId)
  if (!nextSource || !nextTarget) {
    return { ok: false, reason: 'character-not-found', transaction: result.transaction }
  }
  return {
    ok: true,
    characters: result.characters,
    source: nextSource,
    target: nextTarget,
    healingRolled: result.healingRolled,
    healingApplied: result.healingApplied,
    spellSlotLevel: result.spellSlotLevel,
    spellSlotsRecovered: result.spellSlotsRecovered,
    requiresDmAdjudication: result.requiresDmAdjudication,
    spentEconomy: result.spentEconomy,
    deduplicated: result.deduplicated,
    transaction: result.transaction,
  }
}
