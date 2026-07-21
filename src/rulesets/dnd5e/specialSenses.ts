export type Dnd5eSpecialSenseKind = 'blindsight' | 'tremorsense' | 'truesight'

export interface Dnd5eSpecialSense {
  kind: Dnd5eSpecialSenseKind
  rangeFeet: number
}

export function normalizeDnd5eSpecialSenses(
  senses: readonly { name: string; distanceFeet?: number }[] | undefined,
): Dnd5eSpecialSense[] {
  return (senses ?? []).flatMap((sense) => {
    const name = sense.name.trim().toLowerCase()
    const kind: Dnd5eSpecialSenseKind | undefined =
      name.includes('盲视') || name.includes('blindsight') ? 'blindsight' :
        name.includes('震颤感知') || name.includes('tremorsense') ? 'tremorsense' :
          name.includes('真实视觉') || name.includes('真视') || name.includes('truesight') ? 'truesight' : undefined
    const rangeFeet = Math.max(0, Math.floor(sense.distanceFeet ?? 0))
    return kind && rangeFeet > 0 ? [{ kind, rangeFeet }] : []
  })
}

export function dnd5eSpecialSenseRange(
  senses: readonly Dnd5eSpecialSense[] | undefined,
  kind: Dnd5eSpecialSenseKind,
): number {
  return Math.max(0, ...(senses ?? []).filter((sense) => sense.kind === kind).map((sense) => sense.rangeFeet))
}

export function dnd5eHasSpecialSenseInRange(
  senses: readonly Dnd5eSpecialSense[] | undefined,
  kind: Dnd5eSpecialSenseKind,
  distanceFeet: number,
): boolean {
  return distanceFeet <= dnd5eSpecialSenseRange(senses, kind)
}

export function dnd5eTremorsenseDetects(input: {
  senses: readonly Dnd5eSpecialSense[] | undefined
  distanceFeet: number
  viewerElevationFeet?: number
  targetElevationFeet?: number
  targetAirborne?: boolean
}): boolean {
  if (input.targetAirborne) return false
  if (Math.abs((input.viewerElevationFeet ?? 0) - (input.targetElevationFeet ?? 0)) > 5) return false
  return dnd5eHasSpecialSenseInRange(input.senses, 'tremorsense', input.distanceFeet)
}
