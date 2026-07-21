import { describe, expect, it } from 'vitest'
import { dnd5eHasSpecialSenseInRange, dnd5eTremorsenseDetects, normalizeDnd5eSpecialSenses } from './specialSenses'

describe('D&D 5e special senses', () => {
  it('normalizes Chinese and English SRD monster senses', () => {
    expect(normalizeDnd5eSpecialSenses([
      { name: '盲视', distanceFeet: 60 },
      { name: 'Tremorsense', distanceFeet: 30 },
      { name: '真实视觉', distanceFeet: 120 },
      { name: '黑暗视觉', distanceFeet: 60 },
    ])).toEqual([
      { kind: 'blindsight', rangeFeet: 60 },
      { kind: 'tremorsense', rangeFeet: 30 },
      { kind: 'truesight', rangeFeet: 120 },
    ])
  })

  it('uses strict range and same-surface checks', () => {
    const senses = [{ kind: 'tremorsense' as const, rangeFeet: 30 }]
    expect(dnd5eHasSpecialSenseInRange(senses, 'tremorsense', 30)).toBe(true)
    expect(dnd5eTremorsenseDetects({ senses, distanceFeet: 20, viewerElevationFeet: 0, targetElevationFeet: 0 })).toBe(true)
    expect(dnd5eTremorsenseDetects({ senses, distanceFeet: 20, targetAirborne: true })).toBe(false)
  })
})
