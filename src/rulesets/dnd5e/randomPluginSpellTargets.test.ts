import { expect, it, vi } from 'vitest'
import { prepareDnd5eRandomTargetPluginSpellCast } from './randomPluginSpellTargets'
import { resolvePreparedDnd5ePluginSpellCast } from './pluginSpellTransaction'
import { prepareDnd5eLocalContentJson } from './localContentCollection'
import { dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { normalizeCharacter } from '../../store/characters'
import { createDnd5eMechanicalEffect, createDnd5eConditionEffect } from './activeEffects'
import type { BattleMap, Token } from '../../store/maps'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'

it.each([{ count: 1, duplicates: false, relation: 'any' }, { count: 2, duplicates: false, relation: 'any' }, { count: 2, duplicates: true, relation: 'any' }, { count: 1, duplicates: false, relation: 'enemy' }] as const)('randomizes $count imported spell targets, duplicates=$duplicates, relation=$relation', async ({ count, duplicates, relation }) => {
  const content = await prepareDnd5eLocalContentJson(JSON.stringify({ name: 'Random target test',
    spells: [{ id: 'test', name: 'Test', level: 2, school: 'evocation', ritual: false,
      castingTime: { value: 1, unit: 'action' }, range: { type: 'distance', feet: 30 },
      components: { verbal: true, somatic: true, material: false }, duration: { type: 'instantaneous', concentration: false },
      classes: ['wizard'], description: 'Synthetic.', automation: { mode: 'full' } }],
    activityPatterns: [{ schemaVersion: 1, id: 'cast', name: 'Test', source: { kind: 'spell', id: 'test' },
      activation: { kind: 'action', cost: 1 }, target: { kind: 'creature', relation, count, rangeFeet: 30, includeSelf: true, allowDuplicateTargets: duplicates },
      pattern: 'roll-effect', result: { kind: 'damage', damageType: 'cold', amount: { kind: 'constant', value: 2 } } }],
  }), 'random-test.json', { targetCollection: 'spells' })
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(content.package))
  try {
    const spellId = content.package.manifest.id + ':test'
    const actor = normalizeCharacter({ id: 'owner', name: 'Caster', charClass: '法师', level: 5, maxHp: 30, currentHp: 30,
      abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': [spellId] } } } },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 3 } },
    })
    const effect = createDnd5eMechanicalEffect({ id: 'random', definitionId: 'test:random', label: 'Random', targetId: 'caster',
      source: { kind: 'spell' }, modifiers: { randomVisibleCreatureTargets: true, perceiveVisibleCreaturesAsHostile: true } })
    actor.dnd5eCombatState = { activeEffects: [effect] }
    const token = (id: string, x: number, patch: Partial<Token> = {}): Token => ({ id, label: id, type: 'enemy',
      x, y: 25, color: '', emoji: '', size: 1, hp: 30, maxHp: 30, ...patch })
    const caster = token('caster', 25, { type: 'player', characterId: actor.id })
    const ally = token('ally', 75, { dnd5eSide: 'player' })
    const enemy = token('enemy', 125)
    const hidden = token('hidden', 175, { dnd5eCombatState: { activeEffects: [createDnd5eConditionEffect({
      id: 'invisible', condition: 'invisible', targetId: 'hidden', source: { kind: 'dm' },
    })] } })
    const map: BattleMap = { id: 'random-spell', name: 'Test', width: 1000, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [caster, ally, enemy, hidden, token('far', 825), token('object', 100, { type: 'obstacle' })] }
    const action: SharedPlayerActionState = { id: 'cast', combatId: 'combat', mapId: map.id, type: 'dnd5e-spell-cast',
      sourceMode: 'player', status: 'pending', actorTokenId: caster.id, characterId: actor.id,
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
      dnd5eSpellCast: { spellId, slotLevel: 2, castingClassId: 'wizard', targetTokenId: 'enemy', targetTokenIds: count === 1 ? ['enemy'] : ['enemy', 'ally'] } }
    const choose = vi.fn((occurrence: number, ids: readonly string[]) => {
      expect([...ids].sort()).toEqual(occurrence === 0 || duplicates ? ['ally', 'enemy'] : ['enemy'])
      return occurrence === 0 || duplicates ? 'ally' : 'enemy'
    })
    const input = { action, map, characters: [actor], initiativeOrder: [{ tokenId: 'caster', label: 'Caster', emoji: '', color: '', roll: 20 }], chooseRandomTarget: choose }
    const prepared = prepareDnd5eRandomTargetPluginSpellCast(input)
    expect(prepared.ok, JSON.stringify(prepared)).toBe(true)
    if (!prepared.ok) throw Error(prepared.reason)
    expect(choose).toHaveBeenCalledTimes(count)
    expect(prepared.prepared.targetTokens.map(t => t.id)).toEqual(count === 1 ? ['ally'] : duplicates ? ['ally', 'ally'] : ['ally', 'enemy'])
    expect(actor.classResources?.['dnd5e-spell-slot-2'].current).toBe(1)
    const resolved = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: { activityRolls: {} } })
    expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
    expect(resolved.application?.map.tokens.find(t => t.id === 'ally')?.hp).toBe(duplicates ? 26 : 28)
    expect(resolved.application?.map.tokens.find(t => t.id === 'enemy')?.hp).toBe(count === 1 || duplicates ? 30 : 28)
    expect(resolved.application?.characters[0].classResources?.['dnd5e-spell-slot-2'].current).toBe(0)
    expect(resolved.result.state.initiativeOrder).toEqual(['caster'])
    expect(ally.dnd5eSide).toBe('player')
    const forged = structuredClone(prepared.prepared)
    forged.activityHeadlessAction!.projectileTargetIds = Array.from({ length: count + 1 }, () => 'ally')
    const refused = resolvePreparedDnd5ePluginSpellCast({ prepared: forged, rolls: { activityRolls: {} } })
    expect(refused.result.ok).toBe(false)
    expect(refused.result.state.combatants.caster.classResources['dnd5e-spell-slot-2'].current).toBe(1)
    expect(refused.result.state.combatants.ally.currentHp).toBe(30)
    const invalidChoice = prepareDnd5eRandomTargetPluginSpellCast({ ...input, chooseRandomTarget: () => 'far' })
    expect(invalidChoice).toEqual({ ok: false, reason: 'random-target-unavailable' })
    expect(actor.classResources?.['dnd5e-spell-slot-2'].current).toBe(1)
    const noRandom = vi.fn(() => { throw Error('Must not randomize') })
    const self = prepareDnd5eRandomTargetPluginSpellCast({ ...input, chooseRandomTarget: noRandom,
      action: { ...action, dnd5eSpellCast: { ...action.dnd5eSpellCast!, targetTokenId: 'caster', targetTokenIds: ['caster'] } } })
    expect(self.ok).toBe(relation === 'any')
    expect(noRandom).not.toHaveBeenCalled()
    effect.suspendedBy = ['antimagic-test']
    expect(prepareDnd5eRandomTargetPluginSpellCast({ ...input, chooseRandomTarget: noRandom }).ok).toBe(true)
    expect(noRandom).not.toHaveBeenCalled()

    actor.dnd5eCombatState = { activeEffects: [] }
    const normal = prepareDnd5eRandomTargetPluginSpellCast({ ...input, chooseRandomTarget: noRandom })
    expect(normal.ok).toBe(true)
    expect(noRandom).not.toHaveBeenCalled()
  } finally { dispose() }
})
