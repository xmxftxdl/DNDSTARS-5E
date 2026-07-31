import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DeclarativeSubclassDefinitionV1 } from './declarativeSubclassAbility'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
} from './headlessCombatEngine'
import { registerDnd5eRulesPlugin } from './pluginApi'
import {
  dnd5eHiddenSpellSaveDisadvantageApplies,
  dnd5eHiddenSpellSaveDisadvantageFeatures,
} from './spellSavePressure'

const PLUGIN_ID = 'com.example.hidden-spell-save'
const SUBCLASS_ID = `${PLUGIN_ID}:shadow-caster`
const FEATURE_ID = `${SUBCLASS_ID}.hidden-save-pressure`
const ABILITIES = {
  str: 10,
  dex: 16,
  con: 10,
  int: 18,
  wis: 10,
  cha: 10,
} as const

const definition: DeclarativeSubclassDefinitionV1 = {
  schemaVersion: 1,
  id: 'shadow-caster',
  classId: 'wizard',
  name: 'Shadow Caster',
  summary: 'Synthetic hidden spell-save protocol fixture.',
  abilities: [{
    schemaVersion: 1,
    id: 'hidden-save-pressure',
    name: 'Hidden Save Pressure',
    description: 'Synthetic hidden casting fixture.',
    level: 9,
    trigger: { kind: 'active-use' },
    targeting: { kind: 'single-creature', relation: 'enemy' },
    mechanic: { kind: 'hidden-spell-save-disadvantage' },
    effects: [],
    automation: 'full',
  }],
}

function combatant(
  id: string,
  controller: Dnd5eCombatant['controller'],
  initiative: number,
  patch: Partial<Dnd5eCombatant> = {},
): Dnd5eCombatant {
  return createDnd5eCombatant({
    id,
    name: id,
    controller,
    initiative,
    abilities: ABILITIES,
    proficiencyBonus: 4,
    armorClass: 12,
    currentHp: 50,
    maxHp: 50,
    temporaryHp: 0,
    speed: 30,
    position: { x: controller === 'player' ? 0 : 5, y: 0 },
    concentrating: false,
    ...patch,
  })
}

function caster(input: {
  level?: number
  hidden?: boolean
  owned?: boolean
} = {}): Dnd5eCombatant {
  const level = input.level ?? 9
  return combatant('caster', 'player', 20, {
    level,
    classId: 'wizard',
    classLevels: { wizard: level },
    subclassId: SUBCLASS_ID,
    subclassIds: { wizard: SUBCLASS_ID },
    pluginFeatureIds: input.owned === false ? [] : [FEATURE_ID],
    classSelections: { 'spell-cantrips': ['poison-spray'] },
    classState: input.hidden === false ? {} : { hiddenCheckTotal: 24 },
  })
}

describe('generic hidden spell-save disadvantage protocol', () => {
  let dispose: (() => void) | undefined

  beforeAll(() => {
    dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: PLUGIN_ID,
        name: 'Hidden Spell Save Test',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Test',
        license: 'CC0-1.0',
      },
      setup(api) {
        api.registerDeclarativeSubclass(definition)
      },
    })
  })

  afterAll(() => dispose?.())

  it('requires the registered feature, its minimum level and a hidden cast', () => {
    const eligible = caster()
    expect(dnd5eHiddenSpellSaveDisadvantageFeatures(eligible)).toEqual([
      { featureId: FEATURE_ID },
    ])
    expect(dnd5eHiddenSpellSaveDisadvantageApplies(eligible)).toBe(true)
    expect(dnd5eHiddenSpellSaveDisadvantageApplies(caster({
      hidden: false,
    }))).toBe(false)
    expect(dnd5eHiddenSpellSaveDisadvantageApplies(caster({
      level: 8,
    }))).toBe(false)
    expect(dnd5eHiddenSpellSaveDisadvantageApplies(caster({
      owned: false,
    }))).toBe(false)
  })

  it('authoritatively uses the lower save die for a hidden saving-throw spell', () => {
    const actor = caster()
    const target = combatant('target', 'dm', 10)
    const state = startDnd5eHeadlessCombat(
      'hidden-spell-save-combat',
      [actor, target],
    )
    state.distanceFeetByCombatantPair = { ['caster\u0000target']: 5 }

    const result = resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell',
      actorId: actor.id,
      castingClassId: 'wizard',
      targetId: target.id,
      spellId: 'poison-spray',
      slotLevel: 0,
      savingThrowD20: 20,
      savingThrowD20Second: 1,
      effectRolls: [5, 5],
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    expect(result.state.combatants.target.currentHp).toBe(40)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved',
      targetId: target.id,
      d20: 1,
      success: false,
    }))
  })
})
