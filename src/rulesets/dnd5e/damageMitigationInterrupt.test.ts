import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DeclarativeSubclassDefinitionV1 } from './declarativeSubclassAbility'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
} from './headlessCombatEngine'
import { registerDnd5eRulesPlugin } from './pluginApi'

const PLUGIN_ID = 'com.example.damage-interrupt'
const NATURE_SUBCLASS_ID = `${PLUGIN_ID}:nature-domain`
const ABJURATION_SUBCLASS_ID = `${PLUGIN_ID}:abjuration-school`
const DAMPEN_ID = `${NATURE_SUBCLASS_ID}.dampen-elements`
const WARD_ID = `${ABJURATION_SUBCLASS_ID}.arcane-ward`
const PROJECT_ID = `${ABJURATION_SUBCLASS_ID}.projected-ward`

const nature: DeclarativeSubclassDefinitionV1 = {
  schemaVersion: 1, id: 'nature-domain', classId: 'cleric', name: 'Nature', summary: 'Fixture.',
  abilities: [{
    schemaVersion: 1, id: 'dampen-elements', name: 'Dampen Elements', description: 'Resistance interrupt.', level: 6,
    trigger: { kind: 'before-damage-taken' }, cost: { economy: 'reaction' },
    targeting: { kind: 'single-creature', relation: 'ally', rangeFeet: 30, includeSelf: true },
    effects: [], mechanic: {
      kind: 'damage-mitigation-interrupt', mode: 'resistance', protects: 'ally-or-self',
      damageTypes: ['acid', 'cold', 'fire', 'lightning', 'thunder'],
    }, automation: 'full',
  }],
}

const abjuration: DeclarativeSubclassDefinitionV1 = {
  schemaVersion: 1, id: 'abjuration-school', classId: 'wizard', name: 'Abjuration', summary: 'Fixture.',
  abilities: [{
    schemaVersion: 1, id: 'arcane-ward', name: 'Arcane Ward', description: 'Persistent ward.', level: 2,
    trigger: { kind: 'after-spell-cast' }, targeting: { kind: 'self' }, effects: [],
    mechanic: {
      kind: 'ward-pool', spellcastingClassId: 'wizard', ability: 'int', school: 'abjuration',
      minimumSpellLevel: 1, classLevelMultiplier: 2, restorePerSpellLevel: 2,
    }, automation: 'full',
  }, {
    schemaVersion: 1, id: 'projected-ward', name: 'Projected Ward', description: 'Projects the ward.', level: 6,
    trigger: { kind: 'before-damage-taken' }, cost: { economy: 'reaction' },
    targeting: { kind: 'single-creature', relation: 'ally', rangeFeet: 30, requiresSight: true },
    effects: [], mechanic: {
      kind: 'damage-mitigation-interrupt', mode: 'ward-pool', protects: 'ally-or-self', poolAbilityId: 'arcane-ward',
    }, automation: 'full',
  }],
}

function combatant(id: string, controller: Dnd5eCombatant['controller'], initiative: number, patch: Partial<Dnd5eCombatant> = {}) {
  return createDnd5eCombatant({
    id, name: id, controller, initiative,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 3, armorClass: 12, currentHp: 30, maxHp: 30, temporaryHp: 0,
    speed: 30, position: { x: 0, y: 0 }, concentrating: false, ...patch,
  })
}

function state(combatants: Dnd5eCombatant[], activeId: string) {
  const result = startDnd5eHeadlessCombat('damage-interrupt', combatants)
  result.initiativeIndex = result.initiativeOrder.indexOf(activeId)
  result.distanceFeetByCombatantPair = {}
  for (const left of combatants) for (const right of combatants) {
    result.distanceFeetByCombatantPair[dnd5eCombatantPairKey(left.id, right.id)] = left.id === right.id ? 0 : 10
  }
  return result
}

