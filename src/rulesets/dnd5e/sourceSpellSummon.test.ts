import './activeEffects'
import { expect, it } from 'vitest'
import { migrateMapsState, type BattleMap, type Token } from '../../store/maps'
import { dnd5eIsSourceSpellSummon } from './sourceSpellSummon'
import { normalizeDnd5ePersistentAreaTriggerSnapshot } from './persistentAreaTypes'
import { collectDnd5ePersistentAreaTriggers } from './pluginAreas'
import { prepareDnd5ePersistentAreaTrigger } from './pluginAreaTransactions'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5ePersistentAreaTrigger } from './headlessCombatEngine'

const trigger = { id: 'heal', label: 'Heal', timing: 'turn-end' as const,
  requiresSourceSpellSummon: true as const, includedCreatureTypes: ['beast', 'fey'], healing: { amount: 5 } }
function fixture(): BattleMap {
  const summon: NonNullable<Token['dnd5eSummon']> = { schemaVersion: 1, pluginId: 'test', featureId: 'summon',
    sourceTokenId: 'caster', sourceCharacterId: 'owner', sourceSpellId: 'test-spell',
    createdRound: 1, expiresAfterRound: 10, side: 'player' }
  return { id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
    tokens: [{ id: 'caster', label: 'Caster', type: 'player', characterId: 'owner', x: 25, y: 25, size: 1, color: '', emoji: '' },
      { id: 'target', label: 'Summon', type: 'enemy', x: 75, y: 25, size: 1, color: '', emoji: '', creatureTypes: ['beast'], hp: 1, maxHp: 20, dnd5eSummon: summon }],
    dnd5ePluginAreas: [{ id: 'aura', pluginId: 'test', featureId: 'totem', sourceKind: 'plugin-feature', label: 'Aura', color: '#fff',
      sourceCharacterId: 'owner', sourceTokenId: 'caster', cells: [{ col: 1, row: 0 }], anchorCell: { col: 1, row: 0 },
      anchorMode: 'fixed', createdRound: 1, expiresAfterRound: 10, triggers: [trigger] }] }
}

it.each(['owned', 'other-owner', 'no-spell', 'not-summoned', 'same-character', 'wrong-type'] as const)('gates map candidates and direct Host healing by creation provenance (%s)', mode => {
  const map = fixture(), target = map.tokens[1]
  if (mode === 'other-owner') Object.assign(target.dnd5eSummon!, { sourceTokenId: 'other', sourceCharacterId: 'other' })
  if (mode === 'no-spell') delete target.dnd5eSummon!.sourceSpellId
  if (mode === 'not-summoned') delete target.dnd5eSummon
  if (mode === 'same-character') target.dnd5eSummon!.sourceTokenId = 'previous-token'
  if (mode === 'wrong-type') target.creatureTypes = ['undead']
  const allowed = mode === 'owned' || mode === 'same-character'
  const restored = migrateMapsState(JSON.parse(JSON.stringify({ maps: [map], selectedId: map.id }))).maps[0]
  expect(dnd5eIsSourceSpellSummon(restored, 'caster', 'target')).toBe(allowed || mode === 'wrong-type')
  expect(collectDnd5ePersistentAreaTriggers({ map: restored, timing: 'turn-end', round: 2, targetTokenId: 'target' })).toHaveLength(allowed ? 1 : 0)
  const state = startDnd5eHeadlessCombat('test', ['caster', 'target'].map(id => createDnd5eCombatant({ id, name: id,
    controller: 'player', initiative: 10, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2, armorClass: 10, currentHp: 1, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 },
    concentrating: false, creatureType: mode === 'wrong-type' ? 'undead' : 'beast' })))
  state.companionScene = { map: restored, geometry: null, projectedTokenIds: ['caster', 'target'] }
  const result = resolveDnd5ePersistentAreaTrigger(state, { areaId: 'aura', sourceId: 'caster', targetId: 'target', trigger })
  expect(result.ok).toBe(allowed)
  expect(result.state.combatants.target.currentHp).toBe(allowed ? 6 : 1)
  expect(state.combatants.target.currentHp).toBe(1)
})

it('preserves the gate through normalization and rejects malformed declarations', () => {
  expect(normalizeDnd5ePersistentAreaTriggerSnapshot(trigger)?.requiresSourceSpellSummon).toBe(true)
  expect(normalizeDnd5ePersistentAreaTriggerSnapshot({ ...trigger, requiresSourceSpellSummon: 'yes' })).toBeUndefined()
  expect(dnd5eIsSourceSpellSummon(undefined, 'caster', 'target')).toBe(false)
})

it('rejects stale healing candidates after expiry but retains explicit expiry detonations', () => {
  const map = fixture()
  const collect = (round: number) => collectDnd5ePersistentAreaTriggers({ map, timing: 'turn-end', round, targetTokenId: 'target' })
  const candidate = collect(10)[0]
  expect(candidate).toBeDefined()
  expect(collect(11)).toHaveLength(0)
  expect(prepareDnd5ePersistentAreaTrigger({ map, characters: [], initiativeOrder: [], combatId: 'test', round: 11, candidate }))
    .toMatchObject({ ok: false, reason: 'persistent-area-expired' })
  map.dnd5ePluginAreas![0].triggers = [{ ...trigger, timing: 'on-detonate' }]
  expect(collectDnd5ePersistentAreaTriggers({ map, timing: 'on-detonate', round: 11, targetTokenId: 'target' })).toHaveLength(1)
  map.dnd5ePluginAreas![0].triggers = [trigger]
  map.dnd5ePluginAreas![0].permanent = true
  expect(collect(11)).toHaveLength(1)
})
