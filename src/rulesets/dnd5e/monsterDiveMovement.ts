/** Host-only evidence for one continuous, straight, descending flight segment. */
export interface Dnd5eMonsterDiveMovement {
  turnKey: string
  origin: { x: number; y: number; z: number }
  last: { x: number; y: number; z: number }
  distanceFeet: number
}

export function dnd5eMonsterDiveDistanceTowardTarget(evidence: Dnd5eMonsterDiveMovement | undefined,
  turnKey: string, actor: { x: number; y: number; z: number }, target: { x: number; y: number; z: number }): number {
  if (!evidence || evidence.turnKey !== turnKey ||
    Math.hypot(actor.x - evidence.last.x, actor.y - evidence.last.y, actor.z - evidence.last.z) > 1e-6) return 0
  const { origin, last } = evidence
  const before = Math.hypot(target.x - origin.x, target.y - origin.y, target.z - origin.z)
  const after = Math.hypot(target.x - last.x, target.y - last.y, target.z - last.z)
  return after + 1e-6 < before ? evidence.distanceFeet : 0
}

export function advanceDnd5eMonsterDiveMovement(previous: Dnd5eMonsterDiveMovement | undefined, input: {
  turnKey: string
  from: { x: number; y: number }
  to: { x: number; y: number }
  fromElevationFeet?: number
  toElevationFeet?: number
  distanceFeet: number
  flying: boolean
  voluntary: boolean
  straight: boolean
}): Dnd5eMonsterDiveMovement | undefined {
  const values = [input.from.x, input.from.y, input.to.x, input.to.y,
    input.fromElevationFeet, input.toElevationFeet, input.distanceFeet]
  if (!input.flying || !input.voluntary || !input.straight ||
    !values.every(value => typeof value === 'number' && Number.isFinite(value)) ||
    input.distanceFeet <= 0 || input.toElevationFeet! >= input.fromElevationFeet! - 1e-6) return undefined
  const from = { ...input.from, z: input.fromElevationFeet! }
  const to = { ...input.to, z: input.toElevationFeet! }
  const segment = [to.x - from.x, to.y - from.y, to.z - from.z]
  let continuing = previous?.turnKey === input.turnKey &&
    Math.hypot(previous.last.x - from.x, previous.last.y - from.y, previous.last.z - from.z) < 1e-6
  if (continuing && previous) {
    const prior = [from.x - previous.origin.x, from.y - previous.origin.y, from.z - previous.origin.z]
    const dot = prior.reduce((sum, value, index) => sum + value * segment[index], 0)
    const cross = Math.hypot(prior[1] * segment[2] - prior[2] * segment[1],
      prior[2] * segment[0] - prior[0] * segment[2], prior[0] * segment[1] - prior[1] * segment[0])
    continuing = dot > 0 && cross <= 1e-6 * Math.max(1, Math.hypot(...prior) * Math.hypot(...segment))
  }
  return { turnKey: input.turnKey, origin: continuing ? { ...previous!.origin } : from, last: to,
    distanceFeet: (continuing ? previous!.distanceFeet : 0) + input.distanceFeet }
}
