import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, commitDnd5eActivityExecution } from '../headlessCombatEngine'
import {rectangularPrismCells} from '../../../../shared/rectangular-prism.mjs'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { migrateMapsState, type BattleMap } from '../../../store/maps'
import { normalizeCharacter } from '../../../store/characters'
import { cellsForAoe } from '../../../lib/skillTargeting'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import { applyDnd5eActivityMapHandoffsV1 } from './dnd5eActivityMapInteraction'
import { reconcileDnd5ePluginAreasAndConcentrationOnMap } from '../pluginAreas'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'wall-ray', name: 'Wall ray', activation: { kind: 'action' },
  target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 60 },
  checks: [{ id: 'attack', kind: 'attack-roll', rollId: 'attack', attackBonus: { kind: 'constant', value: 5 }, scope: 'per-target', rollMode: 'normal', delivery: 'ranged' }],
  outcomes: [{ id: 'shrink', when: { kind: 'always' }, operations: [{ id: 'reduce', kind: 'shrink-granting-area', target: 'actor', lengthFeet: { kind: 'constant', value: 10 } }] }],
  automation: automationCapabilityFromLegacyStatus('full'),
}
const actor = { id: 'caster', controller: 'players' as const, level: 10, proficiencyBonus: 4, abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 }, armorClass: 15, conditions: [], currentHp: 50, maxHp: 50 }
function map(angle: number): BattleMap {
  const direction = { dc: Math.cos(angle), dr: Math.sin(angle) }, anchorCell = { col: 12, row: 12 }
  return { id: 'map', name: 'Map', width: 2000, height: 2000, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
    tokens: [{ id: 'caster', characterId: 'caster', label: 'caster', type: 'player', size: 1, x: 25, y: 25, color: '', emoji: '' }],
    dnd5ePluginAreas: [{ id: 'wall', pluginId: 'test', featureId: 'wall', label: 'Wall', color: '#fff', sourceCharacterId: 'caster', sourceTokenId: 'caster', createdRound: 1, expiresAfterRound: 100, concentrationId: 'wall-spell', anchorCell,
      rectGeometry: { widthFeet: 5, lengthFeet: 60, direction, gridAligned: false },
      cells: cellsForAoe({ shape: 'rect', origin: 'point', widthFeet: 5, heightFeet: 60 }, { col: anchorCell.col - direction.dc, row: anchorCell.row - direction.dr }, anchorCell),
      grantedActivities: [{ activityId: activity.id }],
    }],
  }
}
function apply(current: BattleMap, actionId: string, feet = 10, actorId = 'caster') {
  return applyDnd5eActivityMapHandoffsV1({ map: current, activity, packageId: 'test', actionId, actorId, round: 1, grantingPersistentAreaId: 'wall', selection: {},
    handoffs: { persistentAreas: [], movements: [], summons: [], invocations: [], areaShrinks: [{ kind: 'shrink-granting-area', operationId: 'reduce', targetId: actorId, lengthFeet: feet }] } })
}
it.each([1, 15, 20])('produces the same shrink after miss, hit or critical attack (%s)', d20 => {
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  expect(() => compileDnd5eActivityHeadlessAction(activity)).not.toThrow()
  const result = resolveDnd5eActivity({ activity, actor, targets: [{ ...actor, id: 'enemy', controller: 'dm' }], distanceFeetByTargetId: { enemy: 5 }, rolls: { 'attack:enemy': { values: [d20] } } })
  expect(result).toMatchObject({ ok: true, proposals: [{ kind: 'shrink-granting-area', targetId: 'caster', lengthFeet: 10 }] })
})
it.each([[45,30],[90,90],[-30,-45]])('shrinks tilted length and projected cells without restoring clipped cells (%s/%s)',(pitchDegrees,rollDegrees)=>{
 let current=map(Math.PI/4),area=current.dnd5ePluginAreas![0]
 area.rectGeometry={...area.rectGeometry!,pitchDegrees,rollDegrees}
 area.vertical={mode:'volume',baseElevationFeet:45,heightFeet:10}
 area.cells=rectangularPrismCells(current,area)!
 // A hole at the center must stay absent even when it belongs to the smaller prism.
 const omitted='12:12'
 area.cells=area.cells.filter(c=>`${c.col}:${c.row}`!==omitted)
 for(let shot=1;shot<=6;shot++){
  const before=current.dnd5ePluginAreas![0],lengthFeet=60-shot*10
  const result=apply(current,`tilt-shot-${shot}`)
  expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)return
  if(lengthFeet===0){expect(result.map.dnd5ePluginAreas).toEqual([]);break}
  const next=result.map.dnd5ePluginAreas![0]
  const projected=new Set(rectangularPrismCells(current,{...before,rectGeometry:{...before.rectGeometry!,lengthFeet}})!.map(c=>`${c.col}:${c.row}`))
  expect(next.cells).toEqual(before.cells.filter(c=>projected.has(`${c.col}:${c.row}`)))
  expect(next.cells.some(c=>`${c.col}:${c.row}`===omitted)).toBe(false)
  expect(next.rectGeometry).toMatchObject({lengthFeet,pitchDegrees,rollDegrees})
  const replay=apply(result.map,`tilt-shot-${shot}`);expect(replay.ok).toBe(true)
  if(replay.ok)expect(replay.map.dnd5ePluginAreas![0].rectGeometry?.lengthFeet).toBe(lengthFeet)
  current=migrateMapsState(JSON.parse(JSON.stringify({maps:[result.map]}))).maps[0]
 }
})
it.each([0, Math.PI / 2, Math.PI / 4])('shrinks without expanding clipped cells, replays once, then ends (%s)', angle => {
  let current = map(angle)
  // A map obstruction clipped one outer cell. Shrinking must not restore it.
  current.dnd5ePluginAreas![0].cells.shift()
  const original = JSON.stringify(current)
  const first = apply(current, 'shot-1'); expect(first.ok).toBe(true); if (!first.ok) return
  expect(first.map.dnd5ePluginAreas![0].rectGeometry!.lengthFeet).toBe(50)
  const originalKeys = new Set(current.dnd5ePluginAreas![0].cells.map(c => `${c.col}:${c.row}`))
  expect(first.map.dnd5ePluginAreas![0].cells.every(c => originalKeys.has(`${c.col}:${c.row}`))).toBe(true)
  expect(JSON.stringify(current)).toBe(original)
  current = migrateMapsState(JSON.parse(JSON.stringify({ maps: [first.map] }))).maps[0]
  const replay = apply(current, 'shot-1'); expect(replay.ok).toBe(true); if (!replay.ok) return
  expect(replay.map.dnd5ePluginAreas![0].rectGeometry!.lengthFeet).toBe(50)
  for (let shot = 2; shot <= 6; shot++) {
    const next = apply(current, `shot-${shot}`); expect(next.ok).toBe(true); if (!next.ok) return
    if (shot < 6) expect(next.map.dnd5ePluginAreas![0].rectGeometry!.lengthFeet).toBe(60 - shot * 10)
    else {
      expect(next.map.dnd5ePluginAreas).toEqual([]); expect(next.endedAreaIds).toEqual(['wall'])
      const character = normalizeCharacter({ id: 'caster', concentrating: true, dnd5eCombatState: { concentrationSpellId: 'wall-spell' } })
      const reconciled = reconcileDnd5ePluginAreasAndConcentrationOnMap(current, [character], 1, next.map)
      expect(reconciled.characters[0].concentrating).toBe(false)
      expect(reconciled.characters[0].dnd5eCombatState?.concentrationSpellId).toBeUndefined()
      const newSpell = normalizeCharacter({ ...character, concentrating: true, dnd5eCombatState: { concentrationSpellId: 'new-spell' } })
      const preserved = reconcileDnd5ePluginAreasAndConcentrationOnMap(current, [newSpell], 1, next.map)
      expect(preserved.characters[0].concentrating).toBe(true)
      expect(preserved.characters[0].dnd5eCombatState?.concentrationSpellId).toBe('new-spell')

    }
    current = next.map
  }
})
it('rejects missing geometry, foreign sources, ungranted commands and invalid amounts atomically', () => {
  for (const feet of [0, -1, NaN, Infinity, 10001]) expect(apply(map(0), 'bad', feet).ok).toBe(false)
  for (const mode of ['geometry', 'source', 'grant']) {
    const current = map(0), area = current.dnd5ePluginAreas![0]
    if (mode === 'geometry') delete area.rectGeometry
    if (mode === 'source') area.sourceCharacterId = 'someone-else'
    if (mode === 'grant') area.grantedActivities = []
    const before = JSON.stringify(current)
    expect(apply(current, 'bad').ok).toBe(false)
    expect(JSON.stringify(current)).toBe(before)
  }
})

