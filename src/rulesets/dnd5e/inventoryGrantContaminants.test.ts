import { describe, expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { applyDnd5eInventoryGrantBundle, applyDnd5eInventoryMutation, normalizeDnd5eInventory } from './items'

const templateId = 'srd-5.1:item:holy-water-flask'
const character = (id: string) => normalizeCharacter({ id, name: id, player: id, charClass: '战士', maxHp: 20, currentHp: 20, equipment: {}, dnd5eInventory: { schemaVersion: 1, entries: [] } })

describe('physical inventory grant contamination', () => {
  it('keeps contaminated holy water separate from clean stock, retains it after transfer and deduplicates replay', () => {
    const clean = applyDnd5eInventoryGrantBundle([character('a'), character('b')], {
      characterId: 'a', receiptId: 'clean', grants: [{ templateId, quantity: 2 }],
    })
    expect(clean.ok).toBe(true)
    const input = { characterId: 'a', receiptId: 'scene-water', grants: [{ templateId, quantity: 2, contaminants: ['poison', 'disease'] as const }] }
    const dirty = applyDnd5eInventoryGrantBundle(clean.characters, input)
    expect(dirty.ok).toBe(true)
    const entries = normalizeDnd5eInventory(dirty.characters[0]).entries
    expect(entries).toHaveLength(2)
    expect(entries.map(e => e.quantity)).toEqual([2, 2])
    const contaminated = entries.find(e => e.contaminants?.includes('poison'))!
    expect(contaminated.contaminants).toEqual(['poison', 'disease'])
    const moved = applyDnd5eInventoryMutation(dirty.characters, { type: 'transfer', characterId: 'a', targetCharacterId: 'b', instanceId: contaminated.instanceId, quantity: 1 })
    expect(moved.ok).toBe(true)
    expect(normalizeDnd5eInventory(moved.characters[1]).entries[0]).toMatchObject({ quantity: 1, contaminants: ['poison', 'disease'] })
    const replay = applyDnd5eInventoryGrantBundle(moved.characters, input)
    expect(replay.deduplicated).toBe(true)
    expect(replay.characters).toEqual(moved.characters)
  })

  it('merges equivalent contamination sets without changing clean stock', () => {
    let characters = [character('a')]
    for (const [index, contaminants] of [undefined, [], ['poison', 'disease'], ['disease', 'poison']].entries()) {
      const result = applyDnd5eInventoryGrantBundle(characters, { characterId: 'a', receiptId: `grant-${index}`, grants: [{ templateId, quantity: 1, contaminants: contaminants as ('poison' | 'disease')[] | undefined }] })
      expect(result.ok).toBe(true)
      characters = result.characters
    }
    expect(normalizeDnd5eInventory(characters[0]).entries.map(e => e.quantity)).toEqual([2, 2])
  })

  it('rejects malformed contamination before granting any item or recording the receipt', () => {
    for (const contaminants of [['fire'], 'poison', ['poison', 'poison', 'disease']]) {
      const characters = [character('a')]
      const result = applyDnd5eInventoryGrantBundle(characters, { characterId: 'a', receiptId: 'invalid', grants: [
        { templateId, quantity: 1 },
        { templateId, quantity: 1, contaminants: contaminants as ('poison' | 'disease')[] },
      ] })
      expect(result.ok).toBe(false)
      expect(result.characters).toEqual(characters)
      expect(normalizeDnd5eInventory(result.characters[0]).authorityGrantReceipts).toEqual([])
    }
  })
})
