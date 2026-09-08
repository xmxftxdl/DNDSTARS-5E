import { describe, expect, it } from 'vitest'
import {
  dnd5eInventoryAuthorityAckMatches,
  dnd5ePlayerInventoryMutationAllowed,
  sanitizeDnd5ePlayerInventoryMutation,
} from './inventoryAuthority'

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

  it('rejects player-authored currency grants while allowing authoritative spending requests', () => {
    expect(dnd5ePlayerInventoryMutationAllowed({
      type: 'adjust-currency',
      characterId: 'hero',
      currency: 'gp',
      delta: 10,
    })).toBe(false)
    expect(dnd5ePlayerInventoryMutationAllowed({
      type: 'adjust-currency',
      characterId: 'hero',
      currency: 'gp',
      delta: -3,
    })).toBe(true)
  })

  it('accepts only the acknowledgement for the same request and room member', () => {
    const ack = {
      requestId: 'inventory-request-1',
      recipientMemberId: 'player-1',
      status: 'applied' as const,
      message: 'done',
      updatedAt: 1,
    }
    expect(dnd5eInventoryAuthorityAckMatches(ack, 'inventory-request-1', 'player-1')).toBe(true)
    expect(dnd5eInventoryAuthorityAckMatches(ack, 'inventory-request-2', 'player-1')).toBe(false)
    expect(dnd5eInventoryAuthorityAckMatches(ack, 'inventory-request-1', 'player-2')).toBe(false)
    expect(dnd5eInventoryAuthorityAckMatches(ack, 'inventory-request-1')).toBe(false)
  })
})
