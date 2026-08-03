import {
  previewDnd5eUnsupportedAirborneFalls,
  resolveDnd5eHeadlessAction,
  type Dnd5eAction,
  type Dnd5eActionResult,
  type Dnd5eHeadlessCombatState,
  type Dnd5eUnsupportedAirborneFallPreview,
} from './headlessCombatEngine'

export type Dnd5eAirborneFallDamageRolls = Readonly<Record<string, readonly number[]>>
export type Dnd5eAirborneFallPreview = Dnd5eUnsupportedAirborneFallPreview

/**
 * Shared two-phase boundary for synchronous Headless facades.
 *
 * A first call without fall rolls returns the authoritative list of falls that
 * require dice. The host then replays the same action with those dice, allowing
 * the engine to commit the original action and every resulting fall atomically.
 */
export function resolveDnd5eActionWithAirborneFallPreview(
  state: Dnd5eHeadlessCombatState,
  action: Dnd5eAction,
  airborneFallDamageRollsByCombatantId?: Dnd5eAirborneFallDamageRolls,
  options?: Parameters<typeof resolveDnd5eHeadlessAction>[2],
): {
  result: Dnd5eActionResult
  airborneFalls?: readonly Dnd5eUnsupportedAirborneFallPreview[]
} {
  const actionWithFallRolls: Dnd5eAction = {
    ...action,
    airborneFallDamageRollsByCombatantId,
  }
  const fallPreview = airborneFallDamageRollsByCombatantId == null
    ? previewDnd5eUnsupportedAirborneFalls(state, actionWithFallRolls)
    : undefined
  const airborneFalls = fallPreview?.ok && fallPreview.falls.length > 0
    ? fallPreview.falls
    : undefined
  return {
    result: resolveDnd5eHeadlessAction(state, actionWithFallRolls, options),
    airborneFalls,
  }
}
