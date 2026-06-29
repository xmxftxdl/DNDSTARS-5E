import type { ClassFeatureKey } from '../types/character'

const PLAYER_DM_READY_FEATURE_KEYS = new Set<ClassFeatureKey>([
  'doubleArrow',
  'preciseStrike',
  'eagleEye',
  'stillWater',
  'finale',
  'flexibleBody',
  'showtime',
  'windBlade',
])

export function shouldSendPlayerReadyFeatureToDm(featureKey: ClassFeatureKey): boolean {
  return PLAYER_DM_READY_FEATURE_KEYS.has(featureKey)
}
