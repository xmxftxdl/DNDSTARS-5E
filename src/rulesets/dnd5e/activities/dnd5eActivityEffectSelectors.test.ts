import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eMechanicalEffect } from '../activeEffects'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import type { BattleMap } from '../../../store/maps'
import { prepareDnd5ePluginFeatureAction, resolvePreparedDnd5ePluginFeatureAction } from '../pluginFeatureAction'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import type { Dnd5ePredicateV1 } from './dnd5eEffectContracts'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { resolveDnd5eActivity, type Dnd5eActivityActorSnapshot } from './dnd5eActivityExecutor'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'

const namespace = 'test.effect-alternatives'
const predicate: Extract<Dnd5ePredicateV1, { kind: 'active-effect' }> = {
  kind: 'active-effect', subject: 'target', source: 'self', present: true,
  anyOf: [{ effectId: 'named-mark' }, { tags: ['curse', 'test:class-curse'] }],
}
const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'pulse', name: 'Synthetic pulse', activation: { kind: 'bonus-action' },
  legacySource: { kind: 'feature', id: 'pulse' }, automation: automationCapabilityFromLegacyStatus('full'),
  target: { kind: 'creature', relation: 'any', count: 1 }, requirements: [predicate],
  consumption: [{ kind: 'action-economy', economy: 'bonus-action', amount: 1, consumeOn: 'resolve' }],
  outcomes: [{ id: 'harm', when: { kind: 'always' }, operations: [
    { id: 'damage', kind: 'damage', target: 'target', damageType: 'psychic', amount: { kind: 'constant', value: 3 } },
  ] }],
}
type Effect = NonNullable<Dnd5eActivityActorSnapshot['activeEffectDefinitionIds']>[number]
it.each([
  { sourceActorId: 'target', suspended: false, allowed: true },
  { sourceActorId: 'other', suspended: false, allowed: false },
  { sourceActorId: undefined, suspended: false, allowed: false },
  { sourceActorId: 'target', suspended: true, allowed: false },
])('binds an effect bearer to the actual selected source: %j', ({sourceActorId, suspended, allowed}) => {
  const requirement: Dnd5ePredicateV1 = { kind: 'active-effect', subject: 'actor', source: 'target',
    anyOf: [{ tags: ['link'] }], present: true }
  const linked = { ...actor, activeEffectDefinitionIds: [{definitionId: 'link-instance', sourceActorId, suspended, tags: ['link']}] }
  const result = resolveDnd5eActivity({ activity: { ...activity, consumption: [], requirements: [requirement] },
    actor: linked, targets: [{ ...actor, id: 'target' }], rolls: {} })
  expect(result.ok).toBe(allowed)
  expect(validateDnd5eActivityDefinitionV1({ ...activity, requirements: [{...requirement, subject: 'target'}] }).length).toBeGreaterThan(0)
})
const owned = { sourceActorId: 'actor' }
const cases: { name: string; effects: Effect[]; matches: boolean }[] = [
  { name: 'named', effects: [{ ...owned, definitionId: 'named-mark' }], matches: true },
  { name: 'wrapped', effects: [{ ...owned, definitionId: 'activity:grant:named-mark' }], matches: true },
  { name: 'tags', effects: [{ ...owned, definitionId: 'other-mark', tags: ['curse', 'test:class-curse'] }], matches: true },
  { name: 'tag order', effects: [{ ...owned, definitionId: 'other-mark', tags: ['test:class-curse', 'extra', 'curse'] }], matches: true },
  { name: 'other source', effects: [{ sourceActorId: 'other', definitionId: 'named-mark' }], matches: false },
  { name: 'unknown source', effects: [{ definitionId: 'named-mark' }], matches: false },
  { name: 'partial tags', effects: [{ ...owned, definitionId: 'other-mark', tags: ['curse'] }], matches: false },
  { name: 'split tags', effects: [{ ...owned, definitionId: 'a', tags: ['curse'] }, { ...owned, definitionId: 'b', tags: ['test:class-curse'] }], matches: false },
  { name: 'split owner', effects: [{ sourceActorId: 'other', definitionId: 'other-mark', tags: ['curse', 'test:class-curse'] }, { ...owned, definitionId: 'a' }], matches: false },
  { name: 'suspended name', effects: [{ ...owned, definitionId: 'named-mark', suspended: true }], matches: false },
  { name: 'suspended tags', effects: [{ ...owned, definitionId: 'other-mark', tags: ['curse', 'test:class-curse'], suspended: true }], matches: false },
  { name: 'active alternative', effects: [{ ...owned, definitionId: 'named-mark', suspended: true }, { ...owned, definitionId: 'b', tags: ['curse', 'test:class-curse'] }], matches: true },
  { name: 'substring', effects: [{ ...owned, definitionId: 'activity:named-mark:unrelated' }], matches: false },
  { name: 'absent', effects: [], matches: false },
]
const actor: Dnd5eActivityActorSnapshot = { id: 'actor', controller: 'players', level: 5, proficiencyBonus: 3,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 }, armorClass: 10, conditions: [] }

