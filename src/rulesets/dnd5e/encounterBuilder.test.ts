import { describe, expect, it } from 'vitest'
import type { EnemyTemplate } from '../../lib/enemyPool'
import { dnd5eEncounterGridOffset, dnd5eEncounterRoster, summarizeDnd5eEncounter } from './encounterBuilder'

const wolf: EnemyTemplate = {
  id: 'wolf', name: '狼', emoji: '🐺', color: '#fff', maxHp: 11,
  tags: [], challengeRating: '1/4', experiencePoints: 50,
}

describe('D&D 5e encounter builder', () => {
  it('summarizes and expands an encounter without exceeding the room cap', () => {
    const entries = [{ template: wolf, quantity: 3 }]
    expect(summarizeDnd5eEncounter(entries)).toEqual({
      creatureCount: 3,
      baseExperience: 150,
      challengeRatings: ['1/4'],
    })
    expect(dnd5eEncounterRoster(entries)).toHaveLength(3)
    expect(dnd5eEncounterRoster([{ template: wolf, quantity: 99 }])).toHaveLength(50)
  })

  it('lays a roster out around the map center', () => {
    expect([0, 1, 2, 3].map((index) => dnd5eEncounterGridOffset(index, 4))).toEqual([
      { column: -0.5, row: -0.5 }, { column: 0.5, row: -0.5 },
      { column: -0.5, row: 0.5 }, { column: 0.5, row: 0.5 },
    ])
  })
})
