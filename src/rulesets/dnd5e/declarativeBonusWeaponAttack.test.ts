import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DeclarativeSubclassDefinitionV1 } from './declarativeSubclassAbility'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { registerDnd5eRulesPlugin } from './pluginApi'

const PLUGIN_ID = 'com.example.bonus-weapon-attack'
const SUBCLASS_ID = `${PLUGIN_ID}:battle-priest`
const FEATURE_ID = `${SUBCLASS_ID}.battle-priest-attack`
const RESOURCE_ID = `${PLUGIN_ID}:decl-battle-priest-battle-priest-attack-uses`

const definition: DeclarativeSubclassDefinitionV1 = {
  schemaVersion: 1,
  id: 'battle-priest',
  classId: 'cleric',
  name: 'Battle Priest',
  summary: 'Synthetic generic bonus weapon attack fixture.',
  abilities: [{
    schemaVersion: 1,
    id: 'battle-priest-attack',
    name: 'Battle Priest Attack',
    description: 'Attack once as a bonus action after taking the Attack action.',
    level: 1,
    trigger: { kind: 'after-attack-roll' },
    cost: { economy: 'bonusAction', uses: 1 },
    targeting: { kind: 'self' },
    effects: [],
    limits: { uses: { kind: 'ability-modifier', ability: 'wis', minimum: 1 }, reset: 'long-rest' },
    mechanic: { kind: 'bonus-weapon-attack', event: 'after-attack-action' },
    automation: 'full',
  }],
}

function combatant(id: string, controller: 'dm' | 'player', initiative: number) {
  return createDnd5eCombatant({
    id, name: id, controller, initiative,
    abilities: { str: 16, dex: 10, con: 12, int: 10, wis: 16, cha: 10 },
    proficiencyBonus: 2, armorClass: 12, currentHp: 30, maxHp: 30, temporaryHp: 0,
    speed: 30, position: { x: 0, y: 0 }, concentrating: false,
  })
}

describe('generic declarative bonus weapon attack', () => {
  let dispose: (() => void) | undefined

  beforeAll(() => {
    dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: PLUGIN_ID, name: 'Bonus Weapon Attack Test', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Test', license: 'CC0-1.0',
      },
      setup(api) { api.registerDeclarativeSubclass(definition) },
    })
  })

  afterAll(() => dispose?.())

  it('requires a real Attack action and atomically spends bonus action plus the generated use resource', () => {
    const actor = combatant('actor', 'player', 20)
    Object.assign(actor, {
      level: 1, classId: 'cleric', subclassId: SUBCLASS_ID,
      classLevels: { cleric: 1 }, subclassIds: { cleric: SUBCLASS_ID },
      pluginFeatureIds: [FEATURE_ID], classResources: { [RESOURCE_ID]: { current: 3, max: 3 } },
    })
    const target = combatant('target', 'dm', 10)
    const initial = startDnd5eHeadlessCombat('bonus-weapon-attack', [actor, target])

    const forged = resolveDnd5eHeadlessAction(initial, {
      type: 'attack', actorId: actor.id, targetId: target.id, attackModifier: 20, d20: 10,
      spendAction: false, spendBonusAction: true, featureBonusWeaponAttackId: FEATURE_ID,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [3], type: 'slashing' },
    })
    expect(forged).toMatchObject({ ok: false, reason: 'invalid-class-feature' })

    const attackAction = resolveDnd5eHeadlessAction(initial, {
      type: 'attack', actorId: actor.id, targetId: target.id, attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [3], type: 'slashing' },
    })
    expect(attackAction.ok).toBe(true)
    if (!attackAction.ok) return

    const bonusAttack = resolveDnd5eHeadlessAction(attackAction.state, {
      type: 'attack', actorId: actor.id, targetId: target.id, attackModifier: 20, d20: 10,
      spendAction: false, spendBonusAction: true, featureBonusWeaponAttackId: FEATURE_ID,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [4], type: 'slashing' },
    })
    expect(bonusAttack.ok, bonusAttack.ok ? undefined : bonusAttack.reason).toBe(true)
    if (!bonusAttack.ok) return
    expect(bonusAttack.state.combatants.actor.turn.bonusActionAvailable).toBe(false)
    expect(bonusAttack.state.combatants.actor.classResources[RESOURCE_ID].current).toBe(2)
    expect(bonusAttack.events).toContainEqual(expect.objectContaining({
      type: 'class-resource-spent', actorId: actor.id, resourceKey: RESOURCE_ID,
    }))
  })
})
