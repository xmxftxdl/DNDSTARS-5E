import { describe, expect, it } from 'vitest'
import { planDnd5eTravel } from './travel'

describe('D&D 5e travel pace', () => {
  it('uses the SRD pace table and halves distance in difficult terrain', () => {
    expect(planDnd5eTravel({ pace: 'normal', hours: 8 })).toMatchObject({ distanceMiles: 24, elapsedMinutes: 480 })
    expect(planDnd5eTravel({ pace: 'fast', hours: 8, difficultTerrain: true })).toMatchObject({ distanceMiles: 15, passivePerceptionModifier: -5 })
    expect(planDnd5eTravel({ pace: 'slow', hours: 1 })).toMatchObject({ distanceMiles: 2, canStealth: true })
  })

  it('creates escalating forced-march saves after eight hours', () => {
    expect(planDnd5eTravel({ pace: 'normal', hours: 11 }).forcedMarchChecks).toEqual([
      { hour: 9, constitutionSaveDc: 10 },
      { hour: 10, constitutionSaveDc: 11 },
      { hour: 11, constitutionSaveDc: 12 },
    ])
  })
})

