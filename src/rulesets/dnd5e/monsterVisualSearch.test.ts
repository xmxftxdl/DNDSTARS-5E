import { afterEach, expect, it } from 'vitest'
import type { BattleMap } from '../../store/maps'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { prepareMonsterVisualSearch, resolveMonsterVisualSearch } from './monsterVisualSearch'
import { prepareDnd5eDruidGroveSpikeGrowth } from './druidGroveSpikeGrowth'
import { createDnd5eConditionEffect } from './activeEffects'

afterEach(() => setMapGeometryRuntime([]))
it('lets a monster investigate a hidden area without knowing its ID and spends its combat action', () => {
  const input = fixture(true)
  input.map.dnd5ePluginAreas![0].visualRecognition!.skill = 'investigation'
  const perception = resolveMonsterVisualSearch(prepareMonsterVisualSearch(input)!, { d20: 20 })
  expect(perception.application!.map.dnd5ePluginAreas![0].visualRecognition!.knownTokenIds).toEqual([])
  const prepared = prepareMonsterVisualSearch({ ...input, searchSkill: 'investigation' })!
  expect(prepared.action).toMatchObject({ ability: 'int', skill: 'investigation' })
  const investigation = resolveMonsterVisualSearch(prepared, { d20: 20 })
  expect(investigation.result.ok).toBe(true)
  expect(investigation.application!.map.dnd5ePluginAreas![0].visualRecognition!.knownTokenIds).toEqual(['goblin'])
  expect(investigation.result.state.combatants.goblin.turn.actionAvailable).toBe(false)
})
function fixture(combat = false) {
  const map: BattleMap = { id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [
      { id: 'goblin', type: 'enemy', label: 'Goblin', poolId: 'srd-5.1:goblin', hp: 7, maxHp: 7,
        x: 125, y: 125, size: 1, color: '', emoji: '' },
      { id: 'caster', type: 'player', characterId: 'caster', label: 'Caster', x: 25, y: 25, size: 1, color: '', emoji: '' },
    ] }
  const geometry = createEmptyMapGeometry(map.id, 1)
  geometry.environment = 'outdoors'
  setMapGeometryRuntime([geometry])
  const created = prepareDnd5eDruidGroveSpikeGrowth({ map, geometry,
    placement: { origin: { col: 0, row: 0 }, sideFeet: 30, fogCells: [], undergrowthCells: [], guardianTreeIds: [] },
    baseElevationFeet: 0, qualifications: { structureObstacleIds: [], treeTokenIds: [] },
    source: { castId: 'grove', pluginId: 'test.grove', spellId: 'grove', characterId: 'caster', tokenId: 'caster', slotLevel: 6, saveDc: 17 },
    round: 1, worldMinute: 100, center: { col: 2, row: 2 } })
  if (!created.ok) throw Error(created.reason)
  map.dnd5ePluginAreas = created.areas.map(area => ({ ...area, visualRecognition: { dc: 17, knownTokenIds: [] } }))
  return { map, characters: [], actorTokenId: 'goblin', transactionId: 'search', worldMinute: 100, round: 1,
    combatId: combat ? 'combat' : undefined,
    initiativeOrder: [{ tokenId: 'goblin', label: 'Goblin', roll: 10, color: '', emoji: '' }],
    turnEconomy: createDnd5eTurnEconomyCounts('goblin:1', 30) }
}

it.each([false, true])('uses a real monster ability check, combat %s', combat => {
  const input = fixture(combat), prepared = prepareMonsterVisualSearch(input)!
  const failed = resolveMonsterVisualSearch(prepared, { d20: 1 })
  expect(failed.result.ok).toBe(true)
  expect(failed.application!.map.dnd5ePluginAreas![0].visualRecognition!.knownTokenIds).toEqual([])
  const passed = resolveMonsterVisualSearch(prepared, { d20: 20 })
  expect(passed.result.ok).toBe(true)
  expect(passed.application!.map.dnd5ePluginAreas![0].visualRecognition!.knownTokenIds).toEqual(['goblin'])
  expect(passed.result.state.combatants.goblin.turn.actionAvailable).toBe(!combat)
  expect(input.map.dnd5ePluginAreas![0].visualRecognition!.knownTokenIds).toEqual([])
})

it('rejects an exhausted combat action and an invalid dice value without revealing', () => {
  const input = fixture(true)
  input.turnEconomy.action.current = 0
  const prepared = prepareMonsterVisualSearch(input)!
  expect(resolveMonsterVisualSearch(prepared, { d20: 20 }).result.ok).toBe(false)
  expect(resolveMonsterVisualSearch(prepareMonsterVisualSearch(fixture())!, { d20: 21 }).result.ok).toBe(false)
})

it('does not reveal to a blinded monster or prepare a dead or unknown monster', () => {
  const input = fixture()
  input.map.tokens[0].dnd5eCombatState = { schemaVersion: 2, activeEffects: [createDnd5eConditionEffect({
    id: 'blind', condition: 'blinded', targetId: 'goblin', source: { kind: 'system', rulesId: 'test' },
  })] }
  const prepared = prepareMonsterVisualSearch(input)!
  expect(resolveMonsterVisualSearch(prepared, { d20: 20, d20Second: 20 }).application!.map.dnd5ePluginAreas![0].visualRecognition!.knownTokenIds).toEqual([])
  input.map.tokens[0].hp = 0
  expect(prepareMonsterVisualSearch(input)).toBeUndefined()
  input.map.tokens[0].hp = 7
  input.map.tokens[0].poolId = 'missing-monster-data'
  expect(prepareMonsterVisualSearch(input)).toBeUndefined()
})

it('spends a monster action on INT Investigation of one illusion only', () => {
  const input=fixture(true), area=input.map.dnd5ePluginAreas![0]
  area.illusionRecognition={dc:17,knownTokenIds:[]}
  input.map.dnd5ePluginAreas!.push({...area,id:'second-illusion',illusionRecognition:{dc:17,knownTokenIds:[]}})
  const prepared=prepareMonsterVisualSearch({...input,investigatedAreaId:area.id})!
  expect(prepared.action).toMatchObject({ability:'int',skill:'investigation',dc:17,spendAction:true})
  const failed=resolveMonsterVisualSearch(prepared,{d20:1})
  expect(failed.result.ok).toBe(true)
  expect(failed.application!.map.dnd5ePluginAreas![0].illusionRecognition?.knownTokenIds).toEqual([])
  const passed=resolveMonsterVisualSearch(prepared,{d20:20})
  expect(passed.result.ok).toBe(true)
  expect(passed.result.state.combatants.goblin.turn.actionAvailable).toBe(false)
  expect(passed.application!.map.dnd5ePluginAreas![0].illusionRecognition?.knownTokenIds).toEqual(['goblin'])
  expect(passed.application!.map.dnd5ePluginAreas![1].illusionRecognition?.knownTokenIds).toEqual([])
  expect(passed.application!.map.dnd5ePluginAreas![0].visualRecognition?.knownTokenIds).toEqual([])
  input.turnEconomy.action.current=0
  expect(resolveMonsterVisualSearch(prepareMonsterVisualSearch({...input,investigatedAreaId:area.id})!,{d20:20}).result.ok).toBe(false)
  expect(prepareMonsterVisualSearch({...input,investigatedAreaId:'missing'})).toBeUndefined()
})
