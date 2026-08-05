import { describe, expect, it } from 'vitest'
import {
  appendRollLedgerEntry,
  createCombatTransaction,
  rerollLedgerDie,
} from '../../lib/combatTransaction'
import { normalizeCharacter } from '../../store/characters'
import type { Character } from '../../types/character'
import { normalizeDnd5eInventory } from './items'
import {
  commitDnd5eAttackRollRerollEffect,
  type Dnd5eCommitAttackRollRerollCommandV1,
} from './inventoryHeadlessEffectAuthority'

function hero(options: { current?: number; attuned?: boolean; identified?: boolean } = {}): Character {
  return normalizeCharacter({
    id: 'hero',
    name: 'Hero',
    player: 'Player',
    charClass: 'Fighter',
    level: 1,
    maxHp: 12,
    currentHp: 12,
    equipment: {
      mainWeapon: {
        id: 'plugin:blade',
        name: 'Fate Blade',
        slot: 'mainWeapon',
        dnd5e: {
          kind: 'weapon', category: 'martial', mode: 'melee',
          damage: { count: 1, sides: 8, type: 'slashing' }, attackAbility: 'str',
        },
      },
    },
    dnd5eInventory: {
      schemaVersion: 3,
      revision: 0,
      entries: [{
        instanceId: 'blade-1',
        templateId: 'plugin:blade',
        quantity: 1,
        acquiredAt: 1,
        equippedSlot: 'mainWeapon',
        attuned: options.attuned ?? true,
        identified: options.identified ?? true,
        item: {
          id: 'plugin:blade',
          name: 'Fate Blade',
          category: 'equipment',
          icon: 'weapon',
          description: 'Test item',
          rulesText: 'Test item',
          stackable: false,
          equipment: {
            id: 'plugin:blade',
            name: 'Fate Blade',
            slot: 'mainWeapon',
            dnd5e: {
              kind: 'weapon', category: 'martial', mode: 'melee',
              damage: { count: 1, sides: 8, type: 'slashing' }, attackAbility: 'str',
            },
          },
          magicItem: { kind: 'weapon', rarity: 'rare', attunement: 'required', automation: 'headless' },
          resources: [{ id: 'charges', label: 'Charges', maximum: 4, resetOn: 'dawn' }],
          headlessEffects: [{
            schemaVersion: 1,
            id: 'attack-reroll',
            kind: 'attack-roll-reroll',
            resourceId: 'charges',
            maximumDice: 1,
            trigger: 'after-attack-roll',
            appliesTo: 'attacks-with-this-weapon',
          }],
          source: { book: 'Test', license: 'CC0' },
        },
        resources: {
          charges: {
            id: 'charges', label: 'Charges', current: options.current ?? 4, maximum: 4, resetOn: 'dawn',
          },
        },
      }],
    },
  })
}

function transaction() {
  const base = appendRollLedgerEntry(createCombatTransaction({
    id: 'attack-1', mapId: 'map', combatId: 'combat', actorId: 'hero',
    actionId: 'attack-1', actionKind: 'weapon-attack', now: 1,
  }), {
    id: 'attack-1:roll', kind: 'attack', label: 'Attack', dice: { sides: 20, values: [4] },
    modifier: 5, visibility: 'public', sourceId: 'hero', targetId: 'foe', createdAt: 2,
  })
  return rerollLedgerDie(base, {
    entryId: 'attack-1:roll',
    dieIndex: 0,
    replacementValue: 15,
    sourceId: 'blade-1',
    sourceLabel: 'Fate Blade',
    spentResource: {
      characterId: 'hero', instanceId: 'blade-1', resourceId: 'charges', amount: 1,
    },
    now: 3,
  })
}

function command(overrides: Partial<Dnd5eCommitAttackRollRerollCommandV1> = {}): Dnd5eCommitAttackRollRerollCommandV1 {
  return {
    schemaVersion: 1,
    commandId: 'attack-1:equipment-reroll',
    transactionId: 'attack-1',
    actorId: 'hero',
    instanceId: 'blade-1',
    effectId: 'attack-reroll',
    resourceId: 'charges',
    rollLedgerEntryId: 'attack-1:roll',
    rerollIndex: 0,
    expectedInventoryRevision: 0,
    ...overrides,
  }
}

describe('inventory triggered Headless effect authority', () => {
  it('commits one charge with a durable receipt and deduplicates replay', () => {
    const first = commitDnd5eAttackRollRerollEffect({
      character: hero(), transaction: transaction(), command: command(), weaponId: 'plugin:blade',
    })
    expect(first).toMatchObject({ ok: true, deduplicated: false })
    if (!first.ok) return
    const inventory = normalizeDnd5eInventory(first.character)
    expect(inventory.entries[0].resources?.charges.current).toBe(3)
    expect(inventory.authorityUseReceipts).toContain('attack-1:equipment-reroll')

    const replayCharacter: Character = {
      ...first.character,
      equipment: {},
      dnd5eInventory: { ...normalizeDnd5eInventory(first.character), entries: [] },
    }
    const replay = commitDnd5eAttackRollRerollEffect({
      character: replayCharacter, transaction: transaction(), command: command(), weaponId: 'plugin:blade',
    })
    expect(replay).toMatchObject({ ok: true, deduplicated: true })
    if (replay.ok) expect(normalizeDnd5eInventory(replay.character).entries).toEqual([])
  })

  it('rejects stale inventory state and forged effect or ledger identity', () => {
    expect(commitDnd5eAttackRollRerollEffect({
      character: hero(), transaction: transaction(), command: command({ expectedInventoryRevision: 9 }),
      weaponId: 'plugin:blade',
    })).toMatchObject({ ok: false, reason: 'stale-inventory-revision' })
    expect(commitDnd5eAttackRollRerollEffect({
      character: hero(), transaction: transaction(), command: command({ effectId: 'forged' }),
      weaponId: 'plugin:blade',
    })).toMatchObject({ ok: false, reason: 'effect-unavailable' })
    expect(commitDnd5eAttackRollRerollEffect({
      character: hero(), transaction: transaction(), command: command({ instanceId: 'other-item' }),
      weaponId: 'plugin:blade',
    })).toMatchObject({ ok: false, reason: 'roll-ledger-mismatch' })
  })

  it('rejects an inactive item, wrong weapon, or depleted resource', () => {
    expect(commitDnd5eAttackRollRerollEffect({
      character: hero({ attuned: false }), transaction: transaction(), command: command(), weaponId: 'plugin:blade',
    })).toMatchObject({ ok: false, reason: 'effect-unavailable' })
    expect(commitDnd5eAttackRollRerollEffect({
      character: hero({ identified: false }), transaction: transaction(), command: command(), weaponId: 'plugin:blade',
    })).toMatchObject({ ok: false, reason: 'effect-unavailable' })
    expect(commitDnd5eAttackRollRerollEffect({
      character: hero(), transaction: transaction(), command: command(), weaponId: 'plugin:other',
    })).toMatchObject({ ok: false, reason: 'effect-unavailable' })
    expect(commitDnd5eAttackRollRerollEffect({
      character: hero({ current: 0 }), transaction: transaction(), command: command(), weaponId: 'plugin:blade',
    })).toMatchObject({ ok: false, reason: 'insufficient-resource' })
  })
})
