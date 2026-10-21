export function validCombatRoundCredits(value: unknown, maximum?: number): value is Record<string, number> | undefined
export function characterCombatClockKey(id: string): string
export function tokenCombatClockKey(mapId: string, tokenId: string): string
export function campaignUnappliedEffectMinutes(clock: {
  worldMinute: number
  advances: readonly { kind: string; fromWorldMinute: number; toWorldMinute: number; minutes: number; combatRoundCredits?: Record<string, number> }[]
}, fromWorldMinute: number, actorKey: string): number
