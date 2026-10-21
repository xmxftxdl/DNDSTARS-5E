import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { normalizeCharacter } from '../../store/characters'
import { exportDnd5eStarMod, readDnd5eStarMod } from './starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from './unifiedContent'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from './character'
import { dnd5eArmorClass } from './equipment'
import { dnd5eCombatantSavingThrowEffectBonus } from './concentrationDefense'
import { dnd5eCombatantPairKey, dnd5eTargetArmorClassForAttack, endDnd5eConcentration, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { validateDeclarativeSubclassAbilityV1 } from './declarativeSubclassAbility'
import { getRegisteredDnd5eActivity } from './activities/dnd5eActivityRegistry'
import { compileDnd5eActivityHeadlessAction } from './activities/dnd5eActivityHeadlessCompiler'
import { dnd5eActivityPerTargetRollDeclarationsV1 } from './activities/dnd5eActivityPerTargetRolls'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './activities/dnd5eActivityCombatAuthority'

const ability = {
  schemaVersion: 1 as const, id: 'focus-defense', name: 'Focus defense', description: 'Synthetic conditional defense', level: 10,
  trigger: { kind: 'passive' as const }, targeting: { kind: 'self' as const }, effects: [], automation: 'full' as const,
  mechanic: { kind: 'passive-defense' as const, concentrationBonuses: { armorClass: 2, savingThrows: 2 } },
}

it.each([{}, { armorClass: 0 }, { savingThrows: 11 }, { armorClass: 1.5 }, { savingThrows: '2' }, { armorClass: 2, unknown: true }])(
  'rejects malformed concentration defense %j', bonuses => {
    expect(() => validateDeclarativeSubclassAbilityV1({ ...ability, mechanic: { ...ability.mechanic, concentrationBonuses: bonuses } })).toThrow()
  })

it('round-trips an imported passive and applies dynamic defenses only while its owner concentrates', async () => {
  const namespace = 'test.concentration-defense'
  const bundle: Dnd5eUnifiedContentBundleV1 = {
    format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Focus defense', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' },
    assets: [], definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'subclass', id: 'focused', name: 'Focused',
      automation: automationCapabilityFromLegacyStatus('full'), payload: {
        schemaVersion: 1, id: 'focused', name: 'Focused', classId: 'wizard', summary: 'Synthetic', abilities: [ability],
      } }, { schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'probe', name: 'Probe',
        automation: automationCapabilityFromLegacyStatus('full'),
        payload: { id: 'probe', name: 'Probe', description: 'Synthetic save probe', summary: 'Synthetic', automation: 'full' },
        activities: [{ schemaVersion: 1, id: 'probe', name: 'Probe', activation: { kind: 'free' },
          automation: automationCapabilityFromLegacyStatus('full'), legacySource: { kind: 'feature', id: 'probe' },
          target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 30 },
          checks: [...(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(key => ({ id: key, kind: 'saving-throw' as const, ability: key,
            dc: { kind: 'constant' as const, value: 10 }, rollId: key, scope: 'per-target' as const, rollMode: 'normal' as const })),
            { id: 'failed-save-table', kind: 'random-roll', rollId: 'failed-save-table', count: 1, sides: 4, scope: 'per-target', appliesWhenSave: { checkId: 'con', result: 'failure' } },
            { id: 'attack', kind: 'attack-roll', rollId: 'attack', scope: 'per-target', attackBonus: { kind: 'constant', value: 0 }, delivery: 'melee', rollMode: 'normal' },
            { id: 'on-hit-save', kind: 'saving-throw', rollId: 'on-hit-save', ability: 'con', scope: 'per-target', dc: { kind: 'constant', value: 10 }, rollMode: 'normal', appliesWhenCheck: { checkId: 'attack', result: 'success' } },
            { id: 'hit-table', kind: 'random-roll', rollId: 'hit-table', count: 1, sides: 4, scope: 'per-target', appliesWhenSave: { checkId: 'on-hit-save', result: 'failure' } }],
          outcomes: [{ id: 'probe', when: { kind: 'always' }, operations: [{ id: 'hp', kind: 'temporary-hit-points', target: 'target', amount: { kind: 'constant', value: 1 } }] }],
        }] }],
  }
  const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
  try {
    const hero = normalizeCharacter({ id: 'hero', name: 'Hero', charClass: '法师', level: 10,
      abilities: { str: 10, dex: 14, con: 10, int: 16, wis: 10, cha: 10 }, equipment: {},
      dnd5eClassLevels: { wizard: 10 }, dnd5eClassChoices: { classes: { wizard: { subclass: `${namespace}:focused` } } },
      maxHp: 50, currentHp: 50, dnd5eCombatState: { schemaVersion: 2, concentrationSpellId: 'web' } })
    const saved = JSON.parse(JSON.stringify(hero))
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(saved),
      controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    const enemy = { ...structuredClone(actor), id: 'enemy', pluginFeatureIds: [`${namespace}:probe`], initiative: 1 }
    const state = startDnd5eHeadlessCombat('focus-defense', [actor, enemy])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey(actor.id, enemy.id)]: 5 }
    expect(dnd5eArmorClass(saved)).toBe(actor.armorClass + 2)
    expect(dnd5eTargetArmorClassForAttack(state, enemy.id, actor.id)).toBe(actor.armorClass + 2)
    for (const key of ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const) {
      expect(dnd5eCombatantSavingThrowEffectBonus(actor, key)).toBe(2)
      expect(dnd5eCombatantSavingThrowEffectBonus({ ...actor, pluginFeatureIds: [] }, key)).toBe(0)
      expect(dnd5eCombatantSavingThrowEffectBonus({ ...actor, concentrating: false }, key)).toBe(0)
      expect(dnd5eCombatantSavingThrowEffectBonus({ ...actor, classState: { ...actor.classState, concentrationSpellId: undefined } }, key)).toBe(0)
    }
    const success = resolveDnd5eHeadlessAction(state, { type: 'concentration-save', actorId: actor.id, d20: 8, dc: 10 })
    expect(success.ok).toBe(true)
    expect(success.events).toContainEqual(expect.objectContaining({ type: 'concentration-resolved', total: 10, success: true }))
    const failure = resolveDnd5eHeadlessAction(state, { type: 'concentration-save', actorId: actor.id, d20: 1, dc: 10 })
    expect(failure.ok).toBe(true)
    if (!failure.ok) throw Error(failure.reason)
    expect(failure.events).toContainEqual(expect.objectContaining({ type: 'concentration-resolved', total: 3, success: false }))
    expect(dnd5eTargetArmorClassForAttack(failure.state, enemy.id, actor.id)).toBe(actor.armorClass)
    expect(dnd5eCombatantSavingThrowEffectBonus(failure.state.combatants.hero, 'wis')).toBe(0)
    expect(state.combatants.hero.concentrating).toBe(true)
    const restored = JSON.parse(JSON.stringify(failure.state))
    expect(dnd5eCombatantSavingThrowEffectBonus(restored.combatants.hero, 'con')).toBe(0)
    const voluntarilyEnded = structuredClone(state)
    endDnd5eConcentration(voluntarilyEnded, voluntarilyEnded.combatants.hero, [])
    expect(dnd5eTargetArmorClassForAttack(voluntarilyEnded, enemy.id, actor.id)).toBe(actor.armorClass)
    const installed = getRegisteredDnd5eActivity(namespace, 'probe')!
    const compiled = compileDnd5eActivityHeadlessAction(installed)
    const declarations = dnd5eActivityPerTargetRollDeclarationsV1({ activity: installed,
      actor: { id: enemy.id, controller: 'dm' }, targets: [{ id: actor.id, controller: 'players' }],
      declarations: compiled.perTargetRolls ?? [], hostAttackRollMode: () => 'normal', hostSavingThrowMode: () => 'normal' })
    expect(declarations).toHaveLength(10)
    for (const [inputState, bonus] of [[state, 2], [voluntarilyEnded, 0]] as const) {
      const directRolls = Object.fromEntries(declarations.filter(roll => bonus === 0 || roll.sides !== 4 && !roll.id.startsWith('on-hit-save:')).map(roll => {
        const value = roll.sides === 4 ? 2 : roll.id.startsWith('attack:') ? 13 : 8
        return [roll.id, { values: [value], modifier: 0, total: value }]
      }))
      const direct = resolveDnd5eHeadlessAction({ ...inputState, initiativeIndex: inputState.initiativeOrder.indexOf(enemy.id) }, {
        type: 'plugin', pluginId: namespace, actionId: installed.id, featureId: `${namespace}:probe`,
        actorId: enemy.id, targetId: actor.id, distanceFeet: 5, rolls: directRolls,
      })
      expect(direct.ok, direct.ok ? undefined : `${bonus}: ${direct.reason}; ${JSON.stringify(directRolls)}`).toBe(true)
      const wrongRolls = { ...directRolls }
      for (const roll of declarations.filter(roll => roll.sides === 4)) {
        if (bonus === 0) delete wrongRolls[roll.id]
        else wrongRolls[roll.id] = { values: [2], modifier: 0, total: 2 }
      }
      const wrong = resolveDnd5eHeadlessAction({ ...inputState, initiativeIndex: inputState.initiativeOrder.indexOf(enemy.id) }, {
        type: 'plugin', pluginId: namespace, actionId: installed.id, featureId: `${namespace}:probe`,
        actorId: enemy.id, targetId: actor.id, distanceFeet: 5, rolls: wrongRolls,
      })
      expect(wrong).toMatchObject({ ok: false, reason: 'invalid-dice' })
      const result = resolveRegisteredDnd5eActivityInCombatV1({ state: { ...inputState, initiativeIndex: inputState.initiativeOrder.indexOf(enemy.id) }, combatRevision: 1,
        command: { schemaVersion: 1, commandId: `probe-${bonus}`, actorId: enemy.id, packageId: namespace, packageVersion: '1.0.0', activityId: installed.id, targetIds: [actor.id], expectedRevision: 1 },
        authoritativeRolls: directRolls, confirmedBy: 'actor' })
      expect(result.result.ok, JSON.stringify(result.result)).toBe(true)
      if (!result.result.ok) throw Error('Expected save probe commit')
      const saves = result.result.events.filter(event => event.type === 'saving-throw-resolved')
      expect(saves).toHaveLength(bonus === 0 ? 7 : 6)
      for (const event of saves) expect(event.total).toBe(8 + actor.savingThrowBonuses[event.ability]! + bonus)
      expect(result.result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', armorClass: actor.armorClass + bonus, hit: bonus === 0 }))
    }
    expect(dnd5eArmorClass({ ...saved, dnd5eCombatState: { schemaVersion: 2 } })).toBe(actor.armorClass)
    const belowLevel = { ...saved, level: 9, dnd5eClassLevels: { wizard: 9 } }
    expect(dnd5eArmorClass(belowLevel)).toBe(actor.armorClass)
  } finally { dispose() }
})
