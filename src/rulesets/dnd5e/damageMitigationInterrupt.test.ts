import { getDnd5eSrdMonster } from './monsters'
import { registerDnd5ePluginMonsterCatalogEntry } from './roomMonsterCatalog'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { validateDeclarativeSubclassAbilityV1, type DeclarativeSubclassDefinitionV1 } from './declarativeSubclassAbility'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
} from './headlessCombatEngine'
import { createDnd5eMechanicalEffect } from './activeEffects'
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
  }, {
    schemaVersion: 1, id: 'rolled-reduction', name: 'Rolled protection', description: 'Synthetic dice reduction.', level: 6,
    trigger: { kind: 'before-damage-taken' }, cost: { economy: 'reaction' },
    targeting: { kind: 'single-creature', relation: 'ally', rangeFeet: 30, requiresSight: true }, effects: [],
    mechanic: { kind: 'damage-mitigation-interrupt', mode: 'reduction', protects: 'ally-or-self', requiresRage: true,
      reductionDice: { count: 2, sides: 6, classId: 'cleric', upgrades: [{ level: 10, count: 3 }, { level: 14, count: 4 }] } },
    automation: 'full',
  }, ...(['reduction', 'transfer'] as const).map(mode => ({
    schemaVersion: 1 as const, id: mode, name: mode, description: 'Synthetic bounded mitigation.', level: 6,
    trigger: { kind: 'before-damage-taken' as const }, cost: { economy: 'reaction' as const },
    targeting: { kind: 'single-creature' as const, relation: 'ally' as const, rangeFeet: 30, includeSelf: true },
    effects: [], mechanic: { kind: 'damage-mitigation-interrupt' as const, mode, protects: 'ally-or-self' as const, maximumAmount: 5 }, automation: 'full' as const,
  }))],
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
      setup(api) {
        for (const definition of [nature, abjuration]) api.registerDeclarativeSubclass({ ...definition, abilities: [
          ...definition.abilities,
          ...(definition === nature ? [{ schemaVersion: 1 as const, id: 'linked-retaliation', name: 'Linked retaliation', description: 'Synthetic upgrade.', level: 14,
            trigger: { kind: 'passive' as const }, targeting: { kind: 'self' as const }, effects: [], automation: 'full' as const,
            mechanic: { kind: 'damage-mitigation-retaliation' as const, protectionAbilityId: 'rolled-reduction', damageType: 'force' as const, magical: true },
          }] : []),
          ...(definition === nature ? [{ ...nature.abilities[1], id: 'early-reduction', mechanic: {
            ...nature.abilities[1].mechanic!, kind: 'damage-mitigation-interrupt' as const,
            mode: 'reduction' as const, protects: 'ally-or-self' as const, reductionTiming: 'before-defenses' as const,
            preventedAttackRetaliation: { minimumClassLevel: 14, damageType: 'force' as const, magical: true },
          } }] : []),
          ...(definition === nature ? [{ ...nature.abilities[1], id: 'retaliating-reduction', mechanic: {
            ...nature.abilities[1].mechanic!, kind: 'damage-mitigation-interrupt' as const,
            mode: 'reduction' as const, protects: 'ally-or-self' as const,
            preventedAttackRetaliation: { minimumClassLevel: 14, damageType: 'force' as const, magical: true },
          } }] : []),
          ...(definition === nature ? [{ ...nature.abilities[0], id: 'attack-only', mechanic: {
            kind: 'damage-mitigation-interrupt' as const, mode: 'resistance' as const, protects: 'ally-or-self' as const,
            damageTypes: ['fire' as const, 'necrotic' as const, 'piercing' as const, 'poison' as const], attackOnly: true,
          } }] : []),
          ...definition.abilities.filter(ability => ['reduction', 'transfer', 'projected-ward'].includes(ability.id)).map(ability => ({
            ...ability, id: 'limited-' + ability.id, limits: { uses: { kind: 'fixed' as const, value: 3 }, reset: 'short-rest' as const },
            cost: { economy: 'reaction' as const, uses: 2, resources: [
              { scope: 'core' as const, resourceId: 'dnd5e-ki', amount: 1 },
              { scope: 'core' as const, resourceId: 'dnd5e-ki', amount: 1 },
            ] },
          })),
        ] })
      },
    })
  })
  afterAll(() => dispose?.())

  it.each([{ level: 13, owned: true, reflected: 0 }, { level: 14, owned: false, reflected: 0 },
    { level: 14, owned: true, reflected: 4 }])('requires a qualified owned linked mitigation upgrade: $level/$owned', ({ level, owned, reflected }) => {
    const featureId = `${NATURE_SUBCLASS_ID}.rolled-reduction`
    const protector = combatant('protector', 'player', 10, { level, classId: 'cleric', classLevels: { cleric: level },
      subclassId: NATURE_SUBCLASS_ID, subclassIds: { cleric: NATURE_SUBCLASS_ID }, classState: { raging: true },
      pluginFeatureIds: [featureId, ...(owned ? [`${NATURE_SUBCLASS_ID}.linked-retaliation`] : [])] })
    const initial = state([combatant('attacker','dm',20), protector, combatant('ally','player',5)], 'attacker')
    const result = resolveDnd5eHeadlessAction(initial, { type:'attack', actorId:'attacker', targetId:'ally', attackModifier:10, d20:15, spendAction:false,
      damage:{count:1,sides:10,bonus:0,rolls:[4],type:'fire'},
      damageMitigationInterrupts:[{sourceId:'protector',targetId:'ally',featureId,reductionRolls:Array(level>=14?4:3).fill(2)}] })
    expect(result.ok).toBe(true)
    expect(result.state.combatants.ally.currentHp).toBe(30)
    expect(result.state.combatants.attacker.currentHp).toBe(30-reflected)
    expect(result.state.combatants.protector.turn.reactionAvailable).toBe(false)
  })

  it.each([
    { defenses: {}, incoming: 12, damage: 8, reflected: 4 },
    { defenses: { damageResistances: ['fire'] }, incoming: 12, damage: 4, reflected: 4 },
    { defenses: { damageVulnerabilities: ['fire'] }, incoming: 12, damage: 16, reflected: 4 },
    { defenses: { damageResistances: ['fire'] }, incoming: 4, damage: 0, reflected: 4 },
    { defenses: { damageImmunities: ['fire'] }, incoming: 12, damage: 0, reflected: 0 },
  ])('applies early reduction before defenses and flushes retaliation at zero HP loss: $incoming/$damage', ({ defenses, incoming, damage, reflected }) => {
    const featureId = `${NATURE_SUBCLASS_ID}.early-reduction`
    const protector = combatant('protector', 'player', 10, { level: 14, classId: 'cleric',
      classLevels: { cleric: 14 }, subclassId: NATURE_SUBCLASS_ID, subclassIds: { cleric: NATURE_SUBCLASS_ID },
      pluginFeatureIds: [featureId], classState: { raging: true } })
    const initial = state([combatant('attacker', 'dm', 20), protector,
      combatant('ally', 'player', 5, defenses as Partial<Dnd5eCombatant>)], 'attacker')
    const result = resolveDnd5eHeadlessAction(initial, { type: 'attack', actorId: 'attacker', targetId: 'ally',
      attackModifier: 10, d20: 15, spendAction: false,
      damage: { count: 1, sides: 12, bonus: 0, rolls: [incoming], type: 'fire' },
      damageMitigationInterrupts: [{ sourceId: 'protector', targetId: 'ally', featureId, reductionRolls: [1, 1, 1, 1] }] })
    // An immune target cannot consume this reaction; a stale client choice is rejected atomically.
    expect(result.ok).toBe(reflected > 0)
    expect(result.state.combatants.ally.currentHp).toBe(30 - damage)
    expect(result.state.combatants.attacker.currentHp).toBe(30 - reflected)
    expect(result.state.combatants.protector.turn.reactionAvailable).toBe(reflected === 0)
  })

  it.each([
    { level: 13, incoming: 9, prevented: 6, reflected: 0, resistance: false },
    { level: 14, incoming: 9, prevented: 8, reflected: 8, resistance: false },
    { level: 14, incoming: 1, prevented: 1, reflected: 1, resistance: false },
    { level: 14, incoming: 9, prevented: 8, reflected: 4, resistance: true },
  ])('retaliates for actual prevented attack damage at class level $level / damage $incoming / resistance $resistance', ({level,incoming,prevented,reflected,resistance}) => {
    const featureId = `${NATURE_SUBCLASS_ID}.retaliating-reduction`
    const attacker = combatant('attacker','dm',20,{damageResistances:resistance?['force']:[]})
    const protector = combatant('protector','player',10,{level:20,classId:'cleric',subclassId:NATURE_SUBCLASS_ID,
      classLevels:{cleric:level,fighter:20-level},subclassIds:{cleric:NATURE_SUBCLASS_ID},pluginFeatureIds:[featureId],classState:{raging:true}})
    const initial = state([attacker,protector,combatant('ally','player',5)],attacker.id)
    const action = {type:'attack' as const,actorId:attacker.id,targetId:'ally',attackModifier:10,d20:15,spendAction:false,
      damage:{count:1,sides:10,bonus:0,rolls:[incoming],type:'fire' as const},
      damageMitigationInterrupts:[{sourceId:protector.id,targetId:'ally',featureId,reductionRolls:Array(level>=14?4:3).fill(2)}]}
    const result=resolveDnd5eHeadlessAction(initial,action)
    expect(result.ok).toBe(true)
    expect(result.state.combatants.ally.currentHp).toBe(30-incoming+prevented)
    expect(result.state.combatants.attacker.currentHp).toBe(30-reflected)
    expect(result.state.combatants.protector.turn.reactionAvailable).toBe(false)
    if(reflected>0){
      const protectedIndex=result.events.findIndex(e=>e.type==='damage-applied'&&e.targetId==='ally')
      const reflectedIndex=result.events.findIndex(e=>e.type==='damage-applied'&&e.targetId==='attacker')
      expect(protectedIndex).toBeGreaterThanOrEqual(0)
      expect(reflectedIndex).toBeGreaterThan(protectedIndex)
    }
    const retry=resolveDnd5eHeadlessAction(result.state,action)
    expect(retry.ok).toBe(false)
    expect(retry.state.combatants.attacker.currentHp).toBe(30-reflected)
  })

  it('rejects malformed prevented-damage retaliation declarations',()=>{
    for(const retaliation of [null,{minimumClassLevel:0,damageType:'force',magical:true},
      {minimumClassLevel:14,damageType:'bogus',magical:true},{minimumClassLevel:14,damageType:'force'},
      {minimumClassLevel:14,damageType:'force',magical:true,amount:100}]){
      const ability={...nature.abilities[1],mechanic:{...nature.abilities[1].mechanic,preventedAttackRetaliation:retaliation}}
      // Null is the established optional-field convention; every malformed object must fail.
      if(retaliation===null)expect(()=>validateDeclarativeSubclassAbilityV1(ability)).not.toThrow()
      else expect(()=>validateDeclarativeSubclassAbilityV1(ability)).toThrow()
    }
  })

  it.each([
    { level: 6, rolls: [2, 4], hp: 27 },
    { level: 10, rolls: [2, 4, 3], hp: 30 },
    { level: 14, rolls: [2, 4, 3, 6], hp: 30 },
  ])('uses declared class level $level to validate the reduction dice and commits once', ({ level, rolls, hp }) => {
    const attacker = combatant('attacker', 'dm', 20)
    const featureId = `${NATURE_SUBCLASS_ID}.rolled-reduction`
    const protector = combatant('protector', 'player', 10, { level: 20, classId: 'cleric', subclassId: NATURE_SUBCLASS_ID,
      classLevels: { cleric: level, fighter: 20 - level }, subclassIds: { cleric: NATURE_SUBCLASS_ID }, pluginFeatureIds: [featureId],
      classState: { raging: true } })
    const ally = combatant('ally', 'player', 5)
    const original = state([attacker, protector, ally], attacker.id)
    const action = { type: 'attack' as const, actorId: attacker.id, targetId: ally.id, attackModifier: 10, d20: 15, spendAction: false,
      damage: { count: 1, sides: 10, bonus: 0, rolls: [9], type: 'fire' as const },
      damageMitigationInterrupts: [{ sourceId: protector.id, targetId: ally.id, featureId, reductionRolls: rolls }] }
    const result = resolveDnd5eHeadlessAction(original, action)
    expect(result.ok, JSON.stringify(result)).toBe(true)
    expect(result.state.combatants.ally.currentHp).toBe(hp)
    expect(result.state.combatants.protector.turn.reactionAvailable).toBe(false)
    expect(original.combatants.ally.currentHp).toBe(30)
    for (const invalid of [[], [7, ...rolls.slice(1)], [...rolls, 1]]) {
      const rejected = resolveDnd5eHeadlessAction(original, { ...action, damageMitigationInterrupts: [{ ...action.damageMitigationInterrupts[0], reductionRolls: invalid }] })
      expect(rejected.ok).toBe(false)
      expect(rejected.state.combatants.ally.currentHp).toBe(30)
      expect(rejected.state.combatants.protector.turn.reactionAvailable).toBe(true)
    }
    original.combatants.protector.classState.raging = false
    expect(resolveDnd5eHeadlessAction(original, action).ok).toBe(false)
  })

  it.each(['reduction', 'transfer'] as const)('settles %s and its reaction in the same transaction without double damage', mode => {
    const attacker = combatant('attacker', 'dm', 20)
    const featureId = `${NATURE_SUBCLASS_ID}.${mode}`
    const protector = combatant('protector', 'player', 10, { level: 6, classId: 'cleric', subclassId: NATURE_SUBCLASS_ID, classLevels: { cleric: 6 }, subclassIds: { cleric: NATURE_SUBCLASS_ID }, pluginFeatureIds: [featureId] })
    const ally = combatant('ally', 'player', 5)
    const original = state([attacker, protector, ally], attacker.id)
    const action = { type: 'attack' as const, actorId: attacker.id, targetId: ally.id, attackModifier: 10, d20: 15, spendAction: false, damage: { count: 1, sides: 10, bonus: 0, rolls: [9], type: 'fire' as const }, damageMitigationInterrupts: [{ sourceId: protector.id, targetId: ally.id, featureId }] }
    const result = resolveDnd5eHeadlessAction(original, action)
    expect(result.ok, JSON.stringify(result)).toBe(true)
    expect(result.state.combatants.ally.currentHp).toBe(26)
    expect(result.state.combatants.protector.currentHp).toBe(mode === 'transfer' ? 25 : 30)
    expect(result.state.combatants.protector.turn.reactionAvailable).toBe(false)
    expect(original.combatants.ally.currentHp).toBe(30)
    const retry = resolveDnd5eHeadlessAction(result.state, action)
    expect(retry.ok).toBe(false)
    expect(retry.state.combatants.ally.currentHp).toBe(26)
  })

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

  it('does not stack reaction resistance with an existing resistance to the same damage', () => {
    const attacker = combatant('attacker', 'dm', 20)
    const cleric = combatant('cleric', 'player', 10, {
      level: 6, classId: 'cleric', subclassId: NATURE_SUBCLASS_ID,
      classLevels: { cleric: 6 }, subclassIds: { cleric: NATURE_SUBCLASS_ID }, pluginFeatureIds: [DAMPEN_ID],
      damageResistances: ['fire'],
    })
    const result = resolveDnd5eHeadlessAction(state([attacker, cleric], attacker.id), {
      type: 'attack', actorId: attacker.id, targetId: cleric.id, attackModifier: 10,
      d20: 15, spendAction: false, damage: { count: 1, sides: 10, bonus: 0, rolls: [9], type: 'fire' },
      damageMitigationInterrupts: [{ sourceId: cleric.id, targetId: cleric.id, featureId: DAMPEN_ID }],
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) throw Error(result.reason)
    expect(result.state.combatants.cleric.currentHp).toBe(26)
  })


  it.each([
    { mode: 'mixed', base: 'slashing' as const, rider: 'fire' as const, expected: 13 },
    { mode: 'existing', base: 'cold' as const, rider: 'fire' as const, expected: 8 },
    { mode: 'vulnerable', base: 'fire' as const, rider: 'cold' as const, expected: 12 },
    { mode: 'suppressed', base: 'fire' as const, rider: 'cold' as const, expected: 13 },
    { mode: 'immune', base: 'fire' as const, rider: 'cold' as const, expected: 4 },
  ])('resolves raw typed reaction resistance ($mode) and never persists it', ({ mode, base, rider, expected }) => {
    const attacker = combatant('attacker', 'dm', 20)
    const cleric = combatant('cleric', 'player', 10, {
      level: 6, classId: 'cleric', subclassId: NATURE_SUBCLASS_ID,
      classLevels: { cleric: 6 }, subclassIds: { cleric: NATURE_SUBCLASS_ID }, pluginFeatureIds: [DAMPEN_ID],
    })
    if (mode === 'existing') cleric.damageResistances = ['fire']
    if (mode === 'vulnerable') cleric.damageVulnerabilities = ['fire']
    if (mode === 'immune') cleric.damageImmunities = ['fire']
    if (mode === 'suppressed') cleric.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'test:suppression', label: 'Suppression', source: { kind: 'spell' }, targetId: cleric.id,
      duration: { type: 'permanent' }, modifiers: { suppressDamageResistance: 'fire' },
    })]
    attacker.classState.activeEffects = [createDnd5eMechanicalEffect({
      id: 'rider', definitionId: 'test:rider', label: 'Rider', source: { kind: 'spell', actorId: attacker.id },
      targetId: attacker.id, duration: { type: 'permanent' }, modifiers: { onHitBonusDamage: {
        count: 1, sides: 10, bonus: 0, damageType: rider, appliesTo: 'all-weapon-attacks',
        doubleDiceOnCritical: true, oncePerTurn: false, consumeEffectOnHit: false,
      } },
    })]
    const original = state([attacker, cleric], attacker.id)
    original.distanceFeetByCombatantPair![dnd5eCombatantPairKey(attacker.id, cleric.id)] = 5
    const action = { type: 'attack' as const, actorId: attacker.id, targetId: cleric.id, attackModifier: 10,
      d20: 15, spendAction: false, damage: { count: 1, sides: 10, bonus: 0, rolls: [9], type: base },
      classDamageContext: { mode: 'melee' as const, weaponId: 'sword', finesse: false, strengthBased: true,
        weaponDamageSides: 10, damageType: base, adjacentEnemyOfTarget: false },
      classDamageRolls: [{ source: 'activity-effect-rider' as const, rollId: 'activity-on-hit:rider', rolls: [9] }],
      damageMitigationInterrupts: [{ sourceId: cleric.id, targetId: cleric.id, featureId: DAMPEN_ID }],
    }
    const result = resolveDnd5eHeadlessAction(original, action)
    expect(result.ok, result.ok ? '' : result.reason).toBe(true)
    expect(result.state.combatants.cleric.currentHp).toBe(30 - expected)
    expect(result.events.filter(e => e.type === 'turn-resource-spent' && e.resource === 'reaction')).toHaveLength(1)
    expect(result.state.combatants.cleric.damageResistances).toEqual(cleric.damageResistances)
    expect(original.combatants.cleric.currentHp).toBe(30)
    const replay = resolveDnd5eHeadlessAction(result.state, action)
    expect(replay.ok).toBe(false)
    expect(replay.state.combatants.cleric.currentHp).toBe(30 - expected)
    const next = resolveDnd5eHeadlessAction(result.state, { ...action, damageMitigationInterrupts: undefined })
    expect(next.ok, next.ok ? '' : next.reason).toBe(true)
    const unprotected = mode === 'existing' ? 13 : mode === 'vulnerable' ? 27 : mode === 'immune' ? 9 : 18
    expect(next.state.combatants.cleric.currentHp).toBe(Math.max(0, 30 - expected - unprotected))
  })

  it('spends a declared resistance reaction even when one raw damage rounds to zero', () => {
    const attacker = combatant('attacker', 'dm', 20)
    const cleric = combatant('cleric', 'player', 10, { level: 6, classId: 'cleric', subclassId: NATURE_SUBCLASS_ID,
      classLevels: { cleric: 6 }, subclassIds: { cleric: NATURE_SUBCLASS_ID }, pluginFeatureIds: [DAMPEN_ID] })
    const result = resolveDnd5eHeadlessAction(state([attacker, cleric], attacker.id), {
      type: 'attack', actorId: attacker.id, targetId: cleric.id, attackModifier: 10, d20: 15,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [1], type: 'fire' },
      damageMitigationInterrupts: [{ sourceId: cleric.id, targetId: cleric.id, featureId: DAMPEN_ID }],
    })
    expect(result.ok, result.ok ? '' : result.reason).toBe(true)
    expect(result.state.combatants.cleric.currentHp).toBe(30)
    expect(result.state.combatants.cleric.turn.reactionAvailable).toBe(false)
  })


  it.each([
    { spellId: 'scorching-ray', attackOnly: false }, { spellId: 'burning-hands', attackOnly: false },
    { spellId: 'scorching-ray', attackOnly: true }, { spellId: 'burning-hands', attackOnly: true },
  ] as const)('applies raw resistance in $spellId, attack-only=$attackOnly', ({ spellId, attackOnly }) => {
    const featureId = attackOnly ? NATURE_SUBCLASS_ID + '.attack-only' : DAMPEN_ID
    const wizard = combatant('wizard', 'dm', 20, { level: 6, classId: 'wizard', classLevels: { wizard: 6 },
      classSelections: { 'spell-prepared': [spellId] }, classResources: {
        'dnd5e-spell-slot-1': { current: 2, max: 2 }, 'dnd5e-spell-slot-2': { current: 2, max: 2 },
      }, abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 } })
    const cleric = combatant('cleric', 'player', 10, { level: 6, classId: 'cleric', subclassId: NATURE_SUBCLASS_ID,
      classLevels: { cleric: 6 }, subclassIds: { cleric: NATURE_SUBCLASS_ID }, pluginFeatureIds: [featureId] })
    const original = state([wizard, cleric], wizard.id)
    const result = resolveDnd5eHeadlessAction(original, {
      type: 'cast-spell', actorId: wizard.id, targetId: cleric.id, spellId,
      slotLevel: spellId === 'scorching-ray' ? 2 : 1,
      effectRolls: spellId === 'scorching-ray' ? [] : [3, 3, 3],
      ...(spellId === 'scorching-ray'
        ? { projectileTargetIds: [cleric.id, cleric.id, cleric.id], targetAttacks: [0, 1, 2].map(() => ({ targetId: cleric.id, d20: 15, effectRolls: [4, 5] })) }
        : { savingThrowD20: 1 }),
      damageMitigationInterrupts: [{ sourceId: cleric.id, targetId: cleric.id, featureId }],
    })
    if (attackOnly && spellId === 'burning-hands') {
      expect(result.ok).toBe(false)
      expect(result.state.combatants.cleric.currentHp).toBe(30)
      expect(result.state.combatants.cleric.turn.reactionAvailable).toBe(true)
      return
    }
    expect(result.ok, result.ok ? '' : result.reason).toBe(true)
    expect(result.state.combatants.cleric.currentHp).toBe(spellId === 'scorching-ray' ? 8 : 26)
    expect(result.events.filter(e => e.type === 'turn-resource-spent' && e.resource === 'reaction')).toHaveLength(1)
    expect(original.combatants.cleric.turn.reactionAvailable).toBe(true)
  })


  it('rolls back a resistance declaration when source protection cancels the damage commit', () => {
    const attacker = combatant('attacker', 'dm', 20)
    const cleric = combatant('cleric', 'player', 10, { level: 6, classId: 'cleric', subclassId: NATURE_SUBCLASS_ID,
      classLevels: { cleric: 6 }, subclassIds: { cleric: NATURE_SUBCLASS_ID }, pluginFeatureIds: [DAMPEN_ID],
      protectedFromActorIds: [attacker.id] })
    const original = state([attacker, cleric], attacker.id)
    const result = resolveDnd5eHeadlessAction(original, {
      type: 'attack', actorId: attacker.id, targetId: cleric.id, attackModifier: 10, d20: 15,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [5], type: 'fire' },
      damageMitigationInterrupts: [{ sourceId: cleric.id, targetId: cleric.id, featureId: DAMPEN_ID }],
    })
    expect(result.ok).toBe(false)
    expect(result.state.combatants.cleric.currentHp).toBe(30)
    expect(result.state.combatants.cleric.turn.reactionAvailable).toBe(true)
  })


  it.each(['reduction', 'transfer', 'projected-ward'] as const)('accounts for independent uses and merged resource costs in %s', mode => {
    const subclass = mode === 'projected-ward' ? ABJURATION_SUBCLASS_ID : NATURE_SUBCLASS_ID
    const localSubclass = mode === 'projected-ward' ? 'abjuration-school' : 'nature-domain'
    const classId = mode === 'projected-ward' ? 'wizard' : 'cleric'
    const featureId = subclass + '.limited-' + mode
    const usesId = PLUGIN_ID + ':decl-' + localSubclass + '-limited-' + mode + '-uses'
    const attacker = combatant('attacker', 'dm', 20)
    const protector = combatant('protector', 'player', 10, { level: 6, classId, subclassId: subclass,
      classLevels: { [classId]: 6 }, subclassIds: { [classId]: subclass }, pluginFeatureIds: [featureId, WARD_ID],
      classResources: { 'dnd5e-ki': { current: 3, max: 3 }, [usesId]: { current: 3, max: 3 } },
      classState: { declarativeWardPools: { [WARD_ID]: { current: 5, max: 5 } } },
    })
    const ally = combatant('ally', 'player', 5)
    const original = state([attacker, protector, ally], attacker.id)
    const action = { type: 'attack' as const, actorId: attacker.id, targetId: ally.id, attackModifier: 10, d20: 15,
      spendAction: false, damage: { count: 1, sides: 10, rolls: [9], bonus: 0, type: 'fire' as const },
      damageMitigationInterrupts: [{ sourceId: protector.id, targetId: ally.id, featureId }] }
    const result = resolveDnd5eHeadlessAction(original, action)
    expect(result.ok, result.ok ? '' : result.reason).toBe(true)
    expect(result.state.combatants.ally.currentHp).toBe(26)
    expect(result.state.combatants.protector.classResources[usesId].current).toBe(1)
    expect(result.state.combatants.protector.classResources['dnd5e-ki'].current).toBe(1)
    expect(result.state.combatants.protector.turn.reactionAvailable).toBe(false)
    expect(result.state.combatants.protector.currentHp).toBe(mode === 'transfer' ? 25 : 30)
    for (const insufficient of ['uses', 'shared'] as const) {
      const current = structuredClone(original)
      current.combatants.protector.classResources[insufficient === 'uses' ? usesId : 'dnd5e-ki'].current = 1
      const rejected = resolveDnd5eHeadlessAction(current, action)
      expect(rejected.ok).toBe(false)
      expect(rejected.state.combatants.protector.classResources).toEqual(current.combatants.protector.classResources)
      expect(rejected.state.combatants.protector.turn.reactionAvailable).toBe(true)
      expect(rejected.state.combatants.ally.currentHp).toBe(30)
    }
  })


  it.each(['poison-rider', 'split-fire', 'curse-rider'] as const)('keeps %s in its owning attack damage packet', mode => {
    const featureId = NATURE_SUBCLASS_ID + '.attack-only'
    const defender = combatant('defender', 'player', 10, { level: 6, classId: 'cleric', subclassId: NATURE_SUBCLASS_ID,
      classLevels: { cleric: 6 }, subclassIds: { cleric: NATURE_SUBCLASS_ID }, pluginFeatureIds: [featureId] })
    let disposeMonster: (() => void) | undefined
    const monster = structuredClone(getDnd5eSrdMonster(mode === 'poison-rider' ? 'srd-5.1:giant-spider' : 'srd-5.1:goblin')!)
    if (mode === 'split-fire') {
      monster.id = 'test:split-fire'
      const base = monster.actions.find(action => action.attack)!
      monster.actions = [{ ...base, id: 'split', attack: { ...base.attack!, damage: [
        { count: 1, sides: 6, bonus: 0, average: 3, type: 'fire' }, { count: 1, sides: 6, bonus: 0, average: 3, type: 'fire' },
      ] } }]
      disposeMonster = registerDnd5ePluginMonsterCatalogEntry(monster)
    }
    try {
      const attacker = mode === 'curse-rider' ? combatant('attacker', 'dm', 20, { level: 1, classId: 'wizard', classLevels: { wizard: 1 },
        abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 }, classSelections: { 'spell-cantrips': ['fire-bolt'] } })
        : combatant('attacker', 'dm', 20, { statBlockId: monster.id, abilities: monster.abilities })
      if (mode === 'curse-rider') defender.classState.activeEffects = [createDnd5eMechanicalEffect({
        id: 'curse', definitionId: 'activity:spell:bestow-curse:damage', label: 'Synthetic curse', tags: ['curse', 'bestow-curse.source-bonus-damage'],
        source: { kind: 'spell', actorId: attacker.id, rulesId: 'bestow-curse', magical: true }, targetId: defender.id,
        duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      })]
      const original = state([attacker, defender], attacker.id)
      original.distanceFeetByCombatantPair![dnd5eCombatantPairKey(attacker.id, defender.id)] = 5
      const uses = [{ sourceId: defender.id, targetId: defender.id, featureId }]
      const action = mode === 'curse-rider' ? {
        type: 'cast-spell' as const, actorId: attacker.id, targetId: defender.id, spellId: 'fire-bolt', slotLevel: 0,
        d20: 18, effectRolls: [9], bestowCurseDamageRolls: [{ targetId: defender.id, rolls: [7] }], damageMitigationInterrupts: uses,
      } : {
        type: 'monster-action' as const, actorId: attacker.id, actionId: mode === 'split-fire' ? 'split' : 'bite',
        rolls: [{ targetId: defender.id, d20: 18, damageRolls: mode === 'split-fire' ? [[3], [3]] : [[6]],
          ...(mode === 'poison-rider' ? { onHitEffectRolls: [{ effectId: 'poison-save-damage', d20: 1, damageRolls: [[4, 5]] }] } : {}),
        }], damageMitigationInterrupts: uses,
      }
      const result = resolveDnd5eHeadlessAction(original, action)
      expect(result.ok, result.ok ? '' : result.reason).toBe(true)
      const expected = mode === 'split-fire' ? 3 : mode === 'curse-rider' ? 7 : 8
      expect(result.state.combatants.defender.currentHp).toBe(30 - expected)
      expect(result.events.filter(event => event.type === 'turn-resource-spent' && event.resource === 'reaction')).toHaveLength(1)
      expect(original.combatants.defender.currentHp).toBe(30)
      expect(result.state.combatants.defender.damageResistances).toEqual([])
      const nextState = structuredClone(result.state)
      nextState.combatants.attacker.turn.actionAvailable = true
      const next = resolveDnd5eHeadlessAction(nextState, { ...action, damageMitigationInterrupts: undefined })
      expect(next.ok, next.ok ? '' : next.reason).toBe(true)
      const fullDamage = mode === 'split-fire' ? 6 : mode === 'curse-rider' ? 16 : 18
      expect(next.state.combatants.defender.currentHp).toBe(30 - expected - fullDamage)
      expect(next.events.some(event => event.type === 'damage-mitigation-interrupt-applied')).toBe(false)
    } finally { disposeMonster?.() }
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
