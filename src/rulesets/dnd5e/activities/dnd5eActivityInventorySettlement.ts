import type { Character } from '../../../types/character'
import type { BattleMap } from '../../../store/maps'
import { tokenFootprintDistanceCells } from '../../../lib/gridCombat'
import { mapGeometryLineOfEffectBlocked, mapGeometryRuntimeForMap, mapGeometryTokenElevation } from '../../../lib/mapGeometry'
import type { Dnd5eHeadlessCombatState } from '../headlessCombatEngine'
import { alterDnd5eInventoryItemBatch, restoreDnd5eInventoryItem } from '../inventoryItemAlteration'
import { dnd5eInventoryItemTemplate, normalizeDnd5eInventory } from '../items'
import type { Dnd5eActivityCapabilityProposal } from './dnd5eActivityExecutor'
import { alterDnd5eGroundInventoryItem, expireDnd5eGroundInventoryAlterations } from '../mapInventoryAlteration'

/** Settle mixed carried and ground selections as one Host transaction. */
export function settleDnd5eActivityPhysicalAlterations(input: Parameters<typeof settleDnd5eActivityInventoryAlterations>[0] & {
  map: BattleMap; groundSelections?: unknown; now: number;
}): { ok: true; map: BattleMap; characters: readonly Character[] } | { ok: false } {
  // Effects have committed only to the staged Headless state. Restore leases
  // ended by that state before selecting their physical originals; keep the
  // pre-action baseline for client revision checks and publish nothing on error.
  const sourceState = input.state.combatants[input.actorId]
  if (input.proposals.length && sourceState) {
    const liveTags = new Set(sourceState.classState.activeEffects?.flatMap(effect => effect.tags ?? []) ?? [])
    const characters = input.characters.map(character => {
      let current = character
      for (const entry of character.dnd5eInventory?.entries ?? []) {
        if (entry.spellAlteration && entry.sourceEffectOwnerId === input.characterId && entry.sourceEffectTag && !liveTags.has(entry.sourceEffectTag)) {
          const restored = restoreDnd5eInventoryItem(current, entry.instanceId, entry.sourceEffectTag)
          if (restored.ok) current = restored.character
        }
      }
      return current
    })
    const source = characters.find(character => character.id === input.characterId)
    const map = source ? expireDnd5eGroundInventoryAlterations(input.map, [{ ...source,
      dnd5eCombatState: { ...source.dnd5eCombatState, activeEffects: sourceState.classState.activeEffects } }]) : input.map
    input = { ...input, characters, map }
  }
  if (input.groundSelections == null) {
    const result = settleDnd5eActivityInventoryAlterations(input)
    return result.ok ? { ...result, map: input.map } : result
  }
  const proposal = input.proposals[0], ground = input.groundSelections
  const source = input.characters.find(character => character.id === input.characterId)
  const actor = input.map.tokens.find(token => token.id === input.actorId)
  if (input.proposals.length !== 1 || !proposal.includeGroundItems || proposal.selectionRangeFeet == null ||
      proposal.actorId !== input.actorId || !source || !actor || !proposal.sourceEffectTag ||
      !input.state.combatants[input.actorId]?.classState.activeEffects?.some(effect => effect.tags?.includes(proposal.sourceEffectTag!)) ||
      !Array.isArray(ground) || !ground.length || ground.length > 100) return { ok: false }
  const carried = input.selection.items
  if (carried != null && !Array.isArray(carried)) return { ok: false }
  const carriedQuantity = (carried ?? []).reduce((sum: number, item: { quantity?: number }) => sum + (item?.quantity ?? NaN), 0)
  let groundQuantity = 0
  const ids = new Set<string>()
  const geometry = mapGeometryRuntimeForMap(input.map.id), elevation = mapGeometryTokenElevation(geometry, actor)
  if (!Number.isFinite(input.map.gridSize) || input.map.gridSize <= 0 || (input.map.feetPerCell ?? 5) <= 0) return { ok: false }
  for (const item of ground) {
    if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.tokenId !== 'string' || ids.has(item.tokenId) ||
        !Number.isSafeInteger(item.quantity) || item.quantity < 1) return { ok: false }
    ids.add(item.tokenId); groundQuantity += item.quantity
    const token = input.map.tokens.find(token => token.id === item.tokenId)
    if (!token || ![actor.x, actor.y, token.x, token.y].every(Number.isFinite)) return { ok: false }
    const targetElevation = mapGeometryTokenElevation(geometry, token)
    if (tokenFootprintDistanceCells(actor, token, input.map) * (input.map.feetPerCell ?? 5) > proposal.selectionRangeFeet ||
        Math.abs(elevation - targetElevation) > proposal.selectionRangeFeet || mapGeometryLineOfEffectBlocked({ geometry, map: input.map,
          from: actor, to: token, fromElevationFeet: elevation, toElevationFeet: targetElevation })) return { ok: false }
  }
  if (groundQuantity + carriedQuantity !== proposal.quantity) return { ok: false }
  let characters = input.characters
  if (carriedQuantity > 0) {
    const result = settleDnd5eActivityInventoryAlterations({ ...input, proposals: [{ ...proposal, quantity: carriedQuantity }] })
    if (!result.ok) return result
    characters = result.characters
  } else if (carried?.length || input.selection.instanceId != null || input.selection.ownerId != null) return { ok: false }
  const replacement = dnd5eInventoryItemTemplate(proposal.templateId)
  if (!replacement) return { ok: false }
  let map = input.map
  for (const item of ground) {
    const result = alterDnd5eGroundInventoryItem({ map, sourceCharacter: source, tokenId: item.tokenId,
      expectedReceiptId: item.expectedReceiptId, expectedQuantity: item.expectedQuantity, quantity: item.quantity,
      originalTemplateIds: proposal.originalTemplateIds, replacement, sourceEffectTag: proposal.sourceEffectTag,
      sourceSpellcastingModifier: proposal.sourceSpellcastingModifier, now: input.now })
    if (!result.ok) return result
    map = result.map
  }
  return { ok: true, map, characters }
}

