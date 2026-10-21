import { exportDnd5eStarMod, readDnd5eStarMod } from './starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from './unifiedContent'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './activities/dnd5eActivityCombatAuthority'
import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { normalizeCharacter } from '../../store/characters'
import { createDnd5eMechanicalEffect, dnd5eActiveSkillCheckBonus, normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict } from './activeEffects'
import { dnd5eSkillCheckModifier } from './checks'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, commitDnd5eActivityExecution } from './headlessCombatEngine'
import { resolveDnd5eActivity } from './activities/dnd5eActivityExecutor'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './activities/dnd5eActivityCombatAuthority'
import { validateDnd5eEffectDefinitionV1 } from './activities/dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'

const definition = {
  schemaVersion: 1 as const, id: 'skill-training', name: 'Skill training', stacking: 'replace' as const,
  duration: { kind: 'rounds' as const, rounds: 1, expiresAt: 'target-turn-end' as const },
  modifiers: [{ kind: 'ability-check' as const, mode: 'add' as const, skill: 'persuasion', ability: 'cha' as const, value: { kind: 'constant' as const, value: 5 } }],
}
const grant: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'grant', name: 'Grant', activation: { kind: 'free' }, target: { kind: 'self' },
  effects: [definition], outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [{ id: 'apply', kind: 'apply-effect', target: 'actor', effectId: definition.id }] }],
  automation: automationCapabilityFromLegacyStatus('full') }
function fixture() {
  const actor = createDnd5eCombatant({ id: 'actor', name: 'Actor', controller: 'player', initiative: 20,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, armorClass: 12, proficiencyBonus: 2,
    currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, concentrating: false, position: { x: 0, y: 0 } })
  return startDnd5eHeadlessCombat('skill-training', [actor, { ...structuredClone(actor), id: 'enemy', controller: 'dm', initiative: 1 }])
}

it('applies the same scoped skill bonus in character display, ordinary Host and Activity checks, and removes it on expiry', () => {
  expect(validateDnd5eEffectDefinitionV1(definition)).toEqual([])
  const initial = fixture()
  const snapshot = dnd5eActivityActorSnapshotFromCombatantV1(initial.combatants.actor)
  const resolution = resolveDnd5eActivity({ activity: grant, actor: snapshot, targets: [snapshot], rolls: {} })
  const applied = commitDnd5eActivityExecution(initial, { actorId: 'actor', activityId: grant.id, targetIds: ['actor'], resolution, source: { kind: 'feature', id: 'training' } })
  expect(applied.ok).toBe(true)
  const loaded = JSON.parse(JSON.stringify(applied.state)) as typeof initial
  const effects = normalizeDnd5eActiveEffects(loaded.combatants.actor.classState.activeEffects)
  expect(effects[0].modifiers?.skillCheckBonuses).toEqual([{ skill: 'persuasion', ability: 'cha', bonus: 5 }])
  expect(validateDnd5eActiveEffectsStrict(effects).ok).toBe(true)
  for (const suspended of [false, true]) for (const skill of ['persuasion', 'intimidation', undefined]) {
    const state = structuredClone(loaded)
    state.combatants.actor.classState.activeEffects = effects.map(effect => ({ ...effect, suspendedBy: suspended ? ['antimagic'] : undefined }))
    const expected = !suspended && skill === 'persuasion' ? 5 : 0
    const character = normalizeCharacter({ id: 'actor', name: 'Actor', charClass: '法师', level: 1, skills: [],
      abilities: state.combatants.actor.abilities, dnd5eCombatState: { activeEffects: state.combatants.actor.classState.activeEffects } })
    if (skill) expect(dnd5eSkillCheckModifier(character, skill)).toBe(expected)
    const before = structuredClone(state)
    const checked = resolveDnd5eHeadlessAction(state, { type: 'ability-check', actorId: 'actor', ability: 'cha', skill, d20: 7, dc: 10 })
    expect(checked.ok).toBe(true)
    expect(checked.events).toContainEqual(expect.objectContaining({ type: 'ability-check-resolved', total: 7 + expected, modifier: expected }))
    for (const withState of [false, true]) {
      const subject = dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.actor, undefined, withState ? state : undefined)
      const probe: Dnd5eActivityDefinitionV1 = { ...grant, effects: undefined,
        checks: [{ id: 'check', rollId: 'check', ability: 'cha', dc: { kind: 'constant', value: 10 }, rollMode: 'normal', ...(skill ? { kind: 'skill-check', skill } : { kind: 'ability-check' }) }],
        outcomes: [{ id: 'done', when: { kind: 'always' }, operations: [{ id: 'done', kind: 'mechanic', target: 'actor', handlerId: 'core.resolve-only' }] }] }
      const result = resolveDnd5eActivity({ activity: probe, actor: subject, targets: [subject], rolls: { check: { values: [7] } } })
      expect(result.ok, JSON.stringify(result)).toBe(true)
      if (result.ok) expect(result.checks[0].total).toBe(7 + expected)
    }
    expect(state).toEqual(before)
  }
  let state = loaded
  for (let turn = 0; turn < 4; turn++) {
    const end = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: state.initiativeOrder[state.initiativeIndex] })
    expect(end.ok).toBe(true)
    state = end.state
  }
  expect(dnd5eActiveSkillCheckBonus(state.combatants.actor.classState.activeEffects, 'cha', 'persuasion')).toBe(0)
  expect(initial.combatants.actor.classState.activeEffects ?? []).toHaveLength(0)
})

