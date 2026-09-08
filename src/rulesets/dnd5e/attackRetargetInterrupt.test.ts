import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'
import { registerDnd5eRulesPlugin } from './pluginApi'

const PLUGIN_ID = 'com.example.attack-retarget'
let featureId = ''
let dispose: (() => void) | undefined

function combatant(id: string, controller: 'dm' | 'player', initiative: number, patch = {}) {
  return createDnd5eCombatant({
    id, name: id, controller, initiative,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2, armorClass: 12, currentHp: 30, maxHp: 30, temporaryHp: 0,
    speed: 30, position: { x: 0, y: 0 }, concentrating: false,
    ...patch,
  })
}

function fixture() {
  const attacker = combatant('attacker', 'dm', 30)
  const wizard = combatant('wizard', 'player', 20, {
    level: 6, classId: 'wizard', classLevels: { wizard: 6 },
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    pluginFeatureIds: [featureId],
  })
  const nearest = combatant('nearest', 'dm', 10)
  const farther = combatant('farther', 'dm', 5)
  const state = startDnd5eHeadlessCombat('retarget-test', [attacker, wizard, nearest, farther])
  state.initiativeIndex = state.initiativeOrder.indexOf(attacker.id)
  state.distanceFeetByCombatantPair = {
    [dnd5eCombatantPairKey(attacker.id, wizard.id)]: 20,
    [dnd5eCombatantPairKey(attacker.id, nearest.id)]: 5,
    [dnd5eCombatantPairKey(attacker.id, farther.id)]: 10,
  }
  return { state, attacker, wizard, nearest, farther }
}

describe('generic attack retarget Interrupt', () => {
  beforeAll(() => {
    dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: PLUGIN_ID, name: 'Attack Retarget Test', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0',
      },
      setup(api) {
        featureId = api.registerFeature({
          id: 'instinctive-redirect', name: 'Instinctive Redirect', summary: 'Test.',
          description: 'Test.', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'instinctive-redirect', name: 'Instinctive Redirect',
            description: 'Test.', level: 1, trigger: { kind: 'before-attack-roll' },
            cost: { economy: 'reaction' },
            targeting: { kind: 'single-creature', relation: 'enemy', rangeFeet: 30, requiresSight: true },
            effects: [], automation: 'full',
            mechanic: {
              kind: 'attack-retarget-interrupt', protects: 'self', saveAbility: 'wis', dcAbility: 'int',
              alternativeTarget: 'nearest-other-creature', immunityCondition: 'charmed',
              successfulSaveImmunity: 'long-rest',
            },
          },
        })
      },
    })
  })
  afterAll(() => dispose?.())

  it('retargets a failed save only to a Host-derived closest creature', () => {
    const { state, attacker, wizard, nearest, farther } = fixture()
    const resolved = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: attacker.id, targetId: nearest.id, attackModifier: 20,
      d20: 10, spendAction: false,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [6], type: 'slashing' },
      attackRetargetInterrupt: {
        featureId, sourceId: wizard.id, originalTargetId: wizard.id,
        replacementTargetId: nearest.id, savingThrowD20: 1,
      },
    })
    expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
    if (!resolved.ok) return
    expect(resolved.state.combatants[nearest.id].currentHp).toBe(24)
    expect(resolved.state.combatants[wizard.id].currentHp).toBe(30)
    expect(resolved.state.combatants[wizard.id].turn.reactionAvailable).toBe(false)
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: 'attack-retarget-save-resolved', success: false, finalTargetId: nearest.id,
    }))

    const forged = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: attacker.id, targetId: farther.id, attackModifier: 20,
      d20: 10, spendAction: false,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [6], type: 'slashing' },
      attackRetargetInterrupt: {
        featureId, sourceId: wizard.id, originalTargetId: wizard.id,
        replacementTargetId: farther.id, savingThrowD20: 1,
      },
    })
    expect(forged).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('keeps the original target on success and records long-rest immunity', () => {
    const { state, attacker, wizard } = fixture()
    const resolved = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: attacker.id, targetId: wizard.id, attackModifier: 20,
      d20: 10, spendAction: false,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [6], type: 'slashing' },
      attackRetargetInterrupt: {
        featureId, sourceId: wizard.id, originalTargetId: wizard.id, savingThrowD20: 20,
      },
    })
    expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
    if (!resolved.ok) return
    expect(resolved.state.combatants[wizard.id].currentHp).toBe(24)
    expect(resolved.state.combatants[attacker.id].classState.declarativeAttackRetargetImmunityFeatureIds)
      .toContain(featureId)
  })
})
