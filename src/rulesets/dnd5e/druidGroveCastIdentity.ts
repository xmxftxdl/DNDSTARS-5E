/** Stable storage identity only; authority continues to use the full transaction ID. */
export function dnd5eGroveCastIdentity(actionId: string, operationId: string): string {
  const legacy = `activity-area:${actionId}:${operationId}`
  if (legacy.length <= 160) return legacy
  // Preserve suffix distinctions and retry identity instead of truncating.
  let hash = 0x6c62272e07bb014262b821756295c58dn
  const mask = (1n << 128n) - 1n
  for (const byte of new TextEncoder().encode(JSON.stringify([actionId, operationId]))) {
    hash = ((hash ^ BigInt(byte)) * 0x1000000000000000000013bn) & mask
  }
  return `grove-cast:${hash.toString(16).padStart(32, '0')}`
}