it('rejects invalid authoring and persisted bonus data without silently treating a bonus as disadvantage', () => {
  for (const modifier of [
    { kind: 'ability-check', mode: 'add', value: { kind: 'constant', value: 5 } },
    { kind: 'ability-check', mode: 'add', skill: 'persuasion' },
    { kind: 'ability-check', mode: 'add', skill: 'persuasion', value: { kind: 'constant', value: Number.NaN } },
  ]) expect(validateDnd5eEffectDefinitionV1({ ...definition, modifiers: [modifier] } as never).length).toBeGreaterThan(0)
  const effect = createDnd5eMechanicalEffect({ definitionId: 'training', label: 'Training', targetId: 'actor', source: { kind: 'plugin' }, modifiers: { skillCheckBonuses: [{ skill: 'persuasion', ability: 'cha', bonus: -2 }] } })
  expect(dnd5eActiveSkillCheckBonus([effect], 'cha', 'persuasion')).toBe(-2)
  expect(dnd5eActiveSkillCheckBonus([effect], 'str', 'persuasion')).toBe(0)
  for (const bonuses of [[], [{ skill: 'persuasion', bonus: '5' }], [{ skill: 'persuasion', ability: 'bad', bonus: 5 }], [{ skill: 'persuasion', bonus: 5, arbitrary: true }]]) {
    expect(validateDnd5eActiveEffectsStrict([{ ...effect, modifiers: { skillCheckBonuses: bonuses } }]).ok).toBe(false)
  }
})

it('installs an exported skill bonus and executes it through registered Host authority twice', async () => {
  const namespace = 'test.skill-bonus-effect'
  const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1, assets: [],
    manifest: { id: namespace, name: 'Synthetic skill bonus', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only' },
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'training', name: 'Training', automation: automationCapabilityFromLegacyStatus('full'),
      payload: { id: 'training', name: 'Training', summary: 'Synthetic', description: 'Synthetic', automation: 'full' },
      activities: [{ ...grant, legacySource: { kind: 'feature', id: 'training' } }] }],
  }
  let archive = await exportDnd5eStarMod(bundle)
  for (let install = 0; install < 2; install++) {
    const decoded = await readDnd5eStarMod(archive)
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
    try {
      const state = fixture()
      state.combatants.actor.pluginFeatureIds = [namespace + ':training']
      const response = resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1, confirmedBy: 'actor', authoritativeRolls: {}, command: {
        schemaVersion: 1, commandId: 'training-' + install, actorId: 'actor', packageId: namespace, packageVersion: '1.0.0', activityId: grant.id, targetIds: ['actor'], expectedRevision: 1,
      } })
      expect(response.result.ok, JSON.stringify(response.result)).toBe(true)
      if (!response.result.ok) throw Error('Host grant failed')
      const check = resolveDnd5eHeadlessAction(response.result.state, { type: 'ability-check', actorId: 'actor', ability: 'cha', skill: 'persuasion', d20: 7, dc: 10 })
      expect(check.ok).toBe(true)
      expect(check.events).toContainEqual(expect.objectContaining({ type: 'ability-check-resolved', total: 12, success: true }))
    } finally { dispose() }
    archive = await exportDnd5eStarMod(decoded.bundle)
  }
})
