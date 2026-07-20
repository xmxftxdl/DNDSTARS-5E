import type { D20RollMode } from '../contracts'

export interface Dnd5eRollModeSource {
  active: boolean
  reason: string
}

export interface Dnd5eRollModeResolution {
  mode: D20RollMode
  advantageReasons: readonly string[]
  disadvantageReasons: readonly string[]
}

function activeReasons(sources: readonly Dnd5eRollModeSource[] | undefined): string[] {
  return [...new Set((sources ?? []).filter((source) => source.active).map((source) => source.reason))]
}

/**
 * D&D 5e only cares whether at least one advantage and/or disadvantage source
 * exists. Multiple sources never stack; one source on each side cancels all of
 * them and produces a normal roll.
 */
export function resolveDnd5eRollMode(input: {
  requestedMode?: D20RollMode
  advantage?: readonly Dnd5eRollModeSource[]
  disadvantage?: readonly Dnd5eRollModeSource[]
}): Dnd5eRollModeResolution {
  const advantageReasons = activeReasons([
    ...(input.requestedMode === 'advantage' ? [{ active: true, reason: 'requested' }] : []),
    ...(input.advantage ?? []),
  ])
  const disadvantageReasons = activeReasons([
    ...(input.requestedMode === 'disadvantage' ? [{ active: true, reason: 'requested' }] : []),
    ...(input.disadvantage ?? []),
  ])
  const hasAdvantage = advantageReasons.length > 0
  const hasDisadvantage = disadvantageReasons.length > 0
  return {
    mode: hasAdvantage === hasDisadvantage ? 'normal' : hasAdvantage ? 'advantage' : 'disadvantage',
    advantageReasons,
    disadvantageReasons,
  }
}

export function imposeDnd5eRollDisadvantage(
  mode: D20RollMode,
  reason: string,
): Dnd5eRollModeResolution {
  return resolveDnd5eRollMode({
    requestedMode: mode,
    disadvantage: [{ active: true, reason }],
  })
}
