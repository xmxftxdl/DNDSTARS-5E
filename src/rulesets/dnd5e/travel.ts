export type Dnd5eTravelPace = 'fast' | 'normal' | 'slow'

const TRAVEL_PACES = {
  fast: { feetPerMinute: 400, milesPerHour: 4, milesPerDay: 30, passivePerceptionModifier: -5, canStealth: false },
  normal: { feetPerMinute: 300, milesPerHour: 3, milesPerDay: 24, passivePerceptionModifier: 0, canStealth: false },
  slow: { feetPerMinute: 200, milesPerHour: 2, milesPerDay: 18, passivePerceptionModifier: 0, canStealth: true },
} as const

export interface Dnd5eTravelPlan {
  pace: Dnd5eTravelPace
  hours: number
  difficultTerrain: boolean
  distanceMiles: number
  elapsedMinutes: number
  passivePerceptionModifier: number
  canStealth: boolean
  forcedMarchChecks: Array<{ hour: number; constitutionSaveDc: number }>
}

/** 2014 旅行步调表；困难地形距离减半，超过每日 8 小时逐小时产生强行军豁免。 */
export function planDnd5eTravel(input: {
  pace: Dnd5eTravelPace
  hours: number
  difficultTerrain?: boolean
}): Dnd5eTravelPlan {
  const pace = TRAVEL_PACES[input.pace]
  const hours = Math.max(0, Math.min(24, Number(input.hours) || 0))
  const terrainMultiplier = input.difficultTerrain ? 0.5 : 1
  const distanceMiles = hours >= 8
    ? pace.milesPerDay * (hours / 8) * terrainMultiplier
    : pace.milesPerHour * hours * terrainMultiplier
  const forcedHours = Math.max(0, Math.ceil(hours - 8))
  return {
    pace: input.pace,
    hours,
    difficultTerrain: input.difficultTerrain === true,
    distanceMiles,
    elapsedMinutes: Math.round(hours * 60),
    passivePerceptionModifier: pace.passivePerceptionModifier,
    canStealth: pace.canStealth,
    forcedMarchChecks: Array.from({ length: forcedHours }, (_, index) => ({
      hour: 9 + index,
      constitutionSaveDc: 10 + index,
    })),
  }
}

export function dnd5eTravelPaceFeetPerMinute(pace: Dnd5eTravelPace): number {
  return TRAVEL_PACES[pace].feetPerMinute
}

