import type {
  Dnd5eTurnEconomyByToken,
  Dnd5eTurnEconomyCounts,
} from '../../lib/sharedCombatTypes'

export type Dnd5eCountedTurnResource = 'action' | 'bonusAction' | 'reaction' | 'objectInteraction'

function normalizeMovementFeet(speed: number): number {
  return Math.max(0, Math.floor(Number.isFinite(speed) ? speed : 0))
}

export function createDnd5eTurnEconomyCounts(turnKey: string, speed = 30): Dnd5eTurnEconomyCounts {
  const movement = normalizeMovementFeet(speed)
  return {
    turnKey,
    attacksUsed: 0,
    action: { current: 1, max: 1 },
    bonusAction: { current: 1, max: 1 },
    reaction: { current: 1, max: 1 },
    objectInteraction: { current: 1, max: 1 },
    movement: { current: movement, max: movement },
  }
}

/** 为热更新或旧共享快照补齐 5e 移动池。 */
export function normalizeDnd5eTurnEconomyCounts(
  economy: Dnd5eTurnEconomyCounts,
  speed = 30,
): Dnd5eTurnEconomyCounts {
  const movement = normalizeMovementFeet(speed)
  const currentMovement = economy.movement
  const normalizedMovement = currentMovement
    ? (() => {
        const previousMaximum = normalizeMovementFeet(currentMovement.max)
        const previousCurrent = normalizeMovementFeet(currentMovement.current)
        const previousSpent = currentMovement.spent == null
          ? Math.max(0, previousMaximum - Math.min(previousCurrent, previousMaximum))
          : normalizeMovementFeet(currentMovement.spent)
        if (previousMaximum === movement) return {
          current: previousCurrent,
          max: previousMaximum,
          ...(previousSpent > 0 || currentMovement.spent != null ? { spent: previousSpent } : {}),
        }
        const extraMovement = Math.max(0, previousCurrent - previousMaximum)
        return {
          current: Math.max(0, movement - previousSpent) + extraMovement,
          max: movement,
          ...(previousSpent > 0 || currentMovement.spent != null ? { spent: previousSpent } : {}),
        }
      })()
    : { current: movement, max: movement }
  if (
    economy.objectInteraction &&
    currentMovement &&
    normalizedMovement.current === currentMovement.current &&
    normalizedMovement.max === currentMovement.max
  ) return economy
  return {
    ...economy,
    movement: normalizedMovement,
    objectInteraction: economy.objectInteraction ?? { current: 1, max: 1 },
  }
}

/**
 * Dash-style effects extend only the current turn's remaining movement. The
 * maximum remains the creature's walking-speed baseline so later speed
 * normalization cannot mistake a temporary Dash grant for a speed change.
 */
export function grantDnd5eMovement(
  economy: Dnd5eTurnEconomyCounts,
  amount: number,
): Dnd5eTurnEconomyCounts {
  const granted = normalizeMovementFeet(amount)
  if (granted <= 0) return economy
  return {
    ...economy,
    movement: {
      ...economy.movement,
      current: normalizeMovementFeet(economy.movement.current) + granted,
    },
  }
}

export interface Dnd5eReactiveReactionRefresh {
  actorId: string
  turnKey: string
  reactionAvailable: boolean
  speed?: number
}

/**
 * Mirrors the Headless Reactive refresh into the Host's shared economy.
 * Only the reaction pool and turn identity change; an off-turn refresh must
 * not restore the creature's action, bonus action, or movement.
 */
export function refreshDnd5eReactiveReactionEconomies(
  current: Dnd5eTurnEconomyByToken,
  refreshes: readonly Dnd5eReactiveReactionRefresh[],
): Dnd5eTurnEconomyByToken {
  if (refreshes.length === 0) return current
  const next = { ...current }
  for (const refresh of refreshes) {
    const economy = normalizeDnd5eTurnEconomyCounts(
      next[refresh.actorId] ??
        createDnd5eTurnEconomyCounts(refresh.turnKey, refresh.speed),
      refresh.speed,
    )
    next[refresh.actorId] = {
      ...economy,
      turnKey: refresh.turnKey,
      reaction: {
        current: refresh.reactionAvailable ? 1 : 0,
        max: 1,
      },
    }
  }
  return next
}

