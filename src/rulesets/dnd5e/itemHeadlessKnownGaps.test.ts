import { describe, expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { applyDnd5eInventoryMutation, normalizeDnd5eInventory } from './items'
import { createDnd5eMechanicalEffect } from './activeEffects'

// Regression coverage for the inventory healing bypass found in the item audit.
describe('inventory healing Headless regressions', () => {
  function usePotion(patch: Record<string, unknown>) {
    const hero = normalizeCharacter({ id: 'audit-target', name: 'audit', charClass: '战士', maxHp: 20, currentHp: 0, equipment: {}, ...patch })
    const source = normalizeCharacter({ id: 'audit-source', name: 'source', charClass: '战士', maxHp: 20, currentHp: 20, equipment: {} })
    const grant = applyDnd5eInventoryMutation([source, hero], { type: 'grant', characterId: source.id, templateId: 'srd-5.1:item:potion-of-healing', quantity: 1 })
    const entry = normalizeDnd5eInventory(grant.characters[0]).entries[0]
    return applyDnd5eInventoryMutation(grant.characters, { type: 'use', characterId: source.id, targetCharacterId: hero.id, instanceId: entry.instanceId, healingRolls: [2, 3] })
  }
  it('must respect preventHealing on the target', () => {
    const result = usePotion({ currentHp: 5, dnd5eCombatState: { activeEffects: [createDnd5eMechanicalEffect({
      definitionId: 'audit:prevent-healing', label: '无法治疗', source: { kind: 'spell', actorId: 'enemy' }, targetId: 'audit-target', modifiers: { preventHealing: true },
    })] } })
    expect(result.characters[1].currentHp).toBe(5)
  })
  it('must not restore hit points to a dead target', () => {
    const result = usePotion({ deathSaveFailures: 3 })
    expect(result.characters[1].currentHp).toBe(0)
  })
})
