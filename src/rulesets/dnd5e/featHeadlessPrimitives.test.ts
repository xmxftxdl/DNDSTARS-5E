import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  dnd5eTargetArmorClassForAttack,
  dnd5eSourceLinkedRelations,
  reconcileDnd5eSourceLinkedRelations,
  dnd5eCombatantPairKey,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
  type Dnd5eCombatEvent,
} from './headlessCombatEngine'
import {
  dnd5eDeclarativeAttackIntentDefinition,
  dnd5eDeclarativeAttackIntentRollPlan,
  registerDnd5eRulesPlugin,
} from './pluginApi'
import { dnd5eCombatantIsSurprised } from './surprise'
import { createDnd5eMechanicalEffect } from './activeEffects'

const PLUGIN_ID = 'test.feat-headless-primitives'
const POWER_FEATURE_ID = `${PLUGIN_ID}:feat-power-attack`
const CONCENTRATION_FEATURE_ID = `${PLUGIN_ID}:feat-concentration-guard`
const abilities = { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 } as const

function combatant(id: string, controller: 'player' | 'dm', patch: Partial<Dnd5eCombatant> = {}) {
  return createDnd5eCombatant({
    id,
    name: id,
    controller,
    initiative: controller === 'player' ? 20 : 10,
    abilities,
    proficiencyBonus: 3,
    armorClass: 10,
    currentHp: 30,
    maxHp: 30,
    temporaryHp: 0,
    speed: 30,
    position: { x: controller === 'player' ? 0 : 5, y: 0 },
    concentrating: false,
    ...patch,
  })
}

let dispose: (() => void) | undefined