export function spendDnd5eTurnResource(
  economy: Dnd5eTurnEconomyCounts,
  resource: Dnd5eCountedTurnResource,
): { ok: true; economy: Dnd5eTurnEconomyCounts } | { ok: false; economy: Dnd5eTurnEconomyCounts } {
  const pool = economy[resource] ?? { current: 1, max: 1 }
  if (pool.current < 1) return { ok: false, economy }
  return {
    ok: true,
    economy: {
      ...economy,
      [resource]: { ...pool, current: pool.current - 1 },
    },
  }
}

/**
 * Mirrors the authoritative Headless turn flags back into the shared UI
 * economy. Effects such as Slow can consume the other action type without
 * emitting a second ordinary resource-spent event.
 */
export function projectDnd5eHeadlessTurnEconomy(
  economy: Dnd5eTurnEconomyCounts,
  turn: {
    actionAvailable: boolean
    bonusActionAvailable: boolean
    reactionAvailable: boolean
    objectInteractionAvailable?: boolean
    movementRemaining: number
    movementSpent?: number
  },
  effectiveSpeed?: number,
): Dnd5eTurnEconomyCounts {
  const normalizedEconomy = effectiveSpeed == null
    ? economy
    : normalizeDnd5eTurnEconomyCounts(economy, effectiveSpeed)
  return {
    ...normalizedEconomy,
    action: {
      ...normalizedEconomy.action,
      current: turn.actionAvailable ? normalizedEconomy.action.current : 0,
    },
    bonusAction: {
      ...normalizedEconomy.bonusAction,
      current: turn.bonusActionAvailable ? normalizedEconomy.bonusAction.current : 0,
    },
    reaction: {
      ...normalizedEconomy.reaction,
      current: turn.reactionAvailable ? normalizedEconomy.reaction.current : 0,
    },
    objectInteraction: {
      ...(normalizedEconomy.objectInteraction ?? { current: 1, max: 1 }),
      current: turn.objectInteractionAvailable === false
        ? 0
        : normalizedEconomy.objectInteraction?.current ?? 1,
    },
    movement: {
      ...normalizedEconomy.movement,
      current: normalizeMovementFeet(turn.movementRemaining),
      ...(turn.movementSpent != null
        ? { spent: normalizeMovementFeet(turn.movementSpent) }
        : {}),
    },
  }
}

export function spendDnd5eMovement(
  economy: Dnd5eTurnEconomyCounts,
  feet: number,
): { ok: true; economy: Dnd5eTurnEconomyCounts } | { ok: false; economy: Dnd5eTurnEconomyCounts } {
  const amount = normalizeMovementFeet(feet)
  if (amount > economy.movement.current) return { ok: false, economy }
  return {
    ok: true,
    economy: {
      ...economy,
      movement: {
        ...economy.movement,
        current: economy.movement.current - amount,
        spent: normalizeMovementFeet(economy.movement.spent ?? 0) + amount,
      },
    },
  }
}

/** Movement already spent this turn, with a migration fallback for old snapshots. */
export function dnd5eTurnMovementSpent(economy: Dnd5eTurnEconomyCounts): number {
  if (economy.movement.spent != null) return normalizeMovementFeet(economy.movement.spent)
  const maximum = normalizeMovementFeet(economy.movement.max)
  const current = normalizeMovementFeet(economy.movement.current)
  return Math.max(0, maximum - Math.min(current, maximum))
}

export function grantDnd5eActionSurge(economy: Dnd5eTurnEconomyCounts): Dnd5eTurnEconomyCounts {
  return {
    ...economy,
    action: {
      current: economy.action.current + 1,
      max: economy.action.max + 1,
    },
  }
}
