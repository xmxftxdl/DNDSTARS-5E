import { describe, expect, it } from 'vitest'
import { projectDnd5eShopsForPlayer, validateSharedStateShape } from '../../scripts/shared-server-core.mjs'
import { validateAndMigrateSharedResource } from './sharedResourceValidation'
import { emptySharedDnd5eShops } from '../rulesets/dnd5e/shops'

describe('D&D 5e shop shared-state boundary', () => {
  it('accepts the canonical empty shop resource on both client and server', () => {
    const state = emptySharedDnd5eShops()
    expect(validateAndMigrateSharedResource('dnd5e-shops', state).status).toBe('valid')
    expect(validateSharedStateShape('dnd5e-shops', state)).toEqual({ ok: true })
  })

  it('rejects truncated or forged inventory envelopes', () => {
    expect(validateAndMigrateSharedResource('dnd5e-shops', {
      schemaVersion: 1,
      shops: [],
      updatedAt: 1,
    }).status).toBe('invalid')
    const forged = {
      ...emptySharedDnd5eShops(),
      shops: [{
        id: 'forged',
        kind: 'equipment',
        name: '伪造商店',
        description: '',
        open: true,
        priceMultiplier: 1,
        revision: 0,
        createdAt: 1,
        updatedAt: 1,
        offers: [{
          id: 'offer:forged',
          templateId: 'forged',
          name: '伪造物品',
          description: '',
          category: 'equipment',
          icon: 'weapon',
          sourceLabel: 'forged',
          quantity: -1,
          basePriceCopper: 1,
          updatedAt: 1,
        }],
      }],
    }
    expect(validateAndMigrateSharedResource('dnd5e-shops', forged).status).toBe('invalid')
    expect(validateSharedStateShape('dnd5e-shops', forged))
      .toMatchObject({ ok: false, reason: 'invalid-dnd5e-shop-offer' })
  })

  it('keeps closed shops, purchase receipts, and the DM audit log out of player projections', () => {
    const projected = projectDnd5eShopsForPlayer({
      ...emptySharedDnd5eShops(),
      shops: [
        { id: 'open', open: true, visibleToPlayers: true },
        { id: 'closed', open: false, visibleToPlayers: false },
        { id: 'legacy-open', open: true },
      ],
      transactions: [{ id: 'private-transaction' }],
      purchaseReceipts: ['private-receipt'],
    })
    expect(projected.shops).toEqual([{ id: 'open', open: true, visibleToPlayers: true }])
    expect(projected.transactions).toEqual([])
    expect(projected.purchaseReceipts).toEqual([])
  })

  it('accepts and projects public rules text and a DM-authored offer price', () => {
    const state = {
      ...emptySharedDnd5eShops(),
      updatedAt: 1,
      shops: [{
        id: 'open', kind: 'apothecary', name: '炼金铺', description: '', open: true,
        visibleToPlayers: true,
        priceMultiplier: 1.5, revision: 1, createdAt: 1, updatedAt: 1,
        offers: [{
          id: 'offer:potion', templateId: 'potion', name: '药水', description: '一瓶药水。',
          rulesText: '饮用后恢复 2d4 + 2 点生命值。', category: 'consumable', icon: 'healing-potion',
          sourceLabel: 'SRD 5.1', quantity: 2, basePriceCopper: 5_000,
          priceOverrideCopper: 3_500, updatedAt: 1,
        }],
      }],
    }

    expect(validateAndMigrateSharedResource('dnd5e-shops', state).status).toBe('valid')
    expect(validateSharedStateShape('dnd5e-shops', state)).toEqual({ ok: true })
    const projected = projectDnd5eShopsForPlayer(state) as unknown as typeof state
    expect(projected.shops[0].offers[0]).toMatchObject({
      rulesText: '饮用后恢复 2d4 + 2 点生命值。',
      priceOverrideCopper: 3_500,
    })
  })
})
