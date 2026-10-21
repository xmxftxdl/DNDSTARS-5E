import { describe, expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { applyDnd5eInventoryMutation, dnd5eInventoryEntryUseAction } from './items'
import { createDnd5eConditionEffect, DND5E_COMBAT_STATE_SCHEMA_VERSION } from './activeEffects'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { validateAndNormalizeDnd5ePluginItemHeadlessProtocol } from './plugins/pluginItemHeadlessProtocol'
import { resolveDnd5eAuthoritativeItemUse } from '../../application/combat/dnd5eItemUseCoordinator'
import { createCombatTransaction } from '../../lib/combatTransaction'
import type { Token } from '../../store/maps'

function fixture(otherPoison = false, self = false) {
  const source = normalizeCharacter({ id: 'source', name: 'Source', player: 'player', charClass: '战士', maxHp: 20, currentHp: 20,
    dnd5eInventory: { schemaVersion: 1, entries: [] } })
  const target = self ? source : normalizeCharacter({ ...source, id: 'target', name: 'Target' })
  const spores = createDnd5eConditionEffect({ id: 'spores', definitionId: 'monster-area:vrock-spores',
    condition: 'poisoned', source: { kind: 'monster', actorId: 'vrock' }, targetId: target.id,
    stackingKey: 'monster-area:vrock-spores', duration: { type: 'rounds', remainingRounds: 14400, tickOn: 'target-turn-end' } })
  const poison = createDnd5eConditionEffect({ id: 'other-poison', definitionId: 'other-poison',
    condition: 'poisoned', source: { kind: 'feature', actorId: 'snake' }, targetId: target.id, stackingKey: 'other-poison' })
  target.dnd5eCombatState = { schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION, activeEffects: [spores, ...(otherPoison ? [poison] : [])] }
  target.conditions = ['poisoned', 'prone']
  const grant = applyDnd5eInventoryMutation(self ? [source] : [source, target], {
    type: 'grant', characterId: source.id, templateId: 'srd-5.1:item:holy-water-flask', quantity: 2,
  })
  const entry = grant.characters[0].dnd5eInventory!.entries.find(e => e.templateId === 'srd-5.1:item:holy-water-flask')!
  const mutation = { type: 'use' as const, characterId: source.id, targetCharacterId: target.id,
    instanceId: entry.instanceId, useActionId: 'cleanse-spores', receiptId: 'holy-water:1' }
  return { characters: grant.characters, entry, mutation, targetId: target.id }
}

describe('holy water removes Vrock spores', () => {
  it.each([true, false])('settles an unlinked monster without changing the source effects (infected=%s)', (infected) => {
    const f = fixture(true, true)
    const targetToken: Token = { id: 'monster', label: 'Monster', type: 'enemy', x: 0, y: 0,
      size: 1, color: '#fff', emoji: 'M', dnd5eCombatState: {
        schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
        activeEffects: infected ? f.characters[0].dnd5eCombatState?.activeEffects : undefined,
        conditions: infected ? ['poisoned', 'prone'] : ['prone'],
        summonAttackerIds: ['attacker'],
      } }
    const input = { characters: f.characters, sourceCharacterId: 'source', targetToken,
      instanceId: f.entry.instanceId, useActionId: 'cleanse-spores', turnEconomy: createDnd5eTurnEconomyCounts('test'),
      transaction: createCombatTransaction({ id: 'monster-cleanse', mapId: 'map', combatId: 'combat',
        actorId: 'source', actionId: 'monster-cleanse', actionKind: 'item-use', now: 1 }) }
    const result = resolveDnd5eAuthoritativeItemUse(input)
    if (!infected) {
      expect(result).toMatchObject({ ok: false, reason: 'invalid-target', transaction: { status: 'rolled-back' } })
      return
    }
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.source.dnd5eCombatState).toEqual(f.characters[0].dnd5eCombatState)
    expect(result.source.conditions).toEqual(f.characters[0].conditions)
    expect(result.characters).toHaveLength(1)
    expect(result.targetTokenPatch?.dnd5eCombatState?.activeEffects?.map(e => e.id)).toEqual(['other-poison'])
    expect(result.targetTokenPatch?.dnd5eCombatState).toMatchObject({ conditions: ['prone', 'poisoned'], summonAttackerIds: ['attacker'] })
    expect(result.source.dnd5eInventory?.entries.find(e => e.instanceId === f.entry.instanceId)?.quantity).toBe(1)
    const replay = resolveDnd5eAuthoritativeItemUse({ ...input, characters: JSON.parse(JSON.stringify(result.characters)),
      targetToken: { ...targetToken, ...result.targetTokenPatch } })
    expect(replay).toMatchObject({ ok: true, deduplicated: true })
    if (replay.ok) expect(replay.targetTokenPatch).toBeUndefined()
  })

  it.each([false, true])('cleans the selected target and consumes one flask (self=%s)', (self) => {
    const f = fixture(false, self)
    const result = applyDnd5eInventoryMutation(f.characters, f.mutation, { turnEconomy: createDnd5eTurnEconomyCounts('test') })
    expect(result).toMatchObject({ ok: true, spentEconomy: 'action' })
    const target = result.characters.find(c => c.id === f.targetId)!
    expect(target.dnd5eCombatState?.activeEffects).toBeUndefined()
    expect(target.conditions).toEqual(['prone'])
    expect(target.currentHp).toBe(20)
    expect(result.characters[0].dnd5eInventory?.entries.find(e => e.instanceId === f.entry.instanceId)?.quantity).toBe(1)
    const replay = applyDnd5eInventoryMutation(JSON.parse(JSON.stringify(result.characters)), f.mutation)
    expect(replay).toMatchObject({ ok: true, deduplicated: true })
    expect(replay.characters[0].dnd5eInventory?.entries.find(e => e.instanceId === f.entry.instanceId)?.quantity).toBe(1)
  })

  it('preserves an independent source of poison and other conditions', () => {
    const f = fixture(true)
    const result = applyDnd5eInventoryMutation(f.characters, f.mutation)
    expect(result.ok).toBe(true)
    const target = result.characters[1]
    expect(target.dnd5eCombatState?.activeEffects?.map(e => e.id)).toEqual(['other-poison'])
    expect(target.conditions).toEqual(expect.arrayContaining(['poisoned', 'prone']))
  })

  it('rejects a target without spores without consuming the flask', () => {
    const f = fixture()
    f.characters[1].dnd5eCombatState = { schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION }
    const result = applyDnd5eInventoryMutation(f.characters, f.mutation)
    expect(result).toMatchObject({ ok: false, reason: 'invalid-target' })
    expect(result.characters).toEqual(f.characters)
  })

  it('rejects use when the action is spent', () => {
    const f = fixture()
    const economy = createDnd5eTurnEconomyCounts('test')
    economy.action.current = 0
    const result = applyDnd5eInventoryMutation(f.characters, f.mutation, { turnEconomy: economy })
    expect(result).toMatchObject({ ok: false, reason: 'action-unavailable' })
    expect(result.characters).toEqual(f.characters)
  })

  it('keeps the attack option and exports both validated actions', () => {
    const f = fixture()
    expect(dnd5eInventoryEntryUseAction(f.entry, 'attack')?.effect.kind).toBe('dm-adjudication')
    const normalized = validateAndNormalizeDnd5ePluginItemHeadlessProtocol({ itemId: f.entry.item.id,
      definition: JSON.parse(JSON.stringify(f.entry.item)), hasEquipment: false })
    expect(normalized.useActions?.map(a => a.id)).toEqual(['attack', 'cleanse-spores'])
    expect(normalized.useActions?.[1].targeting).toEqual({ kind: 'creature', rangeFeet: 5, includeSelf: true })
  })
})
