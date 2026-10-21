import { normalizeDnd5eSubmergedBreathing } from './submerged-breathing-state.mjs'

/** Deterministic breath accounting shared by Headless and server time transactions.
 * The caller resolves effective capabilities and applies any returned collapse.
 */
export function advanceSubmergedBreathingStep(input) {
  if (!Number.isInteger(input.constitutionScore) || input.constitutionScore < 1 || input.constitutionScore > 30 ||
    !Number.isSafeInteger(input.elapsedSeconds) || input.elapsedSeconds < 0 ||
    typeof input.stepKey !== 'string' || !input.stepKey.length || input.stepKey.length > 512 ||
    typeof input.canBreathe !== 'boolean' || typeof input.targetTurnStart !== 'boolean')
    throw new Error('invalid-submerged-breathing-step')
  if (input.state && !normalizeDnd5eSubmergedBreathing(input.state)) throw new Error('invalid-submerged-breathing-state')
  const extraBreath = input.holdBreathSeconds
  if (extraBreath != null && (!Number.isSafeInteger(extraBreath) || extraBreath < 1 || extraBreath > 86_400))
    throw new Error('invalid-intrinsic-breath-duration')
  if (input.canBreathe) return { dropToZero: false, blocksHealingAndStabilization: false }
  const elapsedSeconds = input.state?.lastStepKey === input.stepKey ? 0 : input.elapsedSeconds
  const modifier = Math.floor((input.constitutionScore - 10) / 2)
  const breathCapacitySeconds = Math.max(30, (1 + modifier) * 60, extraBreath ?? 0)
  const previous = input.state ?? { schemaVersion: 1, breathSeconds: breathCapacitySeconds, breathCapacitySeconds,
    survivalSeconds: Math.max(1, modifier) * 6, collapsed: false, lastStepKey: '' }
  // Capacity changes retain elapsed time; an exhausted breath cannot be refilled by a buff.
  const adjustedBreath = previous.breathSeconds === 0 ? 0 : previous.breathCapacitySeconds == null
    ? Math.min(previous.breathSeconds, breathCapacitySeconds)
    : Math.max(0, breathCapacitySeconds - (previous.breathCapacitySeconds - previous.breathSeconds))
  const breathSeconds = Math.max(0, adjustedBreath - elapsedSeconds)
  const survivalSeconds = Math.max(0, previous.survivalSeconds - Math.max(0, elapsedSeconds - adjustedBreath))
  const collapsed = previous.collapsed || input.targetTurnStart && breathSeconds === 0 && survivalSeconds === 0
  return { state: { schemaVersion: 1, breathSeconds, breathCapacitySeconds, survivalSeconds, collapsed, lastStepKey: input.stepKey,
    ...(previous.pendingCollapseAtSeconds != null ? { pendingCollapseAtSeconds: previous.pendingCollapseAtSeconds } : {}) },
    dropToZero: collapsed && !previous.collapsed, blocksHealingAndStabilization: collapsed }
}
