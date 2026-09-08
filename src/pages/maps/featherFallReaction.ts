import {
  createDnd5eMapCombatSnapshot,
  dnd5eCombatantCanRemainAirborne,
  dnd5eCombatantPairKey,
} from '../../application/combat/dnd5eCombatRules'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import type { InitiativeEntry } from '../../components/map/InitiativeTracker'

export interface Dnd5eFeatherFallReactionContext {
  combatId: string
  round: number
  turnSlotId?: string
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  casterTokenId: string
}

/**
 * A forced fall may happen outside a player-action transaction (for example a
 * monster's on-hit push). Give that concrete occurrence its own scope so an
 * answered Feather Fall window from an earlier attack can never be replayed.
 */
export function dnd5eForcedFallInterruptTransactionScope(input: {
  activeTransactionId?: string | null
  combatId: string
  occurrenceId: string
}): string {
  const activeTransactionId = input.activeTransactionId?.trim()
  return activeTransactionId || `${input.combatId}:forced-fall:${input.occurrenceId}`
}

/** Host-rebuildable trigger candidates; the client cannot author falling state. */
export function dnd5eFeatherFallReactionTargetIds(
  input: Dnd5eFeatherFallReactionContext,
): string[] {
  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.combatId,
    round: input.round,
    turnSlotId: input.turnSlotId,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const caster = snapshot.state.combatants[input.casterTokenId]
  if (!caster || caster.currentHp <= 0) return []
  return Object.values(snapshot.state.combatants).flatMap((target) => {
    const distance = snapshot.state.distanceFeetByCombatantPair?.[
      dnd5eCombatantPairKey(caster.id, target.id)
    ] ?? (target.id === caster.id ? 0 : Number.POSITIVE_INFINITY)
    return target.currentHp > 0 && target.airborne === true &&
      !dnd5eCombatantCanRemainAirborne(target) && distance <= 60
      ? [target.id]
      : []
  })
}

export function dnd5eFeatherFallReactionTargetsAreValid(
  input: Dnd5eFeatherFallReactionContext & { targetTokenIds: readonly string[] },
): boolean {
  const targetIds = [...new Set(input.targetTokenIds)]
  if (targetIds.length < 1 || targetIds.length > 5 || targetIds.length !== input.targetTokenIds.length) {
    return false
  }
  const eligible = new Set(dnd5eFeatherFallReactionTargetIds(input))
  return targetIds.every((targetId) => eligible.has(targetId))
}
