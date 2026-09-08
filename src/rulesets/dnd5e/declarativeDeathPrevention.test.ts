import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DeclarativeSubclassDefinitionV1 } from './declarativeSubclassAbility'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { registerDnd5eRulesPlugin } from './pluginApi'

const PLUGIN_ID = 'com.example.death-prevention'
const SUBCLASS_ID = `${PLUGIN_ID}:sentinel`
const FEATURE_ID = `${SUBCLASS_ID}.last-stand`
const RESOURCE_ID = `${PLUGIN_ID}:decl-sentinel-last-stand-uses`

const definition: DeclarativeSubclassDefinitionV1 = {
  schemaVersion: 1,
  id: 'sentinel',
  classId: 'paladin',
  name: 'Sentinel',
  summary: 'Synthetic death prevention fixture.',
  abilities: [{
    schemaVersion: 1,
    id: 'last-stand',
    name: 'Last Stand',
    description: 'Remain at one hit point unless the damage would kill outright.',
    level: 1,
    trigger: { kind: 'before-drop-to-zero' },
    targeting: { kind: 'self' },
    effects: [],
    limits: { uses: { kind: 'fixed', value: 1 }, reset: 'long-rest' },
    mechanic: { kind: 'death-prevention', hitPointsAfter: 1 },
    automation: 'full',
  }],
}

function combatant(id: string, controller: 'dm' | 'player', initiative: number, currentHp: number, maxHp: number) {
  return createDnd5eCombatant({
    id, name: id, controller, initiative,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2, armorClass: 10, currentHp, maxHp, temporaryHp: 0,
    speed: 30, position: { x: 0, y: 0 }, concentrating: false,
  })
}

describe('generic declarative death prevention', () => {
  let dispose: (() => void) | undefined

  beforeAll(() => {
    dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: PLUGIN_ID, name: 'Death Prevention Test', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Test', license: 'CC0-1.0',
      },
      setup(api) { api.registerDeclarativeSubclass(definition) },
    })
  })

  afterAll(() => dispose?.())

  it('atomically spends its use and replaces a valid drop to zero', () => {
    const attacker = combatant('attacker', 'dm', 20, 30, 30)
    const defender = combatant('defender', 'player', 10, 5, 10)
    Object.assign(defender, {
      level: 1, classId: 'paladin', subclassId: SUBCLASS_ID,
      classLevels: { paladin: 1 }, subclassIds: { paladin: SUBCLASS_ID },
      pluginFeatureIds: [FEATURE_ID], classResources: { [RESOURCE_ID]: { current: 1, max: 1 } },
    })
    const state = startDnd5eHeadlessCombat('death-prevention', [attacker, defender])
    state.initiativeIndex = state.initiativeOrder.indexOf(attacker.id)
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: attacker.id, targetId: defender.id, attackModifier: 20,
      d20: 10, mode: 'normal', spendAction: false,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [6] },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[defender.id].currentHp).toBe(1)
    expect(result.state.combatants[defender.id].classResources[RESOURCE_ID].current).toBe(0)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'declarative-death-prevention-applied', actorId: defender.id, featureId: FEATURE_ID,
    }))
  })

  it('does not prevent massive-damage death unless the declaration explicitly allows it', () => {
    const attacker = combatant('massive-attacker', 'dm', 20, 30, 30)
    const defender = combatant('massive-defender', 'player', 10, 5, 10)
    Object.assign(defender, {
      level: 1, classId: 'paladin', subclassId: SUBCLASS_ID,
      classLevels: { paladin: 1 }, subclassIds: { paladin: SUBCLASS_ID },
      pluginFeatureIds: [FEATURE_ID], classResources: { [RESOURCE_ID]: { current: 1, max: 1 } },
    })
    const state = startDnd5eHeadlessCombat('massive-death', [attacker, defender])
    state.initiativeIndex = state.initiativeOrder.indexOf(attacker.id)
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: attacker.id, targetId: defender.id, attackModifier: 20,
      d20: 10, mode: 'normal', spendAction: false,
      damage: { count: 1, sides: 20, bonus: 0, rolls: [15] },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[defender.id].currentHp).toBe(0)
    expect(result.state.combatants[defender.id].classResources[RESOURCE_ID].current).toBe(1)
    expect(result.events.some((event) => event.type === 'declarative-death-prevention-applied')).toBe(false)
  })
})
