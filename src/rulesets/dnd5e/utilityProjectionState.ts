export function dnd5eUtilityProjectionDistanceKey(
  sourceActorId: string,
  projectionId: string,
  targetId: string,
): string {
  return `${sourceActorId}\u0000${projectionId}\u0000${targetId}`
}
