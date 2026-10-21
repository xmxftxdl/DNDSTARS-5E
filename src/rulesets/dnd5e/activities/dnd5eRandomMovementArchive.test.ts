import { afterEach, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { cellToPixel } from '../../../lib/gridCombat'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../../lib/mapGeometry'
import type { BattleMap, Token } from '../../../store/maps'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { applyDnd5eStandardConditionEffect, createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { dnd5eCombatantPairKey } from '../headlessCombatPrimitives'
import { getRegisteredDnd5eActivity } from './dnd5eActivityRegistry'
import { applyDnd5eActivityMapHandoffsV1 } from './dnd5eActivityMapInteraction'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

const namespace = 'test.random-step'
const automation = automationCapabilityFromLegacyStatus('full')
const directions = ['north', 'east', 'south', 'west'] as const
const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'random-step', name: 'Synthetic random step', activation: { kind: 'action', cost: 1 },
  target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 60 }, legacySource: { kind: 'feature', id: 'random-step' },
  checks: [
    { id: 'save', kind: 'saving-throw', ability: 'con', rollId: 'save', scope: 'per-target', dc: { kind: 'constant', value: 12 } },
    { id: 'direction', kind: 'random-roll', rollId: 'direction', scope: 'per-target', count: 1, sides: 4,
      appliesWhenSave: { checkId: 'save', result: 'failure' }, minimumTargetSpeedFeet: 1 },
  ], outcomes: [
    { id: 'hurt', when: { kind: 'check', checkId: 'save', result: 'failure' }, operations: [
      { id: 'hurt', kind: 'damage', target: 'target', amount: { kind: 'constant', value: 3 }, damageType: 'poison' },
    ] },
    ...directions.map((cardinalDirection, index): Dnd5eActivityDefinitionV1['outcomes'][number] => ({
      id: cardinalDirection, when: { kind: 'check-total', checkId: 'direction', minimum: index + 1, maximum: index + 1 },
      operations: [{ id: cardinalDirection, kind: 'move', target: 'target', mode: 'forced', cardinalDirection,
        distanceFeet: { kind: 'constant', value: 5 } }],
    })),
  ], automation,
}
const bundle: Dnd5eUnifiedContentBundleV1 = {
  format: 'dndstars5e-unified-content', schemaVersion: 1,
  manifest: { id: namespace, name: 'Synthetic movement module', version: '1.0.0', apiVersion: 2,
    rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' },
  assets: [], definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'random-step', name: 'Random step', automation,
    payload: { id: 'random-step', name: 'Random step', summary: 'Synthetic', description: 'Synthetic fixture', automation: 'full' }, activities: [activity] }],
}
afterEach(() => setMapGeometryRuntime([]))

it.each([
  { face: 1, save: 5, restrained: false, blocked: false, col: 4, row: 3 },
  { face: 2, save: 5, restrained: false, blocked: false, col: 5, row: 4 },
  { face: 3, save: 5, restrained: false, blocked: false, col: 4, row: 5 },
  { face: 4, save: 5, restrained: false, blocked: false, col: 3, row: 4 },
  { face: 2, save: 5, restrained: false, blocked: true, col: 4, row: 4 },
  { face: 2, save: 15, restrained: false, blocked: false, col: 4, row: 4 },
  { face: 2, save: 5, restrained: true, blocked: false, col: 4, row: 4 },
])('round-trips and settles the combined movement mechanism: %j', async scenario => {
  const archive = await exportDnd5eStarMod(bundle)
  const decoded = await readDnd5eStarMod(archive)
  expect(decoded.bundle.definitions[0].activities?.[0]).toEqual(activity)
  let dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
  // Reinstall from the portable archive after disposing the first installation.
  dispose()
  dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1((await readDnd5eStarMod(archive)).bundle))
  try {
    const installed = getRegisteredDnd5eActivity(namespace, activity.id)!
    expect(installed).toBeDefined()
    const make = (id: string) => createDnd5eCombatant({ id, name: id, controller: id === 'actor' ? 'player' : 'dm', initiative: id === 'actor' ? 20 : 10,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
      armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
    const state = startDnd5eHeadlessCombat('archive-movement', [make('actor'), make('target')])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('actor', 'target')]: 15 }
    state.combatants.actor.pluginFeatureIds = [`${namespace}:${activity.id}`]
    if (scenario.restrained) applyDnd5eStandardConditionEffect(state.combatants.target, state.combatants.actor, {
      rulesId: 'test-restraint', condition: 'restrained', sourceKind: 'feature', duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
    }, [])
    const moves = scenario.save < 12 && !scenario.restrained
    const roll = (value: number) => ({ values: [value], modifier: 0, total: value })
    const result = resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: namespace, actionId: activity.id,
      featureId: `${namespace}:${activity.id}`, actorId: 'actor', targetId: 'target', distanceFeet: 15,
      rolls: { 'save:target': roll(scenario.save), ...(moves ? { 'direction:target': roll(scenario.face) } : {}) } })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.currentHp).toBe(scenario.save < 12 ? 17 : 20)
    expect(result.state.combatants.actor.turn.actionAvailable).toBe(false)
    expect(state.combatants.actor.turn.actionAvailable).toBe(true)
    const map: BattleMap = { id: 'archive-map', name: 'Map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [] }
    const token = (id: string, col: number, row: number): Token => ({ id, label: id, type: 'player', characterId: id,
      color: '', emoji: '', size: 1, ...cellToPixel({ col, row }, map) })
    map.tokens = [token('actor', 1, 1), token('target', 4, 4)]
    if (scenario.blocked) {
      const geometry = createEmptyMapGeometry(map.id)
      geometry.walls.push({ id: 'wall', kind: 'wall', label: 'Wall', points: [{ x: 250, y: 100 }, { x: 250, y: 400 }],
        blocksMovement: true, blocksVision: true, blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 10, createdAt: 1 })
      setMapGeometryRuntime([geometry])
    }
    const applied = applyDnd5eActivityMapHandoffsV1({ map, activity: installed, packageId: namespace,
      actionId: 'cast', actorId: 'actor', round: 1, selection: {},
      handoffs: result.activityHandoffs ?? { movements: [], summons: [], persistentAreas: [], invocations: [] } })
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    expect(applied.map.tokens.find(token => token.id === 'target')).toMatchObject(cellToPixel({ col: scenario.col, row: scenario.row }, map))
    expect(applied.movementPaths.every(path => !path.provokesOpportunityAttacks)).toBe(true)
    const saved = JSON.parse(JSON.stringify({ state: result.state, map: applied.map }))
    expect(saved.state.combatants.target.currentHp).toBe(scenario.save < 12 ? 17 : 20)
    expect(saved.map.tokens[1].x).toBe(applied.map.tokens[1].x)
  } finally { dispose() }
})