/** Derive reachable inventory owners from the authoritative scene, including height and walls. */
export function dnd5eActivityReachableInventoryOwners(map: BattleMap, actorId: string, ranges: readonly number[]) {
  const actor = map.tokens.find(token => token.id === actorId)
  const result = new Map<number, ReadonlySet<string>>()
  if (!actor || !Number.isFinite(map.gridSize) || map.gridSize <= 0 || !Number.isFinite(map.feetPerCell ?? 5) || (map.feetPerCell ?? 5) <= 0) return result
  const geometry = mapGeometryRuntimeForMap(map.id)
  const elevation = mapGeometryTokenElevation(geometry, actor)
  for (const range of new Set(ranges)) {
    if (!Number.isFinite(range) || range < 0) continue
    const owners = new Set<string>()
    for (const target of map.tokens) {
      if (!target.characterId || ![actor.x, actor.y, target.x, target.y].every(Number.isFinite)) continue
      const targetElevation = mapGeometryTokenElevation(geometry, target)
      if (tokenFootprintDistanceCells(actor, target, map) * (map.feetPerCell ?? 5) > range ||
          Math.abs(elevation - targetElevation) > range || mapGeometryLineOfEffectBlocked({ geometry, map, from: actor, to: target,
            fromElevationFeet: elevation, toElevationFeet: targetElevation })) continue
      owners.add(target.characterId)
    }
    result.set(range, owners)
  }
  return result
}

/** Host-only handoff settlement. The baseline validates the player's observed
 * revision; characters may already include this transaction's material cost. */
