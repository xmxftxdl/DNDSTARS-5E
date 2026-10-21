export function validCombatRoundCredits(value, maximum = 10) {
  return value === undefined || (value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length <= 1024 && Object.entries(value).every(([key, rounds]) =>
      key.length > 0 && key.length <= 512 && Number.isSafeInteger(rounds) && rounds >= 0 && rounds <= maximum))
}

export const characterCombatClockKey = id => JSON.stringify(['character', id])
export const tokenCombatClockKey = (mapId, tokenId) => JSON.stringify(['token', mapId, tokenId])

/** Only subtract recorded combat aging inside the character/token's unapplied interval. */
export function campaignUnappliedEffectMinutes(clock, fromWorldMinute, actorKey) {
  const elapsed = Math.max(0, clock.worldMinute - fromWorldMinute) * 10
  let credit = 0
  for (const advance of clock.advances ?? []) {
    if (advance.fromWorldMinute < fromWorldMinute || advance.toWorldMinute > clock.worldMinute ||
      advance.toWorldMinute <= fromWorldMinute || advance.kind !== 'advance') continue
    if (validCombatRoundCredits(advance.combatRoundCredits, advance.minutes * 10)) {
      credit += advance.combatRoundCredits?.[actorKey] ?? 0
    }
  }
  return Math.max(0, elapsed - credit) / 10
}
