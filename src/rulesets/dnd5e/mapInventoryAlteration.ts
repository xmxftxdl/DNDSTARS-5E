import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import type { Dnd5eInventoryItemTemplate } from '../../types/inventory'
import { normalizeDnd5eMapObjectStateV1 } from './mapObjectState'
import { dnd5eInventoryItemTemplate } from './items'
import { alterDnd5eInventoryItem, restoreDnd5eInventoryItem } from './inventoryItemAlteration'
import { tokenFootprintDistanceCells } from '../../lib/gridCombat'
import { mapGeometryLineOfEffectBlocked, mapGeometryRuntimeForMap, mapGeometryTokenElevation } from '../../lib/mapGeometry'

export function dnd5eGroundInventoryAlterationCandidates(map: BattleMap, actorId: string, rangeFeet: number, originalTemplateIds: readonly string[]) {
  const actor = map.tokens.find(token => token.id === actorId), geometry = mapGeometryRuntimeForMap(map.id)
  if (!actor || !Number.isFinite(rangeFeet) || rangeFeet < 0 || !Number.isFinite(map.gridSize) || map.gridSize <= 0 ||
      !Number.isFinite(map.feetPerCell ?? 5) || (map.feetPerCell ?? 5) <= 0) return []
  const elevation = mapGeometryTokenElevation(geometry, actor)
  return map.tokens.flatMap(token => {
    const object = normalizeDnd5eMapObjectStateV1(token.dnd5eObjectState), item = object?.inventoryItem
    if (token.type !== 'obstacle' || token.dnd5eSpellEffect || token.dnd5eSummon || !item || !object ||
        object.magical || object.creation || object.sequester || object.wornOrCarried || object.locked || object.arcaneLock ||
        item.boundEffects?.length || object.waterContainer || object.consumable || item.instance?.spellAlteration ||
        !originalTemplateIds.includes(item.templateId) || ![actor.x, actor.y, token.x, token.y].every(Number.isFinite)) return []
    const targetElevation = mapGeometryTokenElevation(geometry, token)
    if (tokenFootprintDistanceCells(actor, token, map) * (map.feetPerCell ?? 5) > rangeFeet || Math.abs(elevation - targetElevation) > rangeFeet ||
        mapGeometryLineOfEffectBlocked({ geometry, map, from: actor, to: token, fromElevationFeet: elevation, toElevationFeet: targetElevation })) return []
    return [{ tokenId: token.id, quantity: item.quantity, expectedReceiptId: item.receiptId, expectedQuantity: item.quantity,
      label: `地面 · ${token.label} × ${item.quantity}` }]
  })
}

/** Pure physical handoff. The caller must validate range, the authored total,
 * and the live source effect before committing the returned map. */
export function alterDnd5eGroundInventoryItem(input: {
  map: BattleMap; sourceCharacter: Character; tokenId: string; expectedReceiptId: string; expectedQuantity: number;
  quantity: number; originalTemplateIds: readonly string[]; replacement: Dnd5eInventoryItemTemplate;
  sourceEffectTag: string; sourceSpellcastingModifier?: number; now: number;
}): { ok: true; map: BattleMap } | { ok: false } {
  const matches = input.map.tokens.filter(token => token.id === input.tokenId)
  if (matches.length !== 1) return { ok: false }
  const token = matches[0], object = normalizeDnd5eMapObjectStateV1(token.dnd5eObjectState), item = object?.inventoryItem
  if (token.type !== 'obstacle' || token.dnd5eSpellEffect || token.dnd5eSummon || !object || !item ||
      object.magical || object.creation || object.sequester || object.wornOrCarried || object.locked || object.arcaneLock ||
      item.boundEffects?.length || object.waterContainer || object.consumable ||
      item.receiptId !== input.expectedReceiptId || item.quantity !== input.expectedQuantity ||
      !Number.isSafeInteger(input.quantity) || input.quantity < 1 || input.quantity > item.quantity || input.quantity > 100 ||
      !input.originalTemplateIds.includes(item.templateId)) return { ok: false }
  const originalTemplate = dnd5eInventoryItemTemplate(item.templateId)
  if (!originalTemplate || !Number.isFinite(input.now)) return { ok: false }
  const created: Token[] = []
  for (let index = 0; index < input.quantity; index++) {
    const original = item.instance ? structuredClone(item.instance) : {
      instanceId: crypto.randomUUID(), templateId: item.templateId, quantity: 1, acquiredAt: input.now,
      item: structuredClone(originalTemplate), identified: item.identified,
    }
    const holder: Character = { ...input.sourceCharacter, equipment: {}, dnd5eInventory: { schemaVersion: 3, revision: 0, entries: [original] } }
    const changed = alterDnd5eInventoryItem(holder, { expectedInventoryRevision: 0, instanceId: original.instanceId, quantity: 1,
      replacement: input.replacement, sourceEffectTag: input.sourceEffectTag, sourceEffectOwnerId: input.sourceCharacter.id,
      sourceSpellcastingModifier: input.sourceSpellcastingModifier })
    if (!changed.ok) return { ok: false }
    const instance = changed.character.dnd5eInventory!.entries[0]
    created.push({ ...token, id: crypto.randomUUID(), label: input.replacement.name, dnd5eObjectState: {
      ...object, magical: true, weightPounds: object.weightPounds == null ? undefined : object.weightPounds / item.quantity,
      inventoryItem: { templateId: instance.templateId, quantity: 1, receiptId: crypto.randomUUID(), instance, identified: true },
    } })
  }
  return { ok: true, map: { ...input.map, tokens: input.map.tokens.flatMap(candidate => candidate.id !== token.id ? [candidate]
    : item.quantity === input.quantity ? created : [{ ...token, dnd5eObjectState: { ...object,
      weightPounds: object.weightPounds == null ? undefined : object.weightPounds * (item.quantity - input.quantity) / item.quantity,
      inventoryItem: { ...item, quantity: item.quantity - input.quantity } } }, ...created]) } }
}

/** Missing owners are unknown, not proof of expiry. Restore exactly the ground unit. */
export function expireDnd5eGroundInventoryAlterations(map: BattleMap, characters: readonly Character[]): BattleMap {
  const tags = new Set(characters.flatMap(character => character.dnd5eCombatState?.activeEffects?.flatMap(effect => effect.tags ?? []) ?? []))
  let changed = false
  const tokens = map.tokens.map(token => {
    const item = token.dnd5eObjectState?.inventoryItem, entry = item?.instance
    if (!entry?.spellAlteration || !entry.sourceEffectTag || tags.has(entry.sourceEffectTag)) return token
    const source = characters.find(character => character.id === entry.sourceEffectOwnerId)
    if (!source) return token
    const restored = restoreDnd5eInventoryItem({ ...source, equipment: {}, dnd5eInventory: { schemaVersion: 3, revision: 0, entries: [entry] } }, entry.instanceId, entry.sourceEffectTag)
    if (!restored.ok) return token
    changed = true
    const original = restored.character.dnd5eInventory!.entries[0]
    return { ...token, label: original.item.name, dnd5eObjectState: { ...token.dnd5eObjectState!, magical: false,
      inventoryItem: { ...item!, templateId: original.templateId, quantity: 1, instance: original, identified: original.identified } } }
  })
  return changed ? { ...map, tokens } : map
}