it.each(cases)('matches alternatives on one owned unsuspended effect: $name', ({ effects, matches }) => {
  for (const present of [true, false]) {
    const result = resolveDnd5eActivity({ activity: { ...activity, consumption: [], requirements: [{ ...predicate, present }] }, actor,
      targets: [{ ...actor, id: 'target', activeEffectDefinitionIds: effects }], rolls: {} })
    expect(result.ok, JSON.stringify(result)).toBe(present === matches)
  }
})

it('supports actor subjects and any-source selection, while preserving legacy effectId declarations', () => {
  const effect = { definitionId: 'named-mark', sourceActorId: 'other' }
  const owner = { ...actor, activeEffectDefinitionIds: [effect] }
  for (const requirement of [
    { ...predicate, subject: 'actor' as const, source: 'any' as const },
    { kind: 'active-effect' as const, subject: 'actor' as const, source: 'any' as const, effectId: 'named-mark', present: true },
  ]) expect(resolveDnd5eActivity({ activity: { ...activity, target: { kind: 'self' }, requirements: [requirement], consumption: [] }, actor: owner, targets: [owner], rolls: {} }).ok).toBe(true)
})

it.each([
  { name: 'empty', anyOf: [] }, { name: 'non-array', anyOf: {} },
  { name: 'null member', anyOf: [null] }, { name: 'string member', anyOf: ['curse'] },
  { name: 'empty member', anyOf: [{}] }, { name: 'empty tags', anyOf: [{ tags: [] }] },
  { name: 'string tags', anyOf: [{ tags: 'curse' }] }, { name: 'invalid tag', anyOf: [{ tags: ['Bad Tag'] }] },
  { name: 'duplicate tags', anyOf: [{ tags: ['curse', 'curse'] }] },
  { name: 'mixed selector', anyOf: [{ effectId: 'a', tags: ['curse'] }] },
  { name: 'unknown selector key', anyOf: [{ effectId: 'a', source: 'self' }] },
  { name: 'oversize selector', anyOf: Array.from({ length: 33 }, () => ({ effectId: 'a' })) },
  { name: 'oversize tags', anyOf: [{ tags: Array.from({ length: 33 }, (_, i) => `tag${i}`) }] },
  { name: 'long tag', anyOf: [{ tags: ['a'.repeat(81)] }] },
  { name: 'two selectors', anyOf: [{ effectId: 'a' }], effectId: 'b' },
])('rejects malformed effect alternatives: $name', malformed => {
  const { name: _name, ...fields } = malformed
  const invalid = { ...activity, requirements: [{ ...predicate, ...fields }] } as unknown as Dnd5eActivityDefinitionV1
  expect(validateDnd5eActivityDefinitionV1(invalid)).toContain('activity.requirements[0] active-effect selector is invalid')
})

