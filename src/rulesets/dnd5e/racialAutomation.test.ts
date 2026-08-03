import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
} from './headlessCombatEngine'
import {
  DND5E_DRAGONBORN_ANCESTRIES,
  DND5E_RACIAL_RESOURCE_KEYS,
  dnd5eRacialRulesForCharacter,
  type Dnd5eRacialRulesSnapshot,
} from './racialAutomation'
import { createDnd5eConditionEffect } from './activeEffects'
import { registerDnd5eRulesPlugin } from './pluginApi'

const abilities = { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 } as const

function racialRules(
  patch: Partial<Dnd5eRacialRulesSnapshot>,
): Dnd5eRacialRulesSnapshot {
  return {
    halflingLucky: false,
    halfOrcRelentlessEndurance: false,
    halfOrcSavageAttacks: false,
    innateSpells: [],
    ...patch,
  }
}

function combatant(
  id: string,
  initiative: number,
  patch: Partial<Dnd5eCombatant> = {},
): Dnd5eCombatant {
  return createDnd5eCombatant({
    id,
    name: id,
    controller: initiative >= 10 ? 'player' : 'dm',
    initiative,
    abilities,
    proficiencyBonus: 2,
    armorClass: 16,
    currentHp: 20,
    maxHp: 20,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

describe('D&D 5e racial Headless automation', () => {
  it('projects level-gated innate spells from registered race data', () => {
    const pluginId = 'local.test.racial-grants'
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId,
        name: 'Racial Grants Test',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Tests',
        license: 'CC0-1.0',
      },
      setup(api) {
        api.registerRace({
          id: 'ancestry-a',
          name: 'Ancestry A',
          speedFeet: 30,
          innateSpells: [
            { spellId: 'dancing-lights', minimumLevel: 1, ability: 'cha', castAtLevel: 0, resetOn: 'at-will' },
            { spellId: 'faerie-fire', minimumLevel: 3, ability: 'cha', castAtLevel: 1, resetOn: 'long-rest' },
            { spellId: 'darkness', minimumLevel: 5, ability: 'cha', castAtLevel: 2, resetOn: 'long-rest' },
          ],
        })
        api.registerRace({
          id: 'ancestry-b',
          name: 'Ancestry B',
          speedFeet: 25,
          innateSpells: [
            { spellId: 'minor-illusion', minimumLevel: 1, ability: 'int', castAtLevel: 0, resetOn: 'at-will' },
          ],
        })
      },
    })
    try {
      expect(dnd5eRacialRulesForCharacter({
        race: 'Ancestry A',
        dnd5eRaceId: `${pluginId}:ancestry-a`,
        level: 5,
      }).innateSpells).toEqual([
        expect.objectContaining({ spellId: 'dancing-lights', resetOn: 'at-will' }),
        expect.objectContaining({ spellId: 'faerie-fire', resetOn: 'long-rest' }),
        expect.objectContaining({ spellId: 'darkness', resetOn: 'long-rest' }),
      ])
      expect(dnd5eRacialRulesForCharacter({
        race: 'Ancestry B',
        dnd5eRaceId: `${pluginId}:ancestry-b`,
        level: 1,
      }).innateSpells).toEqual([
        expect.objectContaining({ spellId: 'minor-illusion', resetOn: 'at-will' }),
      ])
    } finally {
      dispose()
    }
  })

  it('requires and applies a Halfling Lucky reroll for a natural 1', () => {
    const halfling = combatant('halfling', 20, {
      racialRules: racialRules({ halflingLucky: true }),
    })
    const target = combatant('target', 10, { controller: 'dm' })
    const state = startDnd5eHeadlessCombat('halfling-lucky', [halfling, target])

    expect(resolveDnd5eHeadlessAction(state, {
      type: 'attack',
      actorId: halfling.id,
      targetId: target.id,
      attackModifier: 5,
      d20: 1,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'slashing' },
    })).toMatchObject({ ok: false, reason: 'invalid-dice' })

    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack',
      actorId: halfling.id,
      targetId: target.id,
      attackModifier: 5,
      d20: 1,
      halflingLuckyD20: 15,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'slashing' },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[target.id].currentHp).toBe(16)
    expect(result.events).toContainEqual({
      type: 'halfling-lucky-rerolled',
      actorId: halfling.id,
      original: 1,
      reroll: 15,
      dieIndex: 0,
    })
  })

  it('applies Halfling Lucky independently to both sides of a combat contest', () => {
    const actor = combatant('halfling-actor', 20, {
      racialRules: racialRules({ halflingLucky: true }),
    })
    const target = combatant('halfling-target', 10, {
      controller: 'dm',
      racialRules: racialRules({ halflingLucky: true }),
    })
    const state = startDnd5eHeadlessCombat('halfling-lucky-contest', [actor, target])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(actor.id, target.id)]: 5,
    }
    const action = {
      type: 'grapple' as const,
      actorId: actor.id,
      targetId: target.id,
      actorD20: 1,
      targetD20: 1,
      targetDefense: 'athletics' as const,
    }

    expect(resolveDnd5eHeadlessAction(state, action)).toMatchObject({
      ok: false,
      reason: 'invalid-dice',
    })

    const result = resolveDnd5eHeadlessAction(state, {
      ...action,
      actorHalflingLuckyD20: 18,
      targetHalflingLuckyD20: 5,
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.events).toEqual(expect.arrayContaining([
      {
        type: 'halfling-lucky-rerolled',
        actorId: actor.id,
        original: 1,
        reroll: 18,
        dieIndex: 0,
      },
      {
        type: 'halfling-lucky-rerolled',
        actorId: target.id,
        original: 1,
        reroll: 5,
        dieIndex: 0,
      },
      expect.objectContaining({
        type: 'contest-resolved',
        contest: 'grapple',
        success: true,
      }),
    ]))
  })

  it('uses Halfling Lucky when escaping a fixed-DC combat effect', () => {
    const halfling = combatant('halfling-escape', 20, {
      racialRules: racialRules({ halflingLucky: true }),
    })
    const effect = createDnd5eConditionEffect({
      id: 'halfling-fixed-dc-effect',
      condition: 'restrained',
      targetId: halfling.id,
      source: { kind: 'monster', actorId: 'source', rulesId: 'test-restraint' },
      escapeCheck: {
        ability: 'str',
        skill: 'athletics',
        alternativeAbility: 'dex',
        alternativeSkill: 'acrobatics',
        dc: 14,
        economy: 'action',
      },
    })
    halfling.classState.activeEffects = [effect]
    halfling.conditions = ['restrained']
    const state = startDnd5eHeadlessCombat('halfling-lucky-fixed-dc', [
      halfling,
      combatant('source', 10, { controller: 'dm' }),
    ])
    const action = {
      type: 'escape-active-effect' as const,
      actorId: halfling.id,
      effectId: effect.id,
      d20: 1,
    }

    expect(resolveDnd5eHeadlessAction(state, action)).toMatchObject({
      ok: false,
      reason: 'invalid-dice',
    })

    const result = resolveDnd5eHeadlessAction(state, {
      ...action,
      halflingLuckyD20: 20,
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[halfling.id].conditions).not.toContain('restrained')
    expect(result.events).toContainEqual({
      type: 'halfling-lucky-rerolled',
      actorId: halfling.id,
      original: 1,
      reroll: 20,
      dieIndex: 0,
    })
  })

  it('applies Halfling Lucky to a nested Stunning Strike saving throw', () => {
    const monk = combatant('monk', 20, {
      classId: 'monk',
      level: 5,
      classResources: { 'dnd5e-ki': { current: 1, max: 5 } },
    })
    const halfling = combatant('halfling', 10, {
      controller: 'player',
      racialRules: racialRules({ halflingLucky: true }),
    })
    const state = startDnd5eHeadlessCombat('halfling-lucky-stunning-strike', [monk, halfling])
    const action = {
      type: 'attack' as const,
      actorId: monk.id,
      targetId: halfling.id,
      attackModifier: 20,
      d20: 10,
      stunningStrikeSaveD20: 1,
      classDamageContext: {
        mode: 'melee' as const,
        finesse: false,
        strengthBased: true,
        weaponDamageSides: 6,
        damageType: 'bludgeoning' as const,
        adjacentEnemyOfTarget: false,
        stunningStrike: true,
      },
      damage: { count: 1, sides: 6, bonus: 0, rolls: [3], type: 'bludgeoning' as const },
    }

    expect(resolveDnd5eHeadlessAction(state, action)).toMatchObject({
      ok: false,
      reason: 'invalid-dice',
    })

    const result = resolveDnd5eHeadlessAction(state, {
      ...action,
      stunningStrikeSaveHalflingLuckyD20: 15,
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[halfling.id].classState.stunnedByActorId).toBeUndefined()
    expect(result.events).toContainEqual({
      type: 'halfling-lucky-rerolled',
      actorId: halfling.id,
      original: 1,
      reroll: 15,
      dieIndex: 0,
    })
  })

  it('adds one validated weapon die to a Half-Orc melee weapon critical', () => {
    const halfOrc = combatant('half-orc', 20, {
      racialRules: racialRules({ halfOrcSavageAttacks: true }),
    })
    const target = combatant('target', 10, {
      controller: 'dm',
      currentHp: 40,
      maxHp: 40,
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('savage-attacks', [halfOrc, target]),
      {
        type: 'attack',
        actorId: halfOrc.id,
        targetId: target.id,
        attackModifier: 5,
        d20: 20,
        savageAttacksRoll: 7,
        damage: { count: 1, sides: 8, bonus: 0, rolls: [5, 6], type: 'slashing' },
        classDamageContext: {
          weaponId: 'longsword',
          mode: 'melee',
          finesse: false,
          strengthBased: true,
          weaponDamageSides: 8,
          damageType: 'slashing',
          adjacentEnemyOfTarget: false,
        },
      },
    )
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[target.id].currentHp).toBe(22)
    expect(result.events).toContainEqual({
      type: 'savage-attacks-applied',
      actorId: halfOrc.id,
      targetId: target.id,
      roll: 7,
      damageType: 'slashing',
    })
  })

  it('uses Relentless Endurance at zero HP but not against massive damage', () => {
    const attacker = combatant('attacker', 20)
    const halfOrc = combatant('half-orc', 10, {
      controller: 'dm',
      currentHp: 5,
      racialRules: racialRules({ halfOrcRelentlessEndurance: true }),
      classResources: {
        [DND5E_RACIAL_RESOURCE_KEYS.relentlessEndurance]: { current: 1, max: 1 },
      },
    })
    const survive = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('relentless-endurance', [attacker, halfOrc]),
      {
        type: 'attack',
        actorId: attacker.id,
        targetId: halfOrc.id,
        attackModifier: 5,
        d20: 15,
        damage: { count: 1, sides: 6, bonus: 1, rolls: [5], type: 'slashing' },
      },
    )
    expect(survive.ok, survive.ok ? undefined : survive.reason).toBe(true)
    if (!survive.ok) return
    expect(survive.state.combatants[halfOrc.id]).toMatchObject({
      currentHp: 1,
      classResources: {
        [DND5E_RACIAL_RESOURCE_KEYS.relentlessEndurance]: { current: 0, max: 1 },
      },
    })
    expect(survive.events).toContainEqual({
      type: 'relentless-endurance-triggered',
      actorId: halfOrc.id,
    })

    const massive = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('relentless-massive', [
        combatant('attacker', 20),
        combatant('half-orc', 10, {
          controller: 'dm',
          currentHp: 5,
          maxHp: 20,
          racialRules: racialRules({ halfOrcRelentlessEndurance: true }),
          classResources: {
            [DND5E_RACIAL_RESOURCE_KEYS.relentlessEndurance]: { current: 1, max: 1 },
          },
        }),
      ]),
      {
        type: 'attack',
        actorId: 'attacker',
        targetId: 'half-orc',
        attackModifier: 5,
        d20: 15,
        damage: { count: 1, sides: 6, bonus: 20, rolls: [5], type: 'slashing' },
      },
    )
    expect(massive.ok, massive.ok ? undefined : massive.reason).toBe(true)
    if (!massive.ok) return
    expect(massive.state.combatants['half-orc']).toMatchObject({
      currentHp: 0,
      deathSaves: { dead: true },
      classResources: {
        [DND5E_RACIAL_RESOURCE_KEYS.relentlessEndurance]: { current: 1, max: 1 },
      },
    })
  })

  it('resolves Dragonborn breath damage, resistance, save DC, and short-rest resource', () => {
    const ancestry = DND5E_DRAGONBORN_ANCESTRIES.find((candidate) => candidate.id === 'red')!
    const dragonborn = combatant('dragonborn', 20, {
      level: 6,
      proficiencyBonus: 3,
      abilities: { ...abilities, con: 16 },
      racialRules: racialRules({ dragonbornAncestry: ancestry }),
      classResources: {
        [DND5E_RACIAL_RESOURCE_KEYS.dragonbornBreath]: { current: 1, max: 1 },
      },
    })
    const target = combatant('target', 10, {
      controller: 'dm',
      currentHp: 30,
      maxHp: 30,
      damageResistances: ['fire'],
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('dragonborn-breath', [dragonborn, target]),
      {
        type: 'dragonborn-breath',
        actorId: dragonborn.id,
        resolution: {
          schemaVersion: 1,
          targetIds: [target.id],
          targetSavingThrows: [{ targetId: target.id, d20: 1 }],
          damageRolls: [6, 6, 6],
        },
      },
    )
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[target.id].currentHp).toBe(21)
    expect(result.state.combatants[dragonborn.id]).toMatchObject({
      turn: { actionAvailable: false },
      classResources: {
        [DND5E_RACIAL_RESOURCE_KEYS.dragonbornBreath]: { current: 0, max: 1 },
      },
    })
    expect(result.events).toContainEqual({
      type: 'dragonborn-breath-resolved',
      actorId: dragonborn.id,
      ancestryId: 'red',
      targetIds: [target.id],
      damage: 18,
      dc: 14,
    })
  })

  it('casts racial innate spells without class spell slots and consumes racial uses', () => {
    const drow = combatant('drow', 20, {
      level: 3,
      abilities: { ...abilities, cha: 16 },
      racialRules: racialRules({
        innateSpells: [{
          spellId: 'faerie-fire',
          minimumLevel: 3,
          ability: 'cha',
          castAtLevel: 1,
          resetOn: 'long-rest',
        }],
      }),
      classResources: {
        [DND5E_RACIAL_RESOURCE_KEYS.innateSpell('faerie-fire')]: { current: 1, max: 1 },
      },
    })
    const target = combatant('target', 10, { controller: 'dm' })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('racial-spell', [drow, target]),
      {
        type: 'cast-spell',
        actorId: drow.id,
        targetId: target.id,
        targetIds: [target.id],
        spellId: 'faerie-fire',
        slotLevel: 1,
        racialInnate: true,
        effectRolls: [],
        savingThrowD20: 1,
      },
    )
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[drow.id].classResources[
      DND5E_RACIAL_RESOURCE_KEYS.innateSpell('faerie-fire')
    ].current).toBe(0)
    expect(result.state.combatants[target.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({ definitionId: 'srd-5.1:spell:faerie-fire' }),
    )
  })

  it('casts Tiefling Hellish Rebuke as a racial reaction', () => {
    const attacker = combatant('attacker', 20, {
      controller: 'dm',
      currentHp: 30,
      maxHp: 30,
    })
    const tiefling = combatant('tiefling', 10, {
      controller: 'player',
      level: 3,
      abilities: { ...abilities, cha: 16 },
      racialRules: racialRules({
        innateSpells: [{
          spellId: 'hellish-rebuke',
          minimumLevel: 3,
          ability: 'cha',
          castAtLevel: 2,
          resetOn: 'long-rest',
        }],
      }),
      classResources: {
        [DND5E_RACIAL_RESOURCE_KEYS.innateSpell('hellish-rebuke')]: { current: 1, max: 1 },
      },
    })
    const state = startDnd5eHeadlessCombat('racial-reaction-spell', [attacker, tiefling])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(attacker.id, tiefling.id)]: 30,
    }
    const result = resolveDnd5eHeadlessAction(
      state,
      {
        type: 'hellish-rebuke',
        actorId: tiefling.id,
        targetId: attacker.id,
        racialInnate: true,
        slotLevel: 2,
        triggerDamageAmount: 5,
        savingThrowD20: 1,
        effectRolls: [5, 5, 5],
      },
    )
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[attacker.id].currentHp).toBe(15)
    expect(result.state.combatants[tiefling.id]).toMatchObject({
      turn: { reactionAvailable: false },
      classResources: {
        [DND5E_RACIAL_RESOURCE_KEYS.innateSpell('hellish-rebuke')]: { current: 0, max: 1 },
      },
    })
  })
})
