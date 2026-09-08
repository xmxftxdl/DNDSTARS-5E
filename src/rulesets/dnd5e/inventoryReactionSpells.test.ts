import { describe, expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { applyDnd5eInventoryMutation, normalizeDnd5eInventory } from './items'
import {
  applyDnd5eInventoryReactionSpellSnapshotsToCharacter,
  dnd5eInventoryReactionSpellSnapshots,
} from './inventoryReactionSpells'

function character(id: string, charClass: string, classLevels: Record<string, number>) {
  return normalizeCharacter({
    id,
    name: id,
    player: id,
    charClass,
    dnd5eClassLevels: classLevels,
    maxHp: 20,
    currentHp: 20,
    equipment: {},
    dnd5eInventory: { schemaVersion: 1, entries: [] },
  })
}

function grant(owner: ReturnType<typeof character>, templateId: string) {
  const result = applyDnd5eInventoryMutation([owner], {
    type: 'grant', characterId: owner.id, templateId, quantity: 1,
  })
  expect(result.ok, result.ok ? undefined : result.message).toBe(true)
  return result.characters[0]
}

describe('inventory reaction spell projection', () => {
  it('projects only reaction scrolls on a compatible spell list', () => {
    const wizard = grant(
      grant(
        character('wizard', '法师', { wizard: 5 }),
        'srd-5.1:spell-scroll:shield',
      ),
      'srd-5.1:spell-scroll:counterspell',
    )
    expect(dnd5eInventoryReactionSpellSnapshots(wizard)).toEqual([
      expect.objectContaining({ spellId: 'shield', castAtLevel: 1, quantity: 1 }),
      expect.objectContaining({ spellId: 'counterspell', castAtLevel: 3, quantity: 1 }),
    ])

    const warlock = grant(
      character('warlock', '邪术师', { warlock: 5 }),
      'srd-5.1:spell-scroll:hellish-rebuke',
    )
    expect(dnd5eInventoryReactionSpellSnapshots(warlock)).toEqual([
      expect.objectContaining({
        spellId: 'hellish-rebuke', castAtLevel: 1, spellSaveDc: 13, quantity: 1,
      }),
    ])

    const fighter = grant(
      character('fighter', '战士', { fighter: 5 }),
      'srd-5.1:spell-scroll:shield',
    )
    expect(dnd5eInventoryReactionSpellSnapshots(fighter)).toEqual([])
  })

  it('writes an authoritative consumed quantity back to inventory', () => {
    const owner = grant(
      character('owner', '法师', { wizard: 5 }),
      'srd-5.1:spell-scroll:shield',
    )
    const snapshot = dnd5eInventoryReactionSpellSnapshots(owner)[0]
    expect(snapshot).toBeDefined()
    if (!snapshot) return
    const updated = applyDnd5eInventoryReactionSpellSnapshotsToCharacter({
      character: owner,
      snapshots: [{ ...snapshot, quantity: 0 }],
      revision: (normalizeDnd5eInventory(owner).revision ?? 0) + 1,
    })
    expect(normalizeDnd5eInventory(updated).entries).toEqual([])
  })
})
