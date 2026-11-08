/** Host-only observations. Unknown facts must never be reported as an empty area. */
export interface Dnd5eSensoryDeceptionObservation {
  distanceFeet?: number
  samePlane?: boolean
  illusion?: boolean
  shapechangerOutsideOriginalForm?: boolean
  sensoryDeceivingMagic?: boolean
}

/** Deliberately reveals neither entity identities, locations nor the concealed truth. */
export type Dnd5eSensoryDeceptionPresence =
  | { status: 'blocked'; reason: 'blinded-or-deafened' }
  | { status: 'unavailable' }
  | { status: 'resolved'; present: boolean }

export function dnd5eSensoryDeceptionPresence(input: {
  conditions: readonly string[]
  observations: readonly Dnd5eSensoryDeceptionObservation[]
  /** Host has accounted for scene objects, creatures and persistent effects. */
  sceneComplete: boolean
}): Dnd5eSensoryDeceptionPresence {
  if (input.conditions.some(condition => condition === 'blinded' || condition === 'deafened')) {
    return { status: 'blocked', reason: 'blinded-or-deafened' }
  }
  let known = input.sceneComplete === true
  for (const observation of input.observations) {
    if (observation.samePlane === false) continue
    const distance = observation.distanceFeet
    if (distance != null && Number.isFinite(distance) && distance > 30) continue
    if (observation.samePlane !== true || distance == null || !Number.isFinite(distance) || distance < 0) {
      known = false
      continue
    }
    if (observation.illusion === true || observation.shapechangerOutsideOriginalForm === true ||
      observation.sensoryDeceivingMagic === true) return { status: 'resolved', present: true }
    if (observation.illusion !== false || observation.shapechangerOutsideOriginalForm !== false ||
      observation.sensoryDeceivingMagic !== false) known = false
  }
  return known ? { status: 'resolved', present: false } : { status: 'unavailable' }
}
