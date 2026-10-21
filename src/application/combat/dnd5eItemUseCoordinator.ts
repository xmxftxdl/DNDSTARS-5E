import type { Dnd5eOwnedCompanionMapContext } from '../../rulesets/dnd5e/ownedCompanionProximity'
import type { CombatTransaction } from '../../lib/combatTransaction'
import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import {
  applyDnd5eInventoryMutation,
  normalizeDnd5eInventory,
} from '../../rulesets/dnd5e/items'
import type { Character } from '../../types/character'
import type { createDnd5eMapCombatSnapshot } from '../../rulesets/dnd5e/mapBridge'
import { dnd5eInventoryEntryUseAction } from '../../rulesets/dnd5e/items'
import type { Dnd5eInventoryMutationFailure } from '../../types/inventory'

type Token = Parameters<typeof createDnd5eMapCombatSnapshot>[0]['map']['tokens'][number]

export type Dnd5eAuthoritativeItemUseResult =
  | {
      ok: true
      characters: Character[]
      source: Character
      target: Character
      targetTokenPatch?: Pick<Token, 'dnd5eCombatState'>
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
  /** Authoritative map target; never taken from the player's effect payload. */
  targetToken?: Token
  instanceId: string
  useActionId?: string
  healingRolls?: number[]
  spellSlotLevel?: number
  healingContext?: Dnd5eOwnedCompanionMapContext
  turnEconomy?: Dnd5eTurnEconomyCounts
  transaction: CombatTransaction
}): Dnd5eAuthoritativeItemUseResult {
  const source = input.characters.find((character) => character.id === input.sourceCharacterId)
  if (!source) return { ok: false, reason: 'character-not-found', transaction: input.transaction }
  const inventory = normalizeDnd5eInventory(source)
  const entry = inventory.entries.find((entry) => entry.instanceId === input.instanceId)
  if (!entry) {
    return { ok: false, reason: 'item-not-found', transaction: input.transaction }
  }
  const removal = dnd5eInventoryEntryUseAction(entry, input.useActionId)?.effect.kind === 'remove-active-effects'
  const unlinkedTarget = removal && input.targetToken && !input.targetToken.characterId ? input.targetToken : undefined
  if (unlinkedTarget?.type === 'obstacle' || (removal && input.targetToken?.characterId && input.targetToken.characterId !== input.targetCharacterId)) {
    return { ok: false, reason: 'invalid-target', transaction: input.transaction }
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
    useActionId: input.useActionId,
    healingRolls: input.healingRolls,
    spellSlotLevel: input.spellSlotLevel,
    receiptId: input.transaction.id,
    expectedInventoryRevision: inventory.revision ?? 0,
  }, {
    healingContext: input.healingContext,
    turnEconomy: input.turnEconomy,
    transaction: input.transaction,
    effectRemovalTarget: unlinkedTarget ? {
      activeEffects: unlinkedTarget.dnd5eCombatState?.activeEffects,
      conditions: unlinkedTarget.dnd5eCombatState?.conditions ?? [],
    } : undefined,
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
    targetTokenPatch: unlinkedTarget && result.effectRemovalTargetProjection ? {
      dnd5eCombatState: { ...unlinkedTarget.dnd5eCombatState, ...result.effectRemovalTargetProjection },
    } : undefined,
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
