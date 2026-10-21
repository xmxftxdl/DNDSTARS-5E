import { advanceSubmergedBreathingStep } from '../../../shared/submerged-breathing-step.mjs'
import { dnd5eActiveEnvironmentalCapabilities, dnd5eActiveSubmerged, type Dnd5eActiveEffectInstance } from './activeEffects'

import { normalizeDnd5eSubmergedBreathing, type Dnd5eSubmergedBreathingState } from '../../../shared/submerged-breathing-state.mjs'
export { normalizeDnd5eSubmergedBreathing, type Dnd5eSubmergedBreathingState } from '../../../shared/submerged-breathing-state.mjs'

/** Apply a contiguous Host campaign interval, excluding rounds already charged in combat. */
export function advanceDnd5eSubmergedBreathingAtCampaignTime(input:
  Omit<Parameters<typeof advanceDnd5eSubmergedBreathing>[0], 'elapsedSeconds' | 'stepKey'> & {
    fromSeconds: number; toSeconds: number; creditedCombatRounds?: number
  }) {
  const { fromSeconds, toSeconds } = input
  const credit = input.creditedCombatRounds ?? 0
  if (!Number.isSafeInteger(fromSeconds) || fromSeconds < 0 || !Number.isSafeInteger(toSeconds) || toSeconds < fromSeconds ||
    !Number.isSafeInteger(credit) || credit < 0 || credit > Math.floor((toSeconds - fromSeconds) / 6))
    throw new Error('invalid-submerged-campaign-clock')
  const cursor = input.state?.campaignClockSeconds
  if (cursor != null && cursor !== fromSeconds && cursor !== toSeconds)
    throw new Error('stale-submerged-campaign-clock')
  const elapsedSeconds = cursor === toSeconds ? 0 : toSeconds - fromSeconds - credit * 6
  const result = advanceDnd5eSubmergedBreathing({ ...input, elapsedSeconds, stepKey: `campaign:${toSeconds}` })
  // Combat must re-anchor after an exploration interval rather than charge those seconds again.
  return { ...result, state: result.state ? { ...result.state, campaignClockSeconds: toSeconds } : undefined }
}

/** Re-anchor on a new combat without replenishing air; only Host round advances spend seconds. */
export function advanceDnd5eSubmergedBreathingAtCombatRound(input:
  Omit<Parameters<typeof advanceDnd5eSubmergedBreathing>[0], 'elapsedSeconds' | 'stepKey'> & { combatId: string; round: number }) {
  if (!input.combatId || input.combatId.length > 256 || !Number.isSafeInteger(input.round) || input.round < 0)
    throw new Error('invalid-submerged-breathing-clock')
  const previous = input.state?.combatClock
  if (previous?.combatId === input.combatId && input.round < previous.round) throw new Error('stale-submerged-breathing-clock')
  const elapsedSeconds = previous?.combatId === input.combatId ? (input.round - previous.round) * 6 : 0
  const result = advanceDnd5eSubmergedBreathing({ ...input, elapsedSeconds,
    stepKey: `${input.combatId}:${input.round}:${input.targetTurnStart ? 'start' : 'sync'}` })
  return { ...result, state: result.state ? { ...result.state,
    ...(input.state?.campaignClockSeconds != null ? { campaignClockSeconds: input.state.campaignClockSeconds } : {}),
    combatClock: { combatId: input.combatId, round: input.round } } : undefined }
}

/** 2014/SRD 5.1 suffocation. Caller applies collapse at the target's next turn start. */
export function advanceDnd5eSubmergedBreathing(input: {
  state?: Dnd5eSubmergedBreathingState
  effects: readonly Dnd5eActiveEffectInstance[] | undefined
  constitutionScore: number
  intrinsic?: { canBreatheWater?: boolean; doesNotNeedAir?: boolean; holdBreathSeconds?: number }
  elapsedSeconds: number
  stepKey: string
  targetTurnStart: boolean
}): { state?: Dnd5eSubmergedBreathingState; dropToZero: boolean; blocksHealingAndStabilization: boolean } {
  if (!Number.isInteger(input.constitutionScore) || input.constitutionScore < 1 || input.constitutionScore > 30 ||
    !Number.isSafeInteger(input.elapsedSeconds) || input.elapsedSeconds < 0 || !input.stepKey || input.stepKey.length > 512)
    throw new Error('invalid-submerged-breathing-step')
  if (input.state && !normalizeDnd5eSubmergedBreathing(input.state)) throw new Error('invalid-submerged-breathing-state')
  const intrinsicBreath = input.intrinsic?.holdBreathSeconds
  if (intrinsicBreath != null && (!Number.isSafeInteger(intrinsicBreath) || intrinsicBreath < 1 || intrinsicBreath > 86_400))
    throw new Error('invalid-intrinsic-breath-duration')
  const capabilities = dnd5eActiveEnvironmentalCapabilities(input.effects, input.intrinsic)
  const canBreathe = !dnd5eActiveSubmerged(input.effects) || input.intrinsic?.doesNotNeedAir === true ||
    capabilities.doesNotNeedAir || capabilities.canBreatheWater
  return advanceSubmergedBreathingStep({ ...input, canBreathe,
    holdBreathSeconds: Math.max(intrinsicBreath ?? 0, capabilities.holdBreathSeconds ?? 0) || undefined })
}