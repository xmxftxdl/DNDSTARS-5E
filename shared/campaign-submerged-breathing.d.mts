import type { Dnd5eSubmergedBreathingState, SubmergedBreathingEffectDeadline } from './submerged-breathing-state.mjs'
export function planCampaignSubmergedBreathing(input: {
  maps: readonly unknown[]
  characters: readonly unknown[]
  explicitSummonedMonsterConstitutions?: readonly import('./explicit-water-breathing-policy.mjs').ExplicitSummonedMonsterConstitution[]
  explicitWaterBreathingPolicies?: readonly import('./explicit-water-breathing-policy.mjs').ExplicitWaterBreathingPolicy[]
  previousClock: { worldMinute: number; worldSecondRemainder?: number; advances?: readonly unknown[] }
  nextClock: { worldMinute: number; worldSecondRemainder?: number; advances?: readonly unknown[] }
}): { updates: Array<{ mapId: string; tokenId: string; characterId?: string;
  revertedForm?: boolean; collapsedAt?: number; state?: Dnd5eSubmergedBreathingState; effectDeadlines?: SubmergedBreathingEffectDeadline[]; expiredEffectIds?: string[] }>; endedSourceIds: string[] }
