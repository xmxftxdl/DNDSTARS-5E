/** Host-owned identity for one combat turn or six seconds of exploration. */
export function persistentAreaMovementScopeMatches(
  expected: ReturnType<typeof persistentAreaMovementScope>,
  current: ReturnType<typeof persistentAreaMovementScope>,
): boolean {
  return !expected || !!current && expected.combatId === current.combatId &&
    expected.round === current.round && expected.turnKey === current.turnKey
}

export function persistentAreaMovementScope(input: {
  mapId: string; actorId: string; combatId?: string; round: number; turnKey?: string;
  worldMinute?: number; worldSecondRemainder?: number;
}): { combatId: string; round: number; turnKey: string } | undefined {
  if (input.combatId) return input.turnKey
    ? { combatId: input.combatId, round: input.round, turnKey: input.turnKey } : undefined
  const second = input.worldSecondRemainder ?? 0
  if (!Number.isSafeInteger(input.worldMinute) || input.worldMinute! < 0 ||
    !Number.isSafeInteger(second) || second < 0 || second > 59) return undefined
  return { combatId: `exploration:${input.mapId}`, round: 0,
    turnKey: `${input.actorId}:${input.worldMinute}:${Math.floor(second / 6)}` }
}
