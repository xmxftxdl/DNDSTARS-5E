/** Data-only capacity policy. Null ranks cannot be retained by this policy. */
export interface Dnd5ePersistentAreaCapacityPolicy {
  maximumUnits: number
  unitsBySizeRank: readonly (number | null)[]
}

export interface Dnd5ePersistentAreaCapacityDeclaration extends Dnd5ePersistentAreaCapacityPolicy {
  overflow: 'random-existing-until-fits'
  maximumOutsideDistanceFeet: number
  proneOnExpulsion?: true
}

export function normalizeDnd5ePersistentAreaCapacity(value: unknown): Dnd5ePersistentAreaCapacityDeclaration | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (Object.keys(raw).some(key => !['maximumUnits', 'unitsBySizeRank', 'overflow', 'maximumOutsideDistanceFeet', 'proneOnExpulsion'].includes(key)) ||
    raw.overflow !== 'random-existing-until-fits' || !Number.isInteger(raw.maximumUnits) ||
    Number(raw.maximumUnits) < 1 || Number(raw.maximumUnits) > 64 || !Array.isArray(raw.unitsBySizeRank) ||
    raw.unitsBySizeRank.length !== 6 || raw.unitsBySizeRank.some(units => units !== null &&
      (!Number.isInteger(units) || units < 1 || units > Number(raw.maximumUnits))) ||
    !Number.isInteger(raw.maximumOutsideDistanceFeet) || Number(raw.maximumOutsideDistanceFeet) < 1 ||
    Number(raw.maximumOutsideDistanceFeet) > 1000 ||
    (raw.proneOnExpulsion !== undefined && raw.proneOnExpulsion !== true)) return undefined
  return { maximumUnits: Number(raw.maximumUnits), unitsBySizeRank: [...raw.unitsBySizeRank],
    overflow: 'random-existing-until-fits', maximumOutsideDistanceFeet: Number(raw.maximumOutsideDistanceFeet),
    ...(raw.proneOnExpulsion === true ? { proneOnExpulsion: true } : {}) }
}

export interface Dnd5ePersistentAreaCapacityOccupant {
  targetId: string
  sizeRank: number
}

export type Dnd5ePersistentAreaCapacityPlan =
  | { kind: 'invalid'; reason: 'invalid-policy' | 'invalid-occupants' | 'invalid-random-result' | 'unretainable-entrant' }
  | { kind: 'random-selection-required'; sides: number; candidateIds: string[]; drawIndex: number }
  | { kind: 'ready'; retainedIds: string[]; expelledIds: string[]; usedUnits: number; drawsConsumed: number }

/**
 * Deterministic admission planning, before any effects or movement commit.
 * Existing occupants are sampled uniformly without replacement until the new
 * occupant fits. The caller supplies authoritative 1-based random results and
 * must restart with the same complete prefix after obtaining another result.
 * No map iteration order, Math.random or missing result is a random choice.
 */
export function planDnd5ePersistentAreaCapacity(input: {
  policy: Dnd5ePersistentAreaCapacityPolicy
  existing: readonly Dnd5ePersistentAreaCapacityOccupant[]
  entrant: Dnd5ePersistentAreaCapacityOccupant
  randomResults?: readonly number[]
}): Dnd5ePersistentAreaCapacityPlan {
  const { maximumUnits, unitsBySizeRank } = input.policy
  if (!Number.isInteger(maximumUnits) || maximumUnits < 1 || maximumUnits > 64 ||
    unitsBySizeRank.length !== 6 || unitsBySizeRank.some(units => units !== null &&
      (!Number.isInteger(units) || units < 1 || units > maximumUnits))) {
    return { kind: 'invalid', reason: 'invalid-policy' }
  }
  const validOccupant = (occupant: Dnd5ePersistentAreaCapacityOccupant) =>
    typeof occupant.targetId === 'string' && occupant.targetId.trim().length > 0 &&
    Number.isInteger(occupant.sizeRank) && occupant.sizeRank >= 0 && occupant.sizeRank <= 5
  const ids = input.existing.map(occupant => occupant.targetId)
  if (input.existing.length > 64 || !validOccupant(input.entrant) ||
    input.existing.some(occupant => !validOccupant(occupant)) || new Set(ids).size !== ids.length) {
    return { kind: 'invalid', reason: 'invalid-occupants' }
  }
  const alreadyPresent = input.existing.find(occupant => occupant.targetId === input.entrant.targetId)
  if (alreadyPresent && alreadyPresent.sizeRank !== input.entrant.sizeRank) {
    return { kind: 'invalid', reason: 'invalid-occupants' }
  }
  const entrantUnits = unitsBySizeRank[input.entrant.sizeRank]
  if (entrantUnits === null) return { kind: 'invalid', reason: 'unretainable-entrant' }
  // Unknown/invalid incumbent size is not silently converted to a Medium creature.
  if (input.existing.some(occupant => unitsBySizeRank[occupant.sizeRank] === null)) {
    return { kind: 'invalid', reason: 'invalid-occupants' }
  }
  const remaining = input.existing.filter(occupant => occupant.targetId !== input.entrant.targetId)
    .slice().sort((a, b) => a.targetId < b.targetId ? -1 : a.targetId > b.targetId ? 1 : 0)
  let usedUnits = entrantUnits + remaining.reduce((total, occupant) => total + unitsBySizeRank[occupant.sizeRank]!, 0)
  const expelledIds: string[] = []
  const randomResults = input.randomResults ?? []
  let drawIndex = 0
  while (usedUnits > maximumUnits) {
    // With one eligible incumbent there is no uncertainty and no dice to consume.
    let selection = 0
    if (remaining.length > 1) {
      if (randomResults[drawIndex] === undefined) return { kind: 'random-selection-required',
        sides: remaining.length, candidateIds: remaining.map(occupant => occupant.targetId), drawIndex }
      const roll = randomResults[drawIndex++]
      if (!Number.isInteger(roll) || roll < 1 || roll > remaining.length) {
        return { kind: 'invalid', reason: 'invalid-random-result' }
      }
      selection = roll - 1
    }
    const expelled = remaining.splice(selection, 1)[0]
    usedUnits -= unitsBySizeRank[expelled.sizeRank]!
    expelledIds.push(expelled.targetId)
  }
  if (randomResults.length !== drawIndex) return { kind: 'invalid', reason: 'invalid-random-result' }
  return { kind: 'ready', retainedIds: [...remaining.map(occupant => occupant.targetId), input.entrant.targetId].sort(),
    expelledIds, usedUnits, drawsConsumed: drawIndex }
}