it('preserves shrink through both installed and direct Headless settlement', () => {
  const definition: Dnd5eActivityDefinitionV1 = { ...activity, target: { kind: 'self' }, checks: [], legacySource: { kind: 'feature', id: activity.id } }
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'local.shrink', name: 'Shrink', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(definition))
    api.registerFeature({ id: definition.id, name: definition.name, summary: 'Test', description: 'Test', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(definition) })
  } })
  try {
    const combatant = createDnd5eCombatant({ ...actor, name: 'Caster', controller: 'player', initiative: 20, temporaryHp: 0, speed: 30, saveDc: 16, position: { x: 0, y: 0 }, concentrating: false })
    combatant.pluginFeatureIds = ['local.shrink:wall-ray']
    const state = startDnd5eHeadlessCombat('shrink', [combatant, createDnd5eCombatant({ ...combatant, id: 'opponent', controller: 'dm', initiative: 1 })])
    const installed = resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: 'local.shrink', actionId: definition.id, featureId: 'local.shrink:wall-ray', actorId: actor.id, targetId: actor.id, rolls: {} })
    expect(installed.ok, JSON.stringify(installed)).toBe(true)
    if (!installed.ok) return
    expect(installed.activityHandoffs?.areaShrinks).toMatchObject([{ kind: 'shrink-granting-area', operationId: 'reduce', targetId: actor.id, lengthFeet: 10 }])
    const resolution = resolveDnd5eActivity({ activity: definition, actor, targets: [actor], rolls: {} })
    const direct = commitDnd5eActivityExecution(state, { actorId: actor.id, activityId: definition.id, targetIds: [actor.id], resolution, source: { kind: 'feature', id: definition.id } })
    expect(direct.ok, JSON.stringify(direct)).toBe(true)
    expect(direct.activityHandoffs?.areaShrinks).toEqual(installed.activityHandoffs?.areaShrinks)
  } finally { dispose() }
})

