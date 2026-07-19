import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'

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
  if (economy.movement && economy.objectInteraction) return economy
  const movement = normalizeMovementFeet(speed)
  return {
    ...economy,
    movement: economy.movement ?? { current: movement, max: movement },
    objectInteraction: economy.objectInteraction ?? { current: 1, max: 1 },
  }
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
      movement: { ...economy.movement, current: economy.movement.current - amount },
    },
  }
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
