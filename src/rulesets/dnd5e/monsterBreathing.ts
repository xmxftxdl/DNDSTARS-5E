import { monsterBreathingProfiles } from '../../../shared/monster-breathing-profiles.mjs'

export interface Dnd5eIntrinsicBreathing {
  canBreatheWater?: boolean
  doesNotNeedAir?: boolean
  holdBreathSeconds?: number
}

export function dnd5eNativeMonsterBreathing(statBlockId: string | undefined): Dnd5eIntrinsicBreathing {
  const profile = statBlockId ? monsterBreathingProfiles[statBlockId] : undefined
  return { ...(profile?.canBreatheWater ? { canBreatheWater: true } : {}),
    ...(profile?.holdBreathSeconds ? { holdBreathSeconds: profile.holdBreathSeconds } : {}) }
}
