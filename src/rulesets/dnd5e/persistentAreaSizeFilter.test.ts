import { expect, it } from 'vitest'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5ePersistentAreaTrigger } from './headlessCombatEngine'
import { normalizeDnd5ePersistentAreaTriggerDeclaration, normalizeDnd5ePersistentAreaTriggerSnapshot } from './persistentAreaTypes'
import { collectDnd5ePersistentAreaTriggers } from './pluginAreas'
import { dnd5ePersistentAreaSizeRanks, prepareDnd5ePersistentAreaTrigger } from './pluginAreaTransactions'
import { migrateMapsState, type BattleMap } from '../../store/maps'

const trigger = { id: 'size-gate', label: 'Size gate', timing: 'on-enter' as const,
  targetSizeRanks: [1, 2, 3], condition: { condition: 'restrained' as const, duration: { expiresAt: 'permanent' as const } } }

it.each([0, 1, 2, 3, 4, 5, undefined])('checks authoritative size before applying any condition: %s', sizeRank => {
  const state = startDnd5eHeadlessCombat('size-gate', ['caster', 'target'].map(id => createDnd5eCombatant({
    id, name: id, controller: 'player', initiative: 10,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2, armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0,
    speed: 30, position: { x: 0, y: 0 }, concentrating: false,
  })))
  // Deliberately simulate a malformed persisted snapshot for the missing-size case.
  Object.assign(state.combatants.target, { sizeRank })
  const before = structuredClone(state)
  const result = resolveDnd5ePersistentAreaTrigger(state, { areaId: 'area', sourceId: 'caster', targetId: 'target', trigger })
  const allowed = sizeRank !== undefined && [1, 2, 3].includes(sizeRank)
  expect(result.ok).toBe(allowed)
  expect(result.state.combatants.target.conditions.includes('restrained')).toBe(allowed)
  expect(state).toEqual(before)
  if (!allowed) expect(result).toMatchObject({ reason: 'invalid-target' })
})

it('retains size restrictions through declaration, resolved snapshot and JSON reload', () => {
  const declaration = normalizeDnd5ePersistentAreaTriggerDeclaration(trigger)
  expect(declaration?.targetSizeRanks).toEqual([1, 2, 3])
  expect(normalizeDnd5ePersistentAreaTriggerSnapshot(JSON.parse(JSON.stringify(declaration)))?.targetSizeRanks).toEqual([1, 2, 3])
})

it.each([[], [1, 1], [-1], [6], [1.5], ['2'], null, 'medium'])('rejects malformed size restrictions: %j', targetSizeRanks => {
  expect(normalizeDnd5ePersistentAreaTriggerDeclaration({ ...trigger, targetSizeRanks })).toBeUndefined()
})

it('skips ineligible movement before interrupting, persists the gate, and rechecks changed size on prepare', () => {
  const map: BattleMap = { id: 'gate', name: 'Gate', width: 500, height: 500, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
    tokens: [
      { id: 'caster', label: 'Caster', type: 'enemy', size: 1, creatureSize: '中型', x: 25, y: 75, color: '', emoji: '', hp: 20, maxHp: 20 },
      { id: 'target', label: 'Target', type: 'enemy', size: 1, creatureSize: '微型', x: 25, y: 25, color: '', emoji: '', hp: 20, maxHp: 20 },
    ],
    dnd5ePluginAreas: [{ id: 'gate-area', pluginId: 'test.size', featureId: 'gate', label: 'Gate',
      sourceCharacterId: 'caster', sourceTokenId: 'caster', cells: [{ col: 2, row: 0 }],
      createdRound: 1, expiresAfterRound: 100, color: '#fff', anchorMode: 'fixed', relation: 'any', includeSelf: true, triggers: [trigger] }],
  }
  const reloaded = migrateMapsState(JSON.parse(JSON.stringify({ maps: [map], selectedId: map.id }))).maps[0]
  const collect = () => collectDnd5ePersistentAreaTriggers({ map: reloaded, timing: 'on-enter', round: 1,
    sizeRanksByTokenId: dnd5ePersistentAreaSizeRanks({ map: reloaded, characters: [], round: 1 }),
    movement: { token: reloaded.tokens[1], to: { x: 175, y: 25 } } })
  expect(collect()).toEqual([])
  reloaded.tokens[1].creatureSize = '中型'
  const candidates = collect()
  expect(candidates).toHaveLength(1)
  reloaded.tokens[1].creatureSize = '巨型'
  const result = prepareDnd5ePersistentAreaTrigger({ map: reloaded, characters: [], round: 1, combatId: 'size',
    candidate: candidates[0], initiativeOrder: reloaded.tokens.map(t => ({ tokenId: t.id, label: t.label, emoji: '', color: '', roll: 10 })) })
  expect(result).toMatchObject({ ok: false, reason: 'invalid-target' })
})
