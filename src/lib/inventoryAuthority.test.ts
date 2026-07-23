import { describe, expect, it } from 'vitest'
import { sanitizeDnd5ePlayerInventoryMutation } from './inventoryAuthority'

describe('D&D 5e inventory authority boundary', () => {
  it('strips a player-reported DM attunement confirmation', () => {
    expect(sanitizeDnd5ePlayerInventoryMutation({
      type: 'prepare-attunement',
      characterId: 'hero',
      instanceId: 'ring',
      dmPrerequisiteConfirmed: true,
    })).toEqual({
      type: 'prepare-attunement',
      characterId: 'hero',
      instanceId: 'ring',
      dmPrerequisiteConfirmed: undefined,
    })
  })

  it('strips player-provided healing rolls before the DM resolves item use', () => {
    expect(sanitizeDnd5ePlayerInventoryMutation({
      type: 'use',
      characterId: 'hero',
      instanceId: 'potion',
      healingRolls: [20, 20],
    })).toEqual({
      type: 'use',
      characterId: 'hero',
      instanceId: 'potion',
      healingRolls: undefined,
    })
  })
})
