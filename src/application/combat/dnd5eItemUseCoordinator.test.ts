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
})
