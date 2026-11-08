/** Projection bookkeeping is not a change to a creature or a pending roll.
 * Keep the actual clock separately: a real time advance still invalidates dice.
 */
export function activityNegationAuthorityFingerprint<
  TMap extends { tokens: readonly { dnd5eWorldTimeAppliedMinute?: number }[] },
>(input: { maps: readonly TMap[]; characters: readonly unknown[]; worldMinute: number | null | undefined }): string {
  return JSON.stringify([
    input.maps.map(map => ({ ...map, tokens: map.tokens.map(token =>
      Object.fromEntries(Object.entries(token).filter(([key]) => key !== 'dnd5eWorldTimeAppliedMinute')),
    ) })),
    input.characters,
    // JSON arrays collapse undefined and null; keep unavailable time explicit.
    input.worldMinute === undefined ? { unavailable: true } : input.worldMinute,
  ])
}
