import { describe, expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { applyDnd5eInventoryMutation, normalizeDnd5eInventory } from './items'
import { dnd5eCoreSpellMaterialRequirement, dnd5eSpellMaterialConsumptionPlan } from './spellMaterials'
import { reserveDnd5eSpellMaterials, settleDnd5eEndedSpellMaterialEscrows } from './spellMaterialEscrow'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { endDnd5eConcentration, resolveDnd5eHeadlessAction, type Dnd5eCombatEvent } from './headlessCombatEngine'
import type { BattleMap } from '../../store/maps'

function fixture() {
  const actor = normalizeCharacter({ id: 'caster', name: 'Caster', charClass: '法师', level: 9,
    maxHp: 30, currentHp: 30, equipment: {}, dnd5eInventory: { schemaVersion: 3, revision: 0, entries: [] } })
  const granted = applyDnd5eInventoryMutation([actor], { type: 'grant', characterId: actor.id,
    templateId: 'srd-5.1:item:diamond-300gp', quantity: 2 })
  if (!granted.ok) throw new Error('fixture grant failed')
  const character = granted.characters[0]
  const plan = dnd5eSpellMaterialConsumptionPlan(character, dnd5eCoreSpellMaterialRequirement('revivify')!)!
  return { character, plan, binding: { id: 'cast-1', sourceSpellId: 'test:spell', sourceEffectId: 'effect-1' } }
}

describe('durable spell material escrow primitives', () => {
  it.each(['concentration', 'rounds'] as const)('commits %s-end consumption to the map character patch without touching off-map owners', duration => {
    const { character, plan, binding } = fixture()
    const reserved = reserveDnd5eSpellMaterials(character, plan, binding)
    if (!reserved.ok) throw new Error(reserved.reason)
    const owner = reserved.character
    owner.dnd5eCombatState = { concentrationSpellId: duration === 'concentration' ? binding.sourceSpellId : undefined, activeEffects: [createDnd5eMechanicalEffect({
      id: binding.sourceEffectId, definitionId: 'material-lifetime', label: 'Material lifetime', targetId: 'caster-token',
      source: { kind: 'spell', actorId: 'caster-token', rulesId: binding.sourceSpellId },
      duration: duration === 'concentration'
        ? { type: 'concentration', sourceActorId: 'caster-token', concentrationId: binding.sourceSpellId, remainingRounds: 10 }
        : { type: 'rounds', remainingRounds: 1, tickOn: 'target-turn-end' },
    })] }
    const offMap = structuredClone(owner)
    offMap.id = 'off-map'
    offMap.dnd5eCombatState = {}
    const map: BattleMap = { id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0,
      showGrid: true, feetPerCell: 5, tokens: [{ id: 'caster-token', label: 'Caster', type: 'player', characterId: owner.id, x: 25, y: 25, size: 1, color: '', emoji: '' }] }
    const characters = [owner, offMap]
    const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'escrow', map, characters,
      initiativeOrder: [{ tokenId: 'caster-token', label: 'Caster', roll: 20, emoji: '', color: '' }] })
    const apply = (events: Dnd5eCombatEvent[] = []) => planDnd5eMapResultApplication({ state: snapshot.state, map, characters,
      baselineCharacters: characters, characterIdByCombatantId: snapshot.characterIdByCombatantId, events })
    expect(apply().characters[0].dnd5eInventory?.spellMaterialEscrows?.[0].status).toBe('reserved')
    const events: Dnd5eCombatEvent[] = []
    if (duration === 'concentration') endDnd5eConcentration(snapshot.state, snapshot.state.combatants['caster-token'], events)
    else {
      const result = resolveDnd5eHeadlessAction(snapshot.state, { type: 'end-turn', actorId: 'caster-token' })
      expect(result.ok, JSON.stringify(result)).toBe(true)
      if (!result.ok) return
      snapshot.state = result.state
      events.push(...result.events)
    }
    const ended = apply(events)
    expect(ended.characterPatches?.[owner.id]?.dnd5eInventory?.spellMaterialEscrows?.[0].status).toBe('consumed')
    expect(ended.characters[1].dnd5eInventory?.spellMaterialEscrows?.[0].status).toBe('reserved')
    const repeated = planDnd5eMapResultApplication({ state: snapshot.state, map, characters: ended.characters,
      baselineCharacters: ended.characters, characterIdByCombatantId: snapshot.characterIdByCombatantId, events })
    expect(repeated.characters[0].dnd5eInventory?.revision).toBe(ended.characters[0].dnd5eInventory?.revision)
  })
  it('sets aside exact units, preserves them through normalization and consumes once when the exact effect ends', () => {
    const { character, plan, binding } = fixture()
    const reserved = reserveDnd5eSpellMaterials(character, plan, binding)
    expect(reserved.ok).toBe(true)
    if (!reserved.ok) return
    expect(character.dnd5eInventory?.entries[0].quantity).toBe(2)
    expect(reserved.character.dnd5eInventory?.entries[0].quantity).toBe(1)
    expect(reserved.character.dnd5eInventory?.spellMaterialEscrows?.[0]).toMatchObject({ ...binding, status: 'reserved', entries: [{ quantity: 1 }] })
    const restored = normalizeCharacter(JSON.parse(JSON.stringify(reserved.character)))
    restored.dnd5eInventory = normalizeDnd5eInventory(restored)
    expect(restored.dnd5eInventory.spellMaterialEscrows?.[0]).toMatchObject({ ...binding, status: 'reserved', entries: [{ quantity: 1 }] })
    expect(reserveDnd5eSpellMaterials(restored, plan, binding)).toEqual({ ok: true, character: restored })
    expect(settleDnd5eEndedSpellMaterialEscrows(restored, new Set(['effect-1'])).character).toBe(restored)
    const finished = settleDnd5eEndedSpellMaterialEscrows(restored, new Set(['effect-2']))
    expect(finished.consumedEscrowIds).toEqual(['cast-1'])
    expect(finished.character.dnd5eInventory?.spellMaterialEscrows?.[0]).toMatchObject({ status: 'consumed', entries: [] })
    expect(finished.character.dnd5eInventory?.entries[0].quantity).toBe(1)
    const replayed = normalizeCharacter(JSON.parse(JSON.stringify(finished.character)))
    expect(settleDnd5eEndedSpellMaterialEscrows(replayed, new Set()).consumedEscrowIds).toEqual([])
    expect(reserveDnd5eSpellMaterials(replayed, plan, binding)).toEqual({ ok: true, character: replayed })
    expect(reserveDnd5eSpellMaterials(replayed, plan, { ...binding, sourceEffectId: 'forged' }).ok).toBe(false)
  })

  it('prevents reserved units being transferred or allocated twice and preserves receipts through other mutations', () => {
    const { character, plan, binding } = fixture()
    const reserved = reserveDnd5eSpellMaterials(character, plan, binding)
    if (!reserved.ok) throw new Error(reserved.reason)
    const target = normalizeCharacter({ id: 'target', name: 'Target', maxHp: 10, currentHp: 10 })
    const transfer = applyDnd5eInventoryMutation([reserved.character, target], { type: 'transfer', characterId: character.id,
      targetCharacterId: target.id, instanceId: character.dnd5eInventory!.entries[0].instanceId, quantity: 2 })
    expect(transfer.ok).toBe(false)
    const availableTransfer = applyDnd5eInventoryMutation([reserved.character, target], { type: 'transfer', characterId: character.id,
      targetCharacterId: target.id, instanceId: character.dnd5eInventory!.entries[0].instanceId, quantity: 1 })
    expect(availableTransfer.ok).toBe(true)
    expect(availableTransfer.characters[0].dnd5eInventory?.spellMaterialEscrows).toHaveLength(1)
    expect(availableTransfer.characters[1].dnd5eInventory?.spellMaterialEscrows ?? []).toEqual([])
    expect(reserveDnd5eSpellMaterials(reserved.character, plan, { ...binding, id: 'cast-2' }).ok).toBe(false)
    const remainingPlan = dnd5eSpellMaterialConsumptionPlan(reserved.character, dnd5eCoreSpellMaterialRequirement('revivify')!)!
    const second = reserveDnd5eSpellMaterials(reserved.character, remainingPlan, { ...binding, id: 'cast-2', sourceEffectId: 'effect-2' })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(dnd5eSpellMaterialConsumptionPlan(second.character, dnd5eCoreSpellMaterialRequirement('revivify')!)).toBeUndefined()
    const grant = applyDnd5eInventoryMutation([second.character], { type: 'grant', characterId: character.id,
      templateId: 'srd-5.1:item:diamond-100gp', quantity: 1 })
    expect(grant.ok).toBe(true)
    expect(grant.characters[0].dnd5eInventory?.spellMaterialEscrows).toHaveLength(2)
    const ended = settleDnd5eEndedSpellMaterialEscrows(grant.characters[0], new Set(['effect-2']))
    expect(ended.consumedEscrowIds).toEqual(['cast-1'])
    expect(ended.character.dnd5eInventory?.spellMaterialEscrows?.[1].status).toBe('reserved')
  })
})