describe('generic damage mitigation Interrupt and ward pool', () => {
  let dispose: (() => void) | undefined
  beforeAll(() => {
    dispose = registerDnd5eRulesPlugin({
      manifest: { id: PLUGIN_ID, name: 'Damage Interrupt Test', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Test', license: 'CC0-1.0' },
      setup(api) { api.registerDeclarativeSubclass(nature); api.registerDeclarativeSubclass(abjuration) },
    })
  })
  afterAll(() => dispose?.())

  it('halves a declared elemental damage instance and spends the reaction', () => {
    const attacker = combatant('attacker', 'dm', 20)
    const cleric = combatant('cleric', 'player', 10, {
      level: 6, classId: 'cleric', subclassId: NATURE_SUBCLASS_ID,
      classLevels: { cleric: 6 }, subclassIds: { cleric: NATURE_SUBCLASS_ID }, pluginFeatureIds: [DAMPEN_ID],
    })
    const result = resolveDnd5eHeadlessAction(state([attacker, cleric], attacker.id), {
      type: 'attack', actorId: attacker.id, targetId: cleric.id, attackModifier: 10,
      d20: 15, spendAction: false, damage: { count: 1, sides: 10, bonus: 0, rolls: [9], type: 'fire' },
      damageMitigationInterrupts: [{ sourceId: cleric.id, targetId: cleric.id, featureId: DAMPEN_ID }],
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.cleric.currentHp).toBe(26)
    expect(result.state.combatants.cleric.turn.reactionAvailable).toBe(false)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'damage-mitigation-interrupt-applied', featureId: DAMPEN_ID, prevented: 5,
    }))
  })

  it('creates the arcane ward on a qualifying spell and lets Projected Ward absorb ally damage', () => {
    const wizard = combatant('wizard', 'player', 15, {
      level: 6, classId: 'wizard', subclassId: ABJURATION_SUBCLASS_ID,
      classLevels: { wizard: 6 }, subclassIds: { wizard: ABJURATION_SUBCLASS_ID },
      abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
      pluginFeatureIds: [WARD_ID, PROJECT_ID], classSelections: { 'spell-prepared': ['mage-armor'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const ally = combatant('ally', 'player', 10)
    const attacker = combatant('attacker', 'dm', 20)
    const cast = resolveDnd5eHeadlessAction(state([wizard, ally, attacker], wizard.id), {
      type: 'cast-spell', actorId: wizard.id, targetId: ally.id, spellId: 'mage-armor', slotLevel: 1, effectRolls: [],
    })
    expect(cast.ok, cast.ok ? undefined : cast.reason).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants.wizard.classState.declarativeWardPools?.[WARD_ID]).toEqual({ current: 16, max: 16 })
    cast.state.initiativeIndex = cast.state.initiativeOrder.indexOf(attacker.id)
    const hit = resolveDnd5eHeadlessAction(cast.state, {
      type: 'attack', actorId: attacker.id, targetId: ally.id, attackModifier: 10,
      d20: 15, spendAction: false, damage: { count: 1, sides: 10, bonus: 0, rolls: [10], type: 'slashing' },
      damageMitigationInterrupts: [{ sourceId: wizard.id, targetId: ally.id, featureId: PROJECT_ID }],
    })
    expect(hit.ok, hit.ok ? undefined : hit.reason).toBe(true)
    if (!hit.ok) return
    expect(hit.state.combatants.ally.currentHp).toBe(30)
    expect(hit.state.combatants.wizard.classState.declarativeWardPools?.[WARD_ID].current).toBe(6)
    expect(hit.state.combatants.wizard.turn.reactionAvailable).toBe(false)
  })

  it('applies the same mitigation Interrupt to a catalog monster weapon attack', () => {
    const owlbear = combatant('owlbear', 'dm', 20, {
      statBlockId: 'srd-5.1:owlbear', currentHp: 59, maxHp: 59,
    })
    const wizard = combatant('wizard', 'player', 15, {
      level: 6, classId: 'wizard', subclassId: ABJURATION_SUBCLASS_ID,
      classLevels: { wizard: 6 }, subclassIds: { wizard: ABJURATION_SUBCLASS_ID },
      pluginFeatureIds: [WARD_ID, PROJECT_ID],
      classState: {
        declarativeWardPools: { [WARD_ID]: { current: 12, max: 16 } },
      },
    })
    const ally = combatant('ally', 'player', 10)
    const monsterState = state([owlbear, wizard, ally], owlbear.id)
    monsterState.distanceFeetByCombatantPair ??= {}
    monsterState.distanceFeetByCombatantPair[dnd5eCombatantPairKey(owlbear.id, ally.id)] = 5
    const result = resolveDnd5eHeadlessAction(monsterState, {
      type: 'monster-action', actorId: owlbear.id, actionId: 'beak',
      rolls: [{ targetId: ally.id, d20: 15, damageRolls: [[10]] }],
      damageMitigationInterrupts: [{ sourceId: wizard.id, targetId: ally.id, featureId: PROJECT_ID }],
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.ally.currentHp).toBe(27)
    expect(result.state.combatants.wizard.classState.declarativeWardPools?.[WARD_ID].current).toBe(0)
    expect(result.state.combatants.wizard.turn.reactionAvailable).toBe(false)
  })
})
