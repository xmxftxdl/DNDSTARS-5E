import type { Dnd5eSpellTargetingSession } from '../../presentation/maps/useCombatInteraction'

export function moveEarthSquareTargetingPatch(sideLengthFeet: number): Required<Pick<
  Dnd5eSpellTargetingSession,
  'areaTargetWidthFeet' | 'areaTargetHeightFeet'
>> {
  const side = Math.max(5, Math.min(40, Math.round(sideLengthFeet / 5) * 5))
  return { areaTargetWidthFeet: side, areaTargetHeightFeet: side }
}
