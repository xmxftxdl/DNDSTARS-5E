import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { dnd5eInventoryItemTemplate } from './items'
import { alterDnd5eGroundInventoryItem, expireDnd5eGroundInventoryAlterations } from './mapInventoryAlteration'
import type { BattleMap } from '../../store/maps'

it.each(['success', 'stale', 'quantity', 'bound', 'wrong-template'] as const)('alters ground units without pickup or loss: %s', mode => {
  const character = normalizeCharacter({ id: 'caster', name: 'Caster' })
  const templateId = 'srd-5.1:item:gold-dust-25gp'
  const map: BattleMap = { id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0,
    showGrid: true, tokens: [{ id: 'pile', label: 'Pile', x: 75, y: 75, size: 1, type: 'obstacle', color: '', emoji: '',
      dnd5eObjectState: { schemaVersion: 1, weightPounds: 5, magical: mode === 'bound',
        inventoryItem: { templateId, quantity: 5, receiptId: 'pile-receipt' } } }] }
  const before = structuredClone(map)
  const result = alterDnd5eGroundInventoryItem({ map, sourceCharacter: character, tokenId: 'pile', expectedReceiptId: mode === 'stale' ? 'old' : 'pile-receipt',
    expectedQuantity: 5, quantity: mode === 'quantity' ? 6 : 3, originalTemplateIds: mode === 'wrong-template' ? ['missing'] : [templateId],
    replacement: dnd5eInventoryItemTemplate('srd-5.1:item:goodberry')!, sourceEffectTag: 'item-lease:11111111-1111-1111-1111-111111111111',
    sourceSpellcastingModifier: 4, now: 100 })
  expect(result.ok).toBe(mode === 'success')
  expect(map).toEqual(before)
  if (!result.ok) { expect(result).not.toHaveProperty('map'); return }
  expect(result.map.tokens).toHaveLength(4)
  expect(result.map.tokens.find(token => token.id === 'pile')?.dnd5eObjectState?.inventoryItem?.quantity).toBe(2)
  expect(result.map.tokens.every(token => token.x === 75 && token.y === 75)).toBe(true)
  expect(result.map.tokens.reduce((sum, token) => sum + (token.dnd5eObjectState?.weightPounds ?? 0), 0)).toBe(5)
  expect(result.map.tokens.filter(token => token.id !== 'pile').every(token => token.dnd5eObjectState?.inventoryItem?.instance?.sourceSpellcastingModifier === 4)).toBe(true)
  expect(expireDnd5eGroundInventoryAlterations(result.map, [])).toBe(result.map)
  const restored = expireDnd5eGroundInventoryAlterations(JSON.parse(JSON.stringify(result.map)), [character])
  expect(restored.tokens.every(token => token.dnd5eObjectState?.inventoryItem?.templateId === templateId)).toBe(true)
  expect(restored.tokens.reduce((sum, token) => sum + token.dnd5eObjectState!.inventoryItem!.quantity, 0)).toBe(5)
  expect(restored.tokens.every(token => !token.dnd5eObjectState?.inventoryItem?.instance?.spellAlteration)).toBe(true)
  expect(expireDnd5eGroundInventoryAlterations(restored, [character])).toBe(restored)
})
