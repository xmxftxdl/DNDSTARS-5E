import { afterEach, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { setMapGeometryRuntime } from '../../../lib/mapGeometry'
import type { BattleMap } from '../../../store/maps'
import { createDnd5eConditionEffect, createDnd5eMechanicalEffect } from '../activeEffects'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { resolveDnd5eActivityAreaMapSelectionV1 } from './dnd5eActivityMapInteraction'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'

const namespace = 'test.visible-area'
const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'pulse', name: 'Synthetic pulse', activation: { kind: 'action' },
  legacySource: { kind: 'feature', id: 'pulse' }, automation: automationCapabilityFromLegacyStatus('full'),
  target: { kind: 'area', origin: 'self', shape: 'sphere', radiusFeet: 30, relation: 'any', requiresVisibleTargets: true },
  consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
  outcomes: [{ id: 'benefit', when: { kind: 'always' }, operations: [
    { id: 'pool', kind: 'temporary-hit-points', target: 'target', amount: { kind: 'constant', value: 5 } },
  ] }],
}
const invisible = (targetId: string) => createDnd5eConditionEffect({ condition: 'invisible', targetId, source: { kind: 'spell' } })
const seeInvisible = (targetId: string) => createDnd5eMechanicalEffect({ definitionId: 'test:vision', label: 'Sight',
  targetId, source: { kind: 'spell' }, modifiers: { seeInvisible: true } })

afterEach(() => setMapGeometryRuntime([]))

it('filters invisible occupants before the target cap, while allowing special senses and ordinary unseen area effects', () => {
  const map: BattleMap = { id: 'visible-area', name: 'Map', width: 1000, height: 1000,
    gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
    tokens: ['actor', 'hidden', 'visible'].map((id, index) => ({ id, label: id, color: '#fff', emoji: '',
      type: 'npc', size: 1, x: 75 + index * 50, y: 75,
      dnd5eCombatState: { activeEffects: id === 'hidden' ? [invisible(id)] : [] } })),
  }
  const selected = (requiresVisibleTargets = true) => resolveDnd5eActivityAreaMapSelectionV1({ map,
    actorToken: map.tokens[0], anchorCell: { col: 1, row: 1 }, activity: { ...activity,
      target: { ...activity.target, kind: 'area', origin: 'self', shape: 'sphere', relation: 'any',
        maximumTargets: 1, requiresVisibleTargets } } })
  expect(selected()?.targetIds).toEqual(['visible'])
  expect(selected(false)?.targetIds).toEqual(['hidden'])
  map.tokens[0].dnd5eCombatState!.activeEffects = [seeInvisible('actor')]
  expect(selected()?.targetIds).toEqual(['hidden'])
  map.tokens[0].dnd5eCombatState!.activeEffects = [createDnd5eConditionEffect({ condition: 'blinded', targetId: 'actor', source: { kind: 'spell' } })]
  expect(selected()?.targetIds).toEqual([])
})

it('rejects malformed declarations instead of coercing truthy JSON values', () => {
  for (const value of ['true', 1, {}, []]) {
    const malformed = JSON.parse(JSON.stringify(activity))
    malformed.target.requiresVisibleTargets = value
    expect(validateDnd5eActivityDefinitionV1(malformed)).toContain('activity.target.requiresVisibleTargets is invalid')
  }
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
})

it.each(['direct', 'choice', 'slot'] as const)('preserves perception through archive installation and both Host paths: %s', async projection => {
  const selectiveTarget = { ...activity.target, selection: 'choose-any' as const, minimumTargets: 0 }
  const declared: Dnd5eActivityDefinitionV1 = { ...activity,
    target: projection === 'direct' ? selectiveTarget : { ...activity.target, kind: 'area', origin: 'self', shape: 'sphere', relation: 'any', requiresVisibleTargets: false },
    ...(projection === 'choice' ? { choices: [{ id: 'mode', label: 'Mode', options: [{ id: 'visible', label: 'Visible', targetOverride: selectiveTarget }] }] } : {}),
    ...(projection === 'slot' ? { castLevelTargetProfiles: [{ minimumCastLevel: 3, target: selectiveTarget }] } : {}),
  }
  const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Synthetic visibility', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' },
    assets: [], definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'pulse', name: 'Pulse',
      automation: activity.automation, activities: [declared],
      payload: { id: 'pulse', name: 'Pulse', summary: 'Synthetic', description: 'Synthetic', automation: 'full' } }],
  }
  const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
  try {
    const actors = ['actor', 'target'].map((id, i) => createDnd5eCombatant({ id, name: id, controller: 'player', initiative: 20 - i,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
      armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 75 + i * 50, y: 75 },
      concentrating: false, pluginFeatureIds: i ? [] : [`${namespace}:pulse`] }))
    const state = startDnd5eHeadlessCombat('visible-area', actors)
    const choices = projection === 'choice' ? { mode: 'visible' } : undefined
    const areaPlacement = { x: 75, y: 75, radiusFeet: 30 }
    const runDirect = () => resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1,
      command: { schemaVersion: 1, commandId: 'pulse', actorId: 'actor', packageId: namespace, packageVersion: '1.0.0',
        activityId: 'pulse', targetIds: ['target'], expectedRevision: 1, castLevel: 3, choices, areaPlacement },
      areaTargetIds: ['target'], areaPlacementDistanceFeet: 0, authoritativeRolls: {}, confirmedBy: 'actor' })
    const runCompiled = () => resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: namespace, actionId: 'pulse',
      featureId: `${namespace}:pulse`, actorId: 'actor', targetId: 'target', targetIds: ['target'], castLevel: 3,
      rolls: {}, targetCell: { col: 1, row: 1 }, activityAreaPlacement: areaPlacement, activityAreaPlacementDistanceFeet: 0,
      payload: choices ? { activityChoices: choices } : {} })
    state.combatants.target.classState.activeEffects = [invisible('target')]
    state.combatants.target.conditions = ['invisible']
    const before = structuredClone(state)
    expect(runDirect().result.ok).toBe(false)
    expect(runCompiled().ok).toBe(false)
    expect(state).toEqual(before)
    state.combatants.actor.classState.activeEffects = [seeInvisible('actor')]
    const direct = runDirect()
    expect(direct.result.ok, JSON.stringify(direct)).toBe(true)
    const compiled = runCompiled()
    expect(compiled.ok, JSON.stringify(compiled)).toBe(true)
    if (compiled.ok) expect(compiled.state.combatants.target.temporaryHp).toBe(5)
  } finally { dispose() }
})
