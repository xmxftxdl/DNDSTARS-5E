export interface Dnd5eRepeatedProjectileTargeting {
  maximumTargets: number
  targetTokenIds: readonly string[]
}

export interface Dnd5eVisibleGuessedProjectileTargeting extends Dnd5eRepeatedProjectileTargeting {
  guessedTargeting?: boolean
  allowDuplicateTargets?: boolean
}

export function appendDnd5eRepeatedProjectileTarget(
  targeting: Dnd5eRepeatedProjectileTargeting,
  targetTokenId: string,
): string[] {
  const maximumTargets = Math.max(1, Math.round(targeting.maximumTargets))
  if (!targetTokenId || targeting.targetTokenIds.length >= maximumTargets) {
    return [...targeting.targetTokenIds]
  }
  return [...targeting.targetTokenIds, targetTokenId]
}

export function appendDnd5eVisibleGuessedProjectileTarget(
  targeting: Dnd5eVisibleGuessedProjectileTargeting,
  visibleTargetTokenId?: string,
): string[] | undefined {
  if (
    !targeting.guessedTargeting ||
    !targeting.allowDuplicateTargets ||
    !visibleTargetTokenId
  ) return undefined
  return appendDnd5eRepeatedProjectileTarget(targeting, visibleTargetTokenId)
}

export function dnd5eRepeatedProjectileTargetsRemaining(
  targeting: Dnd5eRepeatedProjectileTargeting,
): number {
  return Math.max(
    0,
    Math.max(1, Math.round(targeting.maximumTargets)) - targeting.targetTokenIds.length,
  )
}

export function dnd5eRepeatedProjectileTargetsComplete(
  targeting: Dnd5eRepeatedProjectileTargeting,
): boolean {
  return dnd5eRepeatedProjectileTargetsRemaining(targeting) === 0
}