it('preserves selectors through module export/install and checks both Host entry paths before resource consumption', async () => {
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Synthetic selectors', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' },
    assets: [], definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'pulse', name: 'Pulse',
      automation: activity.automation, activities: [activity],
      payload: { id: 'pulse', name: 'Pulse', summary: 'Synthetic', description: 'Synthetic', automation: 'full' } }],
  }
  const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  expect(decoded.bundle.definitions[0].activities![0].requirements).toEqual([predicate])
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
  try {
    for (const testCase of cases) {
      const actors = ['actor', 'target'].map((id, i) => createDnd5eCombatant({ id, name: id, controller: 'player', initiative: 20 - i,
        abilities: actor.abilities, proficiencyBonus: 3, armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0,
        speed: 30, position: { x: i * 5, y: 0 }, concentrating: false, pluginFeatureIds: i ? [] : [`${namespace}:pulse`] }))
      const state = startDnd5eHeadlessCombat('selectors', actors)
      state.combatants.target.classState.activeEffects = testCase.effects.map((effect, index) => createDnd5eMechanicalEffect({
        id: `test-${index}`, definitionId: effect.definitionId, label: 'Synthetic curse', targetId: 'target',
        source: { kind: 'feature', actorId: effect.sourceActorId }, tags: effect.tags,
        suspendedBy: effect.suspended ? ['host-suppression'] : undefined, duration: { type: 'permanent' },
      }))
      const original = structuredClone(state)
      const direct = resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1,
        command: { schemaVersion: 1, commandId: 'pulse', actorId: 'actor', packageId: namespace, packageVersion: '1.0.0',
          activityId: 'pulse', targetIds: ['target'], expectedRevision: 1 }, authoritativeRolls: {}, confirmedBy: 'actor' }).result
      const compiled = resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: namespace, actionId: 'pulse',
        featureId: `${namespace}:pulse`, actorId: 'actor', targetId: 'target', targetIds: ['target'], rolls: {}, payload: {} })
      for (const result of [direct, compiled]) {
        expect(result.ok, `${testCase.name}: ${JSON.stringify(result)}`).toBe(testCase.matches)
        if (result.ok) expect('state' in result).toBe(true)
        if ('state' in result) {
          expect(result.state.combatants.target.currentHp).toBe(testCase.matches ? 17 : 20)
          expect(result.state.combatants.actor.turn.bonusActionAvailable).toBe(!testCase.matches)
        }
      }
      expect(state).toEqual(original)
      const map: BattleMap = { id: 'selector-map', name: 'Map', width: 500, height: 500, gridSize: 50,
        gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
        tokens: ['actor', 'target'].map((id, i) => ({ id, label: id, type: 'enemy', size: 1,
          x: 25 + i * 50, y: 25, hp: 20, maxHp: 20, poolId: 'srd-5.1:bandit', color: '', emoji: '',
          dnd5eCombatState: { activeEffects: i ? structuredClone(state.combatants.target.classState.activeEffects) : [] } })),
        dnd5ePluginAreas: [{ id: 'grant', pluginId: namespace, featureId: 'pulse', label: 'Grant', color: '#fff',
          sourceCharacterId: 'actor', sourceTokenId: 'actor', createdRound: 1, expiresAfterRound: 10,
          cells: [{ col: 0, row: 0 }], anchorCell: { col: 0, row: 0 }, grantedActivities: [{ activityId: 'pulse' }] }],
      }
      const mapBefore = structuredClone(map)
      const prepared = prepareDnd5ePluginFeatureAction({ map, characters: [],
        initiativeOrder: map.tokens.map((token, i) => ({ tokenId: token.id, label: token.label, emoji: '', color: '', roll: 20 - i })),
        action: { id: 'map-pulse', mapId: map.id, combatId: 'combat', sourceMode: 'dm', status: 'pending',
          type: 'dnd5e-plugin-action', actorTokenId: 'actor', characterId: 'dm-token:actor', targetTokenId: 'target',
          round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
          dnd5ePluginAction: { featureId: `${namespace}:area-control.pulse`, payload: { persistentAreaId: 'grant' } } },
      })
      expect(prepared.ok, `${testCase.name}: ${JSON.stringify(prepared)}`).toBe(testCase.matches)
      if (prepared.ok) {
        const settled = await resolvePreparedDnd5ePluginFeatureAction({ prepared: prepared.prepared })
        expect(settled.result.ok, JSON.stringify(settled.result)).toBe(true)
        expect(settled.application!.map.tokens.find(token => token.id === 'target')?.hp).toBe(17)
        expect(settled.result.state.combatants.actor.turn.bonusActionAvailable).toBe(false)
      }
      expect(map).toEqual(mapBefore)
    }
  } finally { dispose() }
}, 20_000)
