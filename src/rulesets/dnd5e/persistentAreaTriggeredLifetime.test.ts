import { expect, it } from 'vitest'
import { createDnd5eConditionEffect } from './activeEffects'
import { normalizeDnd5ePersistentAreaTriggerSnapshot } from './persistentAreaTypes'
import { reconcileDnd5eTriggeredAreaLifetimes } from './persistentAreaTriggeredLifetime'
import { rebaseDnd5ePluginAreasAfterCombat, reconcileDnd5ePluginAreasAndConcentrationOnMap } from './pluginAreas'
import { migrateMapsState, type BattleMap } from '../../store/maps'

function fixture() {
  const trigger = normalizeDnd5ePersistentAreaTriggerSnapshot({ id: 'capture', label: 'Capture', timing: 'on-enter',
    endAreaWhenNoBoundConditions: true, condition: { condition: 'restrained', endsWithArea: true, duration: { expiresAt: 'permanent' } } })!
  const map: BattleMap = { id: 'origin', name: 'Origin', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
    tokens: ['caster', 'one', 'two'].map((id, i) => ({ id, label: id, type: 'enemy', size: 1, x: 25 + 50 * i, y: 25, color: '', emoji: '', hp: 20, maxHp: 20 })),
    dnd5ePluginAreas: [{ id: 'trap', pluginId: 'test.trap', featureId: 'trap', label: 'Trap', color: '#fff', sourceCharacterId: '', sourceTokenId: 'caster',
      cells: [{ col: 1, row: 0 }], anchorMode: 'fixed', createdRound: 1, expiresAfterRound: 4800, triggers: [trigger] }],
  }
  const capture = (id: string) => {
    const token = map.tokens.find(token => token.id === id)!
    const effect = { ...createDnd5eConditionEffect({ id: `capture-${id}`, condition: 'restrained', targetId: id,
      source: { kind: 'plugin', actorId: 'caster' }, duration: { type: 'permanent' } }),
      areaLifetime: { mapId: map.id, areaId: 'trap', sourceActorId: 'caster' } }
    token.dnd5eCombatState = { schemaVersion: 2, conditions: ['restrained'], activeEffects: [effect] }
    const area = map.dnd5ePluginAreas![0]
    area.triggerReceipts = [...(area.triggerReceipts ?? []), { triggerId: 'capture', targetTokenId: id, round: 1, transactionId: `capture-${id}` }]
  }
  return { map, capture }
}

it('keeps an armed area and ends only after the last of several captives is released', () => {
  const f = fixture()
  expect(reconcileDnd5eTriggeredAreaLifetimes(f.map, [])).toBe(f.map)
  f.capture('one'); f.capture('two')
  expect(reconcileDnd5eTriggeredAreaLifetimes(f.map, [])).toBe(f.map)
  f.map.tokens.find(token => token.id === 'one')!.dnd5eCombatState!.activeEffects = []
  expect(reconcileDnd5eTriggeredAreaLifetimes(f.map, [])).toBe(f.map)
  f.map.tokens.find(token => token.id === 'two')!.dnd5eCombatState!.activeEffects = []
  expect(reconcileDnd5ePluginAreasAndConcentrationOnMap(f.map, [], 1).map.dnd5ePluginAreas).toEqual([])
})

it('ends after a successful triggering save, but never after a declined trigger', () => {
  const f = fixture(), area = f.map.dnd5ePluginAreas![0]
  area.triggerReceipts = [{ triggerId: 'capture', targetTokenId: 'one', round: 1, transactionId: 'saved', savingThrowSucceeded: true }]
  expect(reconcileDnd5eTriggeredAreaLifetimes(f.map, []).dnd5ePluginAreas).toEqual([])
  area.triggerReceipts[0].declined = true
  expect(reconcileDnd5eTriggeredAreaLifetimes(f.map, [])).toBe(f.map)
})

it('preserves the triggered state across JSON reload and combat round reset', () => {
  const f = fixture(); f.capture('one')
  const rebased = rebaseDnd5ePluginAreasAfterCombat(f.map, 12)
  const saved = migrateMapsState(JSON.parse(JSON.stringify({ maps: [rebased], selectedId: f.map.id }))).maps[0]
  expect(saved.dnd5ePluginAreas![0].triggerReceipts).toHaveLength(1)
  saved.tokens.find(token => token.id === 'one')!.dnd5eCombatState!.activeEffects = []
  expect(reconcileDnd5eTriggeredAreaLifetimes(saved, []).dnd5ePluginAreas).toEqual([])
})

it('checks remote captives in the room and does not infer release from a missing roster', () => {
  const f = fixture(); f.capture('one')
  const remote: BattleMap = { ...f.map, id: 'remote', dnd5ePluginAreas: [], tokens: [f.map.tokens.find(token => token.id === 'one')!] }
  f.map.tokens = f.map.tokens.filter(token => token.id !== 'one')
  expect(reconcileDnd5eTriggeredAreaLifetimes(f.map, [])).toBe(f.map)
  expect(reconcileDnd5eTriggeredAreaLifetimes(f.map, [], [f.map, remote])).toBe(f.map)
  remote.tokens[0].dnd5eCombatState!.activeEffects = []
  expect(reconcileDnd5eTriggeredAreaLifetimes(f.map, [], [f.map, remote]).dnd5ePluginAreas).toEqual([])
})
