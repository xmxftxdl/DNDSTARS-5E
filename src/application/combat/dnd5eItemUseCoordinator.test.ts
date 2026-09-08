import { describe, expect, it } from 'vitest'
import { createCombatTransaction } from '../../lib/combatTransaction'
import { normalizeCharacter } from '../../store/characters'
import { applyDnd5eInventoryMutation, normalizeDnd5eInventory } from '../../rulesets/dnd5e/items'
import { resolveDnd5eAuthoritativeItemUse } from './dnd5eItemUseCoordinator'

function character(id: string, currentHp: number) {
  return normalizeCharacter({
    id, name: id, player: id, charClass: '战士', maxHp: 20, currentHp,
    equipment: {}, dnd5eInventory: { schemaVersion: 1, entries: [] },
  })
}

describe('D&D 5e authoritative item use coordinator', () => {
  it('returns one character snapshot for atomic publication and deduplicates replay', () => {
    const source = character('source', 20)
    const target = character('target', 5)
    const granted = applyDnd5eInventoryMutation([source, target], {
      type: 'grant', characterId: source.id, templateId: 'srd-5.1:item:potion-of-healing', quantity: 2,
    })
    const entry = normalizeDnd5eInventory(granted.characters[0]).entries[0]
    const transaction = createCombatTransaction({
      id: 'item-use:coordinator', mapId: 'map', combatId: 'combat', actorId: source.id,
      actionId: 'item-use:coordinator', actionKind: 'item-use', now: 1,
    })
    const first = resolveDnd5eAuthoritativeItemUse({
      characters: granted.characters,
      sourceCharacterId: source.id,
      targetCharacterId: target.id,
      instanceId: entry.instanceId,
      healingRolls: [2, 3],
      transaction,
    })
    expect(first).toMatchObject({ ok: true, source: { currentHp: 20 }, target: { currentHp: 12 } })
    if (!first.ok) return
    expect(normalizeDnd5eInventory(first.source).entries[0].quantity).toBe(1)

    const replay = resolveDnd5eAuthoritativeItemUse({
      characters: first.characters,
      sourceCharacterId: source.id,
      targetCharacterId: target.id,
      instanceId: entry.instanceId,
      healingRolls: [4, 4],
      transaction,
    })
    expect(replay).toMatchObject({ ok: true, deduplicated: true, target: { currentHp: 12 } })
    if (replay.ok) expect(normalizeDnd5eInventory(replay.source).entries[0].quantity).toBe(1)
  })

  it('preserves the selected action id for a multi-action consumable', () => {
    const source = normalizeCharacter({
      ...character('multi-action-source', 5),
      dnd5eInventory: {
        schemaVersion: 3,
        entries: [{
          instanceId: 'multi-action-tonic-1',
          templateId: 'test:multi-action-tonic',
          quantity: 1,
          identified: true,
          acquiredAt: 1,
          item: {
            id: 'test:multi-action-tonic',
            name: '多效药剂',
            category: 'consumable',
            icon: 'magic-potion',
            description: '选择一种效果。',
            rulesText: '选择一种效果。',
            stackable: true,
            useActions: [{
              id: 'drink-healing',
              label: '饮用并恢复',
              economy: 'action',
              consumeQuantity: 1,
              effect: { kind: 'healing', dice: { count: 2, sides: 4, bonus: 2 } },
            }],
            source: { book: '测试', license: '测试' },
          },
        }],
      },
    })
    const transaction = createCombatTransaction({
      id: 'item-use:multi-action', mapId: 'map', combatId: 'combat', actorId: source.id,
      actionId: 'item-use:multi-action', actionKind: 'item-use', now: 2,
    })
    const result = resolveDnd5eAuthoritativeItemUse({
      characters: [source],
      sourceCharacterId: source.id,
      instanceId: 'multi-action-tonic-1',
      useActionId: 'drink-healing',
      healingRolls: [2, 3],
      transaction,
    })

    expect(result).toMatchObject({ ok: true, source: { currentHp: 12 }, healingApplied: 7 })
    if (result.ok) expect(normalizeDnd5eInventory(result.source).entries).toHaveLength(0)
  })

  it('settles Goodberry as fixed healing without a die or roll-ledger entry', () => {
    const source = character('goodberry-source', 5)
    const granted = applyDnd5eInventoryMutation([source], {
      type: 'grant', characterId: source.id, templateId: 'srd-5.1:item:goodberry', quantity: 10,
    })
    const entry = normalizeDnd5eInventory(granted.characters[0]).entries[0]
    const transaction = createCombatTransaction({
      id: 'item-use:goodberry', mapId: 'map', combatId: 'combat', actorId: source.id,
      actionId: 'item-use:goodberry', actionKind: 'item-use', now: 3,
    })

    const result = resolveDnd5eAuthoritativeItemUse({
      characters: granted.characters,
      sourceCharacterId: source.id,
      instanceId: entry.instanceId,
      healingRolls: [],
      transaction,
    })

    expect(result).toMatchObject({ ok: true, source: { currentHp: 6 }, healingRolled: 1, healingApplied: 1 })
    if (!result.ok) return
    expect(normalizeDnd5eInventory(result.source).entries[0].quantity).toBe(9)
    expect(result.transaction?.rollLedger.entries).toEqual([])
  })
})