export function settleDnd5eActivityInventoryAlterations(input: {
  characters: readonly Character[]
  baselineCharacters: readonly Character[]
  state: Dnd5eHeadlessCombatState
  actorId: string
  characterId: string
  characterIdByCombatantId?: Readonly<Record<string, string>>
  /** Map authority, never a player payload. Required for nearby inventory selection. */
  reachableOwnerIdsByRange?: ReadonlyMap<number, ReadonlySet<string>>
  proposals: readonly Extract<Dnd5eActivityCapabilityProposal, { kind: 'alter-inventory-item' }>[]
  selection: { instanceId?: unknown; ownerId?: unknown; expectedRevision?: unknown; items?: unknown }
}): { ok: true; characters: readonly Character[] } | { ok: false } {
  if (!input.proposals.length) return { ok: true, characters: input.characters }
  const proposal = input.proposals[0]
  if (proposal.selectionRangeFeet != null) {
    const allowed = input.reachableOwnerIdsByRange?.get(proposal.selectionRangeFeet)
    const items = input.selection.items
    if (input.proposals.length !== 1 || !allowed || !Array.isArray(items) || !items.length || items.length > 100 ||
        items[0]?.instanceId !== input.selection.instanceId || items[0]?.ownerId !== input.selection.ownerId ||
        items[0]?.expectedRevision !== input.selection.expectedRevision) return { ok: false }
    const identities = new Set<string>()
    let total = 0
    for (const item of items) {
      if (!item || typeof item !== 'object' || Array.isArray(item) || !allowed.has(item.ownerId) ||
          typeof item.instanceId !== 'string' || !Number.isSafeInteger(item.quantity) || item.quantity < 1 ||
          !Number.isSafeInteger(item.expectedRevision)) return { ok: false }
      const identity = JSON.stringify([item.ownerId, item.instanceId])
      if (identities.has(identity)) return { ok: false }
      identities.add(identity); total += item.quantity
    }
    if (total !== proposal.quantity) return { ok: false }
    let characters = input.characters
    for (const item of items) {
      const ownerActorId = item.ownerId === input.characterId ? undefined
        : Object.entries(input.characterIdByCombatantId ?? {}).find(([, characterId]) => characterId === item.ownerId)?.[0]
      if (item.ownerId !== input.characterId && !ownerActorId) return { ok: false }
      const settled = settleDnd5eActivityInventoryAlterations({ ...input, characters,
        proposals: [{ ...proposal, selectionRangeFeet: undefined, ownerActorId, inventoryInstanceId: item.instanceId, quantity: item.quantity }],
        selection: { instanceId: item.instanceId, ownerId: item.ownerId, expectedRevision: item.expectedRevision } })
      if (!settled.ok) return { ok: false }
      characters = settled.characters
    }
    return { ok: true, characters }
  }
  const ownerCharacterId = proposal.ownerActorId == null ? input.characterId
    : input.characterIdByCombatantId?.[proposal.ownerActorId]
  if (!ownerCharacterId) return { ok: false }
  const { selection } = input
  const owners = input.characters.filter(character => character.id === ownerCharacterId)
  const baseline = input.baselineCharacters.filter(character => character.id === ownerCharacterId)
  if (input.proposals.length !== 1 || owners.length !== 1 || baseline.length !== 1 ||
      typeof selection.instanceId !== 'string' || !Number.isSafeInteger(selection.expectedRevision) ||
       selection.ownerId != null && selection.ownerId !== ownerCharacterId ||
      (normalizeDnd5eInventory(baseline[0]).revision ?? 0) !== selection.expectedRevision) return { ok: false }
  const owner = owners[0]
  const source = input.state.combatants[input.actorId]
  if (proposal.actorId !== input.actorId || proposal.inventoryInstanceId !== selection.instanceId ||
      (proposal.permanent ? proposal.sourceEffectTag != null || proposal.sourceEffectId != null || proposal.sourceSpellcastingModifier != null
        : !proposal.sourceEffectTag || !source?.classState.activeEffects?.some(effect => effect.tags?.includes(proposal.sourceEffectTag!)))) return { ok: false }
  if (owner.dnd5eInventory?.entries.some(entry => entry.instanceId === selection.instanceId && entry.remainingCharges != null)) return { ok: false }
  const inventory = normalizeDnd5eInventory(owner)
  const original = inventory.entries.find(entry => entry.instanceId === selection.instanceId)
  const replacement = dnd5eInventoryItemTemplate(proposal.templateId)
  if (!original || !proposal.originalTemplateIds.includes(original.templateId) || !replacement) return { ok: false }
  const selections: { ownerId: string; instanceId: string; quantity: number; expectedInventoryRevision: number; splitInstanceId: string }[] = []
  if (selection.items != null) {
    if (!Array.isArray(selection.items) || !selection.items.length || selection.items.length > 100) return { ok: false }
    for (const item of selection.items) {
      if (!item || typeof item !== 'object' || Array.isArray(item) || item.ownerId !== owner.id ||
          typeof item.instanceId !== 'string' || !Number.isSafeInteger(item.quantity) || item.quantity < 1 ||
          item.expectedRevision !== selection.expectedRevision ||
          owner.dnd5eInventory?.entries.some(entry => entry.instanceId === item.instanceId && entry.remainingCharges != null)) return { ok: false }
      selections.push({ ownerId: owner.id, instanceId: item.instanceId, quantity: item.quantity,
        expectedInventoryRevision: inventory.revision ?? 0, splitInstanceId: crypto.randomUUID() })
    }
    if (selections[0].instanceId !== selection.instanceId) return { ok: false }
  } else selections.push({ ownerId: owner.id, instanceId: selection.instanceId, expectedInventoryRevision: inventory.revision ?? 0,
    quantity: proposal.quantity, splitInstanceId: crypto.randomUUID() })
  const changed = alterDnd5eInventoryItemBatch(input.characters.map(character => character.id === owner.id ? { ...owner, dnd5eInventory: inventory } : character), {
    quantity: proposal.quantity, originalTemplateIds: proposal.originalTemplateIds,
    selections,
    alteration: { replacement, sourceEffectTag: proposal.sourceEffectTag,
    sourceEffectOwnerId: proposal.permanent ? undefined : input.characterId, permanent: proposal.permanent,
    sourceSpellcastingModifier: proposal.sourceSpellcastingModifier,
    },
  })
  return changed.ok ? { ok: true, characters: changed.characters } : { ok: false }
}