describe('generic feat Headless primitives', () => {
  beforeAll(() => {
    dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: PLUGIN_ID,
        name: 'Feat primitive tests',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Tests',
        license: 'CC0-1.0',
      },
      setup(api) {
        api.registerFeat({
          id: 'power-attack',
          name: 'Power Attack',
          summary: 'Synthetic partial feat.',
          description: 'Synthetic partial feat used to verify the generic attack transaction.',
          automation: 'partial',
          automationReasons: ['Only the attack option is automated.'],
          declarativeAbility: {
            schemaVersion: 1,
            id: 'power-attack-option',
            name: 'Power Attack Option',
            description: 'Take -5 to the attack roll and add 10 damage on a hit.',
            level: 1,
            trigger: { kind: 'before-attack-roll' },
            cost: { economy: 'none' },
            targeting: { kind: 'self' },
            effects: [],
            mechanic: {
              kind: 'attack-tradeoff',
              attackRollModifier: -5,
              damageBonus: 10,
              attackModes: ['melee'],
              requiredWeaponProperties: ['heavy'],
            },
            automation: 'full',
          },
        })
        api.registerFeat({
          id: 'concentration-guard',
          name: 'Concentration Guard',
          summary: 'Synthetic concentration feat.',
          description: 'Synthetic partial feat used to verify concentration advantage.',
          automation: 'partial',
          automationReasons: ['Only concentration advantage is automated.'],
          declarativeAbility: {
            schemaVersion: 1,
            id: 'concentration-guard-passive',
            name: 'Concentration Guard',
            description: 'Gain advantage on concentration checks.',
            level: 1,
            trigger: { kind: 'active-use' },
            cost: { economy: 'none' },
            targeting: { kind: 'self' },
            effects: [],
            mechanic: { kind: 'passive-defense', concentrationCheckAdvantage: true },
            automation: 'full',
          },
        })
      },
    })
  })

  afterAll(() => dispose?.())

  it('exposes a partial feat full component as a Host-owned pre-roll intent', () => {
    expect(dnd5eDeclarativeAttackIntentDefinition(POWER_FEATURE_ID)).toMatchObject({
      feature: { automation: 'partial' },
      hook: { timing: 'before-attack-roll', activation: 'prearm', exclusiveGroup: 'attack-roll-tradeoff' },
    })
    expect(dnd5eDeclarativeAttackIntentRollPlan(combatant('actor', 'player'), POWER_FEATURE_ID, false))
      .toMatchObject({ ok: true, declarations: [] })
  })

  it('applies the declared attack penalty and hit-only damage bonus', () => {
    const actor = combatant('actor', 'player', {
      pluginFeatureIds: [POWER_FEATURE_ID],
      mainWeaponId: 'greatsword',
    })
    const target = combatant('target', 'dm')
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('feat-power-attack', [actor, target]), {
      type: 'attack',
      actorId: actor.id,
      targetId: target.id,
      attackModifier: 5,
      d20: 10,
      spendAction: false,
      declarativeIntentFeatureIds: [POWER_FEATURE_ID],
      classDamageContext: {
        weaponId: 'greatsword',
        weaponProperties: ['heavy', 'two-handed'],
        proficient: true,
        mode: 'melee',
        reachFeet: 5,
        finesse: false,
        strengthBased: true,
        weaponDamageSides: 6,
        damageType: 'slashing',
        adjacentEnemyOfTarget: false,
      },
      damage: { count: 1, sides: 6, bonus: 0, rolls: [4], type: 'slashing' },
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', total: 10, hit: true,
    }))
    expect(result.state.combatants.target.currentHp).toBe(16)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'declarative-subclass-ability-resolved',
      abilityId: POWER_FEATURE_ID,
      trigger: 'before-attack-roll',
    }))
  })

  it('settles one complete melee weapon damage reroll pool per authoritative turn', () => {
    const actor = combatant('actor', 'player', {
      meleeWeaponDamageRerollOncePerTurn: true,
      mainWeaponId: 'longsword',
    })
    const target = combatant('target', 'dm')
    const action = {
      type: 'attack' as const,
      actorId: actor.id,
      targetId: target.id,
      attackModifier: 5,
      d20: 15,
      spendAction: false,
      wholeWeaponDamageReroll: {
        originalRolls: [2],
        rerolledRolls: [6],
        selection: 'rerolled' as const,
      },
      classDamageContext: {
        weaponId: 'longsword', weaponProperties: ['versatile'], proficient: true,
        mode: 'melee' as const, reachFeet: 5, finesse: false, strengthBased: true,
        weaponDamageSides: 8, damageType: 'slashing' as const, adjacentEnemyOfTarget: false,
      },
      damage: { count: 1, sides: 8, bonus: 0, rolls: [6], type: 'slashing' as const },
    }
    const first = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('whole-weapon-reroll', [actor, target]),
      action,
    )
    expect(first.ok, first.ok ? undefined : first.reason).toBe(true)
    if (!first.ok) return
    expect(first.state.combatants.target.currentHp).toBe(24)
    expect(first.state.combatants.actor.classState.meleeWeaponDamageRerollTurnKey).toBeTruthy()
    expect(first.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', stateKey: 'whole-weapon-damage-reroll', actorId: actor.id,
    }))

    expect(resolveDnd5eHeadlessAction(first.state, action)).toMatchObject({
      ok: false,
      reason: 'invalid-class-feature',
    })
  })

  it('rejects forged selected dice for a whole weapon damage reroll', () => {
    const actor = combatant('actor', 'player', {
      meleeWeaponDamageRerollOncePerTurn: true,
      mainWeaponId: 'longsword',
    })
    const target = combatant('target', 'dm')
    expect(resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('whole-weapon-reroll-forged', [actor, target]),
      {
        type: 'attack', actorId: actor.id, targetId: target.id,
        attackModifier: 5, d20: 15, spendAction: false,
        wholeWeaponDamageReroll: {
          originalRolls: [2], rerolledRolls: [6], selection: 'rerolled',
        },
        classDamageContext: {
          weaponId: 'longsword', weaponProperties: ['versatile'], proficient: true,
          mode: 'melee', reachFeet: 5, finesse: false, strengthBased: true,
          weaponDamageSides: 8, damageType: 'slashing', adjacentEnemyOfTarget: false,
        },
        damage: { count: 1, sides: 8, bonus: 0, rolls: [8], type: 'slashing' },
      },
    )).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('adds a wielded shield to a sole-target Dexterity save and validates reaction-based half-damage negation', () => {
    const cleric = combatant('cleric', 'player', {
      classId: 'cleric', level: 5,
      abilities: { ...abilities, wis: 16 },
      classSelections: { 'spell-cantrips': ['sacred-flame'] },
    })
    const shieldBearer = combatant('shield-bearer', 'dm', {
      hasShield: true,
      shieldDexteritySaveBonusWhenSoleTarget: true,
      shieldSuccessfulDexteritySaveNegatesDamage: true,
    })
    const sacredFlame = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('shield-save-bonus', [cleric, shieldBearer]),
      {
        type: 'cast-spell', actorId: cleric.id, targetId: shieldBearer.id,
        targetIds: [shieldBearer.id], castingClassId: 'cleric', spellId: 'sacred-flame', slotLevel: 0,
        savingThrowD20: 10, effectRolls: [],
      },
    )
    expect(sacredFlame.ok, sacredFlame.ok ? undefined : sacredFlame.reason).toBe(true)
    if (!sacredFlame.ok) return
    expect(sacredFlame.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: shieldBearer.id, modifier: 4, total: 14, success: true,
    }))

    const wizard = combatant('wizard', 'player', {
      classId: 'wizard', level: 5,
      abilities: { ...abilities, int: 16 },
      classSelections: { 'spellbook': ['fireball'], 'spell-prepared': ['fireball'] },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const fireballTarget = combatant('fireball-target', 'dm', {
      hasShield: true,
      shieldSuccessfulDexteritySaveNegatesDamage: true,
    })
    const fireball = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('shield-save-negation', [wizard, fireballTarget]),
      {
        type: 'cast-spell', actorId: wizard.id, targetId: fireballTarget.id,
        targetIds: [fireballTarget.id], castingClassId: 'wizard', spellId: 'fireball', slotLevel: 3,
        savingThrowD20: 15,
        shieldSuccessfulSaveNegationTargetIds: [fireballTarget.id],
        effectRolls: [6, 6, 6, 6, 6, 6, 6, 6],
      },
    )
    expect(fireball.ok, fireball.ok ? undefined : fireball.reason).toBe(true)
    if (!fireball.ok) return
    expect(fireball.state.combatants[fireballTarget.id].currentHp).toBe(30)
    expect(fireball.state.combatants[fireballTarget.id].turn.reactionAvailable).toBe(false)
    expect(fireball.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent', actorId: fireballTarget.id, resource: 'reaction',
    }))
  })

  it('settles a Host-authorized War Caster opportunity spell as a reaction', () => {
    const wizard = combatant('war-caster', 'player', {
      classId: 'wizard', level: 5,
      abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-cantrips': ['fire-bolt'] },
      opportunityAttackSpellReplacement: true,
    })
    const target = combatant('provocateur', 'dm')
    const action = {
      type: 'cast-spell' as const,
      actorId: wizard.id,
      targetId: target.id,
      targetIds: [target.id],
      castingClassId: 'wizard' as const,
      spellId: 'fire-bolt',
      slotLevel: 0,
      opportunityAttackSpell: true,
      d20: 15,
      effectRolls: [6, 5],
    }
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('war-caster-opportunity-spell', [wizard, target]),
      action,
    )
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[wizard.id].turn.reactionAvailable).toBe(false)
    expect(result.state.combatants[wizard.id].turn.actionAvailable).toBe(true)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent', actorId: wizard.id, resource: 'reaction',
    }))
    expect(result.state.combatants[target.id].currentHp).toBe(19)

    expect(resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('forged-war-caster-opportunity-spell', [
        { ...wizard, opportunityAttackSpellReplacement: false },
        target,
      ]),
      action,
    )).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('revalidates Mounted Combatant attack redirection against the live riding relation', () => {
    const attacker = combatant('mounted-attacker', 'dm', { initiative: 30 })
    const rider = combatant('rider', 'player', {
      redirectMountedCreatureAttacksToRider: true,
      currentHp: 30,
      maxHp: 30,
    })
    const mount = combatant('mount', 'player', { currentHp: 40, maxHp: 40 })
    mount.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'test:riding',
      label: 'Riding',
      source: { kind: 'feature', actorId: rider.id, rulesId: 'basic-action:mount' },
      targetId: mount.id,
      legacyCondition: 'attached',
      relation: {
        schemaVersion: 1,
        kind: 'attachment',
        sourceActorId: rider.id,
        sourceActionId: 'basic-action:mount',
        slotGroup: 'riding',
        maxDistanceFeet: 5,
        movement: 'source-rides-target',
        endsOnSourceIncapacitated: true,
      },
    })]
    const action = {
      type: 'attack' as const,
      actorId: attacker.id,
      targetId: rider.id,
      attackModifier: 5,
      d20: 15,
      spendAction: false,
      mountedAttackRedirect: { riderId: rider.id, originalMountId: mount.id },
      damage: { count: 1, sides: 6, bonus: 0, rolls: [4], type: 'slashing' as const },
    }
    const mountedState = startDnd5eHeadlessCombat('mounted-redirect', [attacker, rider, mount])
    mountedState.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(rider.id, mount.id)]: 0,
    }
    expect(dnd5eSourceLinkedRelations(mountedState, rider.id)).toHaveLength(1)
    const reconcileEvents: Dnd5eCombatEvent[] = []
    reconcileDnd5eSourceLinkedRelations(mountedState, reconcileEvents)
    expect(reconcileEvents).toEqual([])
    expect(dnd5eSourceLinkedRelations(mountedState, rider.id)).toHaveLength(1)
    expect(mountedState.combatants[rider.id].redirectMountedCreatureAttacksToRider).toBe(true)
    const result = resolveDnd5eHeadlessAction(
      mountedState,
      action,
    )
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[rider.id].currentHp).toBe(26)
    expect(result.state.combatants[mount.id].currentHp).toBe(40)
    expect(result.events).toContainEqual({
      type: 'mounted-attack-redirected', actorId: attacker.id, riderId: rider.id, mountId: mount.id,
    })

    const caster = combatant('mounted-spell-attacker', 'dm', {
      initiative: 30,
      classId: 'wizard',
      level: 5,
      abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-cantrips': ['fire-bolt'] },
    })
    const spellState = startDnd5eHeadlessCombat('mounted-spell-redirect', [caster, rider, mount])
    spellState.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(rider.id, mount.id)]: 0,
    }
    const spellResult = resolveDnd5eHeadlessAction(spellState, {
      type: 'cast-spell',
      actorId: caster.id,
      castingClassId: 'wizard',
      spellId: 'fire-bolt',
      slotLevel: 0,
      targetId: rider.id,
      targetIds: [rider.id],
      mountedAttackRedirect: { riderId: rider.id, originalMountId: mount.id },
      d20: 15,
      effectRolls: [5, 5],
    })
    expect(spellResult.ok, spellResult.ok ? undefined : spellResult.reason).toBe(true)
    if (spellResult.ok) {
      expect(spellResult.state.combatants[rider.id].currentHp).toBe(20)
      expect(spellResult.state.combatants[mount.id].currentHp).toBe(40)
    }

    const forgedMount = combatant('forged-mount', 'player')
    expect(resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('forged-mounted-redirect', [attacker, rider, forgedMount]),
      { ...action, mountedAttackRedirect: { riderId: rider.id, originalMountId: forgedMount.id } },
    )).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('derives Mounted Combatant Evasion for its live mount on Dexterity save damage', () => {
    const caster = combatant('mounted-evasion-caster', 'dm', {
      initiative: 30,
      classId: 'wizard',
      level: 5,
      abilities: { ...abilities, int: 16 },
      classSelections: { spellbook: ['fireball'], 'spell-prepared': ['fireball'] },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const rider = combatant('evasion-rider', 'player', {
      grantMountedCreatureDexterityEvasion: true,
    })
    const mount = combatant('evasion-mount', 'player', { currentHp: 50, maxHp: 50 })
    mount.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'test:riding-evasion',
      label: 'Riding',
      source: { kind: 'feature', actorId: rider.id, rulesId: 'basic-action:mount' },
      targetId: mount.id,
      legacyCondition: 'attached',
      relation: {
        schemaVersion: 1,
        kind: 'attachment',
        sourceActorId: rider.id,
        sourceActionId: 'basic-action:mount',
        slotGroup: 'riding',
        maxDistanceFeet: 5,
        movement: 'source-rides-target',
        endsOnSourceIncapacitated: true,
      },
    })]
    const fireball = (d20: number) => {
      const state = startDnd5eHeadlessCombat(`mounted-evasion-${d20}`, [caster, rider, mount])
      state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(rider.id, mount.id)]: 0,
      }
      return resolveDnd5eHeadlessAction(state, {
        type: 'cast-spell' as const,
        actorId: caster.id,
        targetId: mount.id,
        targetIds: [mount.id],
        castingClassId: 'wizard' as const,
        spellId: 'fireball',
        slotLevel: 3,
        savingThrowD20: d20,
        effectRolls: [4, 4, 4, 4, 4, 4, 4, 4],
      })
    }
    const failed = fireball(1)
    expect(failed.ok, failed.ok ? undefined : failed.reason).toBe(true)
    if (failed.ok) expect(failed.state.combatants[mount.id].currentHp).toBe(34)
    const succeeded = fireball(20)
    expect(succeeded.ok, succeeded.ok ? undefined : succeeded.reason).toBe(true)
    if (succeeded.ok) expect(succeeded.state.combatants[mount.id].currentHp).toBe(50)
  })

  it('rejects an attack tradeoff when the Host weapon profile is ineligible', () => {
    const actor = combatant('actor', 'player', { pluginFeatureIds: [POWER_FEATURE_ID] })
    const target = combatant('target', 'dm')
    expect(resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('feat-power-invalid', [actor, target]), {
      type: 'attack', actorId: actor.id, targetId: target.id, attackModifier: 5, d20: 15, spendAction: false,
      declarativeIntentFeatureIds: [POWER_FEATURE_ID],
      classDamageContext: {
        weaponId: 'longsword', weaponProperties: ['versatile'], mode: 'melee', reachFeet: 5,
        finesse: false, strengthBased: true, weaponDamageSides: 8, damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
      damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'slashing' },
    })).toMatchObject({ ok: false, reason: 'invalid-plugin-action' })
  })

  it('rejects an attack tradeoff when the Host weapon profile is not proficient', () => {
    const actor = combatant('actor', 'player', { pluginFeatureIds: [POWER_FEATURE_ID] })
    const target = combatant('target', 'dm')
    expect(resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('feat-power-unproficient', [actor, target]), {
      type: 'attack', actorId: actor.id, targetId: target.id, attackModifier: 5, d20: 15, spendAction: false,
      declarativeIntentFeatureIds: [POWER_FEATURE_ID],
      classDamageContext: {
        weaponId: 'greatsword', weaponProperties: ['heavy', 'two-handed'], proficient: false,
        mode: 'melee', reachFeet: 5, finesse: false, strengthBased: true,
        weaponDamageSides: 6, damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
      damage: { count: 1, sides: 6, bonus: 0, rolls: [4], type: 'slashing' },
    })).toMatchObject({ ok: false, reason: 'invalid-plugin-action' })
  })

  it('uses the higher Host d20 for a concentration check with advantage', () => {
    const actor = combatant('actor', 'player', {
      concentrating: true,
      pluginFeatureIds: [CONCENTRATION_FEATURE_ID],
    })
    const state = startDnd5eHeadlessCombat('feat-concentration', [actor, combatant('target', 'dm')])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'concentration-save', actorId: actor.id, d20: 3, d20Second: 15, dc: 10,
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'concentration-resolved', d20: 15, success: true,
    }))
  })

  it('projects Alert-style surprise and unseen-attacker defenses', () => {
    const defender = combatant('defender', 'player', {
      cannotBeSurprisedWhileConscious: true,
      unseenAttackersDoNotGainAdvantage: true,
      classState: { surprisedCombatId: 'alert-combat' },
    })
    expect(dnd5eCombatantIsSurprised(defender, 'alert-combat')).toBe(false)

    const attacker = combatant('attacker', 'dm', { initiative: 30 })
    const state = startDnd5eHeadlessCombat('alert-unseen', [attacker, defender])
    state.lineOfSightBlockedByCombatantPair = { [`${defender.id}\u0000${attacker.id}`]: true }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: attacker.id, targetId: defender.id,
      attackModifier: 0, d20: 10, d20Second: 20, spendAction: false,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [3], type: 'slashing' },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', d20: 10,
    }))
  })

  it('applies ranged profile exceptions without bypassing total cover', () => {
    const actor = combatant('actor', 'player', {
      ignoreLongRangeRangedWeaponDisadvantage: true,
      ignoreNearbyHostileRangedAttackDisadvantage: true,
      ignoreRangedWeaponCoverBonus: true,
    })
    const target = combatant('target', 'dm')
    const state = startDnd5eHeadlessCombat('ranged-profile', [actor, target])
    state.distanceFeetByCombatantPair = { [`${actor.id}\u0000${target.id}`]: 100 }
    state.coverBonusByCombatantPair = { [`${actor.id}\u0000${target.id}`]: 5 }
    const action = {
      type: 'attack' as const,
      actorId: actor.id,
      targetId: target.id,
      attackModifier: 0,
      d20: 10,
      d20Second: 1,
      spendAction: false,
      classDamageContext: {
        weaponId: 'longbow', weaponProperties: ['heavy', 'two-handed', 'ammunition'],
        mode: 'ranged' as const, normalRangeFeet: 80, longRangeFeet: 320, distanceFeet: 100,
        finesse: false, strengthBased: false, weaponDamageSides: 8,
        damageType: 'piercing' as const, adjacentEnemyOfTarget: false,
      },
      damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'piercing' as const },
    }
    const result = resolveDnd5eHeadlessAction(state, action)
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', d20: 10, total: 10, armorClass: 10, hit: true,
    }))

    const blocked = startDnd5eHeadlessCombat('ranged-total-cover', [actor, target])
    blocked.lineOfEffectBlockedByCombatantPair = { [`${actor.id}\u0000${target.id}`]: true }
    expect(resolveDnd5eHeadlessAction(blocked, { ...action, d20: 20, d20Second: 20 }))
      .toMatchObject({ ok: true, events: expect.arrayContaining([
        expect.objectContaining({ type: 'attack-resolved', hit: false }),
      ]) })
  })

  it('ignores ordinary cover for spell attacks but keeps total cover authoritative', () => {
    const actor = combatant('actor', 'player', { ignoreSpellAttackCoverBonus: true })
    const target = combatant('target', 'dm')
    const state = startDnd5eHeadlessCombat('spell-cover-profile', [actor, target])
    const key = `${actor.id}\u0000${target.id}`
    state.coverBonusByCombatantPair = { [key]: 5 }
    expect(dnd5eTargetArmorClassForAttack(state, actor.id, target.id, 'spell')).toBe(target.armorClass)
    state.lineOfEffectBlockedByCombatantPair = { [key]: true }
    expect(dnd5eTargetArmorClassForAttack(state, actor.id, target.id, 'spell')).toBeGreaterThan(100_000)
  })

  it('records each melee attack target for current-turn opportunity-attack suppression', () => {
    const actor = combatant('actor', 'player', {
      preventOpportunityAttacksFromMeleeAttackTargets: true,
    })
    const target = combatant('target', 'dm')
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('mobile-targets', [actor, target]), {
      type: 'attack', actorId: actor.id, targetId: target.id,
      attackModifier: 5, d20: 2, spendAction: false,
      classDamageContext: {
        weaponId: 'shortsword', weaponProperties: ['finesse', 'light'], mode: 'melee', reachFeet: 5,
        finesse: true, strengthBased: false, weaponDamageSides: 6, damageType: 'piercing',
        adjacentEnemyOfTarget: false,
      },
      damage: { count: 1, sides: 6, bonus: 0, rolls: [], type: 'piercing' },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[actor.id].classState.meleeAttackTargetIdsThisTurn).toEqual([target.id])
  })

  it('uses Host-owned approach history for running long jumps', () => {
    const athlete = combatant('athlete', 'player', { runningJumpMinimumApproachFeet: 5 })
    const target = combatant('target', 'dm', { position: { x: 50, y: 0 } })
    const initial = startDnd5eHeadlessCombat('athlete-running-jump', [athlete, target])

    expect(resolveDnd5eHeadlessAction(initial, {
      type: 'move', actorId: athlete.id, to: { x: 8, y: 0 }, distance: 8,
      traversalMode: 'long-jump-running',
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })

    const approached = resolveDnd5eHeadlessAction(initial, {
      type: 'move', actorId: athlete.id, to: { x: 5, y: 0 }, distance: 5,
    })
    expect(approached.ok, approached.ok ? undefined : approached.reason).toBe(true)
    if (!approached.ok) return
    expect(approached.state.combatants[athlete.id].classState.runningJumpApproachFeet).toBe(5)

    const jumped = resolveDnd5eHeadlessAction(approached.state, {
      type: 'move', actorId: athlete.id, to: { x: 13, y: 0 }, distance: 8,
      traversalMode: 'long-jump-running',
    })
    expect(jumped.ok, jumped.ok ? undefined : jumped.reason).toBe(true)
    if (!jumped.ok) return
    expect(jumped.state.combatants[athlete.id].classState.runningJumpApproachFeet).toBe(0)

    const ordinary = combatant('ordinary', 'player')
    const ordinaryState = startDnd5eHeadlessCombat('ordinary-running-jump', [ordinary, target])
    const tooShort = resolveDnd5eHeadlessAction(ordinaryState, {
      type: 'move', actorId: ordinary.id, to: { x: 5, y: 0 }, distance: 5,
    })
    expect(tooShort.ok).toBe(true)
    if (!tooShort.ok) return
    expect(resolveDnd5eHeadlessAction(tooShort.state, {
      type: 'move', actorId: ordinary.id, to: { x: 13, y: 0 }, distance: 8,
      traversalMode: 'long-jump-running',
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('keeps a Skulker hidden only when a ranged weapon attack misses', () => {
    const target = combatant('target', 'dm')
    const action = {
      type: 'attack' as const,
      actorId: 'skulker',
      targetId: target.id,
      attackModifier: 0,
      d20: 1,
      spendAction: false,
      classDamageContext: {
        weaponId: 'shortbow', weaponProperties: ['two-handed', 'ammunition'],
        mode: 'ranged' as const, normalRangeFeet: 80, longRangeFeet: 320, distanceFeet: 5,
        finesse: false, strengthBased: false, weaponDamageSides: 6,
        damageType: 'piercing' as const, adjacentEnemyOfTarget: false,
      },
      damage: { count: 1, sides: 6, bonus: 0, rolls: [] as number[], type: 'piercing' as const },
    }
    const skulker = combatant('skulker', 'player', {
      retainHiddenOnRangedWeaponMiss: true,
      classState: { hiddenCheckTotal: 18 },
    })
    const missed = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('skulker-miss', [skulker, target]),
      action,
    )
    expect(missed.ok, missed.ok ? undefined : missed.reason).toBe(true)
    if (!missed.ok) return
    expect(missed.state.combatants[skulker.id].classState.hiddenCheckTotal).toBe(18)
    expect(missed.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', hit: false }))

    const hit = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('skulker-hit', [skulker, target]),
      { ...action, d20: 20, damage: { ...action.damage, rolls: [4, 4] } },
    )
    expect(hit.ok, hit.ok ? undefined : hit.reason).toBe(true)
    if (!hit.ok) return
    expect(hit.state.combatants[skulker.id].classState.hiddenCheckTotal).toBeUndefined()
    expect(hit.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', stateKey: 'hidden', active: false,
    }))
  })
})
