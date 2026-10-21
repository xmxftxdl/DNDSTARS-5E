export interface Dnd5eSubmergedBreathingState {
  schemaVersion: 1
  breathSeconds: number
  breathCapacitySeconds?: number
  survivalSeconds: number
  collapsed: boolean
  lastStepKey: string
  combatClock?: { combatId: string; round: number }
  campaignClockSeconds?: number
  pendingCollapseAtSeconds?: number
}
export function normalizeDnd5eSubmergedBreathing(value: unknown): Dnd5eSubmergedBreathingState | undefined
export interface SubmergedBreathingEffectDeadline {
  effectId: string
  appliedAt: number
  expiresAtSeconds: number
}
export function normalizeSubmergedBreathingEffectDeadlines(value: unknown): SubmergedBreathingEffectDeadline[] | undefined
