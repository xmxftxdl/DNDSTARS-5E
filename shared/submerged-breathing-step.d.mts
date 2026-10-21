import type { Dnd5eSubmergedBreathingState } from './submerged-breathing-state.mjs'
export interface SubmergedBreathingStepInput {
  state?: Dnd5eSubmergedBreathingState
  constitutionScore: number
  canBreathe: boolean
  holdBreathSeconds?: number
  elapsedSeconds: number
  stepKey: string
  targetTurnStart: boolean
}
export interface SubmergedBreathingStepResult {
  state?: Dnd5eSubmergedBreathingState
  dropToZero: boolean
  blocksHealingAndStabilization: boolean
}
export function advanceSubmergedBreathingStep(input: SubmergedBreathingStepInput): SubmergedBreathingStepResult
