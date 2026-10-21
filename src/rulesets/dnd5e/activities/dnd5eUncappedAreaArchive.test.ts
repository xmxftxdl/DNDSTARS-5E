import { expect, it } from 'vitest'
import type { BattleMap, Token } from '../../../store/maps'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { getRegisteredDnd5eActivity } from './dnd5eActivityRegistry'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { resolveDnd5eActivityAreaMapSelectionV1 } from './dnd5eActivityMapInteraction'
import { dnd5eActivityPerTargetRollDeclarationsV1 } from './dnd5eActivityPerTargetRolls'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { validateDnd5eExecuteActivityCommandV1 } from './dnd5eActivityCommand'
import { createDnd5eCombatant, startDnd5eHeadlessCombat } from '../headlessCombatEngine'

const abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
const automation = automationCapabilityFromLegacyStatus('full')

it.each([0, 3, 300])('exports and settles every eligible area occupant without an implicit target cap (%s)', async count => {
  const namespace = 'test.uncapped-area'
  const activity: Dnd5eActivityDefinitionV1 = {
    schemaVersion: 1, id: 'burst', name: 'Synthetic burst', activation: { kind: 'action' }, automation,
    legacySource: { kind: 'feature', id: 'burst' },
    target: { kind: 'area', origin: 'self', relation: 'any', includeSelf: false, shape: 'sphere', radiusFeet: 100 },
    checks: [{ id: 'save', kind: 'saving-throw', ability: 'con', dc: { kind: 'constant', value: 12 }, rollId: 'save', scope: 'per-target', rollMode: 'normal' }],
    outcomes: [
      { id: 'failed', when: { kind: 'check', checkId: 'save', result: 'failure' }, operations: [
        { id: 'full', kind: 'damage', target: 'target', damageType: 'thunder', magical: true, amount: { kind: 'dice', rollId: 'damage', count: 3, sides: 10 } },
      ] },
      { id: 'saved', when: { kind: 'check', checkId: 'save', result: 'success' }, operations: [
        { id: 'half', kind: 'damage', target: 'target', damageType: 'thunder', magical: true,
          amount: { kind: 'floor', value: { kind: 'multiply', values: [{ kind: 'dice', rollId: 'damage', count: 3, sides: 10 }, { kind: 'constant', value: .5 }] } } },
      ] },
    ],
  }
  const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Uncapped area', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' }, assets: [],
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'burst', name: 'Burst', automation, activities: [activity],
      payload: { id: 'burst', name: 'Burst', summary: 'Synthetic', description: 'Synthetic', automation: 'full' } }] }
  const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
  try {
    const installed = getRegisteredDnd5eActivity(namespace, activity.id)!
    expect(installed.target).not.toHaveProperty('maximumTargets')
    const caster: Token = { id: 'caster', label: 'Caster', x: 105, y: 75, size: 1, type: 'player', color: '', emoji: '' }
    const occupants = Array.from({ length: count }, (_, i): Token => ({ ...caster, id: `occupant-${i}`, type: i % 2 ? 'player' : 'enemy', x: 5 + i % 20 * 10, y: 5 + Math.floor(i / 20) * 10 }))
    const outside = { ...caster, id: 'outside', x: 1005 }
    const obstacle: Token = { ...caster, id: 'object', type: 'obstacle' }
    const map: BattleMap = { id: 'uncapped-map', name: 'Map', width: 1200, height: 400, gridSize: 10, feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [caster, ...occupants, outside, obstacle] }
    const selected = resolveDnd5eActivityAreaMapSelectionV1({ activity: installed, map, actorToken: caster, anchorCell: { col: 10, row: 7 } })!
    expect(selected.targetIds).toEqual(occupants.map(token => token.id))
    const compiled = compileDnd5eActivityHeadlessAction(installed)
    expect(compiled.rolls).toEqual([expect.objectContaining({ id: 'damage', count: 3, sides: 10 })])
    const declarations = dnd5eActivityPerTargetRollDeclarationsV1({ activity: installed, actor: { id: caster.id, controller: 'players' },
      targets: occupants.map(token => ({ id: token.id, controller: token.type === 'player' ? 'players' as const : 'dm' as const })),
      declarations: compiled.perTargetRolls ?? [], hostAttackRollMode: () => 'normal', hostSavingThrowMode: () => 'normal' })
    expect(declarations).toHaveLength(count)
    expect(declarations.map(roll => roll.rollerTokenId)).toEqual(occupants.map(token => token.id))
    const combatants = [caster, ...occupants, outside].map(token => createDnd5eCombatant({ id: token.id, name: token.label,
      controller: token.type === 'player' ? 'player' : 'dm', initiative: token.id === caster.id ? 30 : 10,
      abilities, proficiencyBonus: 2, armorClass: 10, currentHp: 40, maxHp: 40, temporaryHp: 0, speed: 30,
      position: { x: token.x, y: token.y }, concentrating: false, pluginFeatureIds: token.id === caster.id ? [`${namespace}:burst`] : [] }))
    const state = startDnd5eHeadlessCombat('uncapped-test', combatants)
    const before = structuredClone(state)
    const authoritativeRolls = Object.fromEntries(declarations.map((roll, i) => [roll.id, { values: [i % 2 ? 20 : 1], modifier: 0, total: i % 2 ? 20 : 1 }]))
    authoritativeRolls.damage = { values: [3, 4, 6], modifier: 0, total: 13 }
    const command = { schemaVersion: 1 as const, commandId: 'burst', actorId: caster.id, packageId: namespace, packageVersion: '1.0.0', activityId: installed.id,
      targetIds: selected.targetIds, areaPlacement: selected.areaPlacement, expectedRevision: 1 }
    const resolveInput = { state, combatRevision: 1, command,
      areaTargetIds: selected.targetIds, areaPlacementDistanceFeet: 0,
      authoritativeRolls, confirmedBy: 'actor' as const }
    if (count > 0) {
      // A large submitted list is permitted only with the same live Host selection.
      expect(resolveRegisteredDnd5eActivityInCombatV1({ ...resolveInput, areaTargetIds: undefined }).result.ok).toBe(false)
      for (const forgedTargets of [selected.targetIds.slice(1), [outside.id, ...selected.targetIds.slice(1)], [...selected.targetIds, selected.targetIds[0]]]) {
        expect(resolveRegisteredDnd5eActivityInCombatV1({ ...resolveInput, command: { ...command, targetIds: forgedTargets } }).result.ok).toBe(false)
      }
    }
    if (count > 256) {
      expect(validateDnd5eExecuteActivityCommandV1(command)).toContain('invalid targetIds')
      expect(validateDnd5eExecuteActivityCommandV1(command, Infinity)).toContain('invalid targetIds')
    }
    const result = resolveRegisteredDnd5eActivityInCombatV1(resolveInput)
    expect(result.result.ok, JSON.stringify(result.result)).toBe(true)
    if (result.phase !== 'commit' || !result.result.ok) throw Error('Expected committed area')
    for (const [index, token] of occupants.entries()) expect(result.result.state.combatants[token.id].currentHp).toBe(index % 2 ? 34 : 27)
    expect(result.result.state.combatants.caster.currentHp).toBe(40)
    expect(result.result.state.combatants.outside.currentHp).toBe(40)
    expect(state).toEqual(before)
  } finally { dispose() }
})
