import { afterEach, describe, expect, it } from 'vitest'
import { createDnd5eCombatant, dnd5eAbilityCheckRollMode, dnd5eAttackerIsUnseenForAttack, dnd5eCombatantCanSee, dnd5eCombatantPairKey, dnd5eDarkOnesOwnLuckAvailable, dnd5eDirectedCombatantPairKey, dnd5eEffectiveDarkvisionRangeFeet, dnd5eEffectiveFlySpeed, dnd5eEffectiveSizeRank, dnd5eEffectiveSpeed, dnd5eGrappleDragExtraMovementFeet, dnd5eTargetArmorClassForAttack, dnd5eWeaponClassDamageDefinitions, resolveDnd5eHeadlessAction, resolveDnd5ePersistentAreaTrigger, setDnd5eHeadlessResolutionObserver, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import {
  createDnd5eConditionEffect,
  createDnd5eMechanicalEffect,
  dnd5eConditionsFromActiveEffects,
  type Dnd5eActiveEffectInstance,
} from './activeEffects'
import { migrateLegacyDnd5eConditions } from './legacyActiveEffectMigration'
import { dnd5eAttackerIsUnseen, dnd5eSavingThrowMode, dnd5eTargetGrantsAttackAdvantage, dnd5eUnseenTargetImposesDisadvantage } from './passiveDefenses'
import { getDnd5eSrdMonster, type Dnd5eMonsterStatBlock } from './monsters'
import { setDnd5eRoomMonsterCatalog } from './roomMonsterCatalog'

const abilities = { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 } as const

function meleeWeaponContext(weaponId?: string) {
  return {
    weaponId,
    mode: 'melee' as const,
    finesse: false,
    strengthBased: true,
    weaponDamageSides: 8,
    damageType: 'slashing' as const,
    adjacentEnemyOfTarget: false,
  }
}

function fighter(id: string, initiative: number, patch = {}) {
  const combatant = createDnd5eCombatant({ id, name: id, controller: 'player', initiative, abilities, proficiencyBonus: 2, armorClass: 16, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false, ...patch })
  const conditionLabels = (patch as { conditions?: string[] }).conditions
  if (conditionLabels?.length) {
    const activeEffects = migrateLegacyDnd5eConditions({ targetId: id, conditions: conditionLabels })
    combatant.classState.activeEffects = activeEffects
    combatant.conditions = dnd5eConditionsFromActiveEffects(activeEffects)
  }
  return combatant
}

describe('D&D 5e 2014 headless combat engine', () => {
  afterEach(() => {
    setDnd5eRoomMonsterCatalog([])
  })

  it.each([
    {
      label: 'one Tail and two Claws',
      actionId: 'multiattack',
      targetPosition: { x: 5, y: 0 },
      rolls: [
        { targetId: 'target', d20: 10, damageRolls: [[4, 4]] },
        { targetId: 'target', d20: 10, damageRolls: [[4]] },
        { targetId: 'target', d20: 10, damageRolls: [[4]] },
      ],
      expectedDamage: 25,
      expectedAttackCount: 3,
    },
    {
      label: 'two Hurl Flame attacks',
      actionId: 'multiattack-hurl-flame',
      targetPosition: { x: 30, y: 0 },
      rolls: [
        { targetId: 'target', d20: 10, damageRolls: [[4, 4, 4]] },
        { targetId: 'target', d20: 10, damageRolls: [[4, 4, 4]] },
      ],
      expectedDamage: 24,
      expectedAttackCount: 2,
    },
  ])('resolves the Barbed Devil Multiattack alternative: $label', ({
    actionId,
    targetPosition,
    rolls,
    expectedDamage,
    expectedAttackCount,
  }) => {
    const devil = fighter('barbed-devil', 20, {
      controller: 'dm',
      statBlockId: 'srd-5.1:barbed-devil',
      armorClass: 15,
      currentHp: 110,
      maxHp: 110,
      position: { x: 0, y: 0 },
    })
    const target = fighter('target', 10, {
      armorClass: 10,
      currentHp: 100,
      maxHp: 100,
      position: targetPosition,
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat(`barbed-devil-${actionId}`, [devil, target]),
      {
        type: 'monster-action',
        actorId: devil.id,
        actionId,
        rolls,
      },
    )

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[target.id].currentHp).toBe(100 - expectedDamage)
    expect(result.state.combatants[devil.id].turn.actionAvailable).toBe(false)
    expect(result.events.filter((event) => event.type === 'attack-resolved')).toHaveLength(
      expectedAttackCount,
    )
  })

  it('resolves Warding Bond benefits, damage transfer, saves, and range termination', () => {
    const cleric = fighter('cleric', 20, {
      classId: 'cleric',
      level: 3,
      abilities: { ...abilities, wis: 16 },
      classSelections: { 'spell-prepared': ['warding-bond'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const ally = fighter('ally', 10)
    const enemy = fighter('enemy', 5, { controller: 'dm' })
    const initial = startDnd5eHeadlessCombat('warding-bond', [cleric, ally, enemy])
    initial.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(cleric.id, ally.id)]: 5,
    }
    const cast = resolveDnd5eHeadlessAction(initial, {
      type: 'cast-spell',
      actorId: cleric.id,
      targetId: ally.id,
      spellId: 'warding-bond',
      slotLevel: 2,
      effectRolls: [],
    })
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants[cleric.id].concentrating).toBe(false)
    expect(cast.state.combatants[ally.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({
        definitionId: 'srd-5.1:spell:warding-bond',
        modifiers: expect.objectContaining({
          armorClassBonus: 1,
          savingThrowBonus: 1,
          resistanceToAllDamage: true,
        }),
      }),
    )
    expect(dnd5eTargetArmorClassForAttack(cast.state, enemy.id, ally.id)).toBe(17)

    cast.state.initiativeIndex = cast.state.initiativeOrder.indexOf(enemy.id)
    cast.state.combatants[ally.id].concentrating = true
    const attack = resolveDnd5eHeadlessAction(cast.state, {
      type: 'attack',
      actorId: enemy.id,
      targetId: ally.id,
      attackModifier: 5,
      d20: 19,
      damage: { count: 1, sides: 10, bonus: 0, rolls: [9], type: 'slashing' },
    })
    expect(attack.ok).toBe(true)
    if (!attack.ok) return
    expect(attack.state.combatants[ally.id].currentHp).toBe(16)
    expect(attack.state.combatants[cleric.id].currentHp).toBe(16)
    expect(attack.events).toContainEqual({
      type: 'warding-bond-damage-transferred',
      targetId: ally.id,
      sourceActorId: cleric.id,
      amount: 4,
    })

    const concentration = resolveDnd5eHeadlessAction(attack.state, {
      type: 'concentration-save',
      actorId: ally.id,
      d20: 7,
      dc: 10,
    })
    expect(concentration.ok).toBe(true)
    if (!concentration.ok) return
    expect(concentration.events).toContainEqual(expect.objectContaining({
      type: 'concentration-resolved',
      total: 10,
      success: true,
    }))

    const dismissalState = structuredClone(concentration.state)
    dismissalState.initiativeIndex = dismissalState.initiativeOrder.indexOf(cleric.id)
    dismissalState.combatants[cleric.id].turn.actionAvailable = true
    const dismissed = resolveDnd5eHeadlessAction(dismissalState, {
      type: 'dismiss-warding-bond',
      actorId: cleric.id,
    })
    expect(dismissed.ok).toBe(true)
    if (!dismissed.ok) return
    expect(dismissed.state.combatants[cleric.id].turn.actionAvailable).toBe(false)
    expect(dismissed.state.combatants[ally.id].classState.activeEffects ?? []).not.toContainEqual(
      expect.objectContaining({ definitionId: 'srd-5.1:spell:warding-bond' }),
    )

    concentration.state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(cleric.id, ally.id)]: 65,
    }
    const outOfRange = resolveDnd5eHeadlessAction(concentration.state, {
      type: 'end-turn',
      actorId: enemy.id,
    })
    expect(outOfRange.ok).toBe(true)
    if (!outOfRange.ok) return
    expect(outOfRange.state.combatants[ally.id].classState.activeEffects ?? []).not.toContainEqual(
      expect.objectContaining({ definitionId: 'srd-5.1:spell:warding-bond' }),
    )
    expect(outOfRange.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed',
      definitionId: 'srd-5.1:spell:warding-bond',
      reason: 'out-of-range',
    }))

    expect(resolveDnd5eHeadlessAction(initial, {
      type: 'cast-spell',
      actorId: cleric.id,
      targetId: cleric.id,
      spellId: 'warding-bond',
      slotLevel: 2,
      effectRolls: [],
    })).toMatchObject({ ok: false, reason: 'invalid-target' })
  })

  it('resolves See Invisibility through authoritative sight and attack modes', () => {
    const wizard = fighter('seer', 20, {
      classId: 'wizard',
      level: 3,
      abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-prepared': ['see-invisibility'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const invisible = fighter('invisible', 10, {
      controller: 'dm',
      armorClass: 12,
      conditions: ['invisible'],
    })
    const state = startDnd5eHeadlessCombat('see-invisibility', [wizard, invisible])
    expect(dnd5eCombatantCanSee(state, wizard.id, invisible.id)).toBe(false)
    expect(dnd5eAttackerIsUnseenForAttack(state, invisible.id, wizard.id)).toBe(true)

    const cast = resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell',
      actorId: wizard.id,
      targetId: wizard.id,
      spellId: 'see-invisibility',
      slotLevel: 2,
      effectRolls: [],
    })
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants[wizard.id]).toMatchObject({
      concentrating: false,
      classState: {
        activeEffects: [expect.objectContaining({
          definitionId: 'srd-5.1:spell:see-invisibility',
          duration: expect.objectContaining({ type: 'rounds', remainingRounds: 600 }),
          modifiers: expect.objectContaining({ seeInvisible: true }),
        })],
      },
    })
    expect(dnd5eCombatantCanSee(cast.state, wizard.id, invisible.id)).toBe(true)
    expect(dnd5eAttackerIsUnseenForAttack(cast.state, invisible.id, wizard.id)).toBe(false)

    cast.state.combatants[wizard.id].turn.actionAvailable = true
    const attack = resolveDnd5eHeadlessAction(cast.state, {
      type: 'attack',
      actorId: wizard.id,
      targetId: invisible.id,
      attackModifier: 5,
      d20: 10,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'slashing' },
    })
    expect(attack.ok).toBe(true)
    if (!attack.ok) return
    expect(attack.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      d20: 10,
      total: 15,
    }))
    expect(attack.state.combatants[wizard.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({ definitionId: 'srd-5.1:spell:see-invisibility' }),
    )

    const blocked = structuredClone(attack.state)
    blocked.physicalLineOfSightBlockedByCombatantPair = {
      [dnd5eDirectedCombatantPairKey(wizard.id, invisible.id)]: true,
    }
    expect(dnd5eCombatantCanSee(blocked, wizard.id, invisible.id)).toBe(false)

    const hidden = structuredClone(attack.state)
    hidden.combatants[invisible.id].classState.hiddenCheckTotal = 20
    expect(dnd5eCombatantCanSee(hidden, wizard.id, invisible.id)).toBe(false)

    const darkness = structuredClone(attack.state)
    darkness.magicalDarknessByCombatantPair = {
      [dnd5eDirectedCombatantPairKey(wizard.id, invisible.id)]: true,
    }
    expect(dnd5eCombatantCanSee(darkness, wizard.id, invisible.id)).toBe(false)
  })

  it('authoritatively resolves all six Enhance Ability options', () => {
    const cases = [
      ['bear-endurance', 'con'],
      ['bull-strength', 'str'],
      ['cat-grace', 'dex'],
      ['eagle-splendor', 'cha'],
      ['fox-cunning', 'int'],
      ['owl-wisdom', 'wis'],
    ] as const
    for (const [choice, ability] of cases) {
      const cleric = fighter(`cleric-${choice}`, 20, {
        classId: 'cleric',
        level: 5,
        abilities: { ...abilities, wis: 16 },
        classSelections: { 'spell-prepared': ['enhance-ability'] },
        classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
      })
      const ally = fighter(`ally-${choice}`, 10)
      const cast = resolveDnd5eHeadlessAction(
        startDnd5eHeadlessCombat(`enhance-${choice}`, [cleric, ally]),
        {
          type: 'cast-spell',
          actorId: cleric.id,
          targetId: ally.id,
          spellId: 'enhance-ability',
          slotLevel: 2,
          enhanceAbilityChoice: choice,
          effectRolls: choice === 'bear-endurance' ? [4, 5] : [],
        },
      )
      expect(cast.ok, choice).toBe(true)
      if (!cast.ok) continue
      const enhanced = cast.state.combatants[ally.id]
      expect(enhanced.classState.activeEffects, choice).toContainEqual(expect.objectContaining({
        definitionId: 'srd-5.1:spell:enhance-ability',
        modifiers: expect.objectContaining({
          abilityCheckAdvantages: [ability],
          carryingCapacityMultiplier: choice === 'bull-strength' ? 2 : undefined,
          safeFallFeet: choice === 'cat-grace' ? 20 : undefined,
        }),
      }))
      expect(enhanced.temporaryHp, choice).toBe(choice === 'bear-endurance' ? 9 : 0)

      cast.state.initiativeIndex = cast.state.initiativeOrder.indexOf(ally.id)
      const check = resolveDnd5eHeadlessAction(cast.state, {
        type: 'ability-check',
        actorId: ally.id,
        ability,
        d20: 2,
        d20Second: 18,
      })
      expect(check.ok, choice).toBe(true)
      if (!check.ok) continue
      expect(check.events, choice).toContainEqual(expect.objectContaining({
        type: 'ability-check-resolved',
        d20: 18,
        mode: 'advantage',
      }))

      if (choice === 'cat-grace') {
        check.state.combatants[ally.id].elevationFeet = 20
        const fall = resolveDnd5eHeadlessAction(check.state, {
          type: 'move',
          actorId: ally.id,
          to: { x: 1, y: 0 },
          distance: 5,
          traversalMode: 'fall',
          toElevationFeet: 0,
          fallingDamageRolls: [],
        })
        expect(fall.ok).toBe(true)
        if (fall.ok) {
          expect(fall.state.combatants[ally.id].currentHp).toBe(20)
          expect(fall.state.combatants[ally.id].conditions).not.toContain('prone')
          expect(fall.events).toContainEqual(expect.objectContaining({
            type: 'falling-damage-resolved',
            distanceFeet: 20,
            damage: 0,
            landedProne: false,
          }))
        }
      }

      if (choice === 'bear-endurance') {
        const concentrationEnded = resolveDnd5eHeadlessAction(check.state, {
          type: 'concentration-save',
          actorId: cleric.id,
          d20: 1,
          dc: 10,
        })
        expect(concentrationEnded.ok).toBe(true)
        if (concentrationEnded.ok) {
          expect(concentrationEnded.state.combatants[ally.id].temporaryHp).toBe(0)
          expect(concentrationEnded.state.combatants[ally.id].classState.temporaryHitPointsSource).toBeUndefined()
        }
      }
    }
  })

  it('locks Magic Weapon to the touched weapon and applies its upcast bonus authoritatively', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard',
      level: 11,
      mainWeaponId: 'test-longsword',
      classSelections: { 'spell-prepared': ['magic-weapon'] },
      classResources: { 'dnd5e-spell-slot-6': { current: 1, max: 1 } },
    })
    const target = fighter('target', 10, {
      controller: 'dm',
      armorClass: 18,
      currentHp: 20,
      maxHp: 20,
      damageDefenseRules: [{
        outcome: 'immune',
        damageTypes: ['bludgeoning', 'piercing', 'slashing'],
        delivery: 'weapon-attack',
        magical: false,
        weaponMaterialNot: 'silvered',
      }],
    })
    const cast = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('magic-weapon', [wizard, target]),
      {
        type: 'cast-spell',
        actorId: 'wizard',
        targetId: 'wizard',
        spellId: 'magic-weapon',
        slotLevel: 6,
        effectRolls: [],
      },
    )
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants.wizard.classState.activeEffects).toContainEqual(
      expect.objectContaining({
        definitionId: 'srd-5.1:spell:magic-weapon',
        modifiers: { magicWeapon: { weaponId: 'test-longsword', bonus: 3 } },
        duration: expect.objectContaining({ type: 'concentration', remainingRounds: 600 }),
      }),
    )

    cast.state.combatants.wizard.turn.actionAvailable = true
    const enchantedAttack = resolveDnd5eHeadlessAction(cast.state, {
      type: 'attack',
      actorId: 'wizard',
      targetId: 'target',
      attackModifier: 5,
      d20: 10,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'slashing' },
      classDamageContext: {
        weaponId: 'test-longsword',
        mode: 'melee',
        finesse: false,
        strengthBased: true,
        weaponDamageSides: 8,
        damageType: 'slashing',
        adjacentEnemyOfTarget: false,
      },
      classDamageRolls: [],
    })
    expect(enchantedAttack.ok).toBe(true)
    if (!enchantedAttack.ok) return
    expect(enchantedAttack.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      total: 18,
      hit: true,
    }))
    expect(enchantedAttack.state.combatants.target.currentHp).toBe(13)

    enchantedAttack.state.combatants.wizard.turn.actionAvailable = true
    const otherWeaponAttack = resolveDnd5eHeadlessAction(enchantedAttack.state, {
      type: 'attack',
      actorId: 'wizard',
      targetId: 'target',
      attackModifier: 5,
      d20: 10,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [], type: 'slashing' },
      classDamageContext: {
        weaponId: 'different-weapon',
        mode: 'melee',
        finesse: false,
        strengthBased: true,
        weaponDamageSides: 8,
        damageType: 'slashing',
        adjacentEnemyOfTarget: false,
      },
      classDamageRolls: [],
    })
    expect(otherWeaponAttack.ok).toBe(true)
    if (!otherWeaponAttack.ok) return
    expect(otherWeaponAttack.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      total: 15,
      hit: false,
    }))
  })

  it('resolves map interaction damage and conditions through the normal rules pipeline', () => {
    const actor = fighter('actor', 20, {
      damageResistances: ['fire'],
      currentHp: 20,
      maxHp: 20,
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('interaction', [actor]),
      {
        type: 'scene-interaction-outcome',
        actorId: 'actor',
        interactionId: 'burning-altar',
        steps: [
          { id: 'flame', kind: 'damage', amount: 7, damageType: 'fire' },
          {
            id: 'blinded',
            kind: 'condition',
            condition: 'blinded',
            duration: { type: 'rounds', remainingRounds: 1, tickOn: 'target-turn-end' },
          },
        ],
      },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.actor.currentHp).toBe(17)
    expect(result.state.combatants.actor.conditions).toContain('blinded')
    expect(result.events).toContainEqual({
      type: 'scene-interaction-outcome-resolved',
      actorId: 'actor',
      interactionId: 'burning-altar',
      stepCount: 2,
    })
  })

  it('applies persistent-area damage to dying creatures and Moonbeam disadvantage to shapechangers', () => {
    const caster = fighter('caster', 20)
    const dying = fighter('dying', 10, {
      currentHp: 0, usesDeathSaves: true,
      deathSaves: { successes: 0, failures: 0, stable: false, dead: false },
    })
    const dyingResult = resolveDnd5ePersistentAreaTrigger(
      startDnd5eHeadlessCombat('area-dying', [caster, dying]),
      {
        areaId: 'spirit-guardians', sourceId: 'caster', targetId: 'dying',
        trigger: {
          id: 'damage', label: '区域伤害', timing: 'turn-start',
          oncePerRound: true, damage: { count: 1, sides: 6, modifier: 0, type: 'radiant' },
        },
        damageRolls: [4],
      },
    )
    expect(dyingResult.ok).toBe(true)
    if (!dyingResult.ok) return
    expect(dyingResult.state.combatants.dying.deathSaves.failures).toBe(1)

    const shapechanger = fighter('shapechanger', 10, {
      controller: 'dm', shapechanger: true, currentHp: 10, maxHp: 10,
      classState: {
        wildShapeFormId: 'wolf', wildShapeCurrentHp: 10,
        wildShapeOriginalCurrentHp: 20, wildShapeOriginalMaxHp: 20,
      },
    })
    const moonbeam = resolveDnd5ePersistentAreaTrigger(
      startDnd5eHeadlessCombat('area-shapechanger', [caster, shapechanger]),
      {
        areaId: 'moonbeam', sourceId: 'caster', targetId: 'shapechanger',
        trigger: {
          id: 'moonbeam', label: '月华之光', timing: 'turn-start', oncePerTurn: true,
          savingThrow: {
            ability: 'con', dc: 12, onSuccess: 'half',
            shapechangerDisadvantage: true, revertShapechangerOnFailure: true,
          },
          damage: { count: 1, sides: 10, modifier: 0, type: 'radiant' },
        },
        d20: 20, d20Second: 1, damageRolls: [5],
      },
    )
    expect(moonbeam.ok).toBe(true)
    expect(moonbeam.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: 'shapechanger', d20: 1, success: false,
    }))
    expect(moonbeam.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: 'shapechanger', stateKey: 'shapechanger-reverted', active: false,
    }))
    expect(moonbeam.state.combatants.shapechanger).toMatchObject({ currentHp: 20, maxHp: 20 })
  })

  it('resolves the first-batch non-damage spells through authoritative Headless state', () => {
    const cleric = fighter('cleric', 20, {
      classId: 'cleric', level: 9, abilities: { ...abilities, wis: 18 },
      classSelections: { 'spell-cantrips': ['spare-the-dying'], 'spell-prepared': ['mass-healing-word'] },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const ally = fighter('ally', 10, {
      currentHp: 0, maxHp: 40, usesDeathSaves: true,
      deathSaves: { successes: 1, failures: 2, stable: false, dead: false },
    })
    const stabilized = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('stabilize', [cleric, ally]), {
      type: 'cast-spell', actorId: 'cleric', targetId: 'ally', spellId: 'spare-the-dying', slotLevel: 0,
      effectRolls: [],
    })
    expect(stabilized.ok).toBe(true)
    if (!stabilized.ok) return
    expect(stabilized.state.combatants.ally.deathSaves).toEqual({ successes: 0, failures: 0, stable: true, dead: false })
    expect(stabilized.events).toContainEqual({ type: 'creature-stabilized', actorId: 'cleric', targetId: 'ally' })

    const wizard = fighter('wizard', 20, {
      classId: 'wizard', level: 5, abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['false-life'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const temporary = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('false-life', [wizard, fighter('enemy', 10, { controller: 'dm' })]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'wizard', spellId: 'false-life', slotLevel: 2,
      effectRolls: [4],
    })
    expect(temporary.ok).toBe(true)
    if (!temporary.ok) return
    expect(temporary.state.combatants.wizard.temporaryHp).toBe(13)
  })

  it('applies choice, repeat-save, concentration, and restoration effects for the first spell batch', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard', level: 9, proficiencyBonus: 4, abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['blindness-deafness', 'hold-person', 'banishment'] },
      classResources: {
        'dnd5e-spell-slot-2': { current: 2, max: 2 },
        'dnd5e-spell-slot-4': { current: 1, max: 1 },
      },
    })
    const humanoid = fighter('humanoid', 10, { controller: 'dm', creatureType: 'humanoid' })
    const blinded = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('blindness', [wizard, humanoid]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'humanoid', spellId: 'blindness-deafness', slotLevel: 2,
      conditionChoice: 'blinded', savingThrowD20: 1, effectRolls: [],
    })
    expect(blinded.ok).toBe(true)
    if (!blinded.ok) return
    expect(blinded.state.combatants.humanoid.classState.activeEffects).toContainEqual(expect.objectContaining({
      standardCondition: 'blinded', repeatSave: { ability: 'con', dc: 16, timing: 'target-turn-end', onSuccess: 'remove' },
    }))

    const held = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('hold', [wizard, humanoid]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'humanoid', spellId: 'hold-person', slotLevel: 2,
      savingThrowD20: 1, effectRolls: [],
    })
    expect(held.ok).toBe(true)
    if (!held.ok) return
    expect(held.state.combatants.wizard.classState.concentrationSpellId).toBe('hold-person')
    expect(held.state.combatants.humanoid.classState.activeEffects).toContainEqual(expect.objectContaining({
      standardCondition: 'paralyzed', duration: expect.objectContaining({ type: 'concentration', sourceActorId: 'wizard' }),
    }))

    const cleric = fighter('cleric', 20, {
      classId: 'cleric', level: 5, abilities: { ...abilities, wis: 18 },
      classSelections: { 'spell-prepared': ['lesser-restoration'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const restoredTarget = fighter('restored', 10, { conditions: ['blinded'] })
    const restored = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('restoration', [cleric, restoredTarget]), {
      type: 'cast-spell', actorId: 'cleric', targetId: 'restored', spellId: 'lesser-restoration', slotLevel: 2,
      conditionChoice: 'blinded', effectRolls: [],
    })
    expect(restored.ok).toBe(true)
    if (!restored.ok) return
    expect(restored.state.combatants.restored.conditions).not.toContain('blinded')
  })

  it('resolves Charm Person targeting, combat advantage, immunity, duration, and harmful-action cleanup', () => {
    const wizard = fighter('wizard', 30, {
      classId: 'wizard',
      level: 3,
      abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-prepared': ['charm-person'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const ally = fighter('ally', 20)
    const humanoid = fighter('humanoid', 10, {
      controller: 'dm',
      creatureType: 'humanoid',
      abilities: { ...abilities, wis: 8 },
    })
    const cast = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('charm-person', [wizard, ally, humanoid]),
      {
        type: 'cast-spell',
        actorId: 'wizard',
        targetId: 'humanoid',
        spellId: 'charm-person',
        slotLevel: 1,
        savingThrowD20: 1,
        savingThrowD20Second: 2,
        effectRolls: [],
      },
    )
    expect(cast.ok, cast.ok ? undefined : cast.reason).toBe(true)
    if (!cast.ok) return
    expect(cast.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved',
      targetId: 'humanoid',
      d20: 2,
      success: false,
    }))
    expect(cast.state.combatants.humanoid.classState.activeEffects).toContainEqual(expect.objectContaining({
      standardCondition: 'charmed',
      source: expect.objectContaining({ actorId: 'wizard', rulesId: 'charm-person' }),
      duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
    }))
    expect(cast.state.combatants.wizard.classResources['dnd5e-spell-slot-1'].current).toBe(0)

    const allyTurn = {
      ...cast.state,
      initiativeIndex: cast.state.initiativeOrder.indexOf('ally'),
    }
    const harmfulMiss = resolveDnd5eHeadlessAction(allyTurn, {
      type: 'attack',
      actorId: 'ally',
      targetId: 'humanoid',
      attackModifier: 0,
      d20: 1,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [1], type: 'bludgeoning' },
    })
    expect(harmfulMiss.ok).toBe(true)
    if (!harmfulMiss.ok) return
    expect(harmfulMiss.state.combatants.humanoid.conditions).not.toContain('charmed')
    expect(harmfulMiss.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed',
      targetId: 'humanoid',
      reason: 'harmful-action',
    }))

    const successfulSave = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('charm-person-save', [wizard, humanoid]),
      {
        type: 'cast-spell',
        actorId: 'wizard',
        targetId: 'humanoid',
        spellId: 'charm-person',
        slotLevel: 1,
        savingThrowD20: 1,
        savingThrowD20Second: 20,
        effectRolls: [],
      },
    )
    expect(successfulSave.ok).toBe(true)
    if (!successfulSave.ok) return
    expect(successfulSave.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved',
      d20: 20,
      success: true,
    }))
    expect(successfulSave.state.combatants.humanoid.conditions).not.toContain('charmed')

    const immuneTarget = fighter('immune', 10, {
      controller: 'dm',
      creatureType: 'humanoid',
      conditionImmunities: ['charmed'],
    })
    const immune = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('charm-person-immune', [wizard, immuneTarget]),
      {
        type: 'cast-spell',
        actorId: 'wizard',
        targetId: 'immune',
        spellId: 'charm-person',
        slotLevel: 1,
        savingThrowD20: 1,
        savingThrowD20Second: 2,
        effectRolls: [],
      },
    )
    expect(immune.ok).toBe(true)
    expect(immune.state.combatants.immune.conditions).not.toContain('charmed')

    const beast = fighter('beast', 10, { controller: 'dm', creatureType: 'beast' })
    const invalidTarget = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('charm-person-beast', [wizard, beast]),
      {
        type: 'cast-spell',
        actorId: 'wizard',
        targetId: 'beast',
        spellId: 'charm-person',
        slotLevel: 1,
        savingThrowD20: 1,
        savingThrowD20Second: 2,
        effectRolls: [],
      },
    )
    expect(invalidTarget).toMatchObject({ ok: false, reason: 'invalid-target' })
  })

  it('grants 60-foot Darkvision for 8 hours without penetrating magical darkness', () => {
    const wizard = fighter('wizard', 30, {
      classId: 'wizard',
      level: 3,
      classSelections: { 'spell-prepared': ['darkvision'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const ally = fighter('ally', 20)
    const enemy = fighter('enemy', 10, { controller: 'dm' })
    const initial = startDnd5eHeadlessCombat('darkvision', [wizard, ally, enemy])
    initial.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('wizard', 'ally')]: 5,
      [dnd5eCombatantPairKey('ally', 'enemy')]: 50,
    }
    const cast = resolveDnd5eHeadlessAction(initial, {
      type: 'cast-spell',
      actorId: 'wizard',
      targetId: 'ally',
      spellId: 'darkvision',
      slotLevel: 2,
      effectRolls: [],
    })
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(dnd5eEffectiveDarkvisionRangeFeet(cast.state.combatants.ally)).toBe(60)
    expect(cast.state.combatants.ally.classState.activeEffects).toContainEqual(
      expect.objectContaining({
        definitionId: 'srd-5.1:spell:darkvision',
        modifiers: expect.objectContaining({ darkvisionRangeFeet: 60 }),
        duration: { type: 'rounds', remainingRounds: 4_800, tickOn: 'target-turn-end' },
      }),
    )
    expect(cast.state.combatants.wizard.concentrating).toBe(false)
    expect(cast.state.combatants.wizard.classResources['dnd5e-spell-slot-2'].current).toBe(0)

    const directedKey = dnd5eDirectedCombatantPairKey('ally', 'enemy')
    cast.state.lineOfSightBlockedByCombatantPair = { [directedKey]: true }
    expect(dnd5eCombatantCanSee(cast.state, 'ally', 'enemy')).toBe(true)
    cast.state.magicalDarknessByCombatantPair = { [directedKey]: true }
    expect(dnd5eCombatantCanSee(cast.state, 'ally', 'enemy')).toBe(false)
  })

  it('uses the compiled Devil’s Sight profile in magical darkness', () => {
    const warlock = fighter('warlock', 20, {
      classId: 'warlock',
      classSelections: { 'eldritch-invocations': ['devils-sight'] },
    })
    const enemy = fighter('enemy', 10, { controller: 'dm' })
    const state = startDnd5eHeadlessCombat('devils-sight', [warlock, enemy])
    const key = dnd5eDirectedCombatantPairKey('warlock', 'enemy')
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('warlock', 'enemy')]: 100,
    }
    state.lineOfSightBlockedByCombatantPair = { [key]: true }
    state.magicalDarknessByCombatantPair = { [key]: true }
    expect(dnd5eCombatantCanSee(state, 'warlock', 'enemy')).toBe(true)
    state.distanceFeetByCombatantPair[dnd5eCombatantPairKey('warlock', 'enemy')] = 125
    expect(dnd5eCombatantCanSee(state, 'warlock', 'enemy')).toBe(false)
  })

  it('resolves Misty Step as a 30-foot bonus-action teleport without spending movement', () => {
    const wizard = fighter('wizard', 30, {
      classId: 'wizard',
      level: 3,
      classSelections: { 'spell-prepared': ['misty-step'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
      position: { x: 5, y: 5 },
    })
    const initial = startDnd5eHeadlessCombat('misty-step', [
      wizard,
      fighter('enemy', 10, { controller: 'dm' }),
    ])
    const cast = resolveDnd5eHeadlessAction(initial, {
      type: 'cast-spell',
      actorId: 'wizard',
      targetId: 'wizard',
      targetIds: [],
      spellId: 'misty-step',
      slotLevel: 2,
      teleportDestination: {
        to: { x: 35, y: 5 },
        distanceFeet: 30,
        toElevationFeet: 10,
      },
      effectRolls: [],
    })
    expect(cast.ok, cast.ok ? undefined : cast.reason).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants.wizard.position).toEqual({ x: 35, y: 5 })
    expect(cast.state.combatants.wizard.elevationFeet).toBe(10)
    expect(cast.state.combatants.wizard.turn).toMatchObject({
      actionAvailable: true,
      bonusActionAvailable: false,
      movementRemaining: 30,
    })
    expect(cast.state.combatants.wizard.classResources['dnd5e-spell-slot-2'].current).toBe(0)
    expect(cast.events).toContainEqual(expect.objectContaining({
      type: 'teleported',
      actorId: 'wizard',
      spellId: 'misty-step',
      distanceFeet: 30,
    }))
    expect(cast.events.some((event) => event.type === 'moved')).toBe(false)

    expect(resolveDnd5eHeadlessAction(initial, {
      type: 'cast-spell',
      actorId: 'wizard',
      targetId: 'wizard',
      targetIds: [],
      spellId: 'misty-step',
      slotLevel: 2,
      teleportDestination: { to: { x: 40, y: 5 }, distanceFeet: 35 },
      effectRolls: [],
    })).toMatchObject({ ok: false, reason: 'invalid-target' })
  })

  it('fully resolves Hideous Laughter, including damage saves, crawling, and concentration cleanup', () => {
    const wizard = fighter('wizard', 30, {
      classId: 'wizard', level: 3, abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-prepared': ['hideous-laughter'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const attacker = fighter('attacker', 20)
    const target = fighter('target', 10, { controller: 'dm' })
    const cast = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('hideous-laughter', [wizard, attacker, target]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'target', spellId: 'hideous-laughter', slotLevel: 1,
      savingThrowD20: 1, effectRolls: [],
    })
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants.target.conditions).toEqual(expect.arrayContaining(['prone', 'incapacitated']))
    expect(cast.state.combatants.target.classState.activeEffects).toContainEqual(expect.objectContaining({
      definitionId: 'srd-5.1:spell:hideous-laughter:repeat-save',
      repeatSave: expect.objectContaining({
        ability: 'wis', timing: 'target-turn-end', onDamage: { mode: 'advantage' },
      }),
    }))

    const targetTurn = {
      ...cast.state,
      initiativeIndex: cast.state.initiativeOrder.indexOf('target'),
    }
    const cannotStand = resolveDnd5eHeadlessAction(targetTurn, {
      type: 'move', actorId: 'target', to: { x: 5, y: 0 }, distance: 5,
      standFromProne: true,
    })
    expect(cannotStand).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
    const crawled = resolveDnd5eHeadlessAction(targetTurn, {
      type: 'move', actorId: 'target', to: { x: 5, y: 0 }, distance: 5,
      standFromProne: false,
    })
    expect(crawled.ok).toBe(true)

    const attackerTurn = {
      ...cast.state,
      initiativeIndex: cast.state.initiativeOrder.indexOf('attacker'),
    }
    const damaged = resolveDnd5eHeadlessAction(attackerTurn, {
      type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [3], type: 'slashing' },
    })
    expect(damaged.ok).toBe(true)
    if (!damaged.ok) return
    const repeatEffect = damaged.state.combatants.target.classState.activeEffects?.find((effect) =>
      effect.source.rulesId === 'hideous-laughter' && effect.repeatSave?.onDamage,
    )
    expect(repeatEffect).toBeDefined()
    expect(damaged.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-save-required', targetId: 'target', effectId: repeatEffect!.id,
      timing: 'takes-damage', mode: 'advantage',
    }))

    const failedDamageSave = resolveDnd5eHeadlessAction(damaged.state, {
      type: 'active-effect-damage-save', actorId: 'target', effectId: repeatEffect!.id,
      d20: 1, d20Second: 2,
    })
    expect(failedDamageSave.ok).toBe(true)
    if (!failedDamageSave.ok) return
    expect(failedDamageSave.state.combatants.target.conditions).toEqual(expect.arrayContaining(['prone', 'incapacitated']))
    expect(failedDamageSave.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-save-resolved', effectId: repeatEffect!.id, success: false,
    }))

    const secondDamage = resolveDnd5eHeadlessAction(attackerTurn, {
      type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [2], type: 'slashing' },
    })
    expect(secondDamage.ok).toBe(true)
    if (!secondDamage.ok) return
    const escaped = resolveDnd5eHeadlessAction(secondDamage.state, {
      type: 'active-effect-damage-save', actorId: 'target', effectId: repeatEffect!.id,
      d20: 20, d20Second: 1,
    })
    expect(escaped.ok).toBe(true)
    if (!escaped.ok) return
    expect(escaped.state.combatants.target.conditions).not.toEqual(expect.arrayContaining(['prone', 'incapacitated']))
    expect(escaped.state.combatants.wizard.concentrating).toBe(false)

    const lowIntTarget = fighter('low-int', 10, {
      controller: 'dm', abilities: { ...abilities, int: 4 },
    })
    const immune = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('hideous-laughter-immune', [wizard, lowIntTarget]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'low-int', spellId: 'hideous-laughter', slotLevel: 1,
      savingThrowD20: 1, effectRolls: [],
    })
    expect(immune).toMatchObject({ ok: false, reason: 'invalid-target' })
  })

  it('resolves Sleep by current HP, excludes immune creatures, and supports both wake conditions', () => {
    const wizard = fighter('wizard', 30, {
      classId: 'wizard', level: 3, abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-prepared': ['sleep'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const helper = fighter('helper', 25)
    const low = fighter('low', 20, { controller: 'dm', currentHp: 4, maxHp: 20 })
    const middle = fighter('middle', 15, { controller: 'dm', currentHp: 7, maxHp: 20 })
    const high = fighter('high', 10, { controller: 'dm', currentHp: 12, maxHp: 20 })
    const undead = fighter('undead', 8, { controller: 'dm', currentHp: 1, creatureType: '亡灵' })
    const charmImmune = fighter('charm-immune', 7, {
      controller: 'dm', currentHp: 2, conditionImmunities: ['魅惑'],
    })
    const magicalSleepImmune = fighter('magical-sleep-immune', 6, {
      controller: 'dm', currentHp: 2, conditionImmunities: ['magical-sleep'],
    })
    const alreadyUnconscious = fighter('already-unconscious', 6, {
      controller: 'dm', currentHp: 3, conditions: ['unconscious', 'prone'],
    })
    const state = startDnd5eHeadlessCombat('sleep', [
      wizard, helper, low, middle, high, undead, charmImmune, magicalSleepImmune, alreadyUnconscious,
    ])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('helper', 'low')]: 5,
      [dnd5eCombatantPairKey('helper', 'middle')]: 5,
    }
    const cast = resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell', actorId: 'wizard', targetId: 'low',
      targetIds: ['low', 'middle', 'high', 'undead', 'charm-immune', 'magical-sleep-immune', 'already-unconscious'],
      spellId: 'sleep', slotLevel: 1, effectRolls: [4, 4, 4, 4, 4],
    })
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants.low.conditions).toEqual(expect.arrayContaining(['unconscious', 'prone']))
    expect(cast.state.combatants.middle.conditions).toEqual(expect.arrayContaining(['unconscious', 'prone']))
    expect(cast.state.combatants.high.conditions).not.toContain('unconscious')
    expect(cast.state.combatants.undead.conditions).not.toContain('unconscious')
    expect(cast.state.combatants['charm-immune'].conditions).not.toContain('unconscious')
    expect(cast.state.combatants['magical-sleep-immune'].conditions).not.toContain('unconscious')
    expect(cast.state.combatants['already-unconscious'].classState.activeEffects)
      .not.toContainEqual(expect.objectContaining({ source: expect.objectContaining({ rulesId: 'sleep' }) }))
    expect(cast.state.combatants.low.classState.activeEffects).toContainEqual(expect.objectContaining({
      standardCondition: 'unconscious', source: expect.objectContaining({ rulesId: 'sleep' }),
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      breakOn: ['takes-damage'],
    }))
    expect(cast.events).toContainEqual({
      type: 'sleep-resolved', actorId: 'wizard', spellId: 'sleep',
      hitPointPool: 20, remainingHitPoints: 9, affectedTargetIds: ['low', 'middle'],
    })
    expect(cast.state.combatants.wizard.classResources['dnd5e-spell-slot-1'].current).toBe(0)

    const helperTurn = { ...cast.state, initiativeIndex: cast.state.initiativeOrder.indexOf('helper') }
    const awakened = resolveDnd5eHeadlessAction(helperTurn, {
      type: 'wake-sleeping-creature', actorId: 'helper', targetId: 'middle',
    })
    expect(awakened.ok).toBe(true)
    if (!awakened.ok) return
    expect(awakened.state.combatants.middle.conditions).not.toContain('unconscious')
    expect(awakened.state.combatants.middle.conditions).toContain('prone')
    expect(awakened.state.combatants.helper.turn.actionAvailable).toBe(false)
    expect(awakened.events).toContainEqual({
      type: 'sleeping-creature-awakened', actorId: 'helper', targetId: 'middle', spellId: 'sleep',
    })

    const helperAttackTurn = { ...cast.state, initiativeIndex: cast.state.initiativeOrder.indexOf('helper') }
    const damaged = resolveDnd5eHeadlessAction(helperAttackTurn, {
      type: 'attack', actorId: 'helper', targetId: 'low', attackModifier: 20,
      d20: 10, d20Second: 15,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [1, 1], type: 'bludgeoning' },
    })
    expect(damaged.ok).toBe(true)
    if (!damaged.ok) return
    expect(damaged.state.combatants.low.conditions).not.toContain('unconscious')
    expect(damaged.state.combatants.low.conditions).toContain('prone')
    expect(damaged.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed', targetId: 'low', reason: 'takes-damage',
    }))
  })

  it('adds two Sleep pool dice per higher slot and rejects forged dice', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard', level: 3,
      classSelections: { 'spell-prepared': ['sleep'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const target = fighter('target', 10, { controller: 'dm', currentHp: 21, maxHp: 21 })
    const state = startDnd5eHeadlessCombat('sleep-upcast', [wizard, target])
    expect(resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell', actorId: 'wizard', targetId: 'target', spellId: 'sleep', slotLevel: 2,
      effectRolls: [3, 3, 3, 3, 3, 3],
    })).toMatchObject({ ok: false, reason: 'invalid-dice' })
    const cast = resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell', actorId: 'wizard', targetId: 'target', spellId: 'sleep', slotLevel: 2,
      effectRolls: [3, 3, 3, 3, 3, 3, 3],
    })
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants.target.conditions).toContain('unconscious')
    expect(cast.events).toContainEqual(expect.objectContaining({
      type: 'sleep-resolved', hitPointPool: 21, remainingHitPoints: 0,
    }))
  })

  it('resolves Color Spray by current HP and expires blindness at the caster next turn end', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard', level: 3,
      classSelections: { 'spell-prepared': ['color-spray'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const low = fighter('low', 15, { controller: 'dm', currentHp: 4, maxHp: 20 })
    const middle = fighter('middle', 14, { controller: 'dm', currentHp: 7, maxHp: 20 })
    const high = fighter('high', 13, { controller: 'dm', currentHp: 8, maxHp: 20 })
    const alreadyBlind = fighter('already-blind', 12, {
      controller: 'dm', currentHp: 1, maxHp: 20, conditions: ['blinded'],
    })
    const blindImmune = fighter('blind-immune', 11, {
      controller: 'dm', currentHp: 2, maxHp: 20, conditionImmunities: ['blinded'],
    })
    const state = startDnd5eHeadlessCombat('color-spray', [
      wizard, low, middle, high, alreadyBlind, blindImmune,
    ])
    const cast = resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell', actorId: 'wizard', targetId: 'low',
      targetIds: ['low', 'middle', 'high', 'already-blind', 'blind-immune'],
      spellId: 'color-spray', slotLevel: 1, effectRolls: [2, 2, 2, 2, 2, 2],
    })
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants.low.conditions).toContain('blinded')
    expect(cast.state.combatants.middle.conditions).toContain('blinded')
    expect(cast.state.combatants.high.conditions).not.toContain('blinded')
    expect(cast.state.combatants['blind-immune'].conditions).not.toContain('blinded')
    expect(cast.events).toContainEqual({
      type: 'color-spray-resolved', actorId: 'wizard', spellId: 'color-spray',
      hitPointPool: 12, remainingHitPoints: 1, affectedTargetIds: ['low', 'middle'],
    })
    expect(cast.state.combatants.low.classState.activeEffects).toContainEqual(expect.objectContaining({
      definitionId: 'condition:blinded',
      stackingKey: 'srd-5.1:spell:color-spray:blinded',
      source: expect.objectContaining({ rulesId: 'color-spray' }),
      duration: expect.objectContaining({ type: 'until-turn-boundary', boundary: 'source-turn-end' }),
    }))

    let advanced = resolveDnd5eHeadlessAction(cast.state, { type: 'end-turn', actorId: 'wizard' })
    expect(advanced.ok).toBe(true)
    for (const actorId of ['low', 'middle', 'high', 'already-blind', 'blind-immune']) {
      if (!advanced.ok) return
      advanced = resolveDnd5eHeadlessAction(advanced.state, { type: 'end-turn', actorId })
      expect(advanced.ok).toBe(true)
    }
    if (!advanced.ok) return
    expect(advanced.state.combatants.low.conditions).toContain('blinded')
    const expired = resolveDnd5eHeadlessAction(advanced.state, { type: 'end-turn', actorId: 'wizard' })
    expect(expired.ok).toBe(true)
    if (!expired.ok) return
    expect(expired.state.combatants.low.conditions).not.toContain('blinded')
    expect(expired.state.combatants.middle.conditions).not.toContain('blinded')
  })

  it('adds Divine Favor radiant damage to authoritative weapon hits', () => {
    const paladin = fighter('paladin', 20, {
      classId: 'paladin', level: 2, abilities: { ...abilities, cha: 16 },
      classSelections: { 'spell-prepared': ['divine-favor'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const target = fighter('target', 10, { controller: 'dm', armorClass: 12 })
    const secondTarget = fighter('second-target', 5, { controller: 'dm', armorClass: 12 })
    const cast = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('divine-favor', [paladin, target, secondTarget]), {
      type: 'cast-spell', actorId: 'paladin', targetId: 'paladin',
      spellId: 'divine-favor', slotLevel: 1, effectRolls: [],
    })
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants.paladin.turn.bonusActionAvailable).toBe(false)
    expect(cast.state.combatants.paladin).toMatchObject({
      concentrating: true,
      classState: { concentrationSpellId: 'divine-favor' },
    })
    expect(dnd5eWeaponClassDamageDefinitions({
      state: cast.state,
      actorId: 'paladin',
      targetId: 'target',
      context: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
        damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
      critical: false,
    })).toContainEqual({
      source: 'divine-favor', count: 1, sides: 4, type: 'radiant', doubleOnCritical: true,
    })

    const attack = resolveDnd5eHeadlessAction(cast.state, {
      type: 'attack', actorId: 'paladin', targetId: 'target', attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5], type: 'slashing' },
      classDamageContext: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
        damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
      classDamageRolls: [{ source: 'divine-favor', rolls: [4] }],
    })
    expect(attack.ok).toBe(true)
    if (!attack.ok) return
    expect(attack.state.combatants.target.currentHp).toBe(8)
    expect(attack.events).toContainEqual({
      type: 'class-damage-applied', actorId: 'paladin', targetId: 'target',
      source: 'divine-favor', amount: 4,
    })

    const forgedOpportunitySmite = resolveDnd5eHeadlessAction(attack.state, {
      type: 'opportunity-attack', actorId: 'paladin', targetId: 'second-target',
      attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5], type: 'slashing' },
      classDamageContext: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
        damageType: 'slashing', adjacentEnemyOfTarget: false, divineSmiteSlotLevel: 1,
      },
      classDamageRolls: [],
    })
    expect(forgedOpportunitySmite).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
    const forgedOpportunityCritical = resolveDnd5eHeadlessAction(attack.state, {
      type: 'opportunity-attack', actorId: 'paladin', targetId: 'second-target',
      attackModifier: 5, criticalThreshold: 18, d20: 18,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5], type: 'slashing' },
      classDamageContext: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
        damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
      classDamageRolls: [],
    })
    expect(forgedOpportunityCritical).toMatchObject({ ok: false, reason: 'invalid-class-feature' })

    const opportunityAttack = resolveDnd5eHeadlessAction(attack.state, {
      type: 'opportunity-attack', actorId: 'paladin', targetId: 'second-target',
      attackModifier: 5, criticalThreshold: 20, d20: 15,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5], type: 'slashing' },
      classDamageContext: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
        damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
      classDamageRolls: [{ source: 'divine-favor', rolls: [4] }],
    })
    expect(opportunityAttack.ok).toBe(true)
    if (!opportunityAttack.ok) return
    expect(opportunityAttack.state.combatants['second-target'].currentHp).toBe(8)
    expect(opportunityAttack.events).toContainEqual({
      type: 'class-damage-applied', actorId: 'paladin', targetId: 'second-target',
      source: 'divine-favor', amount: 4,
    })
  })

  it('fully resolves Enlarge/Reduce saves, size, Strength rolls, and weapon damage', () => {
    const wizard = fighter('wizard', 30, {
      classId: 'wizard', level: 3, abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-prepared': ['enlarge-reduce'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const ally = fighter('ally', 20, { sizeRank: 2 })
    const enemy = fighter('enemy', 10, { controller: 'dm', armorClass: 10 })
    const enlarged = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('enlarge', [wizard, ally, enemy]),
      {
        type: 'cast-spell', actorId: 'wizard', targetId: 'ally',
        spellId: 'enlarge-reduce', slotLevel: 2, enlargeReduceChoice: 'enlarge',
        effectRolls: [],
      },
    )
    expect(enlarged.ok).toBe(true)
    if (!enlarged.ok) return
    expect(enlarged.state.combatants.ally.classState.activeEffects).toContainEqual(expect.objectContaining({
      definitionId: 'srd-5.1:spell:enlarge-reduce',
      modifiers: expect.objectContaining({
        sizeRankDelta: 1,
        strengthRollMode: 'advantage',
        weaponDamageD4: 'add',
      }),
    }))
    expect(dnd5eEffectiveSizeRank(enlarged.state.combatants.ally)).toBe(3)
    expect(dnd5eSavingThrowMode(enlarged.state.combatants.ally, 'str')).toBe('advantage')
    expect(dnd5eWeaponClassDamageDefinitions({
      state: enlarged.state,
      actorId: 'ally',
      targetId: 'enemy',
      context: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
        damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
      critical: false,
    })).toContainEqual({
      source: 'enlarge', count: 1, sides: 4, type: 'slashing',
      doubleOnCritical: true, operation: 'add',
    })
    enlarged.state.initiativeIndex = enlarged.state.initiativeOrder.indexOf('ally')
    enlarged.state.combatants.ally.turn.actionAvailable = true
    const enlargedAttack = resolveDnd5eHeadlessAction(enlarged.state, {
      type: 'attack', actorId: 'ally', targetId: 'enemy', attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5], type: 'slashing' },
      classDamageContext: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
        damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
      classDamageRolls: [{ source: 'enlarge', rolls: [4] }],
    })
    expect(enlargedAttack.ok).toBe(true)
    if (!enlargedAttack.ok) return
    expect(enlargedAttack.state.combatants.enemy.currentHp).toBe(8)

    const reducer = fighter('reducer', 30, {
      classId: 'wizard', level: 3, abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-prepared': ['enlarge-reduce'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const reduced = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('reduce', [reducer, enemy]),
      {
        type: 'cast-spell', actorId: 'reducer', targetId: 'reducer',
        spellId: 'enlarge-reduce', slotLevel: 2, enlargeReduceChoice: 'reduce',
        effectRolls: [],
      },
    )
    expect(reduced.ok).toBe(true)
    if (!reduced.ok) return
    reduced.state.combatants.reducer.turn.actionAvailable = true
    const reducedAttack = resolveDnd5eHeadlessAction(reduced.state, {
      type: 'attack', actorId: 'reducer', targetId: 'enemy', attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [1], type: 'bludgeoning' },
      classDamageContext: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 4,
        damageType: 'bludgeoning', adjacentEnemyOfTarget: false,
      },
      classDamageRolls: [{ source: 'reduce', rolls: [4] }],
    })
    expect(reducedAttack.ok).toBe(true)
    if (!reducedAttack.ok) return
    expect(reducedAttack.events).toContainEqual(expect.objectContaining({
      type: 'damage-applied', targetId: 'enemy', amount: 1,
    }))

    const hostileCaster = fighter('hostile-caster', 30, {
      classId: 'wizard', level: 3, abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-prepared': ['enlarge-reduce'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const unwilling = fighter('unwilling', 10, { controller: 'dm' })
    const saved = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('enlarge-save', [hostileCaster, unwilling]),
      {
        type: 'cast-spell', actorId: 'hostile-caster', targetId: 'unwilling',
        spellId: 'enlarge-reduce', slotLevel: 2, enlargeReduceChoice: 'enlarge',
        savingThrowD20: 20, effectRolls: [],
      },
    )
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    expect(saved.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: 'unwilling', ability: 'con', success: true,
    }))
    expect(saved.state.combatants.unwilling.classState.activeEffects).toBeUndefined()
  })

  it('casts Flame Blade once, then resolves its action attack without spending another slot', () => {
    const druid = fighter('druid', 20, {
      classId: 'druid',
      level: 7,
      abilities: { ...abilities, wis: 18 },
      classSelections: { 'spell-prepared': ['flame-blade'] },
      classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } },
    })
    const enemy = fighter('enemy', 10, {
      controller: 'dm',
      armorClass: 10,
      currentHp: 30,
      maxHp: 30,
    })
    const cast = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('flame-blade', [druid, enemy]),
      {
        type: 'cast-spell',
        actorId: 'druid',
        targetId: 'druid',
        spellId: 'flame-blade',
        slotLevel: 4,
        effectRolls: [],
      },
    )
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants.druid.turn).toMatchObject({
      actionAvailable: true,
      bonusActionAvailable: false,
    })
    expect(cast.state.combatants.druid.classResources['dnd5e-spell-slot-4']).toEqual({
      current: 0,
      max: 1,
    })
    expect(cast.state.combatants.druid.classState.activeEffects).toContainEqual(
      expect.objectContaining({
        definitionId: 'srd-5.1:spell:flame-blade',
        potency: 4,
        duration: expect.objectContaining({
          type: 'concentration',
          sourceActorId: 'druid',
          concentrationId: 'flame-blade',
        }),
      }),
    )

    const attack = resolveDnd5eHeadlessAction(cast.state, {
      type: 'cast-spell',
      actorId: 'druid',
      targetId: 'enemy',
      targetIds: ['enemy'],
      spellId: 'flame-blade',
      slotLevel: 4,
      sustainedEffectAttack: 'flame-blade',
      d20: 15,
      effectRolls: [1, 2, 3, 4],
    })
    expect(attack.ok).toBe(true)
    if (!attack.ok) return
    expect(attack.state.combatants.enemy.currentHp).toBe(20)
    expect(attack.state.combatants.druid.turn.actionAvailable).toBe(false)
    expect(attack.state.combatants.druid.classResources['dnd5e-spell-slot-4']).toEqual({
      current: 0,
      max: 1,
    })
    expect(attack.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      actorId: 'druid',
      targetId: 'enemy',
      hit: true,
    }))

    const forgedCaster = fighter('forged-druid', 20, {
      classId: 'druid',
      level: 3,
      abilities: { ...abilities, wis: 18 },
      classSelections: { 'spell-prepared': ['flame-blade'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const forged = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('forged-flame-blade', [forgedCaster, enemy]),
      {
        type: 'cast-spell',
        actorId: 'forged-druid',
        targetId: 'enemy',
        targetIds: ['enemy'],
        spellId: 'flame-blade',
        slotLevel: 2,
        sustainedEffectAttack: 'flame-blade',
        d20: 15,
        effectRolls: [6, 6, 6],
      },
    )
    expect(forged).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('binds Spiritual Weapon follow-up attacks to the authoritative effect instance', () => {
    const cleric = fighter('cleric', 20, {
      classId: 'cleric',
      level: 7,
      abilities: { ...abilities, wis: 18 },
      classSelections: { 'spell-prepared': ['spiritual-weapon'] },
      classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } },
    })
    const enemy = fighter('enemy', 10, {
      controller: 'dm',
      armorClass: 10,
      currentHp: 30,
      maxHp: 30,
    })
    const effectAreaId = 'core-spell-area:spiritual-weapon-cast'
    const cast = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('spiritual-weapon', [cleric, enemy]),
      {
        type: 'cast-spell',
        actorId: 'cleric',
        targetId: 'enemy',
        targetIds: ['enemy'],
        spellId: 'spiritual-weapon',
        slotLevel: 4,
        sustainedEffectAreaId: effectAreaId,
        d20: 15,
        effectRolls: [3, 4],
      },
    )
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants.enemy.currentHp).toBe(19)
    expect(cast.state.combatants.cleric.turn.bonusActionAvailable).toBe(false)
    expect(cast.state.combatants.cleric.classResources['dnd5e-spell-slot-4'])
      .toEqual({ current: 0, max: 1 })
    expect(cast.state.combatants.cleric.classState.activeEffects).toContainEqual(
      expect.objectContaining({
        definitionId: 'srd-5.1:spell:spiritual-weapon',
        potency: 4,
        stackingKey: effectAreaId,
        duration: expect.objectContaining({ type: 'rounds' }),
      }),
    )
    expect(cast.state.combatants.cleric.classState.concentrationSpellId).toBeUndefined()

    cast.state.combatants.cleric.turn.bonusActionAvailable = true
    const repeated = resolveDnd5eHeadlessAction(cast.state, {
      type: 'cast-spell',
      actorId: 'cleric',
      targetId: 'enemy',
      targetIds: ['enemy'],
      spellId: 'spiritual-weapon',
      slotLevel: 4,
      sustainedEffectAttack: 'spiritual-weapon',
      sustainedEffectAreaId: effectAreaId,
      d20: 15,
      effectRolls: [5, 5],
    })
    expect(repeated.ok).toBe(true)
    if (!repeated.ok) return
    expect(repeated.state.combatants.enemy.currentHp).toBe(5)
    expect(repeated.state.combatants.cleric.turn.bonusActionAvailable).toBe(false)
    expect(repeated.state.combatants.cleric.classResources['dnd5e-spell-slot-4'])
      .toEqual({ current: 0, max: 1 })

    expect(resolveDnd5eHeadlessAction(cast.state, {
      type: 'cast-spell',
      actorId: 'cleric',
      targetId: 'enemy',
      targetIds: ['enemy'],
      spellId: 'spiritual-weapon',
      slotLevel: 4,
      sustainedEffectAttack: 'spiritual-weapon',
      sustainedEffectAreaId: 'core-spell-area:forged',
      d20: 15,
      effectRolls: [8, 8],
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('creates Call Lightning concentration and reuses its original slot for later saving-throw strikes', () => {
    const druid = fighter('druid', 20, {
      classId: 'druid',
      level: 7,
      abilities: { ...abilities, wis: 18 },
      classSelections: { 'spell-prepared': ['call-lightning'] },
      classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } },
    })
    const enemyA = fighter('enemy-a', 10, {
      controller: 'dm', currentHp: 40, maxHp: 40,
    })
    const enemyB = fighter('enemy-b', 5, {
      controller: 'dm', currentHp: 40, maxHp: 40,
    })
    const cast = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('call-lightning', [druid, enemyA, enemyB]),
      {
        type: 'cast-spell',
        actorId: 'druid',
        targetId: 'enemy-a',
        targetIds: ['enemy-a', 'enemy-b'],
        spellId: 'call-lightning',
        slotLevel: 4,
        targetSavingThrows: [
          { targetId: 'enemy-a', d20: 1 },
          { targetId: 'enemy-b', d20: 20 },
        ],
        effectRolls: [1, 2, 3, 4],
      },
    )
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants['enemy-a'].currentHp).toBe(30)
    expect(cast.state.combatants['enemy-b'].currentHp).toBe(35)
    expect(cast.state.combatants.druid.classResources['dnd5e-spell-slot-4'])
      .toEqual({ current: 0, max: 1 })
    expect(cast.state.combatants.druid.classState).toMatchObject({
      concentrationSpellId: 'call-lightning',
      activeEffects: [expect.objectContaining({
        definitionId: 'srd-5.1:spell:call-lightning',
        potency: 4,
        duration: expect.objectContaining({
          type: 'concentration',
          concentrationId: 'call-lightning',
        }),
      })],
    })

    cast.state.combatants.druid.turn.actionAvailable = true
    const repeated = resolveDnd5eHeadlessAction(cast.state, {
      type: 'cast-spell',
      actorId: 'druid',
      targetId: 'enemy-a',
      targetIds: ['enemy-a'],
      spellId: 'call-lightning',
      slotLevel: 4,
      sustainedEffectAttack: 'call-lightning',
      sustainedEffectAreaId: 'core-spell-area:call-lightning',
      savingThrowD20: 1,
      effectRolls: [5, 5, 5, 5],
    })
    expect(repeated.ok).toBe(true)
    if (!repeated.ok) return
    expect(repeated.state.combatants['enemy-a'].currentHp).toBe(10)
    expect(repeated.state.combatants.druid.turn.actionAvailable).toBe(false)
    expect(repeated.state.combatants.druid.classResources['dnd5e-spell-slot-4'])
      .toEqual({ current: 0, max: 1 })
    expect(repeated.state.combatants.druid.classState.concentrationSpellId).toBe('call-lightning')
  })

  it('resolves Guiding Bolt, fixed healing, healing pools, and Power Word Stun', () => {
    const cleric = fighter('cleric', 20, {
      classId: 'cleric', level: 17, proficiencyBonus: 6, abilities: { ...abilities, wis: 20 },
      classSelections: { 'spell-prepared': ['guiding-bolt', 'heal', 'mass-heal'] },
      classResources: {
        'dnd5e-spell-slot-1': { current: 1, max: 1 },
        'dnd5e-spell-slot-6': { current: 1, max: 1 },
        'dnd5e-spell-slot-9': { current: 1, max: 1 },
      },
    })
    const enemy = fighter('enemy', 10, { controller: 'dm', currentHp: 100, maxHp: 100 })
    const bolt = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('guiding-bolt', [cleric, enemy]), {
      type: 'cast-spell', actorId: 'cleric', targetId: 'enemy', spellId: 'guiding-bolt', slotLevel: 1,
      d20: 15, effectRolls: [1, 2, 3, 4],
    })
    expect(bolt.ok).toBe(true)
    if (!bolt.ok) return
    expect(bolt.state.combatants.enemy.currentHp).toBe(90)
    expect(bolt.state.combatants.enemy.classState.activeEffects).toContainEqual(expect.objectContaining({
      definitionId: 'srd-5.1:spell:guiding-bolt:attack-advantage', breakOn: ['targeted-by-attack'],
    }))

    const patient = fighter('patient', 10, { currentHp: 1, maxHp: 200, conditions: ['blinded', 'deafened'] })
    const healed = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('heal', [cleric, patient]), {
      type: 'cast-spell', actorId: 'cleric', targetId: 'patient', spellId: 'heal', slotLevel: 6,
      effectRolls: [],
    })
    expect(healed.ok).toBe(true)
    if (!healed.ok) return
    expect(healed.state.combatants.patient).toMatchObject({ currentHp: 71, conditions: [] })

    const first = fighter('first', 10, { currentHp: 1, maxHp: 500 })
    const second = fighter('second', 5, { currentHp: 1, maxHp: 500 })
    const pooled = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('mass-heal', [cleric, first, second]), {
      type: 'cast-spell', actorId: 'cleric', targetId: 'first', targetIds: ['first', 'second'],
      spellId: 'mass-heal', slotLevel: 9,
      healingAllocations: [{ targetId: 'first', amount: 300 }, { targetId: 'second', amount: 400 }],
      effectRolls: [],
    })
    expect(pooled.ok).toBe(true)
    if (!pooled.ok) return
    expect(pooled.state.combatants.first.currentHp).toBe(301)
    expect(pooled.state.combatants.second.currentHp).toBe(401)

    const wizard = fighter('stunner', 20, {
      classId: 'wizard', level: 15, proficiencyBonus: 5, abilities: { ...abilities, int: 20 },
      classSelections: { 'spell-prepared': ['power-word-stun'] },
      classResources: { 'dnd5e-spell-slot-8': { current: 1, max: 1 } },
    })
    const stunned = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('stun', [wizard, enemy]), {
      type: 'cast-spell', actorId: 'stunner', targetId: 'enemy', spellId: 'power-word-stun', slotLevel: 8,
      effectRolls: [],
    })
    expect(stunned.ok).toBe(true)
    if (!stunned.ok) return
    expect(stunned.state.combatants.enemy.classState.activeEffects).toContainEqual(expect.objectContaining({
      standardCondition: 'stunned', repeatSave: expect.objectContaining({ ability: 'con', dc: 18 }),
    }))
  })

  it('resolves Hellish Rebuke only as an off-turn damage reaction', () => {
    const attacker = fighter('attacker', 20, { controller: 'dm', currentHp: 50, maxHp: 50, abilities: { ...abilities, dex: 8 } })
    const warlock = fighter('warlock', 10, {
      classId: 'warlock', level: 5, controller: 'player', proficiencyBonus: 3,
      abilities: { ...abilities, cha: 18 },
      classSelections: { 'spell-known': ['hellish-rebuke'] },
      classResources: { 'dnd5e-pact-slot': { current: 1, max: 2 } },
    })
    const state = startDnd5eHeadlessCombat('hellish-rebuke', [attacker, warlock])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('attacker', 'warlock')]: 30 }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'hellish-rebuke', actorId: 'warlock', targetId: 'attacker', slotLevel: 3,
      triggerDamageAmount: 8, savingThrowD20: 1, effectRolls: [10, 10, 10, 10],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.attacker.currentHp).toBe(10)
    expect(result.state.combatants.warlock).toMatchObject({
      turn: { reactionAvailable: false },
      classResources: { 'dnd5e-pact-slot': { current: 0, max: 2 } },
      classState: { leveledSpellTurnKey: 'hellish-rebuke:1:warlock' },
    })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'hellish-rebuke-resolved', actorId: 'warlock', targetId: 'attacker', damage: 40,
    }))
  })

  it('handles Banishment, Hold Monster restrictions, and Mass Healing Word targets', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard', level: 9, proficiencyBonus: 4, abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['banishment', 'hold-monster'] },
      classResources: {
        'dnd5e-spell-slot-4': { current: 1, max: 1 },
        'dnd5e-spell-slot-5': { current: 1, max: 1 },
      },
    })
    const fiend = fighter('fiend', 10, { controller: 'dm', creatureType: 'fiend' })
    const banished = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('banishment', [wizard, fiend]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'fiend', spellId: 'banishment', slotLevel: 4,
      savingThrowD20: 1, effectRolls: [],
    })
    expect(banished.ok).toBe(true)
    if (!banished.ok) return
    expect(banished.state.combatants.fiend.conditions).toContain('banished')
    expect(banished.state.combatants.wizard.classState.concentrationSpellId).toBe('banishment')

    const undead = fighter('undead', 10, { controller: 'dm', creatureType: 'undead' })
    expect(resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('hold-undead', [wizard, undead]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'undead', spellId: 'hold-monster', slotLevel: 5,
      savingThrowD20: 1, effectRolls: [],
    })).toMatchObject({ ok: false, reason: 'invalid-target' })

    const cleric = fighter('cleric', 20, {
      classId: 'cleric', level: 5, abilities: { ...abilities, wis: 18 },
      classSelections: { 'spell-prepared': ['mass-healing-word'] },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const first = fighter('first', 10, { currentHp: 1, maxHp: 30 })
    const second = fighter('second', 5, { currentHp: 2, maxHp: 30 })
    const massWord = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('mass-word', [cleric, first, second]), {
      type: 'cast-spell', actorId: 'cleric', targetId: 'first', targetIds: ['first', 'second'],
      spellId: 'mass-healing-word', slotLevel: 3, effectRolls: [4],
    })
    expect(massWord.ok).toBe(true)
    if (!massWord.ok) return
    expect(massWord.state.combatants.first.currentHp).toBe(9)
    expect(massWord.state.combatants.second.currentHp).toBe(10)
  })

  it('resolves Counterspell inside the Headless spell transaction and spends only declared resources', () => {
    const caster = fighter('caster', 20, {
      classId: 'wizard', level: 5, controller: 'player',
      abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-cantrips': ['fire-bolt'] },
    })
    const reactor = fighter('reactor', 10, {
      classId: 'wizard', level: 5, controller: 'dm',
      abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-prepared': ['counterspell'] },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const state = startDnd5eHeadlessCombat('counterspell', [caster, reactor])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('caster', 'reactor')]: 30 }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell', actorId: 'caster', targetId: 'reactor', spellId: 'fire-bolt', slotLevel: 0,
      d20: 20, effectRolls: [6, 6], counterspellReaction: { actorId: 'reactor', slotLevel: 3 },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.reactor.currentHp).toBe(20)
    expect(result.state.combatants.caster.turn.actionAvailable).toBe(false)
    expect(result.state.combatants.reactor.turn.reactionAvailable).toBe(false)
    expect(result.state.combatants.reactor.classResources['dnd5e-spell-slot-3'].current).toBe(0)
    expect(result.state.combatants.reactor.classState.leveledSpellTurnKey).toBe('counterspell:1:reactor')
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'counterspell-resolved', actorId: 'reactor', casterId: 'caster', success: true,
    }))
  })

  it('forbids reaction spells and bonus-action spells in either order during the same turn', () => {
    const sorcerer = fighter('sorcerer', 20, {
      classId: 'sorcerer', level: 5, abilities: { ...abilities, cha: 18 },
      classSelections: { 'spell-cantrips': ['fire-bolt'], 'spell-known': ['shield'], metamagic: ['quickened'] },
      classResources: {
        'dnd5e-spell-slot-1': { current: 1, max: 1 },
        'dnd5e-sorcery-points': { current: 4, max: 5 },
      },
    })
    const enemy = fighter('enemy', 10, { controller: 'dm', armorClass: 10 })
    const quickenedAction = {
      type: 'cast-spell' as const, actorId: 'sorcerer', targetId: 'enemy', spellId: 'fire-bolt', slotLevel: 0,
      metamagic: { kind: 'quickened' as const }, d20: 15, d20Second: 15, effectRolls: [4, 4],
    }
    const opportunityAttack = {
      type: 'opportunity-attack' as const, actorId: 'enemy', targetId: 'sorcerer', attackModifier: 5,
      d20: 15, shieldSpellReaction: true,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [2] },
    }

    const afterQuickened = startDnd5eHeadlessCombat('bonus-then-reaction', [sorcerer, enemy])
    afterQuickened.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('sorcerer', 'enemy')]: 5 }
    const quickened = resolveDnd5eHeadlessAction(afterQuickened, quickenedAction)
    expect(quickened.ok).toBe(true)
    if (!quickened.ok) return
    expect(resolveDnd5eHeadlessAction(quickened.state, opportunityAttack)).toMatchObject({
      ok: false, reason: 'invalid-class-feature',
    })

    const beforeQuickened = startDnd5eHeadlessCombat('reaction-then-bonus', [sorcerer, enemy])
    beforeQuickened.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('sorcerer', 'enemy')]: 5 }
    const shielded = resolveDnd5eHeadlessAction(beforeQuickened, opportunityAttack)
    expect(shielded.ok).toBe(true)
    if (!shielded.ok) return
    expect(shielded.state.combatants.sorcerer.classState.leveledSpellTurnKey).toBe('reaction-then-bonus:1:sorcerer')
    expect(resolveDnd5eHeadlessAction(shielded.state, quickenedAction)).toMatchObject({
      ok: false, reason: 'invalid-class-feature',
    })
  })

  it('applies Faerie Fire to failed targets and suppresses every invisibility benefit', () => {
    const bard = fighter('bard', 20, {
      classId: 'bard', level: 5, proficiencyBonus: 3, abilities: { ...abilities, cha: 18 },
      classSelections: { 'spell-known': ['faerie-fire'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const failed = fighter('failed', 10, { controller: 'dm', conditions: ['invisible'], abilities: { ...abilities, dex: 8 } })
    const passed = fighter('passed', 5, { controller: 'dm', abilities: { ...abilities, dex: 18 } })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('faerie-fire', [bard, failed, passed]), {
      type: 'cast-spell', actorId: 'bard', targetId: 'failed', targetIds: ['failed', 'passed'],
      spellId: 'faerie-fire', slotLevel: 1, effectRolls: [],
      targetSavingThrows: [{ targetId: 'failed', d20: 1 }, { targetId: 'passed', d20: 20 }],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const outlined = result.state.combatants.failed
    expect(outlined.classState.activeEffects).toContainEqual(expect.objectContaining({
      definitionId: 'srd-5.1:spell:faerie-fire',
      duration: expect.objectContaining({ type: 'concentration', sourceActorId: 'bard' }),
    }))
    expect(result.state.combatants.passed.classState.activeEffects).toBeUndefined()
    expect(dnd5eTargetGrantsAttackAdvantage(outlined)).toBe(true)
    expect(dnd5eAttackerIsUnseen(outlined)).toBe(false)
    expect(dnd5eUnseenTargetImposesDisadvantage(bard, outlined)).toBe(false)
  })

  it('expires Chill Touch healing prevention at the caster next turn start and its undead rider at turn end', () => {
    const warlock = fighter('warlock', 20, {
      classId: 'warlock', level: 1, controller: 'player', abilities: { ...abilities, cha: 18 },
      classSelections: { 'spell-cantrips': ['chill-touch'] },
    })
    const target = fighter('target', 15, { controller: 'dm', armorClass: 10, currentHp: 12, maxHp: 30 })
    const cleric = fighter('cleric', 10, {
      classId: 'cleric', level: 1, controller: 'dm', abilities: { ...abilities, wis: 18 },
      classSelections: { 'spell-prepared': ['cure-wounds'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const state = startDnd5eHeadlessCombat('chill-healing', [warlock, target, cleric])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('warlock', 'target')]: 30,
      [dnd5eCombatantPairKey('target', 'cleric')]: 5,
    }
    const chilled = resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell', actorId: 'warlock', targetId: 'target', spellId: 'chill-touch', slotLevel: 0,
      d20: 15, effectRolls: [4],
    })
    expect(chilled.ok).toBe(true)
    if (!chilled.ok) return
    expect(chilled.state.combatants.target.classState.activeEffects).toContainEqual(expect.objectContaining({
      definitionId: 'srd-5.1:spell:chill-touch:no-healing',
      duration: expect.objectContaining({ type: 'until-turn-boundary', boundary: 'source-turn-start' }),
    }))
    const targetTurn = resolveDnd5eHeadlessAction(chilled.state, { type: 'end-turn', actorId: 'warlock' })
    expect(targetTurn.ok).toBe(true)
    if (!targetTurn.ok) return
    const clericTurn = resolveDnd5eHeadlessAction(targetTurn.state, { type: 'end-turn', actorId: 'target' })
    expect(clericTurn.ok).toBe(true)
    if (!clericTurn.ok) return
    const hpBeforeHealing = clericTurn.state.combatants.target.currentHp
    const healing = resolveDnd5eHeadlessAction(clericTurn.state, {
      type: 'cast-spell', actorId: 'cleric', targetId: 'target', spellId: 'cure-wounds', slotLevel: 1,
      effectRolls: [8],
    })
    expect(healing.ok).toBe(true)
    if (!healing.ok) return
    expect(healing.state.combatants.target.currentHp).toBe(hpBeforeHealing)
    expect(healing.events).toContainEqual(expect.objectContaining({
      type: 'healing-applied', targetId: 'target', amount: 0,
    }))
    const nextWarlockTurn = resolveDnd5eHeadlessAction(healing.state, { type: 'end-turn', actorId: 'cleric' })
    expect(nextWarlockTurn.ok).toBe(true)
    if (!nextWarlockTurn.ok) return
    expect(nextWarlockTurn.state.combatants.target.classState.activeEffects ?? []).not.toContainEqual(expect.objectContaining({
      definitionId: 'srd-5.1:spell:chill-touch:no-healing',
    }))

    const undead = fighter('undead', 10, { controller: 'dm', creatureType: 'undead', armorClass: 10 })
    const undeadState = startDnd5eHeadlessCombat('chill-undead', [warlock, undead])
    undeadState.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('warlock', 'undead')]: 30 }
    const chilledUndead = resolveDnd5eHeadlessAction(undeadState, {
      type: 'cast-spell', actorId: 'warlock', targetId: 'undead', spellId: 'chill-touch', slotLevel: 0,
      d20: 15, effectRolls: [4],
    })
    expect(chilledUndead.ok).toBe(true)
    if (!chilledUndead.ok) return
    const undeadTurn = resolveDnd5eHeadlessAction(chilledUndead.state, { type: 'end-turn', actorId: 'warlock' })
    expect(undeadTurn.ok).toBe(true)
    if (!undeadTurn.ok) return
    const attack = resolveDnd5eHeadlessAction(undeadTurn.state, {
      type: 'attack', actorId: 'undead', targetId: 'warlock', attackModifier: 5,
      d20: 20, d20Second: 1,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [4] },
    })
    expect(attack.ok).toBe(true)
    if (!attack.ok) return
    expect(attack.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: 'undead', targetId: 'warlock', d20: 1, hit: false,
    }))
    const nextWarlockTurnAgainstUndead = resolveDnd5eHeadlessAction(attack.state, { type: 'end-turn', actorId: 'undead' })
    expect(nextWarlockTurnAgainstUndead.ok).toBe(true)
    if (!nextWarlockTurnAgainstUndead.ok) return
    expect(nextWarlockTurnAgainstUndead.state.combatants.undead.classState.activeEffects).toContainEqual(expect.objectContaining({
      definitionId: 'srd-5.1:spell:chill-touch:undead-disadvantage',
      duration: expect.objectContaining({ type: 'until-turn-boundary', boundary: 'source-turn-end' }),
    }))
    const undeadTurnAfterExpiry = resolveDnd5eHeadlessAction(nextWarlockTurnAgainstUndead.state, { type: 'end-turn', actorId: 'warlock' })
    expect(undeadTurnAfterExpiry.ok).toBe(true)
    if (!undeadTurnAfterExpiry.ok) return
    expect(undeadTurnAfterExpiry.state.combatants.undead.classState.activeEffects ?? []).not.toContainEqual(expect.objectContaining({
      definitionId: 'srd-5.1:spell:chill-touch:undead-disadvantage',
    }))
  })

  it('ends normal Invisibility on a hostile spell but preserves Greater Invisibility', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard', level: 7, proficiencyBonus: 3, abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-cantrips': ['fire-bolt'], 'spell-prepared': ['invisibility', 'greater-invisibility'] },
      classResources: {
        'dnd5e-spell-slot-2': { current: 1, max: 1 },
        'dnd5e-spell-slot-4': { current: 1, max: 1 },
      },
    })
    const enemy = fighter('enemy', 10, { controller: 'dm', currentHp: 50, maxHp: 50 })
    const invisible = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('invisibility', [wizard, enemy]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'wizard', spellId: 'invisibility', slotLevel: 2,
      effectRolls: [],
    })
    expect(invisible.ok).toBe(true)
    if (!invisible.ok) return
    invisible.state.combatants.wizard.turn.actionAvailable = true
    const revealed = resolveDnd5eHeadlessAction(invisible.state, {
      type: 'cast-spell', actorId: 'wizard', targetId: 'enemy', spellId: 'fire-bolt', slotLevel: 0,
      d20: 15, d20Second: 14, effectRolls: [5, 5],
    })
    expect(revealed.ok ? 'ok' : revealed.reason).toBe('ok')
    if (!revealed.ok) return
    expect(revealed.state.combatants.wizard.conditions).not.toContain('invisible')
    expect(revealed.state.combatants.wizard.concentrating).toBe(false)

    const greater = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('greater-invisibility', [wizard, enemy]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'wizard', spellId: 'greater-invisibility', slotLevel: 4,
      effectRolls: [],
    })
    expect(greater.ok).toBe(true)
    if (!greater.ok) return
    greater.state.combatants.wizard.turn.actionAvailable = true
    const stillHidden = resolveDnd5eHeadlessAction(greater.state, {
      type: 'cast-spell', actorId: 'wizard', targetId: 'enemy', spellId: 'fire-bolt', slotLevel: 0,
      d20: 15, d20Second: 14, effectRolls: [5, 5],
    })
    expect(stillHidden.ok).toBe(true)
    if (!stillHidden.ok) return
    expect(stillHidden.state.combatants.wizard.conditions).toContain('invisible')
    expect(stillHidden.state.combatants.wizard.concentrating).toBe(true)
  })

  it('enforces Barkskin AC and Protection from Poison through ActiveEffect state', () => {
    const druid = fighter('druid', 20, {
      classId: 'druid', level: 5, abilities: { ...abilities, wis: 18 },
      classSelections: { 'spell-prepared': ['barkskin', 'protection-from-poison'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 2, max: 2 } },
    })
    const ally = fighter('ally', 10, { armorClass: 11, conditions: ['poisoned'] })
    const poisoner = fighter('poisoner', 5, {
      controller: 'dm', classId: 'druid', level: 1, abilities: { ...abilities, wis: 20 },
      classSelections: { 'spell-cantrips': ['poison-spray'] },
    })
    const barkskin = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('barkskin', [druid, ally]), {
      type: 'cast-spell', actorId: 'druid', targetId: 'ally', spellId: 'barkskin', slotLevel: 2,
      effectRolls: [],
    })
    expect(barkskin.ok).toBe(true)
    if (!barkskin.ok) return
    expect(dnd5eTargetArmorClassForAttack(barkskin.state, 'druid', 'ally')).toBe(16)

    const poisonProtection = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('poison-protection', [druid, ally, poisoner]), {
      type: 'cast-spell', actorId: 'druid', targetId: 'ally', spellId: 'protection-from-poison', slotLevel: 2,
      effectRolls: [],
    })
    expect(poisonProtection.ok).toBe(true)
    if (!poisonProtection.ok) return
    const protectedAlly = poisonProtection.state.combatants.ally
    expect(protectedAlly.conditions).not.toContain('poisoned')
    expect(protectedAlly.classState.activeEffects).toContainEqual(expect.objectContaining({
      definitionId: 'srd-5.1:spell:protection-from-poison',
    }))
    expect(dnd5eSavingThrowMode(protectedAlly, 'con', { condition: 'poisoned' })).toBe('advantage')
    poisonProtection.state.initiativeIndex = poisonProtection.state.initiativeOrder.indexOf('poisoner')
    const poisoned = resolveDnd5eHeadlessAction(poisonProtection.state, {
      type: 'cast-spell', actorId: 'poisoner', targetId: 'ally', spellId: 'poison-spray', slotLevel: 0,
      savingThrowD20: 1, effectRolls: [12],
    })
    expect(poisoned.ok ? 'ok' : poisoned.reason).toBe('ok')
    if (!poisoned.ok) return
    expect(poisoned.state.combatants.ally.currentHp).toBe(14)
  })

  it('lets Death Ward prevent both lethal damage and a damage-free instant death', () => {
    const cleric = fighter('cleric', 20, {
      classId: 'cleric', level: 17, proficiencyBonus: 6, abilities: { ...abilities, wis: 20 },
      classSelections: { 'spell-prepared': ['death-ward'] },
      classResources: { 'dnd5e-spell-slot-4': { current: 2, max: 2 } },
    })
    const warded = fighter('warded', 10, { currentHp: 5, maxHp: 30 })
    const attacker = fighter('attacker', 5, {
      controller: 'dm', classId: 'wizard', level: 17, proficiencyBonus: 6,
      abilities: { ...abilities, int: 20 },
      classSelections: { 'spell-cantrips': ['fire-bolt'], 'spell-prepared': ['power-word-kill'] },
      classResources: { 'dnd5e-spell-slot-9': { current: 1, max: 1 } },
    })
    const applied = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('death-ward-damage', [cleric, warded, attacker]), {
      type: 'cast-spell', actorId: 'cleric', targetId: 'warded', spellId: 'death-ward', slotLevel: 4,
      effectRolls: [],
    })
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    applied.state.initiativeIndex = applied.state.initiativeOrder.indexOf('attacker')
    const damaged = resolveDnd5eHeadlessAction(applied.state, {
      type: 'cast-spell', actorId: 'attacker', targetId: 'warded', spellId: 'fire-bolt', slotLevel: 0,
      d20: 15, effectRolls: [10, 10, 10, 10],
    })
    expect(damaged.ok ? 'ok' : damaged.reason).toBe('ok')
    if (!damaged.ok) return
    expect(damaged.state.combatants.warded.currentHp).toBe(1)
    expect(damaged.events).toContainEqual({ type: 'death-ward-triggered', targetId: 'warded', trigger: 'damage' })

    const appliedAgain = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('death-ward-kill', [cleric, warded, attacker]), {
      type: 'cast-spell', actorId: 'cleric', targetId: 'warded', spellId: 'death-ward', slotLevel: 4,
      effectRolls: [],
    })
    expect(appliedAgain.ok).toBe(true)
    if (!appliedAgain.ok) return
    appliedAgain.state.initiativeIndex = appliedAgain.state.initiativeOrder.indexOf('attacker')
    const killed = resolveDnd5eHeadlessAction(appliedAgain.state, {
      type: 'cast-spell', actorId: 'attacker', targetId: 'warded', spellId: 'power-word-kill', slotLevel: 9,
      effectRolls: [],
    })
    expect(killed.ok).toBe(true)
    if (!killed.ok) return
    expect(killed.state.combatants.warded.currentHp).toBe(5)
    expect(killed.state.combatants.warded.deathSaves.dead).toBe(false)
    expect(killed.events).toContainEqual({ type: 'death-ward-triggered', targetId: 'warded', trigger: 'instant-death' })
  })

  it('lets a failed spell save consume Legendary Resistance before damage and conditions', () => {
    const caster = fighter('cleric', 20, {
      classId: 'cleric', level: 5, controller: 'player',
      abilities: { ...abilities, wis: 18 },
      classSelections: { 'spell-cantrips': ['sacred-flame'] },
    })
    const legendary = fighter('legendary', 10, {
      controller: 'dm', abilities: { ...abilities, dex: 8 },
      classState: { legendaryResistanceUses: 1 },
    })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('legendary-resistance', [caster, legendary]), {
      type: 'cast-spell', actorId: 'cleric', targetId: 'legendary', spellId: 'sacred-flame', slotLevel: 0,
      savingThrowD20: 1, effectRolls: [], legendaryResistanceTargetIds: ['legendary'],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.legendary.currentHp).toBe(20)
    expect(result.state.combatants.legendary.classState.legendaryResistanceUses).toBe(0)
    expect(result.events).toContainEqual({ type: 'legendary-resistance-used', targetId: 'legendary', remainingUses: 0 })
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'saving-throw-resolved', success: true }))
  })

  it('spends movement independently from the action and supports Dash', () => {
    const state = startDnd5eHeadlessCombat('combat', [fighter('a', 20), fighter('b', 10)])
    const moved = resolveDnd5eHeadlessAction(state, { type: 'move', actorId: 'a', to: { x: 20, y: 0 }, distance: 20 })
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    expect(moved.state.combatants.a.turn).toMatchObject({ actionAvailable: true, movementRemaining: 10 })
    const dashed = resolveDnd5eHeadlessAction(moved.state, { type: 'dash', actorId: 'a' })
    expect(dashed.ok).toBe(true)
    if (!dashed.ok) return
    expect(dashed.state.combatants.a.turn).toMatchObject({ actionAvailable: false, movementRemaining: 40 })
    expect(dashed.events).toContainEqual({ type: 'movement-granted', actorId: 'a', amount: 30 })
  })

  it('settles the free object interaction and action fallback in Headless economy', () => {
    const state = startDnd5eHeadlessCombat('object-interaction', [fighter('a', 20), fighter('b', 10)])
    const opened = resolveDnd5eHeadlessAction(state, {
      type: 'interact-object', actorId: 'a', interactionId: 'open:door-1',
    })
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.state.combatants.a.turn).toMatchObject({
      actionAvailable: true, objectInteractionAvailable: false,
    })
    expect(resolveDnd5eHeadlessAction(opened.state, {
      type: 'interact-object', actorId: 'a', interactionId: 'close:door-1',
    })).toMatchObject({ ok: false, reason: 'object-interaction-unavailable' })
    const fallback = resolveDnd5eHeadlessAction(opened.state, {
      type: 'interact-object', actorId: 'a', interactionId: 'close:door-1', useAction: true,
    })
    expect(fallback.ok).toBe(true)
    if (!fallback.ok) return
    expect(fallback.state.combatants.a.turn.actionAvailable).toBe(false)
  })

  it('emits one observational result for each root Headless transaction', () => {
    const observations: unknown[] = []
    const stop = setDnd5eHeadlessResolutionObserver((observation) => observations.push(observation))
    try {
      const state = startDnd5eHeadlessCombat('observed', [fighter('a', 20), fighter('b', 10)])
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'move', actorId: 'a', to: { x: 5, y: 0 }, distance: 5,
      })
      expect(result.ok).toBe(true)
    } finally {
      stop()
    }
    expect(observations).toHaveLength(1)
    expect(observations[0]).toMatchObject({
      action: { type: 'move', actorId: 'a' },
      result: { ok: true, events: expect.arrayContaining([expect.objectContaining({ type: 'moved' })]) },
    })
  })

  it('resolves Lore Bard Peerless Skill as an authoritative ability-check resource spend', () => {
    const bard = fighter('bard', 20, {
      classId: 'bard', subclassId: 'lore', level: 14, proficiencyBonus: 5,
      abilities: { ...abilities, cha: 18 },
      skillProficiencies: ['performance'],
      classSelections: { expertise: ['performance'] },
      classResources: { 'dnd5e-bardic-inspiration': { current: 2, max: 4 } },
    })
    const state = startDnd5eHeadlessCombat('peerless-skill', [bard, fighter('enemy', 10)])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'ability-check', actorId: 'bard', ability: 'cha', skill: 'performance',
      d20: 2, dc: 20, peerlessSkillRoll: 6,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.bard.classResources['dnd5e-bardic-inspiration']).toEqual({ current: 1, max: 4 })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', total: 22, success: true, peerlessSkillApplied: 6,
    }))
  })

  it('allows an opposing Lore Bard to reduce an ability check with Cutting Words', () => {
    const checker = fighter('checker', 20, { controller: 'dm', abilities: { ...abilities, int: 14 } })
    const bard = fighter('bard', 10, {
      classId: 'bard', subclassId: 'lore', level: 5,
      classResources: { 'dnd5e-bardic-inspiration': { current: 2, max: 3 } },
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('cutting-check', [checker, bard]),
      {
        type: 'ability-check', actorId: 'checker', ability: 'int', d20: 13, dc: 15,
        cuttingWords: { bardId: 'bard', roll: 4, distanceFeet: 30 },
      },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', total: 11, success: false, cuttingWordsApplied: 4,
    }))
    expect(result.state.combatants.bard.turn.reactionAvailable).toBe(false)
    expect(result.state.combatants.bard.classResources['dnd5e-bardic-inspiration'].current).toBe(1)
  })

  it("supports Dark One's Own Luck and Stroke of Luck on generic ability checks", () => {
    const warlock = fighter('warlock', 20, {
      classId: 'warlock', subclassId: 'fiend', level: 6,
      classResources: { 'dnd5e-dark-ones-own-luck': { current: 1, max: 1 } },
    })
    let result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('check-luck', [warlock, fighter('enemy', 10)]),
      { type: 'ability-check', actorId: 'warlock', ability: 'int', d20: 5, dc: 12, darkOnesOwnLuckRoll: 7 },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', total: 12, success: true, darkOnesOwnLuckApplied: 7,
    }))
    expect(result.state.combatants.warlock.classResources['dnd5e-dark-ones-own-luck'].current).toBe(0)

    const rogue = fighter('rogue', 20, {
      classId: 'rogue', subclassId: 'thief', level: 20, proficiencyBonus: 6,
      classResources: { 'dnd5e-stroke-of-luck': { current: 1, max: 1 } },
    })
    result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('stroke-check', [rogue, fighter('enemy', 10)]),
      { type: 'ability-check', actorId: 'rogue', ability: 'wis', d20: 1, dc: 15, strokeOfLuck: true },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', d20: 20, total: 21, success: true, strokeOfLuckApplied: true,
    }))
    expect(result.state.combatants.rogue.classResources['dnd5e-stroke-of-luck'].current).toBe(0)
  })

  it('applies Jack of All Trades, Reliable Talent, and Indomitable Might to generic checks', () => {
    const bard = fighter('bard', 20, { classId: 'bard', level: 5, proficiencyBonus: 3 })
    let result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('jack-check', [bard, fighter('enemy', 10)]),
      { type: 'ability-check', actorId: 'bard', ability: 'wis', d20: 10 },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'ability-check-resolved', total: 12 }))

    const rogue = fighter('rogue', 20, {
      classId: 'rogue', level: 11, proficiencyBonus: 4,
      skillProficiencies: ['stealth'], classSelections: { expertise: ['stealth'] },
    })
    result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('reliable-check', [rogue, fighter('enemy', 10)]),
      { type: 'ability-check', actorId: 'rogue', ability: 'dex', skill: 'stealth', d20: 2 },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', d20: 10, total: 20, reliableTalentApplied: true,
    }))

    const barbarian = fighter('barbarian', 20, {
      classId: 'barbarian', level: 18, abilities: { ...abilities, str: 20 },
    })
    result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('might-check', [barbarian, fighter('enemy', 10)]),
      { type: 'ability-check', actorId: 'barbarian', ability: 'str', d20: 1 },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', total: 20, indomitableMightApplied: true,
    }))
  })

  it('grants a raging Barbarian advantage on Strength ability checks', () => {
    const barbarian = fighter('barbarian', 20, {
      classId: 'barbarian', level: 5, classState: { raging: true },
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('rage-strength-check', [barbarian, fighter('enemy', 10)]),
      { type: 'ability-check', actorId: 'barbarian', ability: 'str', d20: 4, d20Second: 17 },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', d20: 17, mode: 'advantage', total: 20,
    }))
  })

  it('uses an action for an attack and SRD critical damage dice', () => {
    const state = startDnd5eHeadlessCombat('combat', [fighter('a', 20), fighter('b', 10)])
    const result = resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 5, d20: 20, damage: { count: 1, sides: 8, bonus: 3, rolls: [6, 4] } })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.a.turn.actionAvailable).toBe(false)
    expect(result.state.combatants.b.currentHp).toBe(7)
  })

  it('records effective hostile damage as monster threat for later target selection', () => {
    const hero = fighter('hero', 20)
    const monster = fighter('monster', 10, {
      controller: 'dm', statBlockId: 'srd-5.1:goblin', armorClass: 10,
      currentHp: 20, maxHp: 20, temporaryHp: 2,
    })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('threat', [hero, monster]), {
      type: 'attack', actorId: hero.id, targetId: monster.id,
      attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[monster.id].classState.monsterThreatByTargetId).toEqual({ hero: 8 })
  })

  it('authoritatively reduces a ranged weapon hit with Deflect Missiles and spends the Monk reaction', () => {
    const attacker = fighter('enemy', 20, { controller: 'dm' })
    const monk = fighter('monk', 10, {
      classId: 'monk', level: 5,
      classResources: { 'dnd5e-ki': { current: 2, max: 5 } },
    })
    const state = startDnd5eHeadlessCombat('deflect-missiles', [attacker, monk])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'enemy', targetId: 'monk', attackModifier: 10, d20: 10,
      deflectMissilesD10: 6,
      classDamageContext: {
        mode: 'ranged', finesse: false, strengthBased: false, weaponDamageSides: 8,
        damageType: 'piercing', adjacentEnemyOfTarget: false,
      },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [8], type: 'piercing' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.monk.currentHp).toBe(20)
    expect(result.state.combatants.monk.turn.reactionAvailable).toBe(false)
    expect(result.state.combatants.monk.classState).toMatchObject({
      deflectMissilesCatchSourceId: 'enemy',
      deflectMissilesCatchTurnKey: 'deflect-missiles:1:enemy',
      deflectMissilesCatchDamageType: 'piercing',
    })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'damage-reduced', source: 'deflect-missiles', damageBefore: 11, damageAfter: 0, caught: true,
    }))

    const returned = resolveDnd5eHeadlessAction(result.state, {
      type: 'monk-deflect-missiles-return', actorId: 'monk', targetId: 'enemy', distanceFeet: 20,
      d20: 20, damageRolls: [4, 3],
    })
    expect(returned.ok).toBe(true)
    if (!returned.ok) return
    expect(returned.state.combatants.monk.classResources['dnd5e-ki']).toEqual({ current: 1, max: 5 })
    expect(returned.state.combatants.monk.classState.deflectMissilesCatchSourceId).toBeUndefined()
    expect(returned.state.combatants.enemy.currentHp).toBe(11)
    expect(returned.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: 'monk', targetId: 'enemy', hit: true, critical: true,
    }))
  })

  it('rejects Deflect Missiles for melee attacks and long-range return throws', () => {
    const attacker = fighter('enemy', 20, { controller: 'dm' })
    const monk = fighter('monk', 10, {
      classId: 'monk', level: 5,
      classResources: { 'dnd5e-ki': { current: 2, max: 5 } },
    })
    const state = startDnd5eHeadlessCombat('invalid-deflect', [attacker, monk])
    const melee = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'enemy', targetId: 'monk', attackModifier: 10, d20: 10,
      deflectMissilesD10: 6,
      classDamageContext: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
        damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [8], type: 'slashing' },
    })
    expect(melee).toMatchObject({ ok: false, reason: 'invalid-class-feature' })

    const caughtState = startDnd5eHeadlessCombat('invalid-return', [attacker, monk])
    caughtState.combatants.monk.classState.deflectMissilesCatchSourceId = 'enemy'
    caughtState.combatants.monk.classState.deflectMissilesCatchTurnKey = 'invalid-return:1:enemy'
    caughtState.combatants.monk.classState.deflectMissilesCatchDamageType = 'piercing'
    expect(resolveDnd5eHeadlessAction(caughtState, {
      type: 'monk-deflect-missiles-return', actorId: 'monk', targetId: 'enemy', distanceFeet: 65,
      d20: 20, damageRolls: [4, 3],
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('uses turn-slot identity for once-per-turn features on a Thief Reflexes turn', () => {
    const rogue = fighter('rogue', 20, { classId: 'rogue', subclassId: 'thief', level: 17 })
    const state = startDnd5eHeadlessCombat('reflexes', [rogue, fighter('enemy', 10)])
    state.turnSlotId = 'rogue:normal'
    state.combatants.rogue.classState.sneakAttackTurnKey = 'reflexes:1:rogue:normal'
    const context = {
      mode: 'ranged' as const, finesse: false, strengthBased: false, monkMartialArtsEligible: false,
      weaponDamageSides: 8, damageType: 'piercing' as const, adjacentEnemyOfTarget: true,
    }
    expect(dnd5eWeaponClassDamageDefinitions({
      state, actorId: 'rogue', targetId: 'enemy', context, effectiveMode: 'normal', critical: false,
    }).some((definition) => definition.source === 'sneak-attack')).toBe(false)
    state.turnSlotId = 'rogue:thief-reflexes'
    expect(dnd5eWeaponClassDamageDefinitions({
      state, actorId: 'rogue', targetId: 'enemy', context, effectiveMode: 'normal', critical: false,
    }).some((definition) => definition.source === 'sneak-attack')).toBe(true)
  })

  it('only turns a Champion natural 19 into a critical when the attack also hits', () => {
    const missed = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('champion-miss', [fighter('a', 20), fighter('b', 10, { armorClass: 30 })]),
      { type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 0, criticalThreshold: 19, d20: 19, damage: { count: 1, sides: 8, bonus: 0, rolls: [] } },
    )
    expect(missed.ok).toBe(true)
    if (!missed.ok) return
    expect(missed.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', hit: false, critical: false }))
    expect(missed.state.combatants.b.currentHp).toBe(20)

    const hit = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('champion-hit', [fighter('a', 20), fighter('b', 10, { armorClass: 19 })]),
      { type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 0, criticalThreshold: 19, d20: 19, damage: { count: 1, sides: 8, bonus: 0, rolls: [4, 5] } },
    )
    expect(hit.ok).toBe(true)
    if (!hit.ok) return
    expect(hit.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', hit: true, critical: true }))
    expect(hit.state.combatants.b.currentHp).toBe(11)
  })

  it('applies invisibility to both sides of attack visibility', () => {
    const invisibleAttacker = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('invisible-attacker', [
        fighter('a', 20, { conditions: ['invisible'] }), fighter('b', 10),
      ]),
      { type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 0, d20: 2, d20Second: 18, damage: { count: 1, sides: 4, bonus: 0, rolls: [2] } },
    )
    expect(invisibleAttacker.ok).toBe(true)
    if (!invisibleAttacker.ok) return
    expect(invisibleAttacker.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 18, hit: true }))

    const invisibleTarget = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('invisible-target', [
        fighter('a', 20), fighter('b', 10, { conditions: ['invisible'] }),
      ]),
      { type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 0, d20: 18, d20Second: 2, damage: { count: 1, sides: 4, bonus: 0, rolls: [] } },
    )
    expect(invisibleTarget.ok).toBe(true)
    if (!invisibleTarget.ok) return
    expect(invisibleTarget.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 2, hit: false }))
  })

  it('uses directional map visibility for unseen attacker advantage', () => {
    const state = startDnd5eHeadlessCombat('directional-visibility', [fighter('a', 20), fighter('b', 10)])
    state.lineOfSightBlockedByCombatantPair = {
      [dnd5eDirectedCombatantPairKey('b', 'a')]: true,
    }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 0,
      d20: 2, d20Second: 18,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [2] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 18, hit: true }))
  })

  it('cancels unseen attacker advantage when neither side can see the other', () => {
    const state = startDnd5eHeadlessCombat('mutual-darkness', [fighter('a', 20), fighter('b', 10)])
    state.lineOfSightBlockedByCombatantPair = {
      [dnd5eDirectedCombatantPairKey('a', 'b')]: true,
      [dnd5eDirectedCombatantPairKey('b', 'a')]: true,
    }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 0,
      d20: 2, d20Second: 18,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 2, hit: false }))
  })

  it('removes attack advantage against a conscious level-18 Rogue with Elusive', () => {
    const rogue = fighter('b', 10, { classId: 'rogue', level: 18 })
    const state = startDnd5eHeadlessCombat('combat', [fighter('a', 20), rogue])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 5,
      mode: 'advantage', d20: 2, d20Second: 18,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 2, hit: false }))
    expect(result.state.combatants.b.currentHp).toBe(20)
  })

  it('Dodge imposes disadvantage and opportunity attacks spend reactions', () => {
    const state = startDnd5eHeadlessCombat('combat', [fighter('b', 20), fighter('a', 10)])
    const dodged = resolveDnd5eHeadlessAction(state, { type: 'dodge', actorId: 'b' })
    expect(dodged.ok).toBe(true)
    if (!dodged.ok) return
    const ended = resolveDnd5eHeadlessAction(dodged.state, { type: 'end-turn', actorId: 'b' })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    const attack = resolveDnd5eHeadlessAction(ended.state, { type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 5, d20: 18, d20Second: 2, damage: { count: 1, sides: 8, bonus: 3, rolls: [5] } })
    expect(attack.ok).toBe(true)
    if (!attack.ok) return
    expect(attack.state.combatants.b.currentHp).toBe(20)
    const reaction = resolveDnd5eHeadlessAction(attack.state, { type: 'opportunity-attack', actorId: 'b', targetId: 'a', attackModifier: 5, d20: 15, damage: { count: 1, sides: 8, bonus: 3, rolls: [5] } })
    expect(reaction.ok).toBe(true)
    if (!reaction.ok) return
    expect(reaction.state.combatants.b.turn.reactionAvailable).toBe(false)
  })

  it('expires the persisted Dodge marker when the dodging creature starts its next turn', () => {
    const state = startDnd5eHeadlessCombat('dodge-expiry', [
      fighter('b', 20), fighter('a', 10, { controller: 'dm' }),
    ])
    const dodged = resolveDnd5eHeadlessAction(state, { type: 'dodge', actorId: 'b' })
    expect(dodged.ok).toBe(true)
    if (!dodged.ok) return
    expect(dodged.state.combatants.b.classState.dodgingTurnKey).toBe('dodge-expiry:1:b')

    const firstEnd = resolveDnd5eHeadlessAction(dodged.state, { type: 'end-turn', actorId: 'b' })
    expect(firstEnd.ok).toBe(true)
    if (!firstEnd.ok) return
    expect(firstEnd.state.combatants.b.classState.dodgingTurnKey).toBe('dodge-expiry:1:b')

    const secondEnd = resolveDnd5eHeadlessAction(firstEnd.state, { type: 'end-turn', actorId: 'a' })
    expect(secondEnd.ok).toBe(true)
    if (!secondEnd.ok) return
    expect(secondEnd.state.initiativeOrder[secondEnd.state.initiativeIndex]).toBe('b')
    expect(secondEnd.state.combatants.b.classState.dodgingTurnKey).toBeUndefined()
    expect(secondEnd.state.combatants.b.dodging).toBe(false)
  })

  it('resolves Dash, Hide, Ready, and Use an Object as authoritative basic actions', () => {
    const hiddenState = startDnd5eHeadlessCombat('basic-hide', [fighter('a', 20), fighter('b', 10, { controller: 'dm' })])
    hiddenState.lineOfSightBlockedByCombatantPair = {
      [dnd5eDirectedCombatantPairKey('b', 'a')]: true,
    }
    const hidden = resolveDnd5eHeadlessAction(hiddenState, { type: 'hide', actorId: 'a', d20: 15 })
    expect(hidden.ok).toBe(true)
    if (!hidden.ok) return
    expect(hidden.state.combatants.a.classState.hiddenCheckTotal).toBe(17)

    const noticedState = startDnd5eHeadlessCombat('basic-hide-failed', [
      fighter('a', 20),
      fighter('b', 10, { controller: 'dm', passivePerception: 15 }),
    ])
    noticedState.lineOfSightBlockedByCombatantPair = {
      [dnd5eDirectedCombatantPairKey('b', 'a')]: true,
    }
    const noticed = resolveDnd5eHeadlessAction(noticedState, { type: 'hide', actorId: 'a', d20: 1 })
    expect(noticed.ok).toBe(true)
    if (!noticed.ok) return
    expect(noticed.state.combatants.a.classState.hiddenCheckTotal).toBeUndefined()
    expect(noticed.state.combatants.a.turn.actionAvailable).toBe(false)

    const readyState = startDnd5eHeadlessCombat('basic-ready', [fighter('a', 20), fighter('b', 10, { controller: 'dm' })])
    const readied = resolveDnd5eHeadlessAction(readyState, {
      type: 'ready', actorId: 'a', trigger: '敌人进入门口时', actionKind: 'attack', targetId: 'b',
    })
    expect(readied.ok).toBe(true)
    if (!readied.ok) return
    const ended = resolveDnd5eHeadlessAction(readied.state, { type: 'end-turn', actorId: 'a' })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    const triggered = resolveDnd5eHeadlessAction(ended.state, { type: 'trigger-readied-action', actorId: 'a' })
    expect(triggered.ok).toBe(true)
    if (!triggered.ok) return
    expect(triggered.state.combatants.a.turn.reactionAvailable).toBe(false)
    expect(triggered.events).toContainEqual(expect.objectContaining({ type: 'readied-action-triggered', actionKind: 'attack' }))

    const objectState = startDnd5eHeadlessCombat('basic-object', [fighter('a', 20), fighter('b', 10, { controller: 'dm' })])
    const used = resolveDnd5eHeadlessAction(objectState, { type: 'use-object', actorId: 'a', interactionId: 'drink:potion' })
    expect(used.ok).toBe(true)
    if (!used.ok) return
    expect(used.events).toContainEqual({ type: 'object-action-taken', actorId: 'a', action: 'use-object', interactionId: 'drink:potion' })
  })

  it('grants and consumes Help advantage for an ally ability check and attack', () => {
    const helper = fighter('helper', 20)
    const ally = fighter('ally', 15)
    const enemy = fighter('enemy', 10, { controller: 'dm', armorClass: 16 })
    const abilityHelp = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('help-check', [helper, ally, enemy]),
      { type: 'help', actorId: 'helper', targetId: 'ally', helpKind: 'ability-check' },
    )
    expect(abilityHelp.ok).toBe(true)
    if (!abilityHelp.ok) return
    const helperEnded = resolveDnd5eHeadlessAction(abilityHelp.state, { type: 'end-turn', actorId: 'helper' })
    expect(helperEnded.ok).toBe(true)
    if (!helperEnded.ok) return
    const check = resolveDnd5eHeadlessAction(helperEnded.state, {
      type: 'ability-check', actorId: 'ally', ability: 'str', d20: 2, d20Second: 18,
    })
    expect(check.ok).toBe(true)
    if (!check.ok) return
    expect(check.events).toContainEqual(expect.objectContaining({ type: 'ability-check-resolved', d20: 18, mode: 'advantage' }))
    expect(check.state.combatants.ally.classState.helpedAbilityCheckSourceId).toBeUndefined()

    const attackHelpState = startDnd5eHeadlessCombat('help-attack', [helper, ally, enemy])
    attackHelpState.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('helper', 'enemy')]: 5,
    }
    const attackHelp = resolveDnd5eHeadlessAction(attackHelpState, {
      type: 'help', actorId: 'helper', targetId: 'enemy', helpKind: 'attack',
    })
    expect(attackHelp.ok).toBe(true)
    if (!attackHelp.ok) return
    const afterHelp = resolveDnd5eHeadlessAction(attackHelp.state, { type: 'end-turn', actorId: 'helper' })
    expect(afterHelp.ok).toBe(true)
    if (!afterHelp.ok) return
    const attack = resolveDnd5eHeadlessAction(afterHelp.state, {
      type: 'attack', actorId: 'ally', targetId: 'enemy', attackModifier: 0,
      d20: 2, d20Second: 18, damage: { count: 1, sides: 4, bonus: 0, rolls: [2] },
    })
    expect(attack.ok).toBe(true)
    if (!attack.ok) return
    expect(attack.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 18, hit: true }))
    expect(attack.state.combatants.enemy.classState.helpedAttackSourceId).toBeUndefined()
  })

  it('resolves grapple and shove through opposed Athletics checks', () => {
    const state = startDnd5eHeadlessCombat('contests', [fighter('a', 20), fighter('b', 10, { controller: 'dm' })])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('a', 'b')]: 5 }
    const grappled = resolveDnd5eHeadlessAction(state, {
      type: 'grapple', actorId: 'a', targetId: 'b', actorD20: 18, targetD20: 2, targetDefense: 'athletics',
    })
    expect(grappled.ok).toBe(true)
    if (!grappled.ok) return
    expect(grappled.state.combatants.b.conditions).toContain('grappled')
    expect(grappled.events).toContainEqual(expect.objectContaining({ type: 'contest-resolved', contest: 'grapple', success: true }))

    grappled.state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('a', 'b')]: 10 }
    const separated = resolveDnd5eHeadlessAction(grappled.state, { type: 'end-turn', actorId: 'a' })
    expect(separated.ok).toBe(true)
    if (!separated.ok) return
    expect(separated.state.combatants.b.conditions).not.toContain('grappled')
    expect(separated.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed', reason: 'out-of-range', targetId: 'b',
    }))

    const incapacitatedState = startDnd5eHeadlessCombat('grapple-incapacitated', [fighter('a', 20), fighter('b', 10, { controller: 'dm' })])
    incapacitatedState.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('a', 'b')]: 5 }
    const held = resolveDnd5eHeadlessAction(incapacitatedState, {
      type: 'grapple', actorId: 'a', targetId: 'b', actorD20: 18, targetD20: 2, targetDefense: 'athletics',
    })
    expect(held.ok).toBe(true)
    if (!held.ok) return
    held.state.combatants.a.currentHp = 0
    const incapacitated = resolveDnd5eHeadlessAction(held.state, { type: 'end-turn', actorId: 'a' })
    expect(incapacitated.ok).toBe(true)
    if (!incapacitated.ok) return
    expect(incapacitated.state.combatants.b.conditions).not.toContain('grappled')
    expect(incapacitated.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed', reason: 'source-incapacitated', targetId: 'b',
    }))

    const shoveState = startDnd5eHeadlessCombat('shove', [fighter('a', 20), fighter('b', 10, { controller: 'dm' })])
    shoveState.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('a', 'b')]: 5 }
    const shoved = resolveDnd5eHeadlessAction(shoveState, {
      type: 'shove', actorId: 'a', targetId: 'b', actorD20: 18, targetD20: 2,
      targetDefense: 'acrobatics', outcome: 'prone',
    })
    expect(shoved.ok).toBe(true)
    if (!shoved.ok) return
    expect(shoved.state.combatants.b.conditions).toContain('prone')
  })

  it('uses the defender stronger Athletics or Acrobatics modifier for grapple and shove', () => {
    const defender = fighter('b', 10, {
      controller: 'dm',
      abilities: { ...abilities, str: 8, dex: 18 },
      skillProficiencies: ['acrobatics'],
    })
    const state = startDnd5eHeadlessCombat('stronger-defense', [fighter('a', 20), defender])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('a', 'b')]: 5 }
    const grappled = resolveDnd5eHeadlessAction(state, {
      type: 'grapple', actorId: 'a', targetId: 'b', actorD20: 10, targetD20: 10,
      targetDefense: 'athletics',
    })
    expect(grappled.ok).toBe(true)
    if (!grappled.ok) return
    expect(grappled.events).toContainEqual(expect.objectContaining({
      type: 'contest-resolved', targetDefense: 'acrobatics', actorTotal: 13, targetTotal: 16, success: false,
    }))
    expect(grappled.state.combatants.b.conditions).not.toContain('grappled')
  })

  it('rejects grapple and shove targets more than one size larger than the actor', () => {
    const oversized = startDnd5eHeadlessCombat('size-limit', [
      fighter('a', 20, { sizeRank: 2 }),
      fighter('b', 10, { controller: 'dm', sizeRank: 4 }),
    ])
    oversized.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('a', 'b')]: 5 }
    expect(resolveDnd5eHeadlessAction(oversized, {
      type: 'grapple', actorId: 'a', targetId: 'b', actorD20: 20, targetD20: 1,
      targetDefense: 'athletics',
    })).toMatchObject({ ok: false, reason: 'invalid-target' })

    const legal = startDnd5eHeadlessCombat('size-limit-legal', [
      fighter('a', 20, { sizeRank: 2 }),
      fighter('b', 10, { controller: 'dm', sizeRank: 3 }),
    ])
    legal.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('a', 'b')]: 5 }
    expect(resolveDnd5eHeadlessAction(legal, {
      type: 'shove', actorId: 'a', targetId: 'b', actorD20: 20, targetD20: 1,
      targetDefense: 'athletics', outcome: 'prone',
    })).toMatchObject({ ok: true })
  })

  it('rejects grapple and shove through total cover even at five-foot grid distance', () => {
    const state = startDnd5eHeadlessCombat('blocked-contest', [
      fighter('a', 20),
      fighter('b', 10, { controller: 'dm' }),
    ])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('a', 'b')]: 5 }
    state.lineOfEffectBlockedByCombatantPair = {
      [dnd5eDirectedCombatantPairKey('a', 'b')]: true,
    }
    expect(resolveDnd5eHeadlessAction(state, {
      type: 'grapple',
      actorId: 'a',
      targetId: 'b',
      actorD20: 20,
      targetD20: 1,
      targetDefense: 'athletics',
    })).toMatchObject({ ok: false, reason: 'invalid-target' })
    expect(resolveDnd5eHeadlessAction(state, {
      type: 'shove',
      actorId: 'a',
      targetId: 'b',
      actorD20: 20,
      targetD20: 1,
      targetDefense: 'athletics',
      outcome: 'prone',
    })).toMatchObject({ ok: false, reason: 'invalid-target' })
  })

  it('lets a grappled creature spend its action to escape the grappler contest', () => {
    const state = startDnd5eHeadlessCombat('escape-grapple', [
      fighter('a', 20), fighter('b', 10, { controller: 'dm' }),
    ])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('a', 'b')]: 5 }
    const grappled = resolveDnd5eHeadlessAction(state, {
      type: 'grapple', actorId: 'a', targetId: 'b', actorD20: 20, targetD20: 1,
      targetDefense: 'athletics',
    })
    expect(grappled.ok).toBe(true)
    if (!grappled.ok) return
    const nextTurn = resolveDnd5eHeadlessAction(grappled.state, { type: 'end-turn', actorId: 'a' })
    expect(nextTurn.ok).toBe(true)
    if (!nextTurn.ok) return
    const escaped = resolveDnd5eHeadlessAction(nextTurn.state, {
      type: 'escape-grapple', actorId: 'b', grapplerId: 'a', actorD20: 20, targetD20: 1,
    })
    expect(escaped.ok).toBe(true)
    if (!escaped.ok) return
    expect(escaped.events).toContainEqual(expect.objectContaining({
      type: 'contest-resolved', contest: 'escape-grapple', success: true,
    }))
    expect(escaped.state.combatants.b.conditions).not.toContain('grappled')
    expect(escaped.state.combatants.b.turn.actionAvailable).toBe(false)
  })

  it('limits basic grapples by free hands and lets the grappler release one without an action', () => {
    const actor = fighter('a', 20, { grappleFreeHandCapacity: 1 })
    const state = startDnd5eHeadlessCombat('grapple-capacity', [
      actor,
      fighter('b', 10, { controller: 'dm' }),
      fighter('c', 5, { controller: 'dm' }),
    ])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('a', 'b')]: 5,
      [dnd5eCombatantPairKey('a', 'c')]: 5,
    }
    const first = resolveDnd5eHeadlessAction(state, {
      type: 'grapple', actorId: 'a', targetId: 'b', actorD20: 20, targetD20: 1,
      targetDefense: 'athletics', spendAction: false,
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(resolveDnd5eHeadlessAction(first.state, {
      type: 'grapple', actorId: 'a', targetId: 'c', actorD20: 20, targetD20: 1,
      targetDefense: 'athletics', spendAction: false,
    })).toMatchObject({ ok: false, reason: 'invalid-target' })

    const released = resolveDnd5eHeadlessAction(first.state, {
      type: 'release-grapple', actorId: 'a', targetId: 'b',
    })
    expect(released.ok).toBe(true)
    if (!released.ok) return
    expect(released.state.combatants.b.conditions).not.toContain('grappled')
    expect(released.state.combatants.a.turn.actionAvailable).toBe(true)
    expect(released.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed',
      targetId: 'b',
      reason: 'released',
    }))
    expect(resolveDnd5eHeadlessAction(released.state, {
      type: 'grapple', actorId: 'a', targetId: 'c', actorD20: 20, targetD20: 1,
      targetDefense: 'athletics', spendAction: false,
    })).toMatchObject({ ok: true })
  })

  it('reconciles persisted basic grapples against the grappler current free hands', () => {
    const state = startDnd5eHeadlessCombat('persisted-basic-grapple-capacity', [
      fighter('a', 20, { grappleFreeHandCapacity: 1 }),
      fighter('b', 10, { controller: 'dm' }),
      fighter('c', 5, { controller: 'dm' }),
    ])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('a', 'b')]: 5,
      [dnd5eCombatantPairKey('a', 'c')]: 5,
    }
    const first = resolveDnd5eHeadlessAction(state, {
      type: 'grapple',
      actorId: 'a',
      targetId: 'b',
      actorD20: 20,
      targetD20: 1,
      targetDefense: 'athletics',
      spendAction: false,
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const persistedGrapple = first.state.combatants.b.classState.activeEffects?.find(
      (effect) => effect.source.rulesId === 'basic-action:grapple',
    )
    expect(persistedGrapple).toBeDefined()
    if (!persistedGrapple) return
    const persistedDuplicate = structuredClone(persistedGrapple)
    persistedDuplicate.id = 'zz-persisted-extra-grapple'
    first.state.combatants.c.classState.activeEffects = [persistedDuplicate]
    first.state.combatants.c.conditions =
      dnd5eConditionsFromActiveEffects([persistedDuplicate])

    const capacityCleaned = resolveDnd5eHeadlessAction(first.state, {
      type: 'end-turn',
      actorId: 'a',
    })
    expect(capacityCleaned.ok).toBe(true)
    if (!capacityCleaned.ok) return
    expect(capacityCleaned.state.combatants.b.conditions).toContain('grappled')
    expect(capacityCleaned.state.combatants.c.conditions).not.toContain('grappled')
    expect(capacityCleaned.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed',
      targetId: 'c',
      effectId: 'zz-persisted-extra-grapple',
      reason: 'invalid-relation',
    }))

    capacityCleaned.state.combatants.a.grappleFreeHandCapacity = 0
    const noFreeHands = resolveDnd5eHeadlessAction(capacityCleaned.state, {
      type: 'end-turn',
      actorId: 'b',
    })
    expect(noFreeHands.ok).toBe(true)
    if (!noFreeHands.ok) return
    expect(noFreeHands.state.combatants.b.conditions).not.toContain('grappled')
  })

  it('rejects an opportunity attack when the reactor cannot see the moving target', () => {
    const state = startDnd5eHeadlessCombat('blocked-opportunity', [fighter('a', 20), fighter('b', 10)])
    state.lineOfSightBlockedByCombatantPair = {
      [dnd5eDirectedCombatantPairKey('b', 'a')]: true,
    }
    expect(resolveDnd5eHeadlessAction(state, {
      type: 'opportunity-attack', actorId: 'b', targetId: 'a', attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
    })).toMatchObject({ ok: false, reason: 'invalid-target' })
  })

  it('restores a persisted Dodge marker and keeps the target defended until its next turn', () => {
    const defender = fighter('b', 10, { classState: { dodgingTurnKey: 'combat:1:b' } })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('combat', [fighter('a', 20), defender]),
      {
        type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 5,
        d20: 18, d20Second: 2,
        damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
      },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 2, hit: false }))
    expect(result.state.combatants.b.currentHp).toBe(20)
  })

  it('authoritatively validates Protection and spends the shield bearer reaction', () => {
    const attacker = fighter('enemy', 20, { controller: 'dm' })
    const protector = fighter('protector', 10, {
      hasShield: true,
      classSelections: { 'fighting-style': ['protection'] },
    })
    const target = fighter('ally', 5)
    const state = startDnd5eHeadlessCombat('protection', [attacker, protector, target])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'enemy', targetId: 'ally', attackModifier: 5,
      protectionReactionActorId: 'protector', mode: 'normal', d20: 18, d20Second: 2,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual({ type: 'turn-resource-spent', actorId: 'protector', resource: 'reaction' })
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 2, hit: false }))
    expect(result.state.combatants.protector.turn.reactionAvailable).toBe(false)

    const invalidState = startDnd5eHeadlessCombat('invalid-protection', [attacker, fighter('no-shield', 10, {
      classSelections: { 'fighting-style': ['protection'] },
    }), target])
    expect(resolveDnd5eHeadlessAction(invalidState, {
      type: 'attack', actorId: 'enemy', targetId: 'ally', attackModifier: 5,
      protectionReactionActorId: 'no-shield', mode: 'normal', d20: 18, d20Second: 2,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [] },
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('lets Protection cancel an existing advantage instead of turning it into disadvantage twice', () => {
    const attacker = fighter('enemy', 20, { controller: 'dm' })
    const protector = fighter('protector', 10, {
      hasShield: true,
      classSelections: { 'fighting-style': ['protection'] },
    })
    const target = fighter('ally', 5)
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('protection-cancels-advantage', [attacker, protector, target]),
      {
        type: 'attack', actorId: 'enemy', targetId: 'ally', attackModifier: 5,
        protectionReactionActorId: 'protector', mode: 'advantage', d20: 2, d20Second: 18,
        damage: { count: 1, sides: 8, bonus: 3, rolls: [] },
      },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 2, hit: false }))
  })

  it('applies Protection to spell attack rolls as well as weapon attacks', () => {
    const caster = fighter('wizard', 20, {
      controller: 'dm', classId: 'wizard', level: 5,
      classSelections: { 'spell-cantrips': ['fire-bolt'] },
      abilities: { ...abilities, int: 16 },
    })
    const protector = fighter('protector', 10, {
      hasShield: true, classSelections: { 'fighting-style': ['protection'] },
    })
    const target = fighter('ally', 5)
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('spell-protection', [caster, protector, target]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'ally', spellId: 'fire-bolt', slotLevel: 0,
      protectionReactionActorId: 'protector', mode: 'normal', d20: 18, d20Second: 2, effectRolls: [],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual({ type: 'turn-resource-spent', actorId: 'protector', resource: 'reaction' })
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 2, hit: false }))
  })

  it('authoritatively applies Hunter Escape the Horde to opportunity attacks', () => {
    const hunter = fighter('hunter', 10, {
      classId: 'ranger', subclassId: 'hunter', level: 7,
      classSelections: { 'defensive-tactics': ['escape-the-horde'] },
    })
    const state = startDnd5eHeadlessCombat('escape-the-horde', [fighter('enemy', 20), hunter])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'opportunity-attack', actorId: 'enemy', targetId: 'hunter', attackModifier: 5,
      d20: 20, d20Second: 2,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 2, hit: false }))
    expect(result.state.combatants.hunter.currentHp).toBe(20)
  })

  it('authoritatively validates the Berserker Retaliation reaction feature', () => {
    const berserker = fighter('berserker', 10, {
      classId: 'barbarian', subclassId: 'berserker', level: 14,
    })
    const state = startDnd5eHeadlessCombat('retaliation', [fighter('enemy', 20), berserker])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'opportunity-attack', reactionFeature: 'berserker-retaliation',
      actorId: 'berserker', targetId: 'enemy', attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.berserker.turn.reactionAvailable).toBe(false)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'damage-applied', sourceId: 'berserker', targetId: 'enemy', amount: 8,
    }))

    const invalid = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('invalid-retaliation', [fighter('enemy', 20), fighter('fighter', 10)]),
      {
        type: 'opportunity-attack', reactionFeature: 'berserker-retaliation',
        actorId: 'fighter', targetId: 'enemy', attackModifier: 5, d20: 15,
        damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
      },
    )
    expect(invalid).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('authoritatively validates the Hunter Giant Killer reaction feature', () => {
    const hunter = fighter('hunter', 20, {
      classId: 'ranger', subclassId: 'hunter', level: 3,
      classSelections: { 'hunters-prey': ['giant-killer'] },
    })
    const state = startDnd5eHeadlessCombat('giant-killer', [hunter, fighter('giant', 10, { controller: 'dm' })])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'opportunity-attack', reactionFeature: 'hunter-giant-killer',
      actorId: 'hunter', targetId: 'giant', attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.hunter.turn.reactionAvailable).toBe(false)
    expect(result.state.combatants.giant.currentHp).toBe(12)

    const invalid = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('invalid-giant-killer', [
      fighter('hunter', 20, { classId: 'ranger', subclassId: 'hunter', level: 3 }),
      fighter('giant', 10, { controller: 'dm' }),
    ]), {
      type: 'opportunity-attack', reactionFeature: 'hunter-giant-killer',
      actorId: 'hunter', targetId: 'giant', attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
    })
    expect(invalid).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('resolves Hunter Stand Against the Tide as an atomic repeated melee attack', () => {
    const attacker = fighter('attacker', 20, { controller: 'dm' })
    const hunter = fighter('hunter', 10, {
      classId: 'ranger', subclassId: 'hunter', level: 15,
      classSelections: { 'superior-hunters-defense': ['stand-against-tide'] },
      classState: { hideInPlainSightPrepared: true },
    })
    const redirectedTarget = fighter('redirected', 5, { controller: 'dm', armorClass: 12 })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('stand-against-tide', [attacker, hunter, redirectedTarget]),
      {
        type: 'attack', actorId: 'attacker', targetId: 'hunter', attackModifier: 5, d20: 2,
        classDamageContext: {
          mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
          damageType: 'slashing', adjacentEnemyOfTarget: false,
        },
        damage: { count: 1, sides: 8, bonus: 3, rolls: [], type: 'slashing' },
        standAgainstTide: {
          targetId: 'redirected', distanceFeet: 5, d20: 10,
          damageRolls: [[6]],
        },
      },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.hunter.currentHp).toBe(20)
    expect(result.state.combatants.redirected.currentHp).toBe(11)
    expect(result.state.combatants.hunter.turn.reactionAvailable).toBe(false)
    expect(result.state.combatants.hunter.classState.hideInPlainSightPrepared).toBeUndefined()
    expect(result.events.filter((event) => event.type === 'attack-resolved')).toEqual([
      expect.objectContaining({ actorId: 'attacker', targetId: 'hunter', hit: false }),
      expect.objectContaining({ actorId: 'attacker', targetId: 'redirected', hit: true }),
    ])
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: 'hunter', targetId: 'redirected',
      stateKey: 'stand-against-tide', active: true,
    }))
  })

  it('resolves Berserker Intimidating Presence, frightened penalties, and 24-hour immunity', () => {
    const berserker = fighter('berserker', 20, {
      classId: 'barbarian', subclassId: 'berserker', level: 10,
      abilities: { ...abilities, cha: 14 }, position: { x: 0, y: 0 },
    })
    const enemy = fighter('enemy', 10, {
      controller: 'dm', position: { x: 10, y: 0 }, savingThrowBonuses: { wis: 0 },
    })
    const state = startDnd5eHeadlessCombat('intimidating-presence', [berserker, enemy, fighter('victim', 5)])
    const frightened = resolveDnd5eHeadlessAction(state, {
      type: 'barbarian-intimidating-presence', actorId: 'berserker', targetId: 'enemy', savingThrowD20: 2,
    })
    expect(frightened.ok).toBe(true)
    if (!frightened.ok) return
    expect(frightened.state.combatants.enemy.conditions).toContain('frightened')
    expect(frightened.state.combatants.enemy.classState).toMatchObject({
      intimidatingPresenceSourceId: 'berserker', intimidatingPresenceRoundsRemaining: 2,
    })

    const barbarianEnded = resolveDnd5eHeadlessAction(frightened.state, { type: 'end-turn', actorId: 'berserker' })
    expect(barbarianEnded.ok).toBe(true)
    if (!barbarianEnded.ok) return
    expect(barbarianEnded.state.combatants.enemy.classState.intimidatingPresenceRoundsRemaining).toBe(1)
    const cannotApproach = resolveDnd5eHeadlessAction(barbarianEnded.state, {
      type: 'move', actorId: 'enemy', to: { x: 5, y: 0 }, distance: 5,
    })
    expect(cannotApproach).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
    const disadvantagedAttack = resolveDnd5eHeadlessAction(barbarianEnded.state, {
      type: 'attack', actorId: 'enemy', targetId: 'berserker', attackModifier: 5,
      d20: 18, d20Second: 2, damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
    })
    expect(disadvantagedAttack.ok).toBe(true)
    if (!disadvantagedAttack.ok) return
    expect(disadvantagedAttack.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: 'enemy', d20: 2, hit: false,
    }))

    const sourceHidden = structuredClone(barbarianEnded.state)
    sourceHidden.lineOfSightBlockedByCombatantPair = {
      [dnd5eDirectedCombatantPairKey('enemy', 'berserker')]: true,
    }
    const unobstructedAttack = resolveDnd5eHeadlessAction(sourceHidden, {
      type: 'attack', actorId: 'enemy', targetId: 'victim', attackModifier: 5,
      d20: 18, d20Second: 2, damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
    })
    expect(unobstructedAttack.ok).toBe(true)
    if (!unobstructedAttack.ok) return
    expect(unobstructedAttack.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: 'enemy', d20: 18, hit: true,
    }))

    const immune = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('intimidating-immunity', [berserker, enemy]),
      { type: 'barbarian-intimidating-presence', actorId: 'berserker', targetId: 'enemy', savingThrowD20: 20 },
    )
    expect(immune.ok).toBe(true)
    if (!immune.ok) return
    expect(immune.state.combatants.enemy.classState.intimidatingPresenceImmunityRoundsBySource?.berserker).toBe(14_400)
    expect(immune.state.combatants.enemy.conditions).not.toContain('frightened')
  })

  it('spends the target reaction and halves one visible attack with Uncanny Dodge', () => {
    const rogue = fighter('rogue', 10, { classId: 'rogue', level: 5 })
    const state = startDnd5eHeadlessCombat('uncanny-dodge', [fighter('enemy', 20), rogue])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'enemy', targetId: 'rogue', attackModifier: 20, d20: 10,
      uncannyDodge: true,
      damage: { count: 1, sides: 8, bonus: 1, rolls: [8], type: 'slashing' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.rogue.currentHp).toBe(16)
    expect(result.state.combatants.rogue.turn.reactionAvailable).toBe(false)
    expect(result.events).toContainEqual({ type: 'turn-resource-spent', actorId: 'rogue', resource: 'reaction' })
  })

  it('applies attack-wide reductions before vulnerability and resistance', () => {
    const rogue = fighter('rogue', 10, {
      classId: 'rogue', level: 5, damageVulnerabilities: ['slashing'],
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('damage-order', [fighter('enemy', 20), rogue]),
      {
        type: 'attack', actorId: 'enemy', targetId: 'rogue', attackModifier: 20, d20: 10,
        uncannyDodge: true,
        damage: { count: 1, sides: 8, bonus: 1, rolls: [8], type: 'slashing' },
      },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // 9 damage -> Uncanny Dodge 4 -> vulnerability 8 (not vulnerability 18 -> Dodge 9).
    expect(result.state.combatants.rogue.currentHp).toBe(12)
  })

  it('applies resistance before vulnerability, including odd damage totals', () => {
    const target = fighter('target', 10, {
      damageResistances: ['slashing'], damageVulnerabilities: ['slashing'],
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('resistance-before-vulnerability', [fighter('enemy', 20), target]),
      {
        type: 'attack', actorId: 'enemy', targetId: 'target', attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 4, bonus: 0, rolls: [3], type: 'slashing' },
      },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // 3 点先因抗性减半向下取整为 1，再因易伤翻倍为 2。
    expect(result.state.combatants.target.currentHp).toBe(18)
  })

  it('uses only trusted player weapon metadata for nonsilvered weapon immunity', () => {
    const immunity = [{
      outcome: 'immune' as const,
      damageTypes: ['bludgeoning', 'piercing', 'slashing'] as const,
      delivery: 'weapon-attack' as const,
      magical: false,
      weaponMaterialNot: 'silvered' as const,
      reason: 'lycanthrope-nonsilvered-immunity',
    }]
    const cases: readonly {
      label: string
      weaponId?: string
      source?: { magical: boolean; specialMaterial?: 'silvered' | 'adamantine' }
      expectedHp: number
    }[] = [
      { label: 'missing context', expectedHp: 20 },
      {
        label: 'ordinary weapon',
        weaponId: 'ordinary-sword',
        source: { magical: false },
        expectedHp: 20,
      },
      {
        label: 'silvered weapon',
        weaponId: 'silver-sword',
        source: { magical: false, specialMaterial: 'silvered' as const },
        expectedHp: 13,
      },
      {
        label: 'magic weapon',
        weaponId: 'magic-sword',
        source: { magical: true },
        expectedHp: 13,
      },
    ]
    for (const testCase of cases) {
      const externalSources = testCase.weaponId && testCase.source
        ? { [testCase.weaponId]: { ...testCase.source } }
        : undefined
      const attacker = fighter(`attacker-${testCase.label}`, 20, {
        weaponDamageSources: externalSources,
      })
      if (externalSources && testCase.weaponId) {
        const stored = attacker.weaponDamageSources?.[testCase.weaponId]
        expect(stored).not.toBe(externalSources[testCase.weaponId])
      }
      const target = fighter(`target-${testCase.label}`, 10, {
        controller: 'dm',
        damageDefenseRules: immunity,
      })
      const state = startDnd5eHeadlessCombat(`trusted-weapon-${testCase.label}`, [attacker, target])
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'attack',
        actorId: attacker.id,
        targetId: target.id,
        attackModifier: 20,
        d20: 10,
        damage: { count: 1, sides: 8, bonus: 0, rolls: [7], type: 'slashing' },
        ...(testCase.weaponId
          ? {
              classDamageContext: meleeWeaponContext(testCase.weaponId),
              classDamageRolls: [],
            }
          : {}),
      })
      expect(result.ok, testCase.label).toBe(true)
      if (!result.ok) continue
      expect(result.state.combatants[target.id].currentHp, testCase.label).toBe(testCase.expectedHp)
      expect(result.state.combatants[target.id].damageDefenseRules[0]).not.toBe(
        state.combatants[target.id].damageDefenseRules[0],
      )
    }
  })

  it('uses the monster magic-weapons snapshot for every monster weapon component', () => {
    const immunity = [{
      outcome: 'immune' as const,
      damageTypes: ['bludgeoning', 'piercing', 'slashing'] as const,
      delivery: 'weapon-attack' as const,
      magical: false,
      weaponMaterialNot: 'silvered' as const,
    }]
    for (const weaponAttacksMagical of [false, true]) {
      const wolf = fighter(`wolf-${weaponAttacksMagical}`, 20, {
        controller: 'dm',
        statBlockId: 'srd-5.1:wolf',
        usesDeathSaves: false,
        abilities: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
        currentHp: 11,
        maxHp: 11,
        weaponAttacksMagical,
      })
      const target = fighter(`target-${weaponAttacksMagical}`, 10, {
        damageDefenseRules: immunity,
      })
      const result = resolveDnd5eHeadlessAction(
        startDnd5eHeadlessCombat(`monster-magic-weapon-${weaponAttacksMagical}`, [wolf, target]),
        {
          type: 'monster-action',
          actorId: wolf.id,
          actionId: 'bite',
          rolls: [{ targetId: target.id, d20: 12, damageRolls: [[2, 3]] }],
        },
      )
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      expect(result.state.combatants[target.id].currentHp).toBe(
        weaponAttacksMagical ? 13 : 20,
      )
    }
  })

  it('applies good-aligned magic piercing vulnerability in real attacks', () => {
    const vulnerability = [{
      outcome: 'vulnerable' as const,
      damageTypes: ['piercing'] as const,
      delivery: 'weapon-attack' as const,
      magical: true,
      sourceMoralAlignment: 'good' as const,
      reason: 'rakshasa-good-magic-piercing',
    }]
    for (const [moralAlignment, expectedHp] of [['good', 12], ['neutral', 16]] as const) {
      const attacker = fighter(`attacker-${moralAlignment}`, 20, {
        moralAlignment,
        weaponDamageSources: { rapier: { magical: true } },
      })
      const target = fighter(`target-${moralAlignment}`, 10, {
        controller: 'dm',
        damageDefenseRules: vulnerability,
      })
      const result = resolveDnd5eHeadlessAction(
        startDnd5eHeadlessCombat(`rakshasa-${moralAlignment}`, [attacker, target]),
        {
          type: 'attack',
          actorId: attacker.id,
          targetId: target.id,
          attackModifier: 20,
          d20: 10,
          damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'piercing' },
          classDamageContext: {
            ...meleeWeaponContext('rapier'),
            finesse: true,
            damageType: 'piercing',
          },
          classDamageRolls: [],
        },
      )
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      expect(result.state.combatants[target.id].currentHp).toBe(expectedHp)
    }
  })

  it('negates low-level player spell damage and control from the combatant snapshot after spending slots', () => {
    const limitedMagicImmunity = {
      kind: 'limited-magic-immunity',
      maximumSpellLevel: 6,
      advantageAboveMaximum: true,
      allowsWilling: true,
    } as const
    const disintegrator = fighter('disintegrator', 20, {
      classId: 'wizard', level: 11, proficiencyBonus: 4,
      abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['disintegrate'] },
      classResources: { 'dnd5e-spell-slot-6': { current: 1, max: 1 } },
    })
    const rakshasaSnapshot = fighter('rakshasa-snapshot', 10, {
      controller: 'dm',
      currentHp: 200,
      maxHp: 200,
      limitedMagicImmunity,
    })
    const damageState = startDnd5eHeadlessCombat(
      'limited-magic-immunity-damage',
      [disintegrator, rakshasaSnapshot],
    )
    const damage = resolveDnd5eHeadlessAction(damageState, {
      type: 'cast-spell',
      actorId: disintegrator.id,
      targetId: rakshasaSnapshot.id,
      spellId: 'disintegrate',
      slotLevel: 6,
      savingThrowD20: 1,
      savingThrowD20Second: 20,
      effectRolls: Array(10).fill(6),
    })
    expect(damage.ok).toBe(true)
    if (!damage.ok) return
    expect(damage.state.combatants[rakshasaSnapshot.id].currentHp).toBe(200)
    expect(damage.state.combatants[disintegrator.id].classResources['dnd5e-spell-slot-6'].current)
      .toBe(0)
    expect(damage.state.combatants[rakshasaSnapshot.id].magicResistance).toBe(true)
    expect(damage.state.combatants[rakshasaSnapshot.id].limitedMagicImmunity)
      .not.toBe(damageState.combatants[rakshasaSnapshot.id].limitedMagicImmunity)
    expect(damage.events).toContainEqual({
      type: 'spell-negated-by-limited-magic-immunity',
      actorId: disintegrator.id,
      targetId: rakshasaSnapshot.id,
      spellId: 'disintegrate',
      spellLevel: 6,
    })
    expect(damage.events.some((event) =>
      event.type === 'saving-throw-resolved' && event.targetId === rakshasaSnapshot.id))
      .toBe(false)

    const controller = fighter('controller', 20, {
      classId: 'wizard', level: 9, proficiencyBonus: 4,
      abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['hold-monster'] },
      classResources: { 'dnd5e-spell-slot-5': { current: 1, max: 1 } },
    })
    const controlTarget = fighter('control-target', 10, {
      controller: 'dm',
      limitedMagicImmunity,
    })
    const control = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('limited-magic-immunity-control', [controller, controlTarget]),
      {
        type: 'cast-spell',
        actorId: controller.id,
        targetId: controlTarget.id,
        spellId: 'hold-monster',
        slotLevel: 5,
        savingThrowD20: 1,
        savingThrowD20Second: 2,
        effectRolls: [],
      },
    )
    expect(control.ok).toBe(true)
    if (!control.ok) return
    expect(control.state.combatants[controlTarget.id].conditions).not.toContain('paralyzed')
    expect(control.state.combatants[controller.id].classResources['dnd5e-spell-slot-5'].current)
      .toBe(0)
    expect(control.events).toContainEqual(expect.objectContaining({
      type: 'spell-negated-by-limited-magic-immunity',
      targetId: controlTarget.id,
      spellId: 'hold-monster',
    }))
  })

  it('filters a low-level area per target and suppresses its later persistent-area trigger', () => {
    const limitedMagicImmunity = {
      kind: 'limited-magic-immunity',
      maximumSpellLevel: 6,
      advantageAboveMaximum: true,
      allowsWilling: true,
    } as const
    const wizard = fighter('wizard', 20, {
      classId: 'wizard', level: 5, proficiencyBonus: 3,
      abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['fireball'] },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const immune = fighter('immune', 10, {
      controller: 'dm',
      currentHp: 100,
      maxHp: 100,
      limitedMagicImmunity,
    })
    const exposed = fighter('exposed', 5, {
      controller: 'dm',
      currentHp: 100,
      maxHp: 100,
    })
    const area = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('limited-magic-immunity-area', [wizard, immune, exposed]),
      {
        type: 'cast-spell',
        actorId: wizard.id,
        targetId: immune.id,
        targetIds: [immune.id, exposed.id],
        spellId: 'fireball',
        slotLevel: 3,
        targetSavingThrows: [
          { targetId: immune.id, d20: 1, d20Second: 20 },
          { targetId: exposed.id, d20: 1 },
        ],
        effectRolls: Array(8).fill(1),
      },
    )
    expect(area.ok).toBe(true)
    if (!area.ok) return
    expect(area.state.combatants[immune.id].currentHp).toBe(100)
    expect(area.state.combatants[exposed.id].currentHp).toBe(92)
    expect(area.state.combatants[wizard.id].classResources['dnd5e-spell-slot-3'].current).toBe(0)
    expect(area.events).toContainEqual(expect.objectContaining({
      type: 'spell-negated-by-limited-magic-immunity',
      targetId: immune.id,
      spellId: 'fireball',
    }))
    expect(area.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved',
      targetId: exposed.id,
      success: false,
    }))
    expect(area.events.some((event) =>
      event.type === 'saving-throw-resolved' && event.targetId === immune.id))
      .toBe(false)

    const moonbeamCaster = fighter('moonbeam-caster', 20, {
      classState: {
        concentrationSpellId: 'moonbeam',
        concentrationSpellLevel: 2,
      },
      concentrating: true,
    })
    const persistentTarget = fighter('persistent-target', 10, {
      controller: 'dm',
      currentHp: 100,
      maxHp: 100,
      limitedMagicImmunity,
    })
    const persistent = resolveDnd5ePersistentAreaTrigger(
      startDnd5eHeadlessCombat(
        'limited-magic-immunity-persistent-area',
        [moonbeamCaster, persistentTarget],
      ),
      {
        areaId: 'core-spell-area:moonbeam',
        areaSourceKind: 'core-spell',
        coreSpellId: 'moonbeam',
        sourceId: moonbeamCaster.id,
        targetId: persistentTarget.id,
        trigger: {
          id: 'moonbeam',
          label: 'Moonbeam',
          timing: 'turn-start',
          oncePerTurn: true,
          savingThrow: { ability: 'con', dc: 13, onSuccess: 'half' },
          damage: { count: 2, sides: 10, modifier: 0, type: 'radiant' },
        },
      },
    )
    expect(persistent.ok).toBe(true)
    expect(persistent.state.combatants[persistentTarget.id].currentHp).toBe(100)
    expect(persistent.events).toEqual([{
      type: 'spell-negated-by-limited-magic-immunity',
      actorId: moonbeamCaster.id,
      targetId: persistentTarget.id,
      spellId: 'moonbeam',
      spellLevel: 2,
    }])
  })

  it('allows an authoritative willing ally spell and applies advantage to level-seven spells', () => {
    const limitedMagicImmunity = {
      kind: 'limited-magic-immunity',
      maximumSpellLevel: 6,
      advantageAboveMaximum: true,
      allowsWilling: true,
    } as const
    const allyCaster = fighter('ally-caster', 20, {
      classId: 'wizard', level: 3,
      abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['invisibility'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const willingRakshasa = fighter('willing-rakshasa', 10, {
      limitedMagicImmunity,
    })
    const willing = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('limited-magic-immunity-willing', [allyCaster, willingRakshasa]),
      {
        type: 'cast-spell',
        actorId: allyCaster.id,
        targetId: willingRakshasa.id,
        spellId: 'invisibility',
        slotLevel: 2,
        effectRolls: [],
      },
    )
    expect(willing.ok).toBe(true)
    if (!willing.ok) return
    expect(willing.state.combatants[willingRakshasa.id].conditions).toContain('invisible')
    expect(willing.events.some((event) =>
      event.type === 'spell-negated-by-limited-magic-immunity'))
      .toBe(false)

    const highCaster = fighter('high-caster', 20, {
      classId: 'wizard', level: 13, proficiencyBonus: 5,
      abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['finger-of-death'] },
      classResources: { 'dnd5e-spell-slot-7': { current: 1, max: 1 } },
    })
    const highTarget = fighter('high-target', 10, {
      controller: 'dm',
      currentHp: 200,
      maxHp: 200,
      limitedMagicImmunity,
      savingThrowBonuses: { con: 2 },
    })
    const high = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('limited-magic-immunity-high-level', [highCaster, highTarget]),
      {
        type: 'cast-spell',
        actorId: highCaster.id,
        targetId: highTarget.id,
        spellId: 'finger-of-death',
        slotLevel: 7,
        savingThrowD20: 1,
        savingThrowD20Second: 20,
        effectRolls: Array(7).fill(1),
      },
    )
    expect(high.ok).toBe(true)
    if (!high.ok) return
    expect(high.state.combatants[highTarget.id].currentHp).toBe(182)
    expect(high.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved',
      targetId: highTarget.id,
      d20: 20,
      success: true,
    }))
    expect(high.events.some((event) =>
      event.type === 'spell-negated-by-limited-magic-immunity'))
      .toBe(false)
  })

  it('negates monster core and adjudicated detection spells from the same target snapshot', () => {
    const limitedMagicImmunity = {
      kind: 'limited-magic-immunity',
      maximumSpellLevel: 6,
      advantageAboveMaximum: true,
      allowsWilling: true,
    } as const
    const mage = fighter('mage', 20, {
      controller: 'dm',
      statBlockId: 'srd-5.1:mage',
      classState: { monsterSpellSlots: { 3: { current: 1, max: 1 } } },
    })
    const coreTarget = fighter('core-target', 10, {
      controller: 'player',
      currentHp: 100,
      maxHp: 100,
      limitedMagicImmunity,
    })
    const core = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('limited-magic-immunity-monster-core', [mage, coreTarget]),
      {
        type: 'monster-core-spell',
        actorId: mage.id,
        spellId: 'fireball',
        slotLevel: 3,
        resolution: {
          schemaVersion: 1,
          targetIds: [coreTarget.id],
          targetSavingThrows: [{ targetId: coreTarget.id, d20: 1, d20Second: 20 }],
          effectRolls: [Array(8).fill(6)],
        },
      },
    )
    expect(core.ok).toBe(true)
    if (!core.ok) return
    expect(core.state.combatants[coreTarget.id].currentHp).toBe(100)
    expect(core.state.combatants[mage.id].classState.monsterSpellSlots?.['3'].current).toBe(0)
    expect(core.events).toContainEqual(expect.objectContaining({
      type: 'spell-negated-by-limited-magic-immunity',
      targetId: coreTarget.id,
      spellId: 'fireball',
    }))

    const detector = fighter('detector', 20, {
      controller: 'dm',
      statBlockId: 'srd-5.1:rakshasa',
    })
    const hiddenMind = fighter('hidden-mind', 10, {
      controller: 'player',
      limitedMagicImmunity,
    })
    const detection = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('limited-magic-immunity-detection', [detector, hiddenMind]),
      {
        type: 'monster-spell',
        actorId: detector.id,
        spellId: 'detect-thoughts',
        slotLevel: 2,
        effects: [{
          targetId: hiddenMind.id,
          addCondition: 'detected',
          conditionDuration: {
            type: 'rounds',
            remainingRounds: 1,
            tickOn: 'target-turn-end',
          },
        }],
      },
    )
    expect(detection.ok).toBe(true)
    if (!detection.ok) return
    expect(detection.state.combatants[hiddenMind.id].conditions).not.toContain('detected')
    expect(detection.events).toContainEqual(expect.objectContaining({
      type: 'spell-negated-by-limited-magic-immunity',
      targetId: hiddenMind.id,
      spellId: 'detect-thoughts',
    }))
  })

  it('marks core spell damage as magical spell delivery', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard',
      level: 1,
      abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-cantrips': ['fire-bolt'] },
    })
    const target = fighter('target', 10, {
      controller: 'dm',
      damageDefenseRules: [{
        outcome: 'immune',
        damageTypes: ['fire'],
        delivery: 'spell',
        magical: true,
      }],
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('spell-delivery-defense', [wizard, target]),
      {
        type: 'cast-spell',
        actorId: wizard.id,
        targetId: target.id,
        spellId: 'fire-bolt',
        slotLevel: 0,
        d20: 12,
        effectRolls: [8],
      },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.currentHp).toBe(20)
  })

  it('does not stack conditional and dynamic resistance before vulnerability', () => {
    const target = fighter('target', 10, {
      classState: { raging: true },
      damageVulnerabilities: ['slashing'],
      damageDefenseRules: [{
        outcome: 'resistant',
        damageTypes: ['slashing'],
        delivery: 'weapon-attack',
        magical: false,
      }],
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('dynamic-resistance-order', [fighter('enemy', 20), target]),
      {
        type: 'attack',
        actorId: 'enemy',
        targetId: 'target',
        attackModifier: 20,
        d20: 10,
        damage: { count: 1, sides: 8, bonus: 0, rolls: [7], type: 'slashing' },
      },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.currentHp).toBe(14)
  })

  it('charges double movement while crawling and leaves the actor prone', () => {
    const state = startDnd5eHeadlessCombat('crawl', [
      fighter('crawler', 20, { conditions: ['prone'] }), fighter('enemy', 10, { controller: 'dm' }),
    ])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'move', actorId: 'crawler', to: { x: 5, y: 0 }, distance: 5,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.crawler.turn.movementRemaining).toBe(20)
    expect(result.state.combatants.crawler.conditions).toContain('prone')
    expect(result.events).toContainEqual({
      type: 'turn-resource-spent', actorId: 'crawler', resource: 'movement', amount: 10,
    })
  })

  it('does not turn a hit within 5 feet against a petrified target into an automatic critical hit', () => {
    const state = startDnd5eHeadlessCombat('petrified-critical', [
      fighter('enemy', 20), fighter('target', 10, { conditions: ['petrified'] }),
    ])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('enemy', 'target')]: 5 }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'enemy', targetId: 'target', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [3], type: 'force' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', critical: false }))
    expect(result.state.combatants.target.currentHp).toBe(19)
  })

  it('uses Fighter Indomitable or Monk Diamond Soul only after a failed saving throw', () => {
    const cleric = fighter('cleric', 20, {
      classId: 'cleric', level: 5, abilities: { ...abilities, wis: 16 },
      classSelections: { 'spell-cantrips': ['sacred-flame'] },
    })
    const target = fighter('target', 10, {
      controller: 'dm', classId: 'fighter', level: 9,
      classResources: { fighterIndomitable: { current: 1, max: 1 } },
    })
    const state = startDnd5eHeadlessCombat('indomitable', [cleric, target])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell', actorId: 'cleric', targetId: 'target', spellId: 'sacred-flame', slotLevel: 0,
      savingThrowD20: 1, savingThrowRerollD20: 20, effectRolls: [],
    })
    expect(result.ok ? 'ok' : result.reason).toBe('ok')
    if (!result.ok) return
    expect(result.state.combatants.target.currentHp).toBe(20)
    expect(result.state.combatants.target.classResources.fighterIndomitable.current).toBe(0)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: 'target', stateKey: 'indomitable-reroll', active: true,
    }))
  })

  it('settles death saves and concentration in the authoritative engine', () => {
    const dying = fighter('a', 20, { currentHp: 0, concentrating: true })
    const state = startDnd5eHeadlessCombat('combat', [dying, fighter('b', 10)])
    const deathSave = resolveDnd5eHeadlessAction(state, { type: 'death-save', actorId: 'a', d20: 20 })
    expect(deathSave.ok).toBe(true)
    if (!deathSave.ok) return
    expect(deathSave.state.combatants.a).toMatchObject({ currentHp: 1, deathSaves: { successes: 0, failures: 0 } })
    const concentrating = { ...deathSave.state, combatants: { ...deathSave.state.combatants, a: { ...deathSave.state.combatants.a, concentrating: true } } }
    const concentration = resolveDnd5eHeadlessAction(concentrating, { type: 'concentration-save', actorId: 'a', d20: 4, dc: 10 })
    expect(concentration.ok).toBe(true)
    if (!concentration.ok) return
    expect(concentration.state.combatants.a.concentrating).toBe(false)
  })

  it('settles an unconscious turn as one death-save transaction and advances only when still at 0 HP', () => {
    const state = startDnd5eHeadlessCombat('death-save-turn', [
      fighter('a', 20, { currentHp: 0 }),
      fighter('b', 10),
    ])
    const failed = resolveDnd5eHeadlessAction(state, { type: 'death-save-turn', actorId: 'a', d20: 5 })
    expect(failed.ok).toBe(true)
    if (!failed.ok) return
    expect(failed.state.combatants.a.deathSaves.failures).toBe(1)
    expect(failed.state.initiativeIndex).toBe(1)
    expect(failed.transaction?.status).toBe('committed')
    expect(failed.transaction?.rollLedger.entries).toContainEqual(expect.objectContaining({
      kind: 'saving-throw', dice: { sides: 20, values: [5] },
    }))

    const recovered = resolveDnd5eHeadlessAction(state, { type: 'death-save-turn', actorId: 'a', d20: 20 })
    expect(recovered.ok).toBe(true)
    if (!recovered.ok) return
    expect(recovered.state.combatants.a.currentHp).toBe(1)
    expect(recovered.state.initiativeIndex).toBe(0)
  })

  it('applies unconscious and prone at 0 HP and enforces massive-damage instant death', () => {
    const dropped = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('drop-to-zero', [
        fighter('attacker', 20, { controller: 'dm' }),
        fighter('target', 10, { currentHp: 5 }),
      ]),
      {
        type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 6, bonus: 0, rolls: [5], type: 'slashing' },
      },
    )
    expect(dropped.ok).toBe(true)
    if (!dropped.ok) return
    expect(dropped.state.combatants.target).toMatchObject({
      currentHp: 0,
      deathSaves: { successes: 0, failures: 0, stable: false, dead: false },
    })
    expect(dropped.state.combatants.target.conditions).toEqual(expect.arrayContaining(['unconscious', 'prone']))
    expect(dropped.state.combatants.target.classState.activeEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({ standardCondition: 'unconscious', source: expect.objectContaining({ rulesId: 'zero-hit-points' }) }),
      expect.objectContaining({ standardCondition: 'prone', source: expect.objectContaining({ rulesId: 'zero-hit-points' }) }),
    ]))

    const killed = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('massive-damage', [
        fighter('attacker', 20, { controller: 'dm' }),
        fighter('target', 10, { currentHp: 5, maxHp: 20 }),
      ]),
      {
        type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 20, bonus: 15, rolls: [10], type: 'slashing' },
      },
    )
    expect(killed.ok).toBe(true)
    if (!killed.ok) return
    expect(killed.state.combatants.target.deathSaves).toMatchObject({ failures: 3, dead: true })
    expect(killed.events).toContainEqual(expect.objectContaining({
      type: 'instant-death', sourceId: 'attacker', targetId: 'target',
    }))
  })

  it('makes a hit against an unconscious creature within 5 feet critical and applies two death failures', () => {
    const nearby = startDnd5eHeadlessCombat('nearby-unconscious', [
      fighter('attacker', 20, { controller: 'dm' }),
      fighter('target', 10, { currentHp: 0, conditions: ['unconscious', 'prone'] }),
    ])
    nearby.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('attacker', 'target')]: 5 }
    const critical = resolveDnd5eHeadlessAction(nearby, {
      type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 20,
      d20: 2, d20Second: 2,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [2, 3], type: 'slashing' },
    })
    expect(critical.ok).toBe(true)
    if (!critical.ok) return
    expect(critical.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', hit: true, critical: true,
    }))
    expect(critical.state.combatants.target.deathSaves.failures).toBe(2)

    const distant = startDnd5eHeadlessCombat('distant-unconscious', [
      fighter('attacker', 20, { controller: 'dm' }),
      fighter('target', 10, { currentHp: 0, conditions: ['unconscious', 'prone'] }),
    ])
    distant.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('attacker', 'target')]: 10 }
    const ordinary = resolveDnd5eHeadlessAction(distant, {
      type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 20,
      d20: 2, d20Second: 2,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [2], type: 'slashing' },
    })
    expect(ordinary.ok).toBe(true)
    if (!ordinary.ok) return
    expect(ordinary.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', hit: true, critical: false,
    }))
    expect(ordinary.state.combatants.target.deathSaves.failures).toBe(1)
  })

  it('ends concentration immediately when an incapacitating condition is present', () => {
    const state = startDnd5eHeadlessCombat('incapacitated-concentration', [
      fighter('caster', 20, {
        concentrating: true,
        conditions: ['paralyzed'],
        classState: { concentrationSpellId: 'hold-person', concentrationTargetIds: ['target'] },
      }),
      fighter('target', 10),
    ])
    const result = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: 'caster' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.caster.concentrating).toBe(false)
    expect(result.state.combatants.caster.classState.concentrationSpellId).toBeUndefined()
  })

  it('resolves Zombie Undead Fortitude and bypasses it for radiant or critical damage', () => {
    const zombie = () => fighter('zombie', 10, {
      controller: 'dm', statBlockId: 'srd-5.1:zombie', usesDeathSaves: false,
      abilities: { ...abilities, con: 16 }, currentHp: 3, maxHp: 22,
    })
    const pending = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('undead-fortitude', [fighter('attacker', 20), zombie()]),
      {
        type: 'attack', actorId: 'attacker', targetId: 'zombie', attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 4, bonus: 0, rolls: [3], type: 'slashing' },
      },
    )
    expect(pending.ok).toBe(true)
    if (!pending.ok) return
    expect(pending.state.combatants.zombie).toMatchObject({
      currentHp: 0, deathSaves: { dead: false },
      classState: { undeadFortitudePending: { dc: 8, damage: 3, sourceId: 'attacker' } },
    })
    expect(pending.events).toContainEqual({
      type: 'undead-fortitude-save-required', targetId: 'zombie', dc: 8, damage: 3,
    })
    const survived = resolveDnd5eHeadlessAction(pending.state, {
      type: 'monster-undead-fortitude-save', actorId: 'zombie', d20: 10,
    })
    expect(survived.ok).toBe(true)
    if (!survived.ok) return
    expect(survived.state.combatants.zombie).toMatchObject({ currentHp: 1, deathSaves: { dead: false } })
    expect(survived.state.combatants.zombie.classState.undeadFortitudePending).toBeUndefined()

    const failed = resolveDnd5eHeadlessAction(pending.state, {
      type: 'monster-undead-fortitude-save', actorId: 'zombie', d20: 1,
    })
    expect(failed.ok).toBe(true)
    if (!failed.ok) return
    expect(failed.state.combatants.zombie).toMatchObject({ currentHp: 0, deathSaves: { dead: true } })
    expect(failed.state.combatants.zombie.classState.undeadFortitudePending).toBeUndefined()

    const radiant = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('radiant-zombie', [fighter('attacker', 20), zombie()]),
      {
        type: 'attack', actorId: 'attacker', targetId: 'zombie', attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 4, bonus: 0, rolls: [3], type: 'radiant' },
      },
    )
    expect(radiant.ok).toBe(true)
    if (!radiant.ok) return
    expect(radiant.state.combatants.zombie.deathSaves.dead).toBe(true)
    expect(radiant.state.combatants.zombie.classState.undeadFortitudePending).toBeUndefined()

    const critical = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('critical-zombie', [fighter('attacker', 20), zombie()]),
      {
        type: 'attack', actorId: 'attacker', targetId: 'zombie', attackModifier: 20, d20: 20,
        damage: { count: 1, sides: 4, bonus: 0, rolls: [1, 2], type: 'slashing' },
      },
    )
    expect(critical.ok).toBe(true)
    if (!critical.ok) return
    expect(critical.state.combatants.zombie.deathSaves.dead).toBe(true)
    expect(critical.state.combatants.zombie.classState.undeadFortitudePending).toBeUndefined()
  })

  it('resolves the Wolf bite Strength save and applies prone on failure', () => {
    const wolf = fighter('wolf', 20, {
      controller: 'dm', statBlockId: 'srd-5.1:wolf', usesDeathSaves: false,
      abilities: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
      currentHp: 11, maxHp: 11,
    })
    const hit = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('wolf-bite', [wolf, fighter('target', 10)]),
      {
        type: 'monster-action', actorId: 'wolf', actionId: 'bite',
        rolls: [{ targetId: 'target', d20: 12, damageRolls: [[2, 3]] }],
      },
    )
    expect(hit.ok).toBe(true)
    if (!hit.ok) return
    expect(hit.events).toContainEqual({
      type: 'monster-on-hit-save-required', targetId: 'target', sourceId: 'wolf',
      actionId: 'bite', ability: 'str', dc: 11, condition: 'prone',
    })
    const failed = resolveDnd5eHeadlessAction(hit.state, {
      type: 'monster-on-hit-save', actorId: 'target', sourceId: 'wolf', actionId: 'bite', d20: 1,
    })
    expect(failed.ok).toBe(true)
    if (!failed.ok) return
    expect(failed.state.combatants.target.conditions).toContain('prone')
    expect(failed.state.combatants.target.classState.monsterOnHitSavePending).toBeUndefined()
  })

  it('applies active Bless and Bane effects to death saves and rejects forged d4 rolls', () => {
    const blessedDying = fighter('dying', 20, {
      currentHp: 0,
      classState: { concentrationEffectsBySource: { cleric: 'bless' } },
    })
    const cleric = fighter('cleric', 10, {
      concentrating: true,
      classState: {
        concentrationSpellId: 'bless', concentrationTargetIds: ['dying'], concentrationRoundsRemaining: 10,
      },
    })
    const blessed = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('blessed-death-save', [blessedDying, cleric]),
      { type: 'death-save', actorId: 'dying', d20: 8, blessRoll: 2 },
    )
    expect(blessed.ok).toBe(true)
    if (!blessed.ok) return
    expect(blessed.state.combatants.dying.deathSaves).toMatchObject({ successes: 1, failures: 0 })

    const banedDying = fighter('dying', 20, {
      currentHp: 0,
      classState: { concentrationEffectsBySource: { bard: 'bane' } },
    })
    const bard = fighter('bard', 10, {
      concentrating: true,
      classState: {
        concentrationSpellId: 'bane', concentrationTargetIds: ['dying'], concentrationRoundsRemaining: 10,
      },
    })
    const baned = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('baned-death-save', [banedDying, bard]),
      { type: 'death-save', actorId: 'dying', d20: 10, baneRoll: 1 },
    )
    expect(baned.ok).toBe(true)
    if (!baned.ok) return
    expect(baned.state.combatants.dying.deathSaves).toMatchObject({ successes: 0, failures: 1 })

    const forged = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('forged-death-save', [fighter('dying', 20, { currentHp: 0 }), fighter('ally', 10)]),
      { type: 'death-save', actorId: 'dying', d20: 8, blessRoll: 4 },
    )
    expect(forged).toMatchObject({ ok: false, reason: 'invalid-dice' })
  })

  it('resolves concentration saves off-turn from authoritative Constitution bonuses', () => {
    const state = startDnd5eHeadlessCombat('concentration', [
      fighter('attacker', 20),
      fighter('caster', 10, { concentrating: true, savingThrowBonuses: { con: 6 }, exhaustionLevel: 3 }),
    ])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'concentration-save', actorId: 'caster', d20: 18, d20Second: 2, dc: 10,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual({
      type: 'concentration-resolved', actorId: 'caster', d20: 2, total: 8, dc: 10, success: false,
    })
    expect(result.state.combatants.caster.concentrating).toBe(false)
  })

  it('lets Diamond Soul reroll a failed concentration save and consumes one Ki', () => {
    const monk = fighter('monk', 10, {
      classId: 'monk', level: 14, concentrating: true,
      classResources: { 'dnd5e-ki': { current: 1, max: 14 } },
      savingThrowBonuses: { con: 7 },
    })
    const state = startDnd5eHeadlessCombat('diamond-soul-concentration', [fighter('attacker', 20), monk])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'concentration-save', actorId: 'monk', d20: 1, rerollD20: 20, dc: 15,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.monk.concentrating).toBe(true)
    expect(result.state.combatants.monk.classResources['dnd5e-ki']).toEqual({ current: 0, max: 14 })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: 'monk', stateKey: 'diamond-soul-reroll', active: true,
    }))
  })

  it('lets Indomitable replace a failed Stunning Strike save before the condition is applied', () => {
    const monk = fighter('monk', 20, {
      classId: 'monk', level: 5,
      classResources: { 'dnd5e-ki': { current: 1, max: 5 } },
    })
    const target = fighter('target', 10, {
      controller: 'dm', classId: 'fighter', level: 9,
      classResources: { fighterIndomitable: { current: 1, max: 1 } },
    })
    const state = startDnd5eHeadlessCombat('indomitable-stunning-strike', [monk, target])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'monk', targetId: 'target', attackModifier: 20, d20: 10,
      stunningStrikeSaveD20: 1,
      stunningStrikeSaveRerollD20: 20,
      classDamageContext: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 6,
        damageType: 'bludgeoning', adjacentEnemyOfTarget: false, stunningStrike: true,
      },
      damage: { count: 1, sides: 6, bonus: 0, rolls: [3], type: 'bludgeoning' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.classState.stunnedByActorId).toBeUndefined()
    expect(result.state.combatants.target.classResources.fighterIndomitable.current).toBe(0)
    expect(result.state.combatants.monk.classResources['dnd5e-ki'].current).toBe(0)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: 'target', d20: 20, success: true,
    }))
  })

  it('applies Bane to a Stunning Strike Constitution save in Headless', () => {
    const monk = fighter('monk', 20, {
      classId: 'monk', level: 5,
      classResources: { 'dnd5e-ki': { current: 1, max: 5 } },
    })
    const target = fighter('target', 10, {
      controller: 'dm',
      classState: { concentrationEffectsBySource: { bard: 'bane' } },
    })
    const bard = fighter('bard', 1, {
      concentrating: true,
      classState: {
        concentrationSpellId: 'bane', concentrationTargetIds: ['target'], concentrationRoundsRemaining: 10,
      },
    })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('baned-stunning-strike', [monk, target, bard]), {
      type: 'attack', actorId: 'monk', targetId: 'target', attackModifier: 20, d20: 10,
      stunningStrikeSaveD20: 10, stunningStrikeSaveBaneRoll: 2,
      classDamageContext: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 6,
        damageType: 'bludgeoning', adjacentEnemyOfTarget: false, stunningStrike: true,
      },
      damage: { count: 1, sides: 6, bonus: 0, rolls: [3], type: 'bludgeoning' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.classState.stunnedByActorId).toBe('monk')
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: 'target', modifier: 0, total: 10, success: false,
    }))
  })

  it('spends SRD class resources and turn economy atomically without AP', () => {
    const barbarian = fighter('a', 20, { classResources: { 'dnd5e-rage': { current: 2, max: 2 } } })
    const state = startDnd5eHeadlessCombat('combat', [barbarian, fighter('b', 10)])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'class-resource-use', actorId: 'a', resourceKey: 'dnd5e-rage', turnResource: 'bonusAction',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.a.classResources['dnd5e-rage']).toEqual({ current: 1, max: 2 })
    expect(result.state.combatants.a.turn.bonusActionAvailable).toBe(false)
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'class-resource-spent', resourceKey: 'dnd5e-rage', current: 1 }))
    expect(JSON.stringify(result)).not.toMatch(/actionPoints|currentAP|ap-spent/)

    const legacy = resolveDnd5eHeadlessAction(state, {
      type: 'class-resource-use', actorId: 'a', resourceKey: 'legacy-ki', turnResource: 'bonusAction',
    })
    expect(legacy).toMatchObject({ ok: false, reason: 'class-resource-unavailable' })
  })

  it('resolves barbarian Rage, physical resistance, and its end condition in Headless', () => {
    const barbarian = fighter('a', 20, { classId: 'barbarian', classResources: { 'dnd5e-rage': { current: 2, max: 2 } } })
    const state = startDnd5eHeadlessCombat('combat', [barbarian, fighter('b', 10)])
    const raged = resolveDnd5eHeadlessAction(state, { type: 'barbarian-rage', actorId: 'a' })
    expect(raged.ok).toBe(true)
    if (!raged.ok) return
    expect(raged.state.combatants.a).toMatchObject({ classState: { raging: true, rageTurnsRemaining: 10 }, turn: { bonusActionAvailable: false } })
    const hit = resolveDnd5eHeadlessAction(raged.state, {
      type: 'opportunity-attack', actorId: 'b', targetId: 'a', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [8], type: 'bludgeoning' },
    })
    expect(hit.ok).toBe(true)
    if (!hit.ok) return
    expect(hit.state.combatants.a.currentHp).toBe(16)
    const ended = resolveDnd5eHeadlessAction(hit.state, { type: 'end-turn', actorId: 'a' })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.state.combatants.a.classState).toMatchObject({ raging: true, rageTurnsRemaining: 9, rageSustainedThisTurn: false })

    const fresh = startDnd5eHeadlessCombat('fresh', [barbarian, fighter('b', 10)])
    const unsustained = resolveDnd5eHeadlessAction(fresh, { type: 'barbarian-rage', actorId: 'a' })
    expect(unsustained.ok).toBe(true)
    if (!unsustained.ok) return
    const expired = resolveDnd5eHeadlessAction(unsustained.state, { type: 'end-turn', actorId: 'a' })
    expect(expired.ok).toBe(true)
    if (!expired.ok) return
    expect(expired.state.combatants.a.classState.raging).toBeUndefined()
  })

  it('keeps a level-15 Barbarian raging without attacking or taking damage', () => {
    const barbarian = fighter('a', 20, {
      classId: 'barbarian', level: 15,
      classResources: { 'dnd5e-rage': { current: 5, max: 5 } },
    })
    const state = startDnd5eHeadlessCombat('persistent-rage', [barbarian, fighter('b', 10)])
    const raged = resolveDnd5eHeadlessAction(state, { type: 'barbarian-rage', actorId: 'a' })
    expect(raged.ok).toBe(true)
    if (!raged.ok) return
    const ended = resolveDnd5eHeadlessAction(raged.state, { type: 'end-turn', actorId: 'a' })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.state.combatants.a.classState).toMatchObject({ raging: true, rageTurnsRemaining: 9 })
  })

  it('ends Rage immediately at 0 HP and applies Frenzy exhaustion once', () => {
    const barbarian = fighter('barbarian', 10, {
      classId: 'barbarian', subclassId: 'berserker', level: 10, currentHp: 5,
      classState: { raging: true, rageTurnsRemaining: 10, frenzying: true },
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('rage-unconscious', [fighter('enemy', 20, { controller: 'dm' }), barbarian]),
      {
        type: 'attack', actorId: 'enemy', targetId: 'barbarian', attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 12, bonus: 0, rolls: [12], type: 'slashing' },
      },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.barbarian).toMatchObject({
      currentHp: 0, exhaustionLevel: 1,
      classState: { raging: undefined, frenzying: undefined, rageTurnsRemaining: undefined },
    })
    expect(result.events.filter((event) => event.type === 'exhaustion-gained')).toEqual([
      { type: 'exhaustion-gained', actorId: 'barbarian', level: 1 },
    ])
  })

  it('lets a Barbarian end an active Rage with a bonus action', () => {
    const barbarian = fighter('barbarian', 20, {
      classId: 'barbarian', subclassId: 'berserker', level: 3,
      classState: { raging: true, rageTurnsRemaining: 8, frenzying: true },
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('end-rage', [barbarian, fighter('enemy', 10)]),
      { type: 'barbarian-rage', actorId: 'barbarian', end: true },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.barbarian).toMatchObject({
      exhaustionLevel: 1,
      turn: { bonusActionAvailable: false },
      classState: { raging: undefined, frenzying: undefined, rageTurnsRemaining: undefined },
    })
    expect(result.events).toContainEqual({
      type: 'turn-resource-spent', actorId: 'barbarian', resource: 'bonusAction',
    })
  })

  it('grants bardic inspiration to another combatant using a bonus action', () => {
    const bard = fighter('a', 20, { level: 10, classId: 'bard', classResources: { 'dnd5e-bardic-inspiration': { current: 4, max: 4 } } })
    const state = startDnd5eHeadlessCombat('combat', [bard, fighter('b', 10)])
    const result = resolveDnd5eHeadlessAction(state, { type: 'bardic-inspiration', actorId: 'a', targetId: 'b' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.b.classState).toMatchObject({
      bardicInspirationDie: 10,
      bardicInspirationSourceId: 'a',
      bardicInspirationRoundsRemaining: 100,
    })
    expect(result.state.combatants.a.classResources['dnd5e-bardic-inspiration'].current).toBe(3)
  })

  it('lets a Lore Bard spend a reaction and inspiration die to reduce an attack roll', () => {
    const attacker = fighter('attacker', 20, { controller: 'dm' })
    const bard = fighter('bard', 15, {
      classId: 'bard', subclassId: 'lore', level: 5,
      classResources: { 'dnd5e-bardic-inspiration': { current: 3, max: 4 } },
    })
    const target = fighter('target', 10)
    const state = startDnd5eHeadlessCombat('cutting-words', [attacker, bard, target])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 5, d20: 11,
      cuttingWords: { bardId: 'bard', roll: 3, distanceFeet: 30 },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: 'attacker', targetId: 'target', total: 13, hit: false,
    }))
    expect(result.state.combatants.bard.turn.reactionAvailable).toBe(false)
    expect(result.state.combatants.bard.classResources['dnd5e-bardic-inspiration']).toEqual({ current: 2, max: 4 })
    expect(result.state.combatants.target.currentHp).toBe(20)
  })

  it('applies Cutting Words to a damage roll before damage resistance', () => {
    const attacker = fighter('attacker', 20, { controller: 'dm' })
    const bard = fighter('bard', 15, {
      classId: 'bard', subclassId: 'lore', level: 5,
      classResources: { 'dnd5e-bardic-inspiration': { current: 2, max: 3 } },
    })
    const target = fighter('target', 10, { damageResistances: ['slashing'] })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('cutting-damage', [attacker, bard, target]),
      {
        type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 5, d20: 15,
        cuttingWordsDamage: { bardId: 'bard', roll: 3, distanceFeet: 30 },
        damage: { count: 1, sides: 8, bonus: 3, rolls: [8], type: 'slashing' },
      },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.currentHp).toBe(16)
    expect(result.state.combatants.bard.turn.reactionAvailable).toBe(false)
    expect(result.state.combatants.bard.classResources['dnd5e-bardic-inspiration'].current).toBe(1)
  })

  it('does not let Cutting Words cancel a natural 20 or affect a creature that cannot hear it', () => {
    const bard = fighter('bard', 15, {
      classId: 'bard', subclassId: 'lore', level: 5,
      classResources: { 'dnd5e-bardic-inspiration': { current: 2, max: 4 } },
    })
    const criticalState = startDnd5eHeadlessCombat('cutting-words-critical', [fighter('attacker', 20, { controller: 'dm' }), bard, fighter('target', 10)])
    const critical = resolveDnd5eHeadlessAction(criticalState, {
      type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 5, d20: 20,
      cuttingWords: { bardId: 'bard', roll: 8, distanceFeet: 30 },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [4, 4] },
    })
    expect(critical.ok).toBe(true)
    if (critical.ok) expect(critical.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', hit: true, critical: true, total: 17 }))

    const deafState = startDnd5eHeadlessCombat('cutting-words-deaf', [
      fighter('attacker', 20, { controller: 'dm', conditions: ['耳聋'] }), bard, fighter('target', 10),
    ])
    expect(resolveDnd5eHeadlessAction(deafState, {
      type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 5, d20: 11,
      cuttingWords: { bardId: 'bard', roll: 3, distanceFeet: 30 },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [4] },
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })

    const silencedState = startDnd5eHeadlessCombat('cutting-words-silenced', [
      fighter('attacker', 20, { controller: 'dm' }),
      fighter('bard', 15, {
        classId: 'bard', subclassId: 'lore', level: 5, conditions: ['沉默'],
        classResources: { 'dnd5e-bardic-inspiration': { current: 2, max: 4 } },
      }),
      fighter('target', 10),
    ])
    expect(resolveDnd5eHeadlessAction(silencedState, {
      type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 5, d20: 11,
      cuttingWords: { bardId: 'bard', roll: 3, distanceFeet: 30 },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [4] },
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('applies Cutting Words before Stroke of Luck turns the resulting miss into a hit', () => {
    const attacker = fighter('attacker', 20, {
      classId: 'rogue', level: 20,
      classResources: { 'dnd5e-stroke-of-luck': { current: 1, max: 1 } },
    })
    const bard = fighter('bard', 15, {
      controller: 'dm', classId: 'bard', subclassId: 'lore', level: 5,
      classResources: { 'dnd5e-bardic-inspiration': { current: 2, max: 4 } },
    })
    const state = startDnd5eHeadlessCombat('cutting-words-before-stroke', [attacker, bard, fighter('target', 10, { controller: 'dm' })])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 5, d20: 11,
      cuttingWords: { bardId: 'bard', roll: 3, distanceFeet: 30 },
      strokeOfLuck: true,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [4] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: 'attacker', targetId: 'target', total: 13, hit: true,
    }))
    expect(result.state.combatants.attacker.classResources['dnd5e-stroke-of-luck'].current).toBe(0)
  })

  it('starts Countercharm with an action and keeps it through the end of the activation turn', () => {
    const bard = fighter('a', 20, { level: 6, classId: 'bard' })
    const state = startDnd5eHeadlessCombat('countercharm', [bard, fighter('b', 10)])
    const started = resolveDnd5eHeadlessAction(state, { type: 'bard-countercharm', actorId: 'a' })
    expect(started.ok).toBe(true)
    if (!started.ok) return
    expect(started.state.combatants.a).toMatchObject({
      turn: { actionAvailable: false }, classState: { countercharmRoundsRemaining: 2 },
    })
    const ended = resolveDnd5eHeadlessAction(started.state, { type: 'end-turn', actorId: 'a' })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.state.combatants.a.classState.countercharmRoundsRemaining).toBe(1)

    const locked = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('countercharm-locked', [fighter('a', 20, { level: 5, classId: 'bard' }), fighter('b', 10)]),
      { type: 'bard-countercharm', actorId: 'a' },
    )
    expect(locked).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('adds and consumes a held Bardic Inspiration die on an attack roll', () => {
    const inspired = fighter('a', 20, {
      classState: { bardicInspirationDie: 6, bardicInspirationSourceId: 'bard', bardicInspirationRoundsRemaining: 100 },
    })
    const state = startDnd5eHeadlessCombat('bardic-attack', [inspired, fighter('b', 12)])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 2,
      d20: 9, bardicInspirationRoll: 5,
      damage: { count: 1, sides: 8, bonus: 2, rolls: [5], type: 'slashing' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: 'a', total: 16, hit: true,
    }))
    expect(result.state.combatants.a.classState.bardicInspirationDie).toBeUndefined()
    expect(result.state.combatants.a.classState.bardicInspirationSourceId).toBeUndefined()
    expect(result.state.combatants.b.currentHp).toBe(13)
  })

  it('adds and consumes Bardic Inspiration on saving throws before a class reroll', () => {
    const inspired = fighter('a', 20, {
      concentrating: true,
      classState: { bardicInspirationDie: 8, bardicInspirationSourceId: 'bard', bardicInspirationRoundsRemaining: 100 },
    })
    const state = startDnd5eHeadlessCombat('bardic-save', [inspired, fighter('b', 10)])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'concentration-save', actorId: 'a', d20: 5, bardicInspirationRoll: 3, dc: 10,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'concentration-resolved', actorId: 'a', total: 10, success: true,
    }))
    expect(result.state.combatants.a.concentrating).toBe(true)
    expect(result.state.combatants.a.classState.bardicInspirationDie).toBeUndefined()
  })

  it("adds the Fiend warlock's Dark One's Own Luck d10 to a saving throw and consumes its short-rest use", () => {
    const warlock = fighter('warlock', 20, {
      classId: 'warlock', subclassId: 'fiend', level: 6, concentrating: true,
      classResources: { 'dnd5e-dark-ones-own-luck': { current: 1, max: 1 } },
    })
    const state = startDnd5eHeadlessCombat('dark-ones-own-luck', [warlock, fighter('enemy', 10)])
    expect(dnd5eDarkOnesOwnLuckAvailable(state.combatants.warlock)).toBe(true)
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'concentration-save', actorId: 'warlock', d20: 5, darkOnesOwnLuckRoll: 3, dc: 10,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'concentration-resolved', actorId: 'warlock', total: 10, success: true,
    }))
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: 'warlock', stateKey: 'dark-ones-own-luck', active: true, value: 3,
    }))
    expect(result.state.combatants.warlock.classResources['dnd5e-dark-ones-own-luck'].current).toBe(0)
    expect(dnd5eDarkOnesOwnLuckAvailable(result.state.combatants.warlock)).toBe(false)
  })

  it("rejects Dark One's Own Luck when the subclass, resource, or d10 result is invalid", () => {
    const warlock = fighter('warlock', 20, {
      classId: 'warlock', subclassId: 'fiend', level: 6, concentrating: true,
      classResources: { 'dnd5e-dark-ones-own-luck': { current: 1, max: 1 } },
    })
    const state = startDnd5eHeadlessCombat('dark-ones-own-luck-invalid', [warlock, fighter('enemy', 10)])
    const invalidDie = resolveDnd5eHeadlessAction(state, {
      type: 'concentration-save', actorId: 'warlock', d20: 5, darkOnesOwnLuckRoll: 11, dc: 10,
    })
    expect(invalidDie).toMatchObject({ ok: false, reason: 'invalid-dice' })

    state.combatants.warlock.subclassId = 'other'
    state.combatants.warlock.subclassIds = { warlock: 'other' }
    const invalidSubclass = resolveDnd5eHeadlessAction(state, {
      type: 'concentration-save', actorId: 'warlock', d20: 5, darkOnesOwnLuckRoll: 3, dc: 10,
    })
    expect(invalidSubclass).toMatchObject({ ok: false, reason: 'invalid-dice' })
  })

  it('keeps Hurl Through Hell readied across a miss, then returns the hit target at the end of the warlock next turn', () => {
    const warlock = fighter('warlock', 20, {
      classId: 'warlock', subclassId: 'fiend', level: 14,
      classResources: { 'dnd5e-hurl-through-hell': { current: 1, max: 1 } },
    })
    const target = fighter('target', 10, { controller: 'dm', currentHp: 100, maxHp: 100 })
    const state = startDnd5eHeadlessCombat('hurl-through-hell', [warlock, target])
    const readied = resolveDnd5eHeadlessAction(state, {
      type: 'warlock-hurl-through-hell-ready', actorId: 'warlock', active: true,
    })
    expect(readied.ok).toBe(true)
    if (!readied.ok) return

    const missed = resolveDnd5eHeadlessAction(readied.state, {
      type: 'attack', actorId: 'warlock', targetId: 'target', attackModifier: 0, d20: 2,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [] },
    })
    expect(missed.ok).toBe(true)
    if (!missed.ok) return
    expect(missed.state.combatants.warlock.classState.hurlThroughHellReady).toBe(true)
    expect(missed.state.combatants.warlock.classResources['dnd5e-hurl-through-hell'].current).toBe(1)

    missed.state.combatants.warlock.turn.actionAvailable = true
    const hit = resolveDnd5eHeadlessAction(missed.state, {
      type: 'attack', actorId: 'warlock', targetId: 'target', attackModifier: 20, d20: 10,
      hurlThroughHellDamageRolls: Array(10).fill(5),
      damage: { count: 1, sides: 4, bonus: 0, rolls: [1], type: 'slashing' },
    })
    expect(hit.ok).toBe(true)
    if (!hit.ok) return
    expect(hit.state.combatants.warlock.classResources['dnd5e-hurl-through-hell'].current).toBe(0)
    expect(hit.state.combatants.target).toMatchObject({
      currentHp: 99,
      classState: { hurlThroughHellSourceId: 'warlock', hurlThroughHellDamage: 50 },
    })
    expect(hit.state.combatants.target.conditions).toContain('banished')

    const currentTurnEnded = resolveDnd5eHeadlessAction(hit.state, { type: 'end-turn', actorId: 'warlock' })
    expect(currentTurnEnded.ok).toBe(true)
    if (!currentTurnEnded.ok) return
    expect(currentTurnEnded.state.combatants.target.conditions).toContain('banished')

    const targetTurnEnded = resolveDnd5eHeadlessAction(currentTurnEnded.state, { type: 'end-turn', actorId: 'target' })
    expect(targetTurnEnded.ok).toBe(true)
    if (!targetTurnEnded.ok) return
    const returned = resolveDnd5eHeadlessAction(targetTurnEnded.state, { type: 'end-turn', actorId: 'warlock' })
    expect(returned.ok).toBe(true)
    if (!returned.ok) return
    expect(returned.state.combatants.target.currentHp).toBe(49)
    expect(returned.state.combatants.target.conditions).not.toContain('banished')
    expect(returned.state.combatants.target.classState.hurlThroughHellSourceId).toBeUndefined()
    expect(returned.events).toContainEqual(expect.objectContaining({
      type: 'damage-applied', sourceId: 'warlock', targetId: 'target', amount: 50,
    }))
  })

  it('triggers Hurl Through Hell on a spell attack but deals no return damage to a fiend', () => {
    const warlock = fighter('warlock', 20, {
      classId: 'warlock', subclassId: 'fiend', level: 14,
      classSelections: { 'spell-cantrips': ['chill-touch'] },
      classResources: { 'dnd5e-hurl-through-hell': { current: 1, max: 1 } },
    })
    const fiend = fighter('fiend', 10, {
      controller: 'dm', currentHp: 100, maxHp: 100, creatureType: 'fiend', armorClass: 10,
    })
    const state = startDnd5eHeadlessCombat('hurl-through-hell-spell', [warlock, fiend])
    const readied = resolveDnd5eHeadlessAction(state, {
      type: 'warlock-hurl-through-hell-ready', actorId: 'warlock', active: true,
    })
    expect(readied.ok).toBe(true)
    if (!readied.ok) return
    const cast = resolveDnd5eHeadlessAction(readied.state, {
      type: 'cast-spell', actorId: 'warlock', targetId: 'fiend', spellId: 'chill-touch', slotLevel: 0,
      d20: 20, effectRolls: [1, 1, 1, 1, 1, 1], hurlThroughHellDamageRolls: Array(10).fill(10),
    })
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    const hpAfterSpell = cast.state.combatants.fiend.currentHp
    const currentTurnEnded = resolveDnd5eHeadlessAction(cast.state, { type: 'end-turn', actorId: 'warlock' })
    expect(currentTurnEnded.ok).toBe(true)
    if (!currentTurnEnded.ok) return
    const fiendTurnEnded = resolveDnd5eHeadlessAction(currentTurnEnded.state, { type: 'end-turn', actorId: 'fiend' })
    expect(fiendTurnEnded.ok).toBe(true)
    if (!fiendTurnEnded.ok) return
    const returned = resolveDnd5eHeadlessAction(fiendTurnEnded.state, { type: 'end-turn', actorId: 'warlock' })
    expect(returned.ok).toBe(true)
    if (!returned.ok) return
    expect(returned.state.combatants.fiend.currentHp).toBe(hpAfterSpell)
    expect(returned.state.combatants.fiend.conditions).not.toContain('banished')
  })

  it('expires an unused Bardic Inspiration die after its remaining duration', () => {
    const inspired = fighter('a', 20, {
      classState: { bardicInspirationDie: 6, bardicInspirationSourceId: 'bard', bardicInspirationRoundsRemaining: 1 },
    })
    const state = startDnd5eHeadlessCombat('bardic-expiry', [inspired, fighter('b', 10)])
    const result = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: 'a' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.a.classState.bardicInspirationDie).toBeUndefined()
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: 'a', stateKey: 'bardic-inspiration', active: false,
    }))
  })

  it('lets a level-20 Rogue turn a missed attack into a hit with Stroke of Luck', () => {
    const rogue = fighter('a', 20, {
      classId: 'rogue', level: 20,
      classResources: { 'dnd5e-stroke-of-luck': { current: 1, max: 1 } },
    })
    const state = startDnd5eHeadlessCombat('stroke-of-luck', [rogue, fighter('b', 10)])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 0,
      d20: 1, strokeOfLuck: true,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [4], type: 'piercing' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: 'a', hit: true, critical: false,
    }))
    expect(result.state.combatants.b.currentHp).toBe(16)
    expect(result.state.combatants.a.classResources['dnd5e-stroke-of-luck'].current).toBe(0)
  })

  it('applies Foe Slayer once per turn against a selected favored enemy', () => {
    const ranger = fighter('a', 20, {
      classId: 'ranger', level: 20,
      classSelections: { 'favored-enemy': ['favored-亡灵'] },
    })
    const undead = fighter('b', 10, { armorClass: 11, creatureType: '亡灵' })
    const state = startDnd5eHeadlessCombat('foe-slayer', [ranger, undead])
    const context = {
      mode: 'melee' as const,
      finesse: false,
      strengthBased: true,
      weaponDamageSides: 8,
      damageType: 'slashing' as const,
      adjacentEnemyOfTarget: false,
      foeSlayer: 'attack' as const,
    }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 0, d20: 10,
      classDamageContext: context,
      classDamageRolls: [],
      damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'slashing' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: 'a', total: 11, hit: true,
    }))
    expect(result.state.combatants.a.classState.foeSlayerTurnKey).toBe('foe-slayer:1:a')
  })

  it('resolves Lay on Hands, Wholeness of Body, and Preserve Life with rule caps', () => {
    const paladin = fighter('p', 20, { classId: 'paladin', classResources: { 'dnd5e-lay-on-hands': { current: 25, max: 25 } } })
    const wounded = fighter('w', 10, { currentHp: 5 })
    const paladinState = startDnd5eHeadlessCombat('paladin', [paladin, wounded])
    const lay = resolveDnd5eHeadlessAction(paladinState, { type: 'paladin-lay-on-hands', actorId: 'p', targetId: 'w', amount: 7 })
    expect(lay.ok).toBe(true)
    if (!lay.ok) return
    expect(lay.state.combatants.w.currentHp).toBe(12)
    expect(lay.state.combatants.p.classResources['dnd5e-lay-on-hands'].current).toBe(18)

    const monk = fighter('m', 20, { level: 6, classId: 'monk', subclassId: 'open-hand', currentHp: 1, maxHp: 30, classResources: { 'dnd5e-wholeness-of-body': { current: 1, max: 1 } } })
    const monkState = startDnd5eHeadlessCombat('monk', [monk, fighter('x', 10)])
    const whole = resolveDnd5eHeadlessAction(monkState, { type: 'monk-wholeness-of-body', actorId: 'm' })
    expect(whole.ok).toBe(true)
    if (!whole.ok) return
    expect(whole.state.combatants.m.currentHp).toBe(19)

    const cleric = fighter('c', 20, { level: 5, classId: 'cleric', subclassId: 'life', classResources: { 'dnd5e-channel-divinity': { current: 1, max: 1 } } })
    const ally = fighter('y', 10, { currentHp: 2, maxHp: 20 })
    const clericState = startDnd5eHeadlessCombat('cleric', [cleric, ally])
    const preserve = resolveDnd5eHeadlessAction(clericState, { type: 'cleric-preserve-life', actorId: 'c', allocations: [{ targetId: 'y', amount: 8 }] })
    expect(preserve.ok).toBe(true)
    if (!preserve.ok) return
    expect(preserve.state.combatants.y.currentHp).toBe(10)
    const overHalf = resolveDnd5eHeadlessAction(clericState, { type: 'cleric-preserve-life', actorId: 'c', allocations: [{ targetId: 'y', amount: 9 }] })
    expect(overHalf).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
    const undead = fighter('u', 10, { currentHp: 2, maxHp: 20, creatureType: '亡灵' })
    const undeadState = startDnd5eHeadlessCombat('cleric-undead', [cleric, undead])
    expect(resolveDnd5eHeadlessAction(undeadState, {
      type: 'cleric-preserve-life', actorId: 'c', allocations: [{ targetId: 'u', amount: 8 }],
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('enforces Turn Undead movement, action, reaction, and damage-ending rules in Headless', () => {
    const cleric = fighter('cleric', 20, {
      classId: 'cleric', level: 2, abilities: { ...abilities, wis: 16 }, position: { x: 0, y: 0 },
      classResources: { 'dnd5e-channel-divinity': { current: 1, max: 1 } },
    })
    const skeleton = fighter('skeleton', 10, {
      controller: 'dm', creatureType: '亡灵', challengeRating: 0.25,
      position: { x: 30, y: 0 }, savingThrowBonuses: { wis: -1 },
    })
    const state = startDnd5eHeadlessCombat('turn-undead', [cleric, skeleton])
    const turned = resolveDnd5eHeadlessAction(state, {
      type: 'cleric-turn-undead', actorId: 'cleric', targets: [{ targetId: 'skeleton', d20: 1 }],
    })
    expect(turned.ok).toBe(true)
    if (!turned.ok) return
    expect(turned.state.combatants.skeleton.classState).toMatchObject({
      turnedByClericId: 'cleric', turnedRoundsRemaining: 10,
    })
    expect(turned.state.combatants.skeleton.conditions).toContain('turned')
    expect(turned.state.combatants.cleric.classResources['dnd5e-channel-divinity'].current).toBe(0)

    const clericEnded = resolveDnd5eHeadlessAction(turned.state, { type: 'end-turn', actorId: 'cleric' })
    expect(clericEnded.ok).toBe(true)
    if (!clericEnded.ok) return
    expect(resolveDnd5eHeadlessAction(clericEnded.state, {
      type: 'attack', actorId: 'skeleton', targetId: 'cleric', attackModifier: 4, d20: 20,
      damage: { count: 1, sides: 6, bonus: 2, rolls: [6, 6] },
    })).toMatchObject({ ok: false, reason: 'invalid-actor' })
    expect(resolveDnd5eHeadlessAction(clericEnded.state, {
      type: 'move', actorId: 'skeleton', to: { x: 20, y: 0 }, distance: 10,
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
    const fled = resolveDnd5eHeadlessAction(clericEnded.state, {
      type: 'move', actorId: 'skeleton', to: { x: 50, y: 0 }, distance: 20,
    })
    expect(fled.ok).toBe(true)

    const damageState = startDnd5eHeadlessCombat('turn-undead-damage', [
      fighter('attacker', 20),
      fighter('undead', 10, {
        controller: 'dm', creatureType: '亡灵',
        classState: { turnedByClericId: 'cleric', turnedRoundsRemaining: 10 }, conditions: ['turned'],
      }),
    ])
    const damaged = resolveDnd5eHeadlessAction(damageState, {
      type: 'attack', actorId: 'attacker', targetId: 'undead', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [1] },
    })
    expect(damaged.ok).toBe(true)
    if (!damaged.ok) return
    expect(damaged.state.combatants.undead.classState.turnedByClericId).toBeUndefined()
    expect(damaged.state.combatants.undead.conditions).not.toContain('turned')
  })

  it('rejects a forged Turn Undead target that is not undead', () => {
    const cleric = fighter('cleric', 20, {
      classId: 'cleric', level: 2,
      classResources: { 'dnd5e-channel-divinity': { current: 1, max: 1 } },
    })
    const state = startDnd5eHeadlessCombat('forged-turn-undead', [cleric, fighter('humanoid', 10, { controller: 'dm' })])
    expect(resolveDnd5eHeadlessAction(state, {
      type: 'cleric-turn-undead', actorId: 'cleric', targets: [{ targetId: 'humanoid', d20: 1 }],
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('ends the caster concentration when Cleansing Touch removes its final affected target', () => {
    const paladin = fighter('paladin', 20, {
      classId: 'paladin', level: 14,
      classResources: { 'dnd5e-cleansing-touch': { current: 1, max: 1 } },
      classState: { concentrationEffectsBySource: { caster: 'shield-of-faith' } },
    })
    const caster = fighter('caster', 15, {
      classId: 'cleric', concentrating: true,
      classState: {
        concentrationSpellId: 'shield-of-faith',
        concentrationTargetIds: ['paladin'],
        concentrationRoundsRemaining: 100,
      },
    })
    const state = startDnd5eHeadlessCombat('cleansing-touch', [paladin, caster])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'paladin-cleansing-touch', actorId: 'paladin', targetId: 'paladin',
      sourceId: 'caster', spellId: 'shield-of-faith',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.paladin).toMatchObject({
      classResources: { 'dnd5e-cleansing-touch': { current: 0, max: 1 } },
      turn: { actionAvailable: false },
      classState: { concentrationEffectsBySource: undefined },
    })
    expect(result.state.combatants.caster).toMatchObject({
      concentrating: false,
      classState: { concentrationSpellId: undefined, concentrationTargetIds: undefined },
    })
  })

  it('spends five Lay on Hands points to cure disease or neutralize poison', () => {
    const paladin = fighter('paladin', 20, {
      classId: 'paladin', level: 5,
      classResources: { 'dnd5e-lay-on-hands': { current: 10, max: 25 } },
    })
    const ally = fighter('ally', 10, { conditions: ['疾病', '中毒'] })
    const disease = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('lay-cure', [paladin, ally]), {
      type: 'paladin-lay-on-hands', actorId: 'paladin', targetId: 'ally', cure: 'disease',
    })
    expect(disease.ok).toBe(true)
    if (!disease.ok) return
    expect(disease.state.combatants.ally.conditions).toEqual(['中毒'])
    expect(disease.state.combatants.paladin.classResources['dnd5e-lay-on-hands'].current).toBe(5)
    expect(disease.events).toContainEqual({ type: 'condition-ended', targetId: 'ally', condition: '疾病' })

    const undead = fighter('undead', 10, { creatureType: '亡灵', conditions: ['中毒'] })
    expect(resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('lay-undead', [paladin, undead]), {
      type: 'paladin-lay-on-hands', actorId: 'paladin', targetId: 'undead', cure: 'poisoned',
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('turns fiends and undead with the Devotion Channel Divinity without Destroy Undead', () => {
    const paladin = fighter('paladin', 20, {
      classId: 'paladin', subclassId: 'devotion', level: 5, abilities: { ...abilities, cha: 16 },
      classResources: { 'dnd5e-channel-divinity': { current: 1, max: 1 } },
    })
    const fiend = fighter('fiend', 10, { controller: 'dm', creatureType: '邪魔', challengeRating: 0.25 })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('turn-unholy', [paladin, fiend]), {
      type: 'paladin-turn-the-unholy', actorId: 'paladin', targets: [{ targetId: 'fiend', d20: 1 }],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.fiend).toMatchObject({
      currentHp: 20,
      classState: { turnedByClericId: 'paladin', turnedRoundsRemaining: 10 },
    })
    expect(result.events).toContainEqual({ type: 'unholy-turned', actorId: 'paladin', targetId: 'fiend', rounds: 10 })
  })

  it('resolves Divine Intervention chance, automatic success, and seven-day lockout', () => {
    const cleric = fighter('cleric', 20, {
      classId: 'cleric', level: 10,
      classResources: { 'dnd5e-divine-intervention': { current: 1, max: 1 } },
    })
    const success = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('intervention', [cleric, fighter('enemy', 10)]), {
      type: 'cleric-divine-intervention', actorId: 'cleric', d100: 10,
    })
    expect(success.ok).toBe(true)
    if (!success.ok) return
    expect(success.state.combatants.cleric.classState.divineInterventionCooldownDays).toBe(7)
    expect(success.events).toContainEqual({
      type: 'divine-intervention-resolved', actorId: 'cleric', d100: 10,
      success: true, automatic: false, cooldownDays: 7,
    })

    const highCleric = fighter('high-cleric', 20, {
      classId: 'cleric', level: 20,
      classResources: { 'dnd5e-divine-intervention': { current: 1, max: 1 } },
    })
    const automatic = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('intervention-20', [highCleric, fighter('enemy', 10)]), {
      type: 'cleric-divine-intervention', actorId: 'high-cleric',
    })
    expect(automatic.ok).toBe(true)
    if (!automatic.ok) return
    expect(automatic.events).toContainEqual({
      type: 'divine-intervention-resolved', actorId: 'high-cleric', d100: undefined,
      success: true, automatic: true, cooldownDays: 7,
    })
  })

  it('applies Holy Nimbus radiant damage at an enemy turn start and tracks duration', () => {
    const paladin = fighter('paladin', 20, {
      classId: 'paladin', subclassId: 'devotion', level: 20,
      classResources: { 'dnd5e-holy-nimbus': { current: 1, max: 1 } },
    })
    const enemy = fighter('enemy', 10, { controller: 'dm', holyNimbusSourceIds: ['paladin'] })
    const activated = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('holy-nimbus', [paladin, enemy]), {
      type: 'paladin-holy-nimbus', actorId: 'paladin',
    })
    expect(activated.ok).toBe(true)
    if (!activated.ok) return
    const ended = resolveDnd5eHeadlessAction(activated.state, { type: 'end-turn', actorId: 'paladin' })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.state.combatants.paladin.classState.holyNimbusRoundsRemaining).toBe(9)
    expect(ended.state.combatants.enemy.currentHp).toBe(10)
    expect(ended.events).toContainEqual(expect.objectContaining({
      type: 'damage-applied', sourceId: 'paladin', targetId: 'enemy', amount: 10,
    }))
  })

  it('toggles Draconic Wings as a bonus action and rejects unmodified armor', () => {
    const sorcerer = fighter('sorcerer', 20, {
      classId: 'sorcerer', subclassId: 'draconic', level: 14,
    })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('wings', [sorcerer, fighter('enemy', 10)]), {
      type: 'sorcerer-draconic-wings', actorId: 'sorcerer', active: true,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.sorcerer).toMatchObject({
      classState: { draconicWingsActive: true }, turn: { bonusActionAvailable: false },
    })

    const armored = fighter('armored', 20, {
      classId: 'sorcerer', subclassId: 'draconic', level: 14, wearingArmor: true,
    })
    expect(resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('armored-wings', [armored, fighter('enemy', 10)]), {
      type: 'sorcerer-draconic-wings', actorId: 'armored', active: true,
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('runs Draconic Presence saves at turn start and ends its conditions with concentration', () => {
    const sorcerer = fighter('sorcerer', 20, {
      classId: 'sorcerer', subclassId: 'draconic', level: 18, proficiencyBonus: 6,
      abilities: { ...abilities, cha: 18 },
      classResources: { 'dnd5e-sorcery-points': { current: 18, max: 18 } },
    })
    const enemy = fighter('enemy', 10, {
      controller: 'dm', draconicPresenceSourceIds: ['sorcerer'], savingThrowBonuses: { wis: 0 },
    })
    const activated = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('presence', [sorcerer, enemy]), {
      type: 'sorcerer-draconic-presence', actorId: 'sorcerer', mode: 'fear',
    })
    expect(activated.ok).toBe(true)
    if (!activated.ok) return
    expect(activated.state.combatants.sorcerer).toMatchObject({
      concentrating: true,
      classResources: { 'dnd5e-sorcery-points': { current: 13, max: 18 } },
      classState: { concentrationSpellId: 'class:draconic-presence:fear', concentrationRoundsRemaining: 10 },
    })
    const turnStarted = resolveDnd5eHeadlessAction(activated.state, { type: 'end-turn', actorId: 'sorcerer' })
    expect(turnStarted.ok).toBe(true)
    if (!turnStarted.ok) return
    expect(turnStarted.events).toContainEqual({
      type: 'draconic-presence-save-required', targetId: 'enemy', sourceId: 'sorcerer', mode: 'fear', dc: 18,
    })
    const failed = resolveDnd5eHeadlessAction(turnStarted.state, {
      type: 'sorcerer-draconic-presence-save', actorId: 'enemy', sourceId: 'sorcerer', d20: 1,
    })
    expect(failed.ok).toBe(true)
    if (!failed.ok) return
    expect(failed.state.combatants.enemy.conditions).toContain('frightened')
    expect(failed.state.combatants.enemy.classState.concentrationEffectsBySource).toEqual({
      sorcerer: 'class:draconic-presence:fear',
    })

    const concentrationEnded = resolveDnd5eHeadlessAction(failed.state, {
      type: 'concentration-save', actorId: 'sorcerer', d20: 1, dc: 10,
    })
    expect(concentrationEnded.ok).toBe(true)
    if (!concentrationEnded.ok) return
    expect(concentrationEnded.state.combatants.sorcerer.concentrating).toBe(false)
    expect(concentrationEnded.state.combatants.enemy.conditions).not.toContain('frightened')
  })

  it('does not register Draconic Presence against an immune creature', () => {
    const sorcerer = fighter('sorcerer', 20, {
      classId: 'sorcerer', subclassId: 'draconic', level: 18, proficiencyBonus: 6,
      abilities: { ...abilities, cha: 18 },
      classResources: { 'dnd5e-sorcery-points': { current: 18, max: 18 } },
    })
    const enemy = fighter('enemy', 10, {
      controller: 'dm', draconicPresenceSourceIds: ['sorcerer'], savingThrowBonuses: { wis: 0 },
      conditionImmunities: ['frightened'],
    })
    const activated = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('presence-immunity', [sorcerer, enemy]), {
      type: 'sorcerer-draconic-presence', actorId: 'sorcerer', mode: 'fear',
    })
    expect(activated.ok).toBe(true)
    if (!activated.ok) return
    const turnStarted = resolveDnd5eHeadlessAction(activated.state, { type: 'end-turn', actorId: 'sorcerer' })
    expect(turnStarted.ok).toBe(true)
    if (!turnStarted.ok) return
    expect(turnStarted.events).not.toContainEqual(expect.objectContaining({
      type: 'draconic-presence-save-required', targetId: 'enemy',
    }))
    expect(turnStarted.state.combatants.enemy.conditions).not.toContain('frightened')
    expect(turnStarted.state.combatants.enemy.classState.concentrationEffectsBySource).toBeUndefined()
    expect(turnStarted.state.combatants.sorcerer.classState.concentrationTargetIds).toEqual([])
  })

  it('converts sorcery points and spell slots in both directions as bonus actions', () => {
    const sorcerer = fighter('s', 20, { classId: 'sorcerer', level: 5, classResources: {
      'dnd5e-sorcery-points': { current: 5, max: 5 },
      'dnd5e-spell-slot-2': { current: 1, max: 3 },
    } })
    const state = startDnd5eHeadlessCombat('create', [sorcerer, fighter('x', 10)])
    const created = resolveDnd5eHeadlessAction(state, { type: 'sorcerer-create-spell-slot', actorId: 's', slotLevel: 2 })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(created.state.combatants.s.classResources).toMatchObject({
      'dnd5e-sorcery-points': { current: 2, max: 5 },
      'dnd5e-spell-slot-2': { current: 2, max: 3 },
    })

    const convertSorcerer = fighter('s', 20, { classId: 'sorcerer', level: 5, classResources: {
      'dnd5e-sorcery-points': { current: 1, max: 5 },
      'dnd5e-spell-slot-2': { current: 2, max: 3 },
    } })
    const convertState = startDnd5eHeadlessCombat('convert', [convertSorcerer, fighter('x', 10)])
    const converted = resolveDnd5eHeadlessAction(convertState, { type: 'sorcerer-convert-spell-slot', actorId: 's', slotLevel: 2 })
    expect(converted.ok).toBe(true)
    if (!converted.ok) return
    expect(converted.state.combatants.s.classResources).toMatchObject({
      'dnd5e-sorcery-points': { current: 3, max: 5 },
      'dnd5e-spell-slot-2': { current: 1, max: 3 },
    })
  })

  it('keeps Hunter\'s Mark in concentration state and adds 1d6 to weapon hits', () => {
    const ranger = fighter('r', 20, {
      classId: 'ranger', level: 5,
      classSelections: { 'spell-known': ['hunters-mark'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 4, max: 4 } },
    })
    const state = startDnd5eHeadlessCombat('hunters-mark', [ranger, fighter('target', 10, { controller: 'dm' })])
    const marked = resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell', actorId: 'r', targetId: 'target', spellId: 'hunters-mark', slotLevel: 1,
      effectRolls: [],
    })
    expect(marked.ok).toBe(true)
    if (!marked.ok) return
    expect(marked.state.combatants.r).toMatchObject({
      concentrating: true,
      classState: { huntersMarkTargetId: 'target' },
      classResources: { 'dnd5e-spell-slot-1': { current: 3, max: 4 } },
      turn: { actionAvailable: true, bonusActionAvailable: false },
    })

    const hit = resolveDnd5eHeadlessAction(marked.state, {
      type: 'attack', actorId: 'r', targetId: 'target', attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [5], type: 'slashing' },
      classDamageContext: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
        damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
      classDamageRolls: [{ source: 'hunters-mark', rolls: [4] }],
    })
    expect(hit.ok).toBe(true)
    if (!hit.ok) return
    expect(hit.state.combatants.target.currentHp).toBe(11)
    expect(hit.events).toContainEqual({
      type: 'class-damage-applied', actorId: 'r', targetId: 'target', source: 'hunters-mark', amount: 4,
    })
  })

  it('moves Hunter\'s Mark from a defeated target without spending another spell slot', () => {
    const ranger = fighter('r', 20, {
      classId: 'ranger', level: 5, concentrating: true,
      classState: { huntersMarkTargetId: 'old' },
      classResources: { 'dnd5e-spell-slot-1': { current: 3, max: 4 } },
    })
    const state = startDnd5eHeadlessCombat('move-hunters-mark', [
      ranger,
      fighter('old', 10, { controller: 'dm', currentHp: 0 }),
      fighter('next', 5, { controller: 'dm' }),
    ])
    const moved = resolveDnd5eHeadlessAction(state, {
      type: 'ranger-move-hunters-mark', actorId: 'r', targetId: 'next',
    })
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    expect(moved.state.combatants.r).toMatchObject({
      concentrating: true,
      classState: { huntersMarkTargetId: 'next' },
      classResources: { 'dnd5e-spell-slot-1': { current: 3, max: 4 } },
      turn: { bonusActionAvailable: false },
    })
  })

  it('resolves Wild Shape as an authoritative dual-HP transformation', () => {
    const druid = fighter('druid', 20, {
      classId: 'druid', level: 2, concentrating: true,
      abilities: { str: 8, dex: 14, con: 14, int: 12, wis: 16, cha: 10 },
      baseSavingThrowBonuses: { str: -1, dex: 2, con: 2, int: 3, wis: 5, cha: 0 },
      savingThrowBonuses: { str: -1, dex: 2, con: 2, int: 3, wis: 5, cha: 0 },
      savingThrowProficiencies: ['int', 'wis'],
      classResources: { 'dnd5e-wild-shape': { current: 2, max: 2 } },
      classSelections: { 'wild-shape-known-forms': ['srd-5.1:wolf'] },
      magicResistance: true,
      limitedMagicImmunity: {
        kind: 'limited-magic-immunity',
        maximumSpellLevel: 6,
        advantageAboveMaximum: true,
        allowsWilling: true,
      },
    })
    const state = startDnd5eHeadlessCombat('wild-shape', [druid, fighter('enemy', 10)])
    const transformed = resolveDnd5eHeadlessAction(state, {
      type: 'druid-wild-shape', actorId: 'druid', formId: 'srd-5.1:wolf',
    })
    expect(transformed.ok).toBe(true)
    if (!transformed.ok) return
    expect(transformed.state.combatants.druid).toMatchObject({
      currentHp: 11,
      maxHp: 11,
      armorClass: 13,
      speed: 40,
      concentrating: true,
      statBlockId: 'srd-5.1:wolf',
      abilities: { str: 12, dex: 15, con: 12, int: 12, wis: 16, cha: 10 },
      savingThrowBonuses: { str: 1, dex: 2, con: 1, int: 3, wis: 5, cha: 0 },
      classState: {
        wildShapeFormId: 'srd-5.1:wolf',
        wildShapeCurrentHp: 11,
        wildShapeOriginalCurrentHp: 20,
        wildShapeOriginalMaxHp: 20,
        wildShapeRoundsRemaining: 600,
      },
      turn: { actionAvailable: false },
    })
    expect(transformed.state.combatants.druid.magicResistance).toBe(false)
    expect(transformed.state.combatants.druid.limitedMagicImmunity).toBeUndefined()
    expect(transformed.state.combatants.druid.classResources['dnd5e-wild-shape'].current).toBe(1)

    const damaged = resolveDnd5eHeadlessAction(transformed.state, {
      type: 'opportunity-attack', actorId: 'enemy', targetId: 'druid', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 20, bonus: 0, rolls: [15], type: 'slashing' },
    })
    expect(damaged.ok).toBe(true)
    if (!damaged.ok) return
    expect(damaged.state.combatants.druid).toMatchObject({
      currentHp: 16,
      maxHp: 20,
      armorClass: 16,
      speed: 30,
      statBlockId: undefined,
      abilities: { str: 8, dex: 14, con: 14, int: 12, wis: 16, cha: 10 },
      classState: { wildShapeFormId: undefined },
    })
    expect(damaged.state.combatants.druid.magicResistance).toBe(true)
    expect(damaged.state.combatants.druid.limitedMagicImmunity).toEqual({
      kind: 'limited-magic-immunity',
      maximumSpellLevel: 6,
      advantageAboveMaximum: true,
      allowsWilling: true,
    })
    expect(damaged.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: 'druid', stateKey: 'wild-shape', active: false,
    }))
  })

  it('uses a bonus action to end Wild Shape and grants Archdruid unlimited uses', () => {
    const druid = fighter('druid', 20, {
      classId: 'druid', level: 20,
      classSelections: { 'wild-shape-known-forms': ['srd-5.1:wolf'] },
    })
    const state = startDnd5eHeadlessCombat('archdruid', [druid, fighter('enemy', 10)])
    const transformed = resolveDnd5eHeadlessAction(state, {
      type: 'druid-wild-shape', actorId: 'druid', formId: 'srd-5.1:wolf',
    })
    expect(transformed.ok).toBe(true)
    if (!transformed.ok) return
    expect(transformed.state.combatants.druid.classResources['dnd5e-wild-shape']).toBeUndefined()
    const reverted = resolveDnd5eHeadlessAction(transformed.state, { type: 'druid-end-wild-shape', actorId: 'druid' })
    expect(reverted.ok).toBe(true)
    if (!reverted.ok) return
    expect(reverted.state.combatants.druid).toMatchObject({
      currentHp: 20,
      maxHp: 20,
      classState: { wildShapeFormId: undefined },
      turn: { bonusActionAvailable: false },
    })
  })

  it('applies deterministic SRD subclass passives in Headless', () => {
    const champion = fighter('champion', 10, {
      classId: 'fighter', subclassId: 'champion', level: 18, currentHp: 8, maxHp: 20,
    })
    const turnState = startDnd5eHeadlessCombat('survivor', [fighter('active', 20), champion])
    const nextTurn = resolveDnd5eHeadlessAction(turnState, { type: 'end-turn', actorId: 'active' })
    expect(nextTurn.ok).toBe(true)
    if (!nextTurn.ok) return
    expect(nextTurn.state.combatants.champion.currentHp).toBe(15)
    expect(nextTurn.events).toContainEqual({
      type: 'healing-applied', targetId: 'champion', amount: 7, hpBefore: 8, hpAfter: 15,
    })

    const warlock = fighter('warlock', 20, {
      classId: 'warlock', subclassId: 'fiend', level: 6,
      abilities: { ...abilities, cha: 18 },
    })
    const fiendState = startDnd5eHeadlessCombat('fiend', [warlock, fighter('target', 10, { controller: 'dm', currentHp: 5 })])
    const killed = resolveDnd5eHeadlessAction(fiendState, {
      type: 'attack', actorId: 'warlock', targetId: 'target', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [5], type: 'slashing' },
    })
    expect(killed.ok).toBe(true)
    if (!killed.ok) return
    expect(killed.state.combatants.warlock.temporaryHp).toBe(10)
    expect(killed.events).toContainEqual({
      type: 'temporary-hit-points-gained', actorId: 'warlock', amount: 10, current: 10,
    })
  })

  it('applies Life Domain healing and Divine Strike', () => {
    const cleric = fighter('cleric', 20, {
      classId: 'cleric', subclassId: 'life', level: 17, currentHp: 10,
      abilities: { ...abilities, wis: 16 },
      classSelections: { 'spell-prepared': ['cure-wounds'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 2, max: 4 } },
    })
    const state = startDnd5eHeadlessCombat('life-healing', [cleric, fighter('ally', 10, { currentHp: 1 })])
    const healed = resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell', actorId: 'cleric', targetId: 'ally', spellId: 'cure-wounds', slotLevel: 1, effectRolls: [1],
    })
    expect(healed.ok).toBe(true)
    if (!healed.ok) return
    expect(healed.state.combatants.ally.currentHp).toBe(15)
    expect(healed.state.combatants.cleric.currentHp).toBe(13)

    const poolCleric = fighter('pool-cleric', 20, {
      classId: 'cleric', subclassId: 'life', level: 17, currentHp: 1,
      abilities: { ...abilities, wis: 16 },
      classSelections: { 'spell-prepared': ['mass-heal'] },
      classResources: { 'dnd5e-spell-slot-9': { current: 1, max: 1 } },
    })
    const first = fighter('first', 10, { currentHp: 1, maxHp: 100 })
    const second = fighter('second', 5, { currentHp: 1, maxHp: 100 })
    const zeroAllocation = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('zero-allocation', [poolCleric, first, second]), {
      type: 'cast-spell', actorId: 'pool-cleric', targetId: 'first', targetIds: ['first', 'second'],
      spellId: 'mass-heal', slotLevel: 9, effectRolls: [],
      healingAllocations: [{ targetId: 'first', amount: 10 }, { targetId: 'second', amount: 0 }],
    })
    expect(zeroAllocation).toMatchObject({ ok: false, reason: 'invalid-class-feature' })

    const pooled = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('blessed-healer-once', [poolCleric, first, second]), {
      type: 'cast-spell', actorId: 'pool-cleric', targetId: 'first', targetIds: ['first', 'second'],
      spellId: 'mass-heal', slotLevel: 9, effectRolls: [],
      healingAllocations: [{ targetId: 'first', amount: 10 }, { targetId: 'second', amount: 10 }],
    })
    expect(pooled.ok).toBe(true)
    if (!pooled.ok) return
    expect(pooled.state.combatants['pool-cleric'].currentHp).toBe(12)
    expect(pooled.state.combatants.first.currentHp).toBe(22)
    expect(pooled.state.combatants.second.currentHp).toBe(22)

    const striker = fighter('cleric', 20, { classId: 'cleric', subclassId: 'life', level: 14 })
    const strikeState = startDnd5eHeadlessCombat('divine-strike', [striker, fighter('enemy', 10, { controller: 'dm' })])
    const struck = resolveDnd5eHeadlessAction(strikeState, {
      type: 'attack', actorId: 'cleric', targetId: 'enemy', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'slashing' },
      classDamageContext: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
        damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
      classDamageRolls: [{ source: 'divine-strike', rolls: [3, 3] }],
    })
    expect(struck.ok).toBe(true)
    if (!struck.ok) return
    expect(struck.state.combatants.enemy.currentHp).toBe(10)
    expect(struck.events).toContainEqual({
      type: 'class-damage-applied', actorId: 'cleric', targetId: 'enemy', source: 'divine-strike', amount: 6,
    })
  })

  it('adds Draconic Affinity and Empowered Evocation once per spell damage roll', () => {
    const sorcerer = fighter('sorcerer', 20, {
      classId: 'sorcerer', subclassId: 'draconic', level: 6,
      abilities: { ...abilities, cha: 18 },
      classSelections: { 'spell-cantrips': ['fire-bolt'], 'dragon-ancestor': ['red-fire'] },
    })
    const sorcererState = startDnd5eHeadlessCombat('affinity', [sorcerer, fighter('target', 10, { controller: 'dm' })])
    const affinity = resolveDnd5eHeadlessAction(sorcererState, {
      type: 'cast-spell', actorId: 'sorcerer', targetId: 'target', spellId: 'fire-bolt', slotLevel: 0,
      d20: 10, effectRolls: [5, 5],
    })
    expect(affinity.ok).toBe(true)
    if (!affinity.ok) return
    expect(affinity.state.combatants.target.currentHp).toBe(6)

    const wizard = fighter('wizard', 20, {
      classId: 'wizard', subclassId: 'evocation', level: 10,
      abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-cantrips': ['fire-bolt'] },
    })
    const wizardState = startDnd5eHeadlessCombat('empowered', [wizard, fighter('target', 10, { controller: 'dm' })])
    const empowered = resolveDnd5eHeadlessAction(wizardState, {
      type: 'cast-spell', actorId: 'wizard', targetId: 'target', spellId: 'fire-bolt', slotLevel: 0,
      d20: 10, effectRolls: [5, 5],
    })
    expect(empowered.ok).toBe(true)
    if (!empowered.ok) return
    expect(empowered.state.combatants.target.currentHp).toBe(6)
  })

  it('expires Draconic Elemental Affinity resistance after its last remaining turn', () => {
    const sorcerer = fighter('sorcerer', 20, {
      classId: 'sorcerer', subclassId: 'draconic', level: 6,
      classState: { draconicResistanceType: 'fire', draconicResistanceRoundsRemaining: 1 },
    })
    const state = startDnd5eHeadlessCombat('draconic-resistance-expiry', [sorcerer, fighter('enemy', 10)])
    const ended = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: 'sorcerer' })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.state.combatants.sorcerer.classState.draconicResistanceType).toBeUndefined()
    expect(ended.state.combatants.sorcerer.classState.draconicResistanceRoundsRemaining).toBeUndefined()
    expect(ended.events).toContainEqual({
      type: 'class-state-changed', actorId: 'sorcerer', stateKey: 'draconic-resistance', active: false,
    })
  })

  it('expires Sacred Weapon after ten of the Paladin\'s turns', () => {
    const paladin = fighter('paladin', 20, {
      classId: 'paladin', subclassId: 'devotion', level: 3,
      classState: { sacredWeaponTurnsRemaining: 1 },
    })
    const state = startDnd5eHeadlessCombat('sacred-weapon', [paladin, fighter('enemy', 10)])
    const ended = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: 'paladin' })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.state.combatants.paladin.classState.sacredWeaponTurnsRemaining).toBeUndefined()
    expect(ended.events).toContainEqual({
      type: 'class-state-changed', actorId: 'paladin', stateKey: 'sacred-weapon', active: false,
    })
  })

  it('applies Hunter Multiattack Defense after the first hit from a creature', () => {
    const owlbear = fighter('owlbear', 20, {
      controller: 'dm', statBlockId: 'srd-5.1:owlbear', currentHp: 59, maxHp: 59,
    })
    const hunter = fighter('hunter', 10, {
      classId: 'ranger', subclassId: 'hunter', level: 7,
      classSelections: { 'defensive-tactics': ['multiattack-defense'] },
    })
    const state = startDnd5eHeadlessCombat('multiattack-defense', [owlbear, hunter])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action', actorId: 'owlbear', actionId: 'multiattack',
      rolls: [
        { targetId: 'hunter', d20: 10, damageRolls: [[5]] },
        { targetId: 'hunter', d20: 10, damageRolls: [] },
      ],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events.filter((event) => event.type === 'attack-resolved')).toEqual([
      expect.objectContaining({ targetId: 'hunter', armorClass: 16, hit: true }),
      expect.objectContaining({ targetId: 'hunter', armorClass: 20, hit: false }),
    ])
    expect(result.state.combatants.hunter.currentHp).toBe(10)
  })

  it('resolves Empty Body invisibility and non-force resistance for a level-18 Monk', () => {
    const monk = fighter('monk', 20, {
      classId: 'monk', level: 18,
      classResources: { 'dnd5e-ki': { current: 18, max: 18 } },
    })
    const owlbear = fighter('owlbear', 10, {
      controller: 'dm', statBlockId: 'srd-5.1:owlbear', currentHp: 59, maxHp: 59,
    })
    const state = startDnd5eHeadlessCombat('empty-body', [monk, owlbear])
    const activated = resolveDnd5eHeadlessAction(state, { type: 'monk-empty-body', actorId: 'monk' })
    expect(activated.ok).toBe(true)
    if (!activated.ok) return
    expect(activated.state.combatants.monk).toMatchObject({
      classResources: { 'dnd5e-ki': { current: 14, max: 18 } },
      classState: { emptyBodyRoundsRemaining: 10 },
      turn: { actionAvailable: false },
    })
    const ended = resolveDnd5eHeadlessAction(activated.state, { type: 'end-turn', actorId: 'monk' })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    const hit = resolveDnd5eHeadlessAction(ended.state, {
      type: 'monster-action', actorId: 'owlbear', actionId: 'beak',
      rolls: [{ targetId: 'monk', d20: 20, d20Second: 20, mode: 'normal', damageRolls: [[5, 5]] }],
    })
    expect(hit.ok).toBe(true)
    if (!hit.ok) return
    expect(hit.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', targetId: 'monk', d20: 20, hit: true,
    }))
    expect(hit.state.combatants.monk.currentHp).toBe(13)
  })

  it('resolves Relentless Rage saves and raises the DC until a rest', () => {
    const barbarian = fighter('barbarian', 10, {
      controller: 'player', classId: 'barbarian', level: 11, currentHp: 5,
      classState: { raging: true, rageTurnsRemaining: 10 },
      savingThrowBonuses: { con: 2 },
    })
    const state = startDnd5eHeadlessCombat('relentless-rage', [
      fighter('enemy-1', 20, { controller: 'dm' }), barbarian,
      fighter('enemy-2', 5, { controller: 'dm' }), fighter('enemy-3', 1, { controller: 'dm' }),
    ])
    const firstDrop = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'enemy-1', targetId: 'barbarian', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 10, bonus: 0, rolls: [10], type: 'slashing' },
    })
    expect(firstDrop.ok).toBe(true)
    if (!firstDrop.ok) return
    expect(firstDrop.events).toContainEqual({ type: 'relentless-rage-save-required', targetId: 'barbarian', dc: 10 })
    const firstSave = resolveDnd5eHeadlessAction(firstDrop.state, {
      type: 'barbarian-relentless-rage-save', actorId: 'barbarian', d20: 8, dc: 10,
    })
    expect(firstSave.ok).toBe(true)
    if (!firstSave.ok) return
    expect(firstSave.state.combatants.barbarian).toMatchObject({
      currentHp: 1, classState: { raging: true, relentlessRageDc: 15 },
    })

    const secondDrop = resolveDnd5eHeadlessAction(firstSave.state, {
      type: 'opportunity-attack', actorId: 'enemy-2', targetId: 'barbarian', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [2], type: 'slashing' },
    })
    expect(secondDrop.ok).toBe(true)
    if (!secondDrop.ok) return
    expect(secondDrop.events).toContainEqual({ type: 'relentless-rage-save-required', targetId: 'barbarian', dc: 15 })
    const failed = resolveDnd5eHeadlessAction(secondDrop.state, {
      type: 'barbarian-relentless-rage-save', actorId: 'barbarian', d20: 1, dc: 15,
    })
    expect(failed.ok).toBe(true)
    if (!failed.ok) return
    expect(failed.state.combatants.barbarian).toMatchObject({
      currentHp: 0, concentrating: false, classState: { raging: undefined },
    })
  })

  it('applies Fiendish Resilience and Lifedrinker for the selected Warlock build', () => {
    const enemy = fighter('enemy', 20, { controller: 'dm' })
    const warlock = fighter('warlock', 20, {
      classId: 'warlock', subclassId: 'fiend', level: 12,
      abilities: { ...abilities, cha: 18 },
      classSelections: {
        'fiendish-resilience': ['fire'],
        'pact-boon': ['blade'],
        'eldritch-invocations': ['lifedrinker'],
      },
    })
    const state = startDnd5eHeadlessCombat('fiendish-resilience', [enemy, warlock])
    const resisted = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'enemy', targetId: 'warlock', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 10, bonus: 0, rolls: [10], type: 'fire' },
    })
    expect(resisted.ok).toBe(true)
    if (!resisted.ok) return
    expect(resisted.state.combatants.warlock.currentHp).toBe(15)

    const warlockTurn = startDnd5eHeadlessCombat('lifedrinker', [warlock, enemy])
    const struck = resolveDnd5eHeadlessAction(warlockTurn, {
      type: 'attack', actorId: 'warlock', targetId: 'enemy', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'slashing' },
      classDamageContext: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
        damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
      classDamageRolls: [{ source: 'lifedrinker', rolls: [] }],
    })
    expect(struck.ok).toBe(true)
    if (!struck.ok) return
    expect(struck.state.combatants.enemy.currentHp).toBe(12)
    expect(struck.events).toContainEqual({
      type: 'class-damage-applied', actorId: 'warlock', targetId: 'enemy', source: 'lifedrinker', amount: 4,
    })
  })

  it('uses Open Hand Tranquility as a Sanctuary save before a targeted attack', () => {
    const attacker = fighter('attacker', 20, { savingThrowBonuses: { wis: 1 } })
    const monk = fighter('monk', 10, {
      classId: 'monk', subclassId: 'open-hand', level: 11,
      abilities: { ...abilities, wis: 16 },
      proficiencyBonus: 4,
      classState: { tranquilityActive: true },
    })
    const blocked = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('tranquility-blocked', [attacker, monk]), {
      type: 'attack', actorId: 'attacker', targetId: 'monk', attackModifier: 20, d20: 20,
      tranquilitySave: { d20: 5 },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [8] },
    })
    expect(blocked.ok).toBe(true)
    if (!blocked.ok) return
    expect(blocked.state.combatants.attacker.turn.actionAvailable).toBe(false)
    expect(blocked.state.combatants.monk.currentHp).toBe(20)
    expect(blocked.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: 'attacker', ability: 'wis', dc: 15, success: false,
    }))
    expect(blocked.events).toContainEqual({
      type: 'hostile-targeting-prevented', actorId: 'attacker', targetId: 'monk', source: 'tranquility',
    })
    expect(blocked.events.some((event) => event.type === 'attack-resolved')).toBe(false)

    const passed = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('tranquility-passed', [attacker, monk]), {
      type: 'attack', actorId: 'attacker', targetId: 'monk', attackModifier: 20, d20: 10,
      tranquilitySave: { d20: 20 },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
    })
    expect(passed.ok).toBe(true)
    if (!passed.ok) return
    expect(passed.state.combatants.monk.currentHp).toBe(12)
    expect(passed.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: 'attacker', ability: 'wis', success: true,
    }))
  })

  it('uses a Sanctuary spell effect for targeting saves and ends it when the warded creature attacks', () => {
    const attacker = fighter('attacker', 20, { savingThrowBonuses: { wis: 1 } })
    const warded = fighter('warded', 10, {
      classState: {
        activeEffects: [createDnd5eMechanicalEffect({
          definitionId: 'srd-5.1:spell:sanctuary',
          label: '庇护术',
          targetId: 'warded',
          source: { kind: 'spell', actorId: 'cleric', rulesId: 'sanctuary' },
          duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
          potency: 15,
        })],
      },
    })
    const blocked = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('sanctuary-blocked', [attacker, warded]), {
      type: 'attack', actorId: 'attacker', targetId: 'warded', attackModifier: 20, d20: 20,
      tranquilitySave: { d20: 5 },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [8] },
    })
    expect(blocked.ok).toBe(true)
    if (!blocked.ok) return
    expect(blocked.state.combatants.warded.currentHp).toBe(20)
    expect(blocked.events).toContainEqual({
      type: 'hostile-targeting-prevented',
      actorId: 'attacker',
      targetId: 'warded',
      source: 'sanctuary',
    })

    const wardedTurn = startDnd5eHeadlessCombat('sanctuary-break', [
      { ...warded, initiative: 30 },
      attacker,
    ])
    const struck = resolveDnd5eHeadlessAction(wardedTurn, {
      type: 'attack', actorId: 'warded', targetId: 'attacker', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [1] },
    })
    expect(struck.ok).toBe(true)
    if (!struck.ok) return
    expect(struck.state.combatants.warded.classState.activeEffects).toBeUndefined()
    expect(struck.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed',
      definitionId: 'srd-5.1:spell:sanctuary',
      reason: 'makes-attack',
    }))
  })

  it("uses the Land druid's Nature's Sanctuary only against beast or plant attacks", () => {
    const beast = fighter('beast', 20, {
      controller: 'dm', creatureType: '野兽', savingThrowBonuses: { wis: 1 },
    })
    const druid = fighter('druid', 10, {
      classId: 'druid', subclassId: 'land', level: 14,
      abilities: { ...abilities, wis: 16 }, proficiencyBonus: 4,
    })
    const blocked = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('nature-sanctuary-blocked', [beast, druid]), {
      type: 'attack', actorId: 'beast', targetId: 'druid', attackModifier: 20, d20: 20,
      tranquilitySave: { d20: 5 },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [8] },
    })
    expect(blocked.ok).toBe(true)
    if (!blocked.ok) return
    expect(blocked.state.combatants.druid.currentHp).toBe(20)
    expect(blocked.events).toContainEqual({
      type: 'hostile-targeting-prevented', actorId: 'beast', targetId: 'druid', source: 'nature-sanctuary',
    })

    const passed = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('nature-sanctuary-passed', [beast, druid]), {
      type: 'attack', actorId: 'beast', targetId: 'druid', attackModifier: 20, d20: 10,
      spendAction: false, tranquilitySave: { d20: 20 },
      damage: { count: 1, sides: 4, bonus: 0, rolls: [1] },
    })
    expect(passed.ok).toBe(true)
    if (!passed.ok) return
    expect(passed.state.combatants.beast.classState.natureSanctuaryImmunityRoundsByTarget?.druid).toBe(14_400)
    expect(passed.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', stateKey: 'nature-sanctuary-immunity', active: true, value: 14_400,
    }))
    const immuneAttack = resolveDnd5eHeadlessAction(passed.state, {
      type: 'attack', actorId: 'beast', targetId: 'druid', attackModifier: 20, d20: 10,
      spendAction: false,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [1] },
    })
    expect(immuneAttack.ok).toBe(true)
    if (!immuneAttack.ok) return
    expect(immuneAttack.events.some((event) => event.type === 'saving-throw-resolved')).toBe(false)

    const humanoid = fighter('humanoid', 20, { controller: 'dm', creatureType: '类人生物' })
    const ordinaryAttack = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('nature-sanctuary-ineligible', [humanoid, druid]), {
      type: 'attack', actorId: 'humanoid', targetId: 'druid', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [1] },
    })
    expect(ordinaryAttack.ok).toBe(true)
    if (!ordinaryAttack.ok) return
    expect(ordinaryAttack.events.some((event) => event.type === 'saving-throw-resolved')).toBe(false)
  })

  it('ends the Open Hand Tranquility ward when the monk makes an attack', () => {
    const monk = fighter('monk', 20, {
      classId: 'monk', subclassId: 'open-hand', level: 11,
      classState: { tranquilityActive: true },
    })
    const enemy = fighter('enemy', 10, { controller: 'dm' })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('tranquility-ends', [monk, enemy]), {
      type: 'attack', actorId: 'monk', targetId: 'enemy', attackModifier: 5, d20: 1,
      damage: { count: 1, sides: 6, bonus: 3, rolls: [] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.monk.classState.tranquilityActive).toBeUndefined()
    expect(result.events).toContainEqual({
      type: 'class-state-changed', actorId: 'monk', stateKey: 'tranquility', active: false,
    })
  })

  it('grants advantage for an attack from hiding and then reveals the attacker', () => {
    const rogue = fighter('rogue', 20, {
      classId: 'rogue', subclassId: 'thief', level: 9,
      classState: { hiddenCheckTotal: 22 },
    })
    const enemy = fighter('enemy', 10, { controller: 'dm' })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('hidden-attack', [rogue, enemy]), {
      type: 'attack', actorId: 'rogue', targetId: 'enemy', attackModifier: 5,
      d20: 2, d20Second: 18,
      damage: { count: 1, sides: 6, bonus: 3, rolls: [4] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: 'rogue', d20: 18, hit: true,
    }))
    expect(result.state.combatants.rogue.classState.hiddenCheckTotal).toBeUndefined()
    expect(result.events).toContainEqual({
      type: 'class-state-changed', actorId: 'rogue', stateKey: 'hidden', active: false,
    })
  })

  it('applies Blight immunity and the plant disadvantage/maximum-damage rule', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard', level: 7, proficiencyBonus: 3,
      abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-prepared': ['blight'] },
      classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } },
    })
    const plant = fighter('plant', 10, { controller: 'dm', creatureType: '植物', currentHp: 100, maxHp: 100 })
    const plantResult = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('blight-plant', [wizard, plant]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'plant', spellId: 'blight', slotLevel: 4,
      savingThrowD20: 20, savingThrowD20Second: 1, effectRolls: Array(8).fill(1),
    })
    expect(plantResult.ok).toBe(true)
    if (!plantResult.ok) return
    expect(plantResult.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: 'plant', d20: 1, success: false,
    }))
    expect(plantResult.state.combatants.plant.currentHp).toBe(36)

    const secondWizard = fighter('wizard', 20, {
      classId: 'wizard', level: 7, proficiencyBonus: 3,
      abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-prepared': ['blight'] },
      classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } },
    })
    const undead = fighter('undead', 10, { controller: 'dm', creatureType: '亡灵', currentHp: 80, maxHp: 80 })
    const immuneResult = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('blight-undead', [secondWizard, undead]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'undead', spellId: 'blight', slotLevel: 4,
      savingThrowD20: 1, effectRolls: Array(8).fill(8),
    })
    expect(immuneResult.ok).toBe(true)
    if (!immuneResult.ok) return
    expect(immuneResult.state.combatants.undead.currentHp).toBe(80)
  })

  it('marks a creature reduced to zero by Disintegrate as dead', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard', level: 11, proficiencyBonus: 4,
      abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['disintegrate'] },
      classResources: { 'dnd5e-spell-slot-6': { current: 1, max: 1 } },
    })
    const target = fighter('target', 10, {
      controller: 'dm', statBlockId: 'srd-5.1:zombie', usesDeathSaves: false,
      currentHp: 30, maxHp: 30,
    })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('disintegrate', [wizard, target]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'target', spellId: 'disintegrate', slotLevel: 6,
      savingThrowD20: 1, effectRolls: Array(10).fill(1),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target).toMatchObject({
      currentHp: 0,
      deathSaves: { successes: 0, failures: 3, stable: false, dead: true },
    })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'instant-death', sourceId: 'wizard', targetId: 'target',
    }))
    expect(result.events.some((event) => event.type === 'undead-fortitude-save-required')).toBe(false)
    expect(result.state.combatants.target.classState.undeadFortitudePending).toBeUndefined()
  })

  it('uses the pre-damage hit points and removes zero-HP effects for Disintegrate', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard', level: 11, proficiencyBonus: 4,
      abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['disintegrate'] },
      classResources: { 'dnd5e-spell-slot-6': { current: 1, max: 1 } },
    })
    const target = fighter('target', 10, { controller: 'dm', usesDeathSaves: true, currentHp: 30, maxHp: 30 })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('disintegrate-player', [wizard, target]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'target', spellId: 'disintegrate', slotLevel: 6,
      savingThrowD20: 1, effectRolls: Array(10).fill(1),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.deathSaves).toMatchObject({ failures: 3, dead: true })
    expect(result.state.combatants.target.conditions).not.toEqual(expect.arrayContaining(['unconscious', 'prone']))
    expect(result.events).toContainEqual({
      type: 'instant-death', sourceId: 'wizard', targetId: 'target', hpBefore: 30,
    })
  })

  it('scales class features from their class level after multiclassing', () => {
    const bardFighter = fighter('bard-fighter', 20, {
      classId: 'fighter', level: 15, classLevels: { fighter: 10, bard: 5 },
      classResources: { 'dnd5e-bardic-inspiration': { current: 1, max: 1 } },
    })
    const ally = fighter('ally', 10)
    const inspired = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('multiclass-bard', [bardFighter, ally]), {
      type: 'bardic-inspiration', actorId: 'bard-fighter', targetId: 'ally',
    })
    expect(inspired.ok).toBe(true)
    if (!inspired.ok) return
    expect(inspired.state.combatants.ally.classState.bardicInspirationDie).toBe(8)

    const fighterWizard = fighter('fighter-wizard', 20, {
      classId: 'fighter', level: 11, classLevels: { fighter: 1, wizard: 10 }, currentHp: 10, maxHp: 30,
      classResources: { fighterSecondWind: { current: 1, max: 1 } },
    })
    const healed = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('multiclass-second-wind', [fighterWizard, fighter('enemy', 10)]), {
      type: 'fighter-second-wind', actorId: 'fighter-wizard', resourceKey: 'fighterSecondWind', d10: 5,
    })
    expect(healed.ok).toBe(true)
    if (!healed.ok) return
    expect(healed.state.combatants['fighter-wizard'].currentHp).toBe(16)
  })

  it('applies Phantasmal Killer damage on failed end-of-turn saves and ends it on success', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard',
      level: 9,
      proficiencyBonus: 4,
      abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['phantasmal-killer'] },
      classResources: { 'dnd5e-spell-slot-5': { current: 1, max: 1 } },
    })
    const target = fighter('target', 10, {
      controller: 'dm',
      currentHp: 100,
      maxHp: 100,
    })
    const cast = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('phantasmal-killer', [wizard, target]),
      {
        type: 'cast-spell',
        actorId: 'wizard',
        targetId: 'target',
        spellId: 'phantasmal-killer',
        slotLevel: 5,
        savingThrowD20: 1,
        effectRolls: [],
      },
    )
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    const effect = cast.state.combatants.target.classState.activeEffects?.find((entry) =>
      entry.source.rulesId === 'phantasmal-killer',
    )
    expect(effect).toMatchObject({
      standardCondition: 'frightened',
      repeatSave: {
        ability: 'wis',
        dc: 16,
        timing: 'target-turn-end',
        damageOnFailure: {
          count: 5,
          sides: 10,
          modifier: 0,
          type: 'psychic',
        },
        onSuccess: 'remove',
      },
    })
    if (!effect) return

    cast.state.initiativeIndex = cast.state.initiativeOrder.indexOf('target')
    const failed = resolveDnd5eHeadlessAction(cast.state, {
      type: 'end-turn',
      actorId: 'target',
      activeEffectSavingThrows: [{
        effectId: effect.id,
        d20: 1,
        damageRolls: [10, 10, 10, 10, 10],
      }],
    })
    expect(failed.ok).toBe(true)
    if (!failed.ok) return
    expect(failed.state.combatants.target.currentHp).toBe(50)
    expect(failed.state.combatants.target.conditions).toContain('frightened')
    expect(failed.events).toContainEqual(expect.objectContaining({
      type: 'delayed-spell-damage-triggered',
      spellId: 'phantasmal-killer',
      targetId: 'target',
      amount: 50,
    }))

    failed.state.initiativeIndex = failed.state.initiativeOrder.indexOf('target')
    const succeeded = resolveDnd5eHeadlessAction(failed.state, {
      type: 'end-turn',
      actorId: 'target',
      activeEffectSavingThrows: [{
        effectId: effect.id,
        d20: 20,
        damageRolls: [1, 1, 1, 1, 1],
      }],
    })
    expect(succeeded.ok).toBe(true)
    if (!succeeded.ok) return
    expect(succeeded.state.combatants.target.currentHp).toBe(50)
    expect(succeeded.state.combatants.target.conditions).not.toContain('frightened')
    expect(succeeded.state.combatants.wizard.concentrating).toBe(false)
  })

  it('applies Mage Armor to the real AC calculation and rejects armored targets', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard', level: 3, abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-prepared': ['mage-armor'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 2, max: 2 } },
    })
    const ally = fighter('ally', 10, { armorClass: 10, abilities: { ...abilities, dex: 14 } })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('mage-armor', [wizard, ally]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'ally', spellId: 'mage-armor', slotLevel: 1,
      effectRolls: [],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(dnd5eTargetArmorClassForAttack(result.state, 'wizard', 'ally')).toBe(15)

    const shieldedAlly = fighter('shielded-ally', 10, {
      armorClass: 14,
      abilities: { ...abilities, dex: 14 },
      hasShield: true,
    })
    const shieldedResult = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('mage-armor-shield', [wizard, shieldedAlly]),
      {
        type: 'cast-spell', actorId: 'wizard', targetId: 'shielded-ally',
        spellId: 'mage-armor', slotLevel: 1, effectRolls: [],
      },
    )
    expect(shieldedResult.ok).toBe(true)
    if (!shieldedResult.ok) return
    expect(dnd5eTargetArmorClassForAttack(shieldedResult.state, 'wizard', 'shielded-ally')).toBe(17)

    const armored = fighter('armored', 10, { wearingArmor: true })
    expect(resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('mage-armor-armored', [wizard, armored]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'armored', spellId: 'mage-armor', slotLevel: 1,
      effectRolls: [],
    })).toMatchObject({ ok: false, reason: 'invalid-target' })
  })

  it('resolves Dispel Magic per spell and preserves failed higher-level effects', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard', level: 7, abilities: { ...abilities, int: 18 }, proficiencyBonus: 3,
      classSelections: { 'spell-prepared': ['dispel-magic'] },
      classResources: { 'dnd5e-spell-slot-3': { current: 2, max: 2 } },
    })
    const target = fighter('target', 10)
    target.classState.activeEffects = [
      createDnd5eMechanicalEffect({
        id: 'shield-of-faith-effect', definitionId: 'srd-5.1:spell:shield-of-faith', label: '虔诚护盾',
        kind: 'buff', source: { kind: 'spell', actorId: 'cleric', rulesId: 'shield-of-faith' },
        targetId: 'target', duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      }),
      createDnd5eMechanicalEffect({
        id: 'greater-invisibility-effect', definitionId: 'srd-5.1:spell:greater-invisibility', label: '高等隐形术',
        kind: 'buff',
        source: { kind: 'spell', actorId: 'sorcerer', rulesId: 'greater-invisibility', spellLevel: 6 },
        targetId: 'target', duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      }),
    ]
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('dispel', [wizard, target]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'target', spellId: 'dispel-magic', slotLevel: 3,
      dispelMagicChecks: [{ effectId: 'greater-invisibility-effect', d20: 1 }], effectRolls: [],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.classState.activeEffects?.map((effect) => effect.id))
      .toEqual(['greater-invisibility-effect'])
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'spell-dispelled', spellId: 'shield-of-faith', success: true,
    }))
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'spell-dispelled', spellId: 'greater-invisibility', spellLevel: 6, dc: 16, total: 5, success: false,
    }))
  })

  describe('Assassin indexed on-hit poison effects', () => {
    const poisonEffect = (
      d20: number,
      damageRolls: readonly number[] = [4, 4, 4, 4, 4, 4, 4],
      effectId = 'poison-save-damage',
    ) => ({
      effectId,
      d20,
      damageRolls: [damageRolls],
    })

    function assassinCombat(targetPatch = {}) {
      const assassin = fighter('assassin', 20, {
        controller: 'dm',
        statBlockId: 'srd-5.1:assassin',
        abilities: { str: 11, dex: 16, con: 14, int: 13, wis: 11, cha: 10 },
        armorClass: 15,
        currentHp: 78,
        maxHp: 78,
      })
      const target = fighter('target', 10, {
        armorClass: 16,
        currentHp: 100,
        maxHp: 100,
        savingThrowBonuses: { con: 2 },
        ...targetPatch,
      })
      const state = startDnd5eHeadlessCombat('assassin-on-hit-effects', [assassin, target])
      // These cases isolate the indexed poison payload. Mark the target as
      // having already acted so Assassinate does not also make Sneak Attack
      // mandatory in the same submitted roll bundle.
      state.combatants[target.id].classState.turnStartResolvedTurnKey =
        `${state.combatId}:prior-target-turn`
      return {
        assassin,
        target,
        state,
      }
    }

    it('resolves two Shortsword poison saves independently in one Multiattack transaction', () => {
      const { state, target } = assassinCombat()
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: 'assassin',
        actionId: 'multiattack',
        rolls: [
          {
            targetId: target.id,
            d20: 10,
            damageRolls: [[4]],
            onHitEffectRolls: [poisonEffect(10)],
          },
          {
            targetId: target.id,
            d20: 10,
            damageRolls: [[5]],
            onHitEffectRolls: [poisonEffect(13)],
          },
        ],
      }, {
        transactionId: 'assassin-two-poison-saves',
        now: 1,
      })

      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(result.state.combatants[target.id].currentHp).toBe(43)
      expect(result.events.filter((event) => event.type === 'saving-throw-resolved')).toEqual([
        expect.objectContaining({
          targetId: target.id,
          ability: 'con',
          dc: 15,
          total: 12,
          success: false,
        }),
        expect.objectContaining({
          targetId: target.id,
          ability: 'con',
          dc: 15,
          total: 15,
          success: true,
        }),
      ])
      expect(result.events.filter((event) =>
        event.type === 'damage-applied' && event.targetId === target.id,
      )).toEqual([
        expect.objectContaining({
          sourceId: 'assassin',
          amount: 35,
          damageTypes: ['piercing', 'poison'],
        }),
        expect.objectContaining({
          sourceId: 'assassin',
          amount: 22,
          damageTypes: ['piercing', 'poison'],
        }),
      ])
      expect(result.transaction).toMatchObject({
        id: 'assassin-two-poison-saves',
        status: 'committed',
      })
      const ledgerIds = result.transaction?.rollLedger.entries.map((entry) => entry.id) ?? []
      expect(ledgerIds).toContain('assassin:monster-action:monster:0:on-hit:poison-save-damage:save')
      expect(ledgerIds).toContain('assassin:monster-action:monster:0:on-hit:poison-save-damage:damage:0')
      expect(ledgerIds).toContain('assassin:monster-action:monster:1:on-hit:poison-save-damage:save')
      expect(ledgerIds).toContain('assassin:monster-action:monster:1:on-hit:poison-save-damage:damage:0')
    })

    it('commits the first attack and stops prepared follow-up attacks after defeating a monster', () => {
      const { state, target } = assassinCombat({
        controller: 'dm',
        currentHp: 30,
        maxHp: 30,
      })
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: 'assassin',
        actionId: 'multiattack',
        rolls: [
          {
            targetId: target.id,
            d20: 10,
            damageRolls: [[4]],
            onHitEffectRolls: [poisonEffect(1)],
          },
          {
            targetId: target.id,
            d20: 10,
            damageRolls: [[5]],
            onHitEffectRolls: [poisonEffect(1)],
          },
        ],
      }, {
        transactionId: 'assassin-defeats-monster-on-first-hit',
        now: 1,
      })

      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(result.transaction).toMatchObject({
        id: 'assassin-defeats-monster-on-first-hit',
        status: 'committed',
      })
      expect(result.state.combatants[target.id]).toMatchObject({
        currentHp: 0,
        deathSaves: { dead: true },
      })
      expect(result.events.filter((event) => event.type === 'attack-resolved')).toHaveLength(1)
      expect(result.events.filter((event) => event.type === 'saving-throw-resolved')).toHaveLength(1)
      expect(result.events.filter((event) => event.type === 'damage-applied')).toEqual([
        expect.objectContaining({
          sourceId: 'assassin',
          targetId: target.id,
          amount: 35,
        }),
      ])
    })

    it('stops prepared follow-up attacks after newly reducing a player to zero hit points', () => {
      const { state, target } = assassinCombat({
        currentHp: 30,
        maxHp: 30,
      })
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: 'assassin',
        actionId: 'multiattack',
        rolls: [
          {
            targetId: target.id,
            d20: 10,
            damageRolls: [[4]],
            onHitEffectRolls: [poisonEffect(1)],
          },
          {
            targetId: target.id,
            d20: 10,
            damageRolls: [[5]],
            onHitEffectRolls: [poisonEffect(1)],
          },
        ],
      }, {
        transactionId: 'assassin-downs-player-on-first-hit',
        now: 1,
      })

      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(result.transaction?.status).toBe('committed')
      expect(result.state.combatants[target.id]).toMatchObject({
        currentHp: 0,
        deathSaves: {
          successes: 0,
          failures: 0,
          stable: false,
          dead: false,
        },
      })
      expect(result.events.filter((event) => event.type === 'attack-resolved')).toHaveLength(1)
      expect(result.events.filter((event) => event.type === 'saving-throw-resolved')).toHaveLength(1)
      expect(result.events.filter((event) => event.type === 'damage-applied')).toHaveLength(1)
    })

    it('applies poison immunity only to the on-hit poison component', () => {
      const { state, target } = assassinCombat({ damageImmunities: ['poison'] })
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: 'assassin',
        actionId: 'shortsword',
        rolls: [{
          targetId: target.id,
          d20: 10,
          damageRolls: [[4]],
          onHitEffectRolls: [poisonEffect(1, [6, 6, 6, 6, 6, 6, 6])],
        }],
      })

      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(result.state.combatants[target.id].currentHp).toBe(93)
      expect(result.events).toContainEqual(expect.objectContaining({
        type: 'saving-throw-resolved',
        targetId: target.id,
        ability: 'con',
        dc: 15,
        success: false,
      }))
      expect(result.events).toContainEqual(expect.objectContaining({
        type: 'damage-applied',
        sourceId: 'assassin',
        targetId: target.id,
        amount: 7,
        damageTypes: ['piercing', 'poison'],
      }))
    })

    it('does not double saving-throw poison dice on a critical hit', () => {
      const { state, target } = assassinCombat()
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: 'assassin',
        actionId: 'shortsword',
        rolls: [{
          targetId: target.id,
          d20: 20,
          damageRolls: [[4, 4]],
          onHitEffectRolls: [poisonEffect(1, [1, 1, 1, 1, 1, 1, 1])],
        }],
      })

      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(result.events).toContainEqual(expect.objectContaining({
        type: 'attack-resolved',
        actorId: 'assassin',
        targetId: target.id,
        critical: true,
      }))
      expect(result.state.combatants[target.id].currentHp).toBe(82)
      expect(result.transaction?.rollLedger.entries).toContainEqual(expect.objectContaining({
        id: 'assassin:monster-action:monster:0:on-hit:poison-save-damage:damage:0',
        kind: 'damage',
        dice: { sides: 6, values: [1, 1, 1, 1, 1, 1, 1] },
      }))
    })

    it('does not request or resolve poison on a miss and rejects forged on-hit dice', () => {
      const clean = assassinCombat()
      const missed = resolveDnd5eHeadlessAction(clean.state, {
        type: 'monster-action',
        actorId: clean.assassin.id,
        actionId: 'shortsword',
        rolls: [{
          targetId: clean.target.id,
          d20: 1,
          damageRolls: [],
        }],
      })
      expect(missed.ok, missed.ok ? undefined : missed.reason).toBe(true)
      if (!missed.ok) return
      expect(missed.state.combatants[clean.target.id].currentHp).toBe(100)
      expect(missed.events.some((event) => event.type === 'saving-throw-resolved')).toBe(false)

      const forged = assassinCombat()
      const rejected = resolveDnd5eHeadlessAction(forged.state, {
        type: 'monster-action',
        actorId: forged.assassin.id,
        actionId: 'shortsword',
        rolls: [{
          targetId: forged.target.id,
          d20: 1,
          damageRolls: [],
          onHitEffectRolls: [poisonEffect(1)],
        }],
      })
      expect(rejected).toMatchObject({
        ok: false,
        reason: 'invalid-dice',
        transaction: { status: 'rolled-back', rollbackReason: 'invalid-dice' },
      })
      expect(forged.state.combatants[forged.target.id].currentHp).toBe(100)
      expect(forged.state.combatants[forged.assassin.id].turn.actionAvailable).toBe(true)
    })

    it.each([
      {
        name: 'wrong effectId',
        effects: [poisonEffect(1, [1, 1, 1, 1, 1, 1, 1], 'forged-effect')],
      },
      {
        name: 'duplicate effectId',
        effects: [poisonEffect(1), poisonEffect(1)],
      },
      {
        name: 'wrong damage die count',
        effects: [poisonEffect(1, [1, 1, 1, 1, 1, 1])],
      },
    ])('rolls back the complete attack transaction for $name', ({ effects }) => {
      const { state, assassin, target } = assassinCombat()
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: assassin.id,
        actionId: 'shortsword',
        rolls: [{
          targetId: target.id,
          d20: 10,
          damageRolls: [[4]],
          onHitEffectRolls: effects,
        }],
      })

      expect(result).toMatchObject({
        ok: false,
        reason: 'invalid-dice',
        transaction: { status: 'rolled-back', rollbackReason: 'invalid-dice' },
      })
      expect(state.combatants[target.id].currentHp).toBe(100)
      expect(state.combatants[assassin.id].turn.actionAvailable).toBe(true)
    })
  })

  describe('Bone Devil indexed Sting condition effect', () => {
    function boneDevilCombat(targetPatch = {}) {
      const devil = fighter('bone-devil', 20, {
        controller: 'dm',
        statBlockId: 'srd-5.1:bone-devil',
        abilities: { str: 18, dex: 16, con: 18, int: 13, wis: 14, cha: 16 },
        armorClass: 19,
        currentHp: 142,
        maxHp: 142,
        position: { x: 0, y: 0 },
      })
      const target = fighter('target', 10, {
        armorClass: 10,
        currentHp: 100,
        maxHp: 100,
        position: { x: 5, y: 0 },
        ...targetPatch,
      })
      return {
        devil,
        target,
        state: startDnd5eHeadlessCombat('bone-devil-sting', [devil, target]),
      }
    }

    const stingHit = (savingThrowD20: number) => ({
      targetId: 'target',
      d20: 10,
      damageRolls: [
        [4, 4],
        [3, 3, 3, 3, 3],
      ],
      onHitEffectRolls: [{
        effectId: 'sting-poisoned',
        d20: savingThrowD20,
      }],
    })

    it('applies a ten-round poisoned effect on a failed Sting save and removes it on a repeat save', () => {
      const { state, devil, target } = boneDevilCombat()
      const failed = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: devil.id,
        actionId: 'sting',
        rolls: [stingHit(1)],
      })

      expect(failed.ok, failed.ok ? undefined : failed.reason).toBe(true)
      if (!failed.ok) return
      expect(failed.state.combatants[target.id].currentHp).toBe(73)
      expect(failed.events).toContainEqual(expect.objectContaining({
        type: 'saving-throw-resolved',
        targetId: target.id,
        ability: 'con',
        dc: 14,
        success: false,
      }))
      const poisoned = failed.state.combatants[target.id].classState.activeEffects?.find((effect) =>
        effect.standardCondition === 'poisoned')
      expect(poisoned).toMatchObject({
        standardCondition: 'poisoned',
        source: {
          kind: 'monster',
          actorId: devil.id,
          rulesId: 'monster:srd-5.1:bone-devil:bone-devil:sting:sting-poisoned',
        },
        duration: {
          type: 'rounds',
          remainingRounds: 10,
          tickOn: 'target-turn-end',
        },
        repeatSave: {
          ability: 'con',
          dc: 14,
          timing: 'target-turn-end',
          onSuccess: 'remove',
        },
      })
      expect(failed.state.combatants[target.id].conditions).toContain('poisoned')

      if (!poisoned) return
      failed.state.initiativeIndex = failed.state.initiativeOrder.indexOf(target.id)
      const recovered = resolveDnd5eHeadlessAction(failed.state, {
        type: 'end-turn',
        actorId: target.id,
        activeEffectSavingThrows: [{
          effectId: poisoned.id,
          d20: 20,
        }],
      })
      expect(recovered.ok, recovered.ok ? undefined : recovered.reason).toBe(true)
      if (!recovered.ok) return
      expect(recovered.state.combatants[target.id].conditions).not.toContain('poisoned')
      expect(recovered.events).toContainEqual(expect.objectContaining({
        type: 'active-effect-save-resolved',
        targetId: target.id,
        effectId: poisoned.id,
        success: true,
      }))
    })

    it('does not apply poisoned when the target succeeds on the initial Sting save', () => {
      const { state, devil, target } = boneDevilCombat()
      const saved = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: devil.id,
        actionId: 'sting',
        rolls: [stingHit(20)],
      })

      expect(saved.ok, saved.ok ? undefined : saved.reason).toBe(true)
      if (!saved.ok) return
      expect(saved.state.combatants[target.id].currentHp).toBe(73)
      expect(saved.state.combatants[target.id].conditions).not.toContain('poisoned')
      expect(saved.state.combatants[target.id].classState.activeEffects ?? [])
        .not.toContainEqual(expect.objectContaining({ standardCondition: 'poisoned' }))
      expect(saved.events).toContainEqual(expect.objectContaining({
        type: 'saving-throw-resolved',
        targetId: target.id,
        ability: 'con',
        dc: 14,
        success: true,
      }))
    })

    it('resolves Claw, Claw, Sting once each and binds the condition save only to Sting', () => {
      const { state, devil, target } = boneDevilCombat({
        currentHp: 200,
        maxHp: 200,
      })
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: devil.id,
        actionId: 'multiattack',
        rolls: [
          { targetId: target.id, d20: 10, damageRolls: [[4]] },
          { targetId: target.id, d20: 10, damageRolls: [[5]] },
          stingHit(20),
        ],
      }, {
        transactionId: 'bone-devil-three-attacks',
        now: 1,
      })

      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(result.state.combatants[target.id].currentHp).toBe(156)
      expect(result.events.filter((event) => event.type === 'attack-resolved')).toHaveLength(3)
      expect(result.events.filter((event) => event.type === 'saving-throw-resolved')).toEqual([
        expect.objectContaining({
          targetId: target.id,
          ability: 'con',
          dc: 14,
          success: true,
        }),
      ])
      const stingLedgerIds = result.transaction?.rollLedger.entries
        .map((entry) => entry.id)
        .filter((id) => id.includes('on-hit:sting-poisoned')) ?? []
      expect(stingLedgerIds).toEqual([
        expect.stringContaining(':monster:2:on-hit:sting-poisoned:save'),
      ])

      const forged = boneDevilCombat({ currentHp: 200, maxHp: 200 })
      const rejected = resolveDnd5eHeadlessAction(forged.state, {
        type: 'monster-action',
        actorId: forged.devil.id,
        actionId: 'multiattack',
        rolls: [
          {
            targetId: forged.target.id,
            d20: 10,
            damageRolls: [[4]],
            onHitEffectRolls: [{ effectId: 'sting-poisoned', d20: 20 }],
          },
          { targetId: forged.target.id, d20: 10, damageRolls: [[5]] },
          stingHit(20),
        ],
      })
      expect(rejected).toMatchObject({
        ok: false,
        reason: 'invalid-dice',
        transaction: {
          status: 'rolled-back',
          rollbackReason: 'invalid-dice',
        },
      })
      expect(forged.state.combatants[forged.target.id].currentHp).toBe(200)
      expect(forged.state.combatants[forged.devil.id].turn.actionAvailable).toBe(true)
    })
  })

  describe('source-linked monster grapple relations', () => {
    function ankhegGrappleState(includeSecondTarget = false) {
      const ankheg = fighter('ankheg', 20, {
        controller: 'dm',
        statBlockId: 'srd-5.1:ankheg',
        abilities: { str: 17, dex: 11, con: 13, int: 1, wis: 13, cha: 6 },
        armorClass: 14,
        currentHp: 39,
        maxHp: 39,
        sizeRank: 3,
        position: { x: 0, y: 0 },
      })
      const target = fighter('target', 10, {
        armorClass: 14,
        currentHp: 100,
        maxHp: 100,
        sizeRank: 3,
        position: { x: 5, y: 0 },
      })
      const secondTarget = fighter('second-target', 5, {
        armorClass: 14,
        currentHp: 100,
        maxHp: 100,
        sizeRank: 2,
        position: { x: 0, y: 5 },
      })
      const state = startDnd5eHeadlessCombat(
        'ankheg-source-linked-grapple',
        includeSecondTarget ? [ankheg, target, secondTarget] : [ankheg, target],
      )
      state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(ankheg.id, target.id)]: 5,
        ...(includeSecondTarget
          ? { [dnd5eCombatantPairKey(ankheg.id, secondTarget.id)]: 5 }
          : {}),
      }
      const hit = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: ankheg.id,
        actionId: 'bite',
        rolls: [{
          targetId: target.id,
          d20: 10,
          damageRolls: [[3, 4], [3]],
          onHitEffectRolls: [{ effectId: 'bite-grapple' }],
        }],
      })
      expect(hit.ok, hit.ok ? undefined : hit.reason).toBe(true)
      if (!hit.ok) throw new Error(hit.reason)
      return { hit, ankheg, target, secondTarget }
    }

    it('links Ankheg Bite to its source and grants advantage only against the linked target', () => {
      const { hit } = ankhegGrappleState()
      const grapple = hit.state.combatants.target.classState.activeEffects?.find((effect) =>
        effect.standardCondition === 'grappled')
      expect(grapple).toMatchObject({
        source: {
          kind: 'monster',
          actorId: 'ankheg',
        },
        escapeCheck: {
          ability: 'str',
          skill: 'athletics',
          alternativeAbility: 'dex',
          alternativeSkill: 'acrobatics',
          dc: 13,
          economy: 'action',
        },
        relation: {
          schemaVersion: 1,
          kind: 'grapple',
          sourceActorId: 'ankheg',
          sourceActionId: 'bite',
          slotGroup: 'bite',
          maxDistanceFeet: 5,
          movement: 'drag-target',
          endsOnSourceIncapacitated: true,
        },
      })
      expect(hit.state.combatants.target.conditions).toContain('grappled')

      hit.state.combatants.ankheg.turn.actionAvailable = true
      const advantaged = resolveDnd5eHeadlessAction(hit.state, {
        type: 'monster-action',
        actorId: 'ankheg',
        actionId: 'bite',
        rolls: [{
          targetId: 'target',
          d20: 1,
          d20Second: 15,
          damageRolls: [[1, 1], [1]],
          onHitEffectRolls: [{ effectId: 'bite-grapple' }],
        }],
      })
      expect(advantaged.ok, advantaged.ok ? undefined : advantaged.reason).toBe(true)
      if (!advantaged.ok) return
      expect(advantaged.events).toContainEqual(expect.objectContaining({
        type: 'attack-resolved',
        actorId: 'ankheg',
        targetId: 'target',
        d20: 15,
        hit: true,
      }))
      expect(advantaged.state.combatants.target.classState.activeEffects?.filter((effect) =>
        effect.relation?.slotGroup === 'bite')).toHaveLength(1)
    })

    it('lets a monster release its own grapple for free and outside its turn', () => {
      const { hit } = ankhegGrappleState()
      hit.state.initiativeIndex = hit.state.initiativeOrder.indexOf('target')
      const actionAvailable = hit.state.combatants.ankheg.turn.actionAvailable
      const released = resolveDnd5eHeadlessAction(hit.state, {
        type: 'release-grapple',
        actorId: 'ankheg',
        targetId: 'target',
      })
      expect(released.ok, released.ok ? undefined : released.reason).toBe(true)
      if (!released.ok) return
      expect(released.state.combatants.target.conditions).not.toContain('grappled')
      expect(released.state.combatants.ankheg.turn.actionAvailable).toBe(actionAvailable)
      expect(released.events).toContainEqual(expect.objectContaining({
        type: 'active-effect-removed',
        targetId: 'target',
        reason: 'released',
      }))
    })

    it('requires an exact root id when one source-target pair has two legal grapple slots', () => {
      const base = getDnd5eSrdMonster('srd-5.1:ankheg')!
      const bite = base.actions.find((action) => action.id === 'bite')
      const biteRelation = bite?.attack?.onHitEffects?.find((effect) =>
        effect.kind === 'source-linked-condition')
      if (!bite?.attack || !biteRelation) throw new Error('Ankheg Bite relation is missing')
      const tailRelation = {
        ...biteRelation,
        id: 'tail-grapple',
        relation: {
          ...biteRelation.relation,
          slotGroup: 'tail',
        },
      }
      const monster = {
        ...base,
        id: 'room-monster:dual-slot-grappler',
        slug: 'dual-slot-grappler',
        actions: [
          bite,
          {
            ...bite,
            id: 'tail-grapple-attack',
            name: 'Tail Grapple',
            attack: {
              ...bite.attack,
              onHitEffects: [tailRelation],
            },
          },
        ],
      } as Dnd5eMonsterStatBlock
      setDnd5eRoomMonsterCatalog([monster])
      const source = fighter('dual-source', 20, {
        controller: 'dm',
        statBlockId: monster.id,
        abilities: { ...monster.abilities },
        currentHp: 100,
        maxHp: 100,
        sizeRank: 3,
      })
      const target = fighter('dual-target', 10, {
        armorClass: 14,
        currentHp: 200,
        maxHp: 200,
        sizeRank: 2,
        position: { x: 5, y: 0 },
      })
      const state = startDnd5eHeadlessCombat('dual-slot-release', [source, target])
      state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(source.id, target.id)]: 5,
      }
      const first = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: source.id,
        actionId: bite.id,
        rolls: [{
          targetId: target.id,
          d20: 10,
          damageRolls: [[1, 1], [1]],
          onHitEffectRolls: [{ effectId: biteRelation.id }],
        }],
      })
      expect(first.ok, first.ok ? undefined : first.reason).toBe(true)
      if (!first.ok) return
      first.state.combatants[source.id].turn.actionAvailable = true
      const second = resolveDnd5eHeadlessAction(first.state, {
        type: 'monster-action',
        actorId: source.id,
        actionId: 'tail-grapple-attack',
        rolls: [{
          targetId: target.id,
          d20: 10,
          damageRolls: [[1, 1], [1]],
          onHitEffectRolls: [{ effectId: tailRelation.id }],
        }],
      })
      expect(second.ok, second.ok ? undefined : second.reason).toBe(true)
      if (!second.ok) return
      const roots = second.state.combatants[target.id].classState.activeEffects
        ?.filter((effect) =>
          effect.standardCondition === 'grappled' &&
          effect.dependsOnEffectId == null) ?? []
      expect(roots).toHaveLength(2)
      const biteRoot = roots.find((effect) => effect.relation?.slotGroup === 'bite')
      const tailRoot = roots.find((effect) => effect.relation?.slotGroup === 'tail')
      if (!biteRoot || !tailRoot) throw new Error('Dual grapple roots were not created')

      const ambiguous = resolveDnd5eHeadlessAction(second.state, {
        type: 'release-grapple',
        actorId: source.id,
        targetId: target.id,
      })
      expect(ambiguous).toMatchObject({ ok: false, reason: 'invalid-target' })
      expect(ambiguous.state.combatants[target.id].classState.activeEffects
        ?.filter((effect) => effect.standardCondition === 'grappled')).toHaveLength(2)

      const exact = resolveDnd5eHeadlessAction(ambiguous.state, {
        type: 'release-grapple',
        actorId: source.id,
        targetId: target.id,
        effectId: biteRoot.id,
      })
      expect(exact.ok, exact.ok ? undefined : exact.reason).toBe(true)
      if (!exact.ok) return
      expect(exact.state.combatants[target.id].conditions).toContain('grappled')
      expect(exact.state.combatants[target.id].classState.activeEffects)
        .toContainEqual(expect.objectContaining({ id: tailRoot.id }))
      expect(exact.state.combatants[target.id].classState.activeEffects ?? [])
        .not.toContainEqual(expect.objectContaining({ id: biteRoot.id }))
      expect(exact.events).toContainEqual(expect.objectContaining({
        type: 'active-effect-removed',
        targetId: target.id,
        effectId: biteRoot.id,
        reason: 'released',
      }))
    })

    it.each([
      {
        name: 'forged source kind',
        mutate: (effect: Dnd5eActiveEffectInstance) => {
          effect.source.kind = 'spell'
        },
      },
      {
        name: 'forged source rules id',
        mutate: (effect: Dnd5eActiveEffectInstance) => {
          effect.source.rulesId = 'monster:srd-5.1:ankheg:bite:other-effect'
        },
      },
      {
        name: 'forged stable root id',
        mutate: (effect: Dnd5eActiveEffectInstance) => {
          effect.id = 'forged-root'
          effect.stackingKey = 'forged-root'
        },
      },
    ])('fails closed for a persisted monster relation with $name', ({ mutate }) => {
      const { hit } = ankhegGrappleState()
      const grapple = hit.state.combatants.target.classState.activeEffects?.find((effect) =>
        effect.relation?.slotGroup === 'bite')
      if (!grapple) throw new Error('missing grapple')
      mutate(grapple)
      const cleaned = resolveDnd5eHeadlessAction(hit.state, {
        type: 'end-turn',
        actorId: 'ankheg',
      })
      expect(cleaned.ok, cleaned.ok ? undefined : cleaned.reason).toBe(true)
      if (!cleaned.ok) return
      expect(cleaned.state.combatants.target.conditions).not.toContain('grappled')
      expect(cleaned.events).toContainEqual(expect.objectContaining({
        type: 'active-effect-removed',
        targetId: 'target',
        reason: 'invalid-relation',
      }))
    })

    it('ends a physical grapple when total cover separates source and target', () => {
      const { hit } = ankhegGrappleState()
      hit.state.lineOfEffectBlockedByCombatantPair = {
        [dnd5eDirectedCombatantPairKey('ankheg', 'target')]: true,
      }
      const cleaned = resolveDnd5eHeadlessAction(hit.state, {
        type: 'end-turn',
        actorId: 'ankheg',
      })
      expect(cleaned.ok, cleaned.ok ? undefined : cleaned.reason).toBe(true)
      if (!cleaned.ok) return
      expect(cleaned.state.combatants.target.conditions).not.toContain('grappled')
      expect(cleaned.events).toContainEqual(expect.objectContaining({
        type: 'active-effect-removed',
        targetId: 'target',
        reason: 'invalid-relation',
      }))
    })

    it('does not end an established grapple merely because the target later changes size', () => {
      const { hit } = ankhegGrappleState()
      hit.state.combatants.target.sizeRank = 5
      const retained = resolveDnd5eHeadlessAction(hit.state, {
        type: 'end-turn',
        actorId: 'ankheg',
      })
      expect(retained.ok, retained.ok ? undefined : retained.reason).toBe(true)
      if (!retained.ok) return
      expect(retained.state.combatants.target.conditions).toContain('grappled')
    })

    it.each([
      {
        name: 'Ankheg Bite',
        statBlockId: 'srd-5.1:ankheg',
        actionId: 'bite',
        effectId: 'bite-grapple',
        slotGroup: 'bite',
        sizeRank: 3,
        abilities: { str: 17, dex: 11, con: 13, int: 1, wis: 13, cha: 6 },
        damageRolls: [[1, 1], [1]],
        expectedConditions: ['grappled'],
      },
      {
        name: 'Behir Constrict',
        statBlockId: 'srd-5.1:behir',
        actionId: 'constrict',
        effectId: 'constrict-grapple',
        slotGroup: 'constrict',
        sizeRank: 4,
        abilities: { str: 23, dex: 16, con: 18, int: 7, wis: 14, cha: 12 },
        damageRolls: [[1, 1], [1, 1]],
        expectedConditions: ['grappled', 'restrained'],
      },
    ])(
      'keeps two independent $name relations on one target and removes only the incapacitated source',
      ({
        statBlockId,
        actionId,
        effectId,
        slotGroup,
        sizeRank,
        abilities: monsterAbilities,
        damageRolls,
        expectedConditions,
      }) => {
        const first = fighter('first-source', 30, {
          controller: 'dm',
          statBlockId,
          abilities: monsterAbilities,
          sizeRank,
          currentHp: 200,
          maxHp: 200,
          position: { x: 0, y: 0 },
        })
        const second = fighter('second-source', 20, {
          controller: 'dm',
          statBlockId,
          abilities: monsterAbilities,
          sizeRank,
          currentHp: 200,
          maxHp: 200,
          position: { x: 0, y: 5 },
        })
        const target = fighter('shared-target', 10, {
          armorClass: 10,
          currentHp: 200,
          maxHp: 200,
          sizeRank: 3,
          position: { x: 5, y: 0 },
        })
        const state = startDnd5eHeadlessCombat(
          `parallel-${slotGroup}-relations`,
          [first, second, target],
        )
        state.distanceFeetByCombatantPair = {
          [dnd5eCombatantPairKey(first.id, target.id)]: 5,
          [dnd5eCombatantPairKey(second.id, target.id)]: 5,
        }
        const firstHit = resolveDnd5eHeadlessAction(state, {
          type: 'monster-action',
          actorId: first.id,
          actionId,
          rolls: [{
            targetId: target.id,
            d20: 10,
            damageRolls,
            onHitEffectRolls: [{ effectId }],
          }],
        })
        expect(firstHit.ok, firstHit.ok ? undefined : firstHit.reason).toBe(true)
        if (!firstHit.ok) return

        firstHit.state.initiativeIndex = firstHit.state.initiativeOrder.indexOf(second.id)
        firstHit.state.combatants[second.id].turn.actionAvailable = true
        const secondHit = resolveDnd5eHeadlessAction(firstHit.state, {
          type: 'monster-action',
          actorId: second.id,
          actionId,
          rolls: [{
            targetId: target.id,
            d20: 10,
            damageRolls,
            onHitEffectRolls: [{ effectId }],
          }],
        })
        expect(secondHit.ok, secondHit.ok ? undefined : secondHit.reason).toBe(true)
        if (!secondHit.ok) return
        expect(secondHit.state.combatants[target.id].classState.activeEffects?.filter((effect) =>
          effect.relation?.slotGroup === slotGroup).map((effect) =>
          effect.relation?.sourceActorId).sort()).toEqual([first.id, second.id])

        const incapacitatingEffects = migrateLegacyDnd5eConditions({
          targetId: first.id,
          conditions: ['stunned'],
        })
        secondHit.state.combatants[first.id].classState.activeEffects = incapacitatingEffects
        secondHit.state.combatants[first.id].conditions =
          dnd5eConditionsFromActiveEffects(incapacitatingEffects)
        secondHit.state.initiativeIndex = secondHit.state.initiativeOrder.indexOf(first.id)
        const cleaned = resolveDnd5eHeadlessAction(secondHit.state, {
          type: 'end-turn',
          actorId: first.id,
        })
        expect(cleaned.ok, cleaned.ok ? undefined : cleaned.reason).toBe(true)
        if (!cleaned.ok) return
        const remainingEffects =
          cleaned.state.combatants[target.id].classState.activeEffects ?? []
        expect(remainingEffects.filter((effect) =>
          effect.relation?.slotGroup === slotGroup)).toEqual([
          expect.objectContaining({
            relation: expect.objectContaining({ sourceActorId: second.id }),
          }),
        ])
        expect(remainingEffects.some((effect) => effect.source.actorId === first.id)).toBe(false)
        expect(cleaned.state.combatants[target.id].conditions).toEqual(
          expect.arrayContaining(expectedConditions),
        )
      },
    )

    it('does not let a dependent grapple relation occupy capacity or enable dragging', () => {
      const source = fighter('ankheg', 20, {
        controller: 'dm',
        statBlockId: 'srd-5.1:ankheg',
        abilities: { str: 17, dex: 11, con: 13, int: 1, wis: 13, cha: 6 },
        sizeRank: 3,
        currentHp: 39,
        maxHp: 39,
        position: { x: 0, y: 0 },
      })
      const malformedTarget = fighter('malformed-target', 10, {
        armorClass: 10,
        currentHp: 100,
        maxHp: 100,
        position: { x: 5, y: 0 },
      })
      const validTarget = fighter('valid-target', 5, {
        armorClass: 10,
        currentHp: 100,
        maxHp: 100,
        position: { x: 0, y: 5 },
      })
      const anchor = createDnd5eConditionEffect({
        id: 'malformed-anchor',
        condition: 'prone',
        targetId: malformedTarget.id,
        source: { kind: 'monster', actorId: source.id, rulesId: 'bite' },
      })
      const malformedRelation = createDnd5eConditionEffect({
        id: 'malformed-dependent-relation',
        condition: 'grappled',
        targetId: malformedTarget.id,
        source: { kind: 'monster', actorId: source.id, rulesId: 'bite' },
        dependsOnEffectId: anchor.id,
        escapeCheck: {
          ability: 'str',
          skill: 'athletics',
          alternativeAbility: 'dex',
          alternativeSkill: 'acrobatics',
          dc: 13,
          economy: 'action',
        },
        relation: {
          schemaVersion: 1,
          kind: 'grapple',
          sourceActorId: source.id,
          sourceActionId: 'bite',
          slotGroup: 'bite',
          maxDistanceFeet: 5,
          movement: 'drag-target',
          endsOnSourceIncapacitated: true,
        },
      })
      malformedTarget.classState.activeEffects = [anchor, malformedRelation]
      malformedTarget.conditions =
        dnd5eConditionsFromActiveEffects(malformedTarget.classState.activeEffects)
      const state = startDnd5eHeadlessCombat(
        'malformed-relation-fail-closed',
        [source, malformedTarget, validTarget],
      )
      state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(source.id, malformedTarget.id)]: 5,
        [dnd5eCombatantPairKey(source.id, validTarget.id)]: 5,
      }

      expect(dnd5eGrappleDragExtraMovementFeet(state, source.id, 5)).toBe(0)
      const hit = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: source.id,
        actionId: 'bite',
        rolls: [{
          targetId: validTarget.id,
          d20: 10,
          damageRolls: [[1, 1], [1]],
          onHitEffectRolls: [{ effectId: 'bite-grapple' }],
        }],
      })
      expect(hit.ok, hit.ok ? undefined : hit.reason).toBe(true)
    })

    it('removes a source-linked relation in the same shove transaction that breaks reach', () => {
      const { hit } = ankhegGrappleState()
      const shover = fighter('shover', 30, {
        abilities: { ...abilities, str: 20 },
        position: { x: 5, y: 0 },
      })
      hit.state.combatants[shover.id] = shover
      hit.state.initiativeOrder = [shover.id, ...hit.state.initiativeOrder]
      hit.state.initiativeIndex = 0
      hit.state.distanceFeetByCombatantPair = {
        ...hit.state.distanceFeetByCombatantPair,
        [dnd5eCombatantPairKey(shover.id, 'ankheg')]: 5,
      }

      const pushed = resolveDnd5eHeadlessAction(hit.state, {
        type: 'shove',
        actorId: shover.id,
        targetId: 'ankheg',
        actorD20: 20,
        targetD20: 1,
        targetDefense: 'athletics',
        outcome: 'push',
        pushTo: { x: -5, y: 0 },
      })
      expect(pushed.ok, pushed.ok ? undefined : pushed.reason).toBe(true)
      if (!pushed.ok) return
      expect(pushed.state.combatants.target.conditions).not.toContain('grappled')
      expect(pushed.events).toContainEqual(expect.objectContaining({
        type: 'active-effect-removed',
        targetId: 'target',
        reason: 'out-of-range',
      }))
    })

    it('removes a source-linked relation when Thunderwave pushes its source out of reach', () => {
      const { hit } = ankhegGrappleState()
      const caster = fighter('caster', 30, {
        classId: 'wizard',
        level: 5,
        abilities: { ...abilities, int: 16 },
        classSelections: { 'spell-prepared': ['thunderwave'] },
        classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 4 } },
        position: { x: 5, y: 0 },
      })
      hit.state.combatants[caster.id] = caster
      hit.state.initiativeOrder = [caster.id, ...hit.state.initiativeOrder]
      hit.state.initiativeIndex = 0
      hit.state.distanceFeetByCombatantPair = {
        ...hit.state.distanceFeetByCombatantPair,
        [dnd5eCombatantPairKey(caster.id, 'ankheg')]: 5,
      }

      const pushed = resolveDnd5eHeadlessAction(hit.state, {
        type: 'cast-spell',
        actorId: caster.id,
        castingClassId: 'wizard',
        targetId: 'ankheg',
        targetIds: ['ankheg'],
        spellId: 'thunderwave',
        slotLevel: 1,
        savingThrowD20: 1,
        forcedMovements: [{
          targetId: 'ankheg',
          to: { x: -10, y: 0 },
          distanceFeet: 10,
        }],
        effectRolls: [1, 1],
      })
      expect(pushed.ok, pushed.ok ? undefined : pushed.reason).toBe(true)
      if (!pushed.ok) return
      expect(pushed.state.combatants.target.conditions).not.toContain('grappled')
      expect(pushed.events).toContainEqual(expect.objectContaining({
        type: 'active-effect-removed',
        targetId: 'target',
        reason: 'out-of-range',
      }))
    })

    it('rejects another Ankheg Bite target and Acid Spray while its bite slot is occupied', () => {
      const { hit } = ankhegGrappleState(true)
      hit.state.combatants.ankheg.turn.actionAvailable = true
      expect(resolveDnd5eHeadlessAction(hit.state, {
        type: 'monster-action',
        actorId: 'ankheg',
        actionId: 'bite',
        rolls: [{
          targetId: 'second-target',
          d20: 10,
          damageRolls: [[3, 4], [3]],
          onHitEffectRolls: [{ effectId: 'bite-grapple' }],
        }],
      })).toMatchObject({ ok: false, reason: 'invalid-target' })

      expect(resolveDnd5eHeadlessAction(hit.state, {
        type: 'monster-area-action',
        actorId: 'ankheg',
        actionId: 'acid-spray',
        resolution: {
          schemaVersion: 1,
          targetIds: ['second-target'],
          targetSavingThrows: [{ targetId: 'second-target', d20: 1 }],
          damageRolls: [1, 1, 1],
        },
      })).toMatchObject({ ok: false, reason: 'invalid-target' })
    })

    it('applies dependent Behir restraint and escapes with the better proficient skill', () => {
      const behir = fighter('behir', 20, {
        controller: 'dm',
        statBlockId: 'srd-5.1:behir',
        abilities: { str: 23, dex: 16, con: 18, int: 7, wis: 14, cha: 12 },
        armorClass: 17,
        currentHp: 168,
        maxHp: 168,
        sizeRank: 4,
      })
      const target = fighter('target', 10, {
        armorClass: 16,
        currentHp: 100,
        maxHp: 100,
        abilities: { ...abilities, str: 18, dex: 14 },
        proficiencyBonus: 3,
        skillProficiencies: ['acrobatics'],
        classSelections: { expertise: ['acrobatics'] },
        sizeRank: 3,
      })
      const state = startDnd5eHeadlessCombat('behir-constrict-relation', [behir, target])
      state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(behir.id, target.id)]: 5,
      }
      const hit = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: behir.id,
        actionId: 'constrict',
        rolls: [{
          targetId: target.id,
          d20: 10,
          damageRolls: [[1, 1], [1, 1]],
          onHitEffectRolls: [{ effectId: 'constrict-grapple' }],
        }],
      })
      expect(hit.ok, hit.ok ? undefined : hit.reason).toBe(true)
      if (!hit.ok) return
      const grapple = hit.state.combatants.target.classState.activeEffects?.find((effect) =>
        effect.standardCondition === 'grappled')
      const restrained = hit.state.combatants.target.classState.activeEffects?.find((effect) =>
        effect.standardCondition === 'restrained')
      expect(grapple).toMatchObject({
        escapeCheck: {
          dc: 16,
          skill: 'athletics',
          alternativeSkill: 'acrobatics',
        },
        relation: {
          sourceActorId: 'behir',
          sourceActionId: 'constrict',
          slotGroup: 'constrict',
        },
      })
      expect(restrained).toMatchObject({ dependsOnEffectId: grapple?.id })
      expect(hit.state.combatants.target.conditions).toEqual(
        expect.arrayContaining(['grappled', 'restrained']),
      )

      const targetTurn = resolveDnd5eHeadlessAction(hit.state, {
        type: 'end-turn',
        actorId: behir.id,
      })
      expect(targetTurn.ok, targetTurn.ok ? undefined : targetTurn.reason).toBe(true)
      if (!targetTurn.ok || !grapple) return
      const escaped = resolveDnd5eHeadlessAction(targetTurn.state, {
        type: 'escape-active-effect',
        actorId: target.id,
        effectId: grapple.id,
        d20: 8,
      })
      expect(escaped.ok, escaped.ok ? undefined : escaped.reason).toBe(true)
      if (!escaped.ok) return
      expect(escaped.events).toContainEqual(expect.objectContaining({
        type: 'ability-check-resolved',
        actorId: target.id,
        ability: 'dex',
        skill: 'acrobatics',
        modifier: 8,
        total: 16,
        dc: 16,
        success: true,
      }))
      expect(escaped.state.combatants.target.conditions).not.toContain('grappled')
      expect(escaped.state.combatants.target.conditions).not.toContain('restrained')
      expect(escaped.state.combatants.target.classState.activeEffects ?? []).not.toContainEqual(
        expect.objectContaining({ id: restrained?.id }),
      )
    })

    it('rejects Behir Constrict and a Multiattack containing it against a Huge target', () => {
      const behir = fighter('behir', 20, {
        controller: 'dm',
        statBlockId: 'srd-5.1:behir',
        abilities: { str: 23, dex: 16, con: 18, int: 7, wis: 14, cha: 12 },
        currentHp: 168,
        maxHp: 168,
        sizeRank: 4,
      })
      const huge = fighter('huge-target', 10, {
        controller: 'player',
        armorClass: 10,
        currentHp: 200,
        maxHp: 200,
        sizeRank: 4,
      })
      const state = startDnd5eHeadlessCombat('behir-size-restriction', [behir, huge])
      state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(behir.id, huge.id)]: 5,
      }
      expect(resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: behir.id,
        actionId: 'constrict',
        rolls: [{
          targetId: huge.id,
          d20: 10,
          damageRolls: [[1, 1], [1, 1]],
          onHitEffectRolls: [{ effectId: 'constrict-grapple' }],
        }],
      })).toMatchObject({ ok: false, reason: 'invalid-target' })
      expect(resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: behir.id,
        actionId: 'multiattack',
        rolls: [
          {
            targetId: huge.id,
            d20: 10,
            damageRolls: [[1, 1, 1]],
          },
          {
            targetId: huge.id,
            d20: 10,
            damageRolls: [[1, 1], [1, 1]],
            onHitEffectRolls: [{ effectId: 'constrict-grapple' }],
          },
        ],
      })).toMatchObject({ ok: false, reason: 'invalid-target' })
    })

    it('fails closed when a persisted Behir grapple is missing its dependent restraint', () => {
      const behir = fighter('behir', 20, {
        controller: 'dm',
        statBlockId: 'srd-5.1:behir',
        abilities: { str: 23, dex: 16, con: 18, int: 7, wis: 14, cha: 12 },
        currentHp: 168,
        maxHp: 168,
        sizeRank: 4,
      })
      const target = fighter('target', 10, {
        armorClass: 10,
        currentHp: 100,
        maxHp: 100,
        sizeRank: 3,
      })
      const state = startDnd5eHeadlessCombat('behir-missing-dependent', [behir, target])
      state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(behir.id, target.id)]: 5,
      }
      const hit = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: behir.id,
        actionId: 'constrict',
        rolls: [{
          targetId: target.id,
          d20: 10,
          damageRolls: [[1, 1], [1, 1]],
          onHitEffectRolls: [{ effectId: 'constrict-grapple' }],
        }],
      })
      expect(hit.ok, hit.ok ? undefined : hit.reason).toBe(true)
      if (!hit.ok) return
      hit.state.combatants[target.id].classState.activeEffects =
        hit.state.combatants[target.id].classState.activeEffects?.filter((effect) =>
          effect.standardCondition !== 'restrained')
      hit.state.combatants[target.id].conditions = ['grappled']

      const reconciled = resolveDnd5eHeadlessAction(hit.state, {
        type: 'release-grapple',
        actorId: behir.id,
        targetId: target.id,
      })
      expect(reconciled).toMatchObject({ ok: false, reason: 'invalid-target' })
      expect(reconciled.state.combatants[target.id].conditions).not.toContain('grappled')
      expect(reconciled.state.combatants[target.id].classState.activeEffects ?? []).toEqual([])
      expect(reconciled.events).toContainEqual(expect.objectContaining({
        type: 'active-effect-removed',
        targetId: target.id,
        reason: 'invalid-relation',
      }))
    })

    it('keeps a valid Behir grapple when the target is immune to its dependent restraint', () => {
      const behir = fighter('behir', 20, {
        controller: 'dm',
        statBlockId: 'srd-5.1:behir',
        abilities: { str: 23, dex: 16, con: 18, int: 7, wis: 14, cha: 12 },
        currentHp: 168,
        maxHp: 168,
        sizeRank: 4,
      })
      const target = fighter('target', 10, {
        armorClass: 10,
        currentHp: 100,
        maxHp: 100,
        sizeRank: 3,
        conditionImmunities: ['restrained'],
      })
      const state = startDnd5eHeadlessCombat('behir-restraint-immunity', [behir, target])
      state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(behir.id, target.id)]: 5,
      }
      const hit = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: behir.id,
        actionId: 'constrict',
        rolls: [{
          targetId: target.id,
          d20: 10,
          damageRolls: [[1, 1], [1, 1]],
          onHitEffectRolls: [{ effectId: 'constrict-grapple' }],
        }],
      })
      expect(hit.ok, hit.ok ? undefined : hit.reason).toBe(true)
      if (!hit.ok) return
      expect(hit.state.combatants[target.id].conditions).toContain('grappled')
      expect(hit.state.combatants[target.id].conditions).not.toContain('restrained')

      const next = resolveDnd5eHeadlessAction(hit.state, {
        type: 'end-turn',
        actorId: behir.id,
      })
      expect(next.ok, next.ok ? undefined : next.reason).toBe(true)
      if (!next.ok) return
      expect(next.state.combatants[target.id].conditions).toContain('grappled')
      expect(next.events).not.toContainEqual(expect.objectContaining({
        type: 'active-effect-removed',
        targetId: target.id,
        reason: 'invalid-relation',
      }))
    })

    it('lets an occupied Behir Constrict damage another target without creating a second relation', () => {
      const behir = fighter('behir', 20, {
        controller: 'dm',
        statBlockId: 'srd-5.1:behir',
        abilities: { str: 23, dex: 16, con: 18, int: 7, wis: 14, cha: 12 },
        armorClass: 17,
        currentHp: 168,
        maxHp: 168,
        sizeRank: 4,
      })
      const first = fighter('first', 10, {
        armorClass: 14,
        currentHp: 100,
        maxHp: 100,
        sizeRank: 3,
      })
      const second = fighter('second', 5, {
        armorClass: 14,
        currentHp: 100,
        maxHp: 100,
        sizeRank: 3,
      })
      const state = startDnd5eHeadlessCombat('behir-constrict-capacity', [behir, first, second])
      state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(behir.id, first.id)]: 5,
        [dnd5eCombatantPairKey(behir.id, second.id)]: 5,
      }
      const held = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: behir.id,
        actionId: 'constrict',
        rolls: [{
          targetId: first.id,
          d20: 10,
          damageRolls: [[1, 1], [1, 1]],
          onHitEffectRolls: [{ effectId: 'constrict-grapple' }],
        }],
      })
      expect(held.ok, held.ok ? undefined : held.reason).toBe(true)
      if (!held.ok) return
      held.state.combatants.behir.turn.actionAvailable = true
      const attacked = resolveDnd5eHeadlessAction(held.state, {
        type: 'monster-action',
        actorId: behir.id,
        actionId: 'constrict',
        rolls: [{
          targetId: second.id,
          d20: 10,
          damageRolls: [[1, 1], [1, 1]],
          onHitEffectRolls: [{ effectId: 'constrict-grapple' }],
        }],
      })
      expect(attacked.ok, attacked.ok ? undefined : attacked.reason).toBe(true)
      if (!attacked.ok) return
      expect(attacked.state.combatants.second.currentHp).toBe(84)
      expect(attacked.state.combatants.second.conditions).not.toContain('grappled')
      expect(attacked.state.combatants.first.conditions).toEqual(
        expect.arrayContaining(['grappled', 'restrained']),
      )
    })

    it.each(['incapacitated', 'dead'] as const)(
      'cleans source-linked grapples on the next transaction when the source is %s',
      (sourceState) => {
        const { hit } = ankhegGrappleState()
        const source = hit.state.combatants.ankheg
        if (sourceState === 'dead') {
          source.currentHp = 0
          source.deathSaves.dead = true
        } else {
          const effects = migrateLegacyDnd5eConditions({
            targetId: source.id,
            conditions: ['stunned'],
          })
          source.classState.activeEffects = effects
          source.conditions = dnd5eConditionsFromActiveEffects(effects)
        }
        const cleaned = resolveDnd5eHeadlessAction(hit.state, {
          type: 'end-turn',
          actorId: source.id,
        })
        expect(cleaned.ok, cleaned.ok ? undefined : cleaned.reason).toBe(true)
        if (!cleaned.ok) return
        expect(cleaned.state.combatants.target.conditions).not.toContain('grappled')
        expect(cleaned.events).toContainEqual(expect.objectContaining({
          type: 'active-effect-removed',
          targetId: 'target',
          reason: 'source-incapacitated',
        }))
      },
    )

    it('fails closed when persisted source-linked escape metadata no longer matches its declaration', () => {
      const { hit } = ankhegGrappleState()
      const grapple = hit.state.combatants.target.classState.activeEffects?.find((effect) =>
        effect.relation?.slotGroup === 'bite')
      if (!grapple?.escapeCheck) throw new Error('missing bite grapple')
      grapple.escapeCheck.dc = 99

      const cleaned = resolveDnd5eHeadlessAction(hit.state, {
        type: 'end-turn',
        actorId: 'ankheg',
      })
      expect(cleaned.ok, cleaned.ok ? undefined : cleaned.reason).toBe(true)
      if (!cleaned.ok) return
      expect(cleaned.state.combatants.target.conditions).not.toContain('grappled')
      expect(cleaned.events).toContainEqual(expect.objectContaining({
        type: 'active-effect-removed',
        targetId: 'target',
        effectId: grapple.id,
        reason: 'invalid-relation',
      }))
    })

    it.each([
      { targetSizeRank: 3, expectedMovementCost: 10 },
      { targetSizeRank: 1, expectedMovementCost: 5 },
    ])(
      'drags a linked target and spends $expectedMovementCost feet for a 5-foot move',
      ({ targetSizeRank, expectedMovementCost }) => {
        const { hit } = ankhegGrappleState()
        hit.state.combatants.target.sizeRank = targetSizeRank
        const moved = resolveDnd5eHeadlessAction(hit.state, {
          type: 'move',
          actorId: 'ankheg',
          to: { x: 5, y: 0 },
          distance: 5,
        })
        expect(moved.ok, moved.ok ? undefined : moved.reason).toBe(true)
        if (!moved.ok) return
        expect(moved.state.combatants.ankheg.position).toEqual({ x: 5, y: 0 })
        expect(moved.state.combatants.target.position).toEqual({ x: 10, y: 0 })
        expect(moved.state.combatants.ankheg.turn.movementRemaining)
          .toBe(30 - expectedMovementCost)
        expect(moved.events.filter((event) => event.type === 'moved')).toEqual([
          expect.objectContaining({
            actorId: 'ankheg',
            from: { x: 0, y: 0 },
            to: { x: 5, y: 0 },
            distance: 5,
          }),
          expect.objectContaining({
            actorId: 'target',
            from: { x: 5, y: 0 },
            to: { x: 10, y: 0 },
            distance: 5,
          }),
        ])
        expect(moved.events).toContainEqual({
          type: 'turn-resource-spent',
          actorId: 'ankheg',
          resource: 'movement',
          amount: expectedMovementCost,
        })
      },
    )

    it('applies independently supplied fall rolls to the grappler and its linked target', () => {
      const { hit } = ankhegGrappleState()
      hit.state.combatants.ankheg.elevationFeet = 20
      hit.state.combatants.target.elevationFeet = 20
      const moved = resolveDnd5eHeadlessAction(hit.state, {
        type: 'move',
        actorId: 'ankheg',
        to: { x: 5, y: 0 },
        distance: 5,
        traversalMode: 'fall',
        toElevationFeet: 0,
        fallingDamageRollsByCombatantId: {
          ankheg: [3, 4],
          target: [2, 5],
        },
      })
      expect(moved.ok, moved.ok ? undefined : moved.reason).toBe(true)
      if (!moved.ok) return
      expect(moved.state.combatants.ankheg.currentHp).toBe(32)
      expect(moved.state.combatants.target.currentHp).toBe(80)
      expect(moved.state.combatants.ankheg.conditions).toContain('prone')
      expect(moved.state.combatants.target.conditions).toContain('prone')
      expect(moved.events.filter((event) =>
        event.type === 'falling-damage-resolved' && event.distanceFeet === 20))
        .toEqual(expect.arrayContaining([
          expect.objectContaining({ actorId: 'ankheg', damage: 7, landedProne: true }),
          expect.objectContaining({ actorId: 'target', damage: 7, landedProne: true }),
        ]))
    })

    it('does not reuse the grappler legacy fall dice for a dragged target', () => {
      const { hit } = ankhegGrappleState()
      hit.state.combatants.ankheg.elevationFeet = 20
      hit.state.combatants.target.elevationFeet = 20
      expect(resolveDnd5eHeadlessAction(hit.state, {
        type: 'move',
        actorId: 'ankheg',
        to: { x: 5, y: 0 },
        distance: 5,
        traversalMode: 'fall',
        toElevationFeet: 0,
        fallingDamageRolls: [3, 4],
      })).toMatchObject({ ok: false, reason: 'invalid-dice' })
    })

    it('fills both Giant Scorpion claw slots and skips a third new grapple', () => {
      const scorpion = fighter('scorpion', 20, {
        controller: 'dm',
        statBlockId: 'srd-5.1:giant-scorpion',
        abilities: { str: 15, dex: 13, con: 15, int: 1, wis: 9, cha: 3 },
        armorClass: 15,
        currentHp: 52,
        maxHp: 52,
        sizeRank: 3,
      })
      const targets = ['first', 'second', 'third'].map((id, index) => fighter(id, 10 - index, {
        armorClass: 14,
        currentHp: 100,
        maxHp: 100,
        position: { x: 5 * (index + 1), y: 0 },
      }))
      const state = startDnd5eHeadlessCombat('giant-scorpion-claw-capacity', [
        scorpion,
        ...targets,
      ])
      state.distanceFeetByCombatantPair = Object.fromEntries(targets.map((target) => [
        dnd5eCombatantPairKey(scorpion.id, target.id),
        5,
      ]))
      const multiattack = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: scorpion.id,
        actionId: 'multiattack',
        rolls: [
          {
            targetId: 'first',
            d20: 10,
            damageRolls: [[4]],
            onHitEffectRolls: [{ effectId: 'claw-grapple' }],
          },
          {
            targetId: 'second',
            d20: 10,
            damageRolls: [[4]],
            onHitEffectRolls: [{ effectId: 'claw-grapple' }],
          },
          {
            targetId: 'third',
            d20: 1,
            damageRolls: [],
          },
        ],
      })
      expect(multiattack.ok, multiattack.ok ? undefined : multiattack.reason).toBe(true)
      if (!multiattack.ok) return
      expect(multiattack.state.combatants.first.conditions).toContain('grappled')
      expect(multiattack.state.combatants.second.conditions).toContain('grappled')
      expect(multiattack.state.combatants.third.conditions).not.toContain('grappled')

      multiattack.state.combatants.scorpion.turn.actionAvailable = true
      const thirdClaw = resolveDnd5eHeadlessAction(multiattack.state, {
        type: 'monster-action',
        actorId: scorpion.id,
        actionId: 'claw',
        rolls: [{
          targetId: 'third',
          d20: 10,
          damageRolls: [[4]],
          onHitEffectRolls: [{ effectId: 'claw-grapple' }],
        }],
      })
      expect(thirdClaw.ok, thirdClaw.ok ? undefined : thirdClaw.reason).toBe(true)
      if (!thirdClaw.ok) return
      expect(thirdClaw.state.combatants.third.currentHp).toBe(94)
      expect(thirdClaw.state.combatants.third.conditions).not.toContain('grappled')
      expect(['first', 'second', 'third'].flatMap((id) =>
        thirdClaw.state.combatants[id].classState.activeEffects?.filter((effect) =>
          effect.relation?.slotGroup === 'claw') ?? [])).toHaveLength(2)
    })
  })

  it('applies Bronze Dragon Repulsion Breath only to failed saves, including allied and downed targets', () => {
    const dragon = fighter('dragon', 30, {
      controller: 'dm',
      statBlockId: 'srd-5.1:adult-bronze-dragon',
      currentHp: 200,
      maxHp: 200,
      position: { x: 0, y: 0 },
    })
    const ally = fighter('ally', 20, {
      controller: 'dm',
      position: { x: 5, y: 0 },
    })
    const enemy = fighter('enemy', 10, {
      position: { x: 10, y: 0 },
    })
    const downed = fighter('downed', 5, {
      currentHp: 0,
      maxHp: 20,
      usesDeathSaves: true,
      conditions: ['unconscious'],
      position: { x: 15, y: 0 },
    })
    const state = startDnd5eHeadlessCombat('bronze-repulsion', [
      dragon, ally, enemy, downed,
    ])
    const resolution = {
      schemaVersion: 1 as const,
      variantId: 'repulsion-breath',
      targetIds: ['ally', 'enemy', 'downed'],
      targetSavingThrows: [
        { targetId: 'ally', d20: 20 },
        { targetId: 'enemy', d20: 1 },
        { targetId: 'downed', d20: 1 },
      ],
      damageRolls: [],
      forcedMovements: [
        { targetId: 'ally', to: { x: 65, y: 0 }, distanceFeet: 60 },
        { targetId: 'enemy', to: { x: 70, y: 0 }, distanceFeet: 60 },
        { targetId: 'downed', to: { x: 75, y: 0 }, distanceFeet: 60 },
      ],
    }

    const pushed = resolveDnd5eHeadlessAction(state, {
      type: 'monster-area-action',
      actorId: 'dragon',
      actionId: 'breath-weapons',
      resolution,
    })
    expect(pushed.ok, pushed.ok ? undefined : pushed.reason).toBe(true)
    if (!pushed.ok) return
    expect(pushed.state.combatants.ally.position).toEqual({ x: 5, y: 0 })
    expect(pushed.state.combatants.enemy.position).toEqual({ x: 70, y: 0 })
    expect(pushed.state.combatants.downed.position).toEqual({ x: 75, y: 0 })
    expect(pushed.events.filter((event) => event.type === 'moved').map((event) =>
      event.actorId)).toEqual(['enemy', 'downed'])
    expect(pushed.state.combatants.dragon.classState.monsterRechargeReadyByActionId)
      .toMatchObject({ 'breath-weapons': false })

    const missingCandidate = resolveDnd5eHeadlessAction(state, {
      type: 'monster-area-action',
      actorId: 'dragon',
      actionId: 'breath-weapons',
      resolution: {
        ...resolution,
        forcedMovements: resolution.forcedMovements.slice(0, 2),
      },
    })
    expect(missingCandidate).toMatchObject({ ok: false, reason: 'invalid-target' })

    for (const forgedEnemyMovement of [
      { targetId: 'enemy', to: { x: 1_000, y: 0 }, distanceFeet: 60 },
      { targetId: 'enemy', to: { x: 10, y: 60 }, distanceFeet: 60 },
    ]) {
      const forged = resolveDnd5eHeadlessAction(state, {
        type: 'monster-area-action',
        actorId: 'dragon',
        actionId: 'breath-weapons',
        resolution: {
          ...resolution,
          forcedMovements: resolution.forcedMovements.map((movement) =>
            movement.targetId === 'enemy' ? forgedEnemyMovement : movement),
        },
      })
      expect(forged).toMatchObject({ ok: false, reason: 'invalid-target' })
    }
  })

  it('enforces every mechanical restriction from Copper Dragon Slowing Breath and repeats the save', () => {
    const dragon = fighter('dragon', 30, {
      controller: 'dm',
      statBlockId: 'srd-5.1:copper-dragon-wyrmling',
      currentHp: 100,
      maxHp: 100,
    })
    const target = fighter('target', 20, {
      classId: 'fighter',
      level: 1,
      currentHp: 10,
      maxHp: 20,
      classResources: { fighterSecondWind: { current: 1, max: 1 } },
      movementSpeeds: { walk: 30, fly: 60, swim: 40, climb: 20 },
      position: { x: 5, y: 0 },
    })
    const ally = fighter('ally', 10, {
      controller: 'dm',
      position: { x: 10, y: 0 },
    })
    const slowed = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('copper-slowing', [dragon, target, ally]),
      {
        type: 'monster-area-action',
        actorId: 'dragon',
        actionId: 'breath-weapons',
        resolution: {
          schemaVersion: 1,
          variantId: 'slowing-breath',
          targetIds: ['target', 'ally'],
          targetSavingThrows: [
            { targetId: 'target', d20: 1 },
            { targetId: 'ally', d20: 20 },
          ],
          damageRolls: [],
        },
      },
    )
    expect(slowed.ok, slowed.ok ? undefined : slowed.reason).toBe(true)
    if (!slowed.ok) return
    const slowedTarget = slowed.state.combatants.target
    const slowEffect = slowedTarget.classState.activeEffects?.find((effect) =>
      effect.definitionId === 'monster-area:slowing-breath-effect')
    expect(slowEffect).toMatchObject({
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      repeatSave: { ability: 'con', dc: 11, timing: 'target-turn-end', onSuccess: 'remove' },
      stackingKey: 'monster-area:slowing-breath-effect',
      stackingPolicy: 'refresh-duration',
      modifiers: {
        speedMultiplier: 0.5,
        preventReactions: true,
        maximumAttacksPerTurn: 1,
        actionOrBonusActionOnly: true,
      },
    })
    expect(slowed.state.combatants.ally.classState.activeEffects?.some((effect) =>
      effect.definitionId === 'monster-area:slowing-breath-effect')).not.toBe(true)
    expect(dnd5eEffectiveSpeed(slowedTarget)).toBe(15)
    expect(dnd5eEffectiveFlySpeed(slowedTarget)).toBe(30)
    expect(slowedTarget.turn.movementRemaining).toBe(15)
    expect(slowedTarget.turn.reactionAvailable).toBe(false)

    const bonusFirstState = structuredClone(slowed.state)
    bonusFirstState.initiativeIndex = bonusFirstState.initiativeOrder.indexOf('target')
    const secondWind = resolveDnd5eHeadlessAction(bonusFirstState, {
      type: 'fighter-second-wind',
      actorId: 'target',
      resourceKey: 'fighterSecondWind',
      d10: 1,
    })
    expect(secondWind.ok, secondWind.ok ? undefined : secondWind.reason).toBe(true)
    if (!secondWind.ok) return
    expect(resolveDnd5eHeadlessAction(secondWind.state, {
      type: 'attack',
      actorId: 'target',
      targetId: 'dragon',
      attackModifier: 20,
      d20: 10,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [1], type: 'slashing' },
      classDamageContext: meleeWeaponContext('test-sword'),
    })).toMatchObject({ ok: false, reason: 'action-unavailable' })

    const attackLimitState = structuredClone(slowed.state)
    attackLimitState.initiativeIndex = attackLimitState.initiativeOrder.indexOf('target')
    const firstAttack = resolveDnd5eHeadlessAction(attackLimitState, {
      type: 'attack',
      actorId: 'target',
      targetId: 'dragon',
      attackModifier: 20,
      d20: 10,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [1], type: 'slashing' },
      classDamageContext: meleeWeaponContext('test-sword'),
    })
    expect(firstAttack.ok, firstAttack.ok ? undefined : firstAttack.reason).toBe(true)
    if (!firstAttack.ok) return
    expect(resolveDnd5eHeadlessAction(firstAttack.state, {
      type: 'attack',
      actorId: 'target',
      targetId: 'dragon',
      attackModifier: 20,
      d20: 10,
      spendAction: false,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [1], type: 'slashing' },
      classDamageContext: meleeWeaponContext('test-sword'),
    })).toMatchObject({ ok: false, reason: 'action-unavailable' })

    if (!slowEffect) return
    const repeatSaveState = structuredClone(slowed.state)
    repeatSaveState.initiativeIndex = repeatSaveState.initiativeOrder.indexOf('target')
    const recovered = resolveDnd5eHeadlessAction(repeatSaveState, {
      type: 'end-turn',
      actorId: 'target',
      activeEffectSavingThrows: [{ effectId: slowEffect.id, d20: 20 }],
    })
    expect(recovered.ok, recovered.ok ? undefined : recovered.reason).toBe(true)
    if (!recovered.ok) return
    expect(recovered.state.combatants.target.classState.activeEffects?.some((effect) =>
      effect.definitionId === 'monster-area:slowing-breath-effect')).not.toBe(true)
    expect(dnd5eEffectiveSpeed(recovered.state.combatants.target)).toBe(30)
  })

  it('applies Gold Dragon Weakening Breath to Strength attacks, checks, saves, and failed targets only', () => {
    const dragon = fighter('dragon', 30, {
      controller: 'dm',
      statBlockId: 'srd-5.1:gold-dragon-wyrmling',
      armorClass: 18,
      currentHp: 100,
      maxHp: 100,
    })
    const target = fighter('target', 20, {
      position: { x: 5, y: 0 },
    })
    const ally = fighter('ally', 10, {
      controller: 'dm',
      position: { x: 10, y: 0 },
    })
    const weakened = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('gold-weakening', [dragon, target, ally]),
      {
        type: 'monster-area-action',
        actorId: 'dragon',
        actionId: 'breath-weapons',
        resolution: {
          schemaVersion: 1,
          variantId: 'weakening-breath',
          targetIds: ['target', 'ally'],
          targetSavingThrows: [
            { targetId: 'target', d20: 1 },
            { targetId: 'ally', d20: 20 },
          ],
          damageRolls: [],
        },
      },
    )
    expect(weakened.ok, weakened.ok ? undefined : weakened.reason).toBe(true)
    if (!weakened.ok) return
    expect(weakened.state.combatants.target.classState.activeEffects).toContainEqual(
      expect.objectContaining({
        definitionId: 'monster-area:weakening-breath-effect',
        modifiers: expect.objectContaining({ strengthRollMode: 'disadvantage' }),
      }),
    )
    expect(weakened.state.combatants.ally.classState.activeEffects?.some((effect) =>
      effect.definitionId === 'monster-area:weakening-breath-effect')).not.toBe(true)
    expect(dnd5eSavingThrowMode(weakened.state.combatants.target, 'str')).toBe('disadvantage')
    expect(dnd5eAbilityCheckRollMode(weakened.state.combatants.target, {
      ability: 'str',
      skill: 'athletics',
    })).toBe('disadvantage')

    weakened.state.initiativeIndex = weakened.state.initiativeOrder.indexOf('target')
    const attack = resolveDnd5eHeadlessAction(weakened.state, {
      type: 'attack',
      actorId: 'target',
      targetId: 'dragon',
      attackModifier: 5,
      d20: 20,
      d20Second: 1,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [], type: 'slashing' },
      classDamageContext: meleeWeaponContext('test-sword'),
    })
    expect(attack.ok, attack.ok ? undefined : attack.reason).toBe(true)
    if (!attack.ok) return
    expect(attack.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      actorId: 'target',
      targetId: 'dragon',
      d20: 1,
      hit: false,
    }))
  })

  it('applies Weakening Breath by a monster weapon actual ability, not by melee/ranged mode', () => {
    const dragon = fighter('dragon', 40, {
      controller: 'dm',
      statBlockId: 'srd-5.1:gold-dragon-wyrmling',
      currentHp: 100,
      maxHp: 100,
    })
    const spy = fighter('spy', 30, {
      controller: 'dm',
      statBlockId: 'srd-5.1:spy',
      currentHp: 50,
      maxHp: 50,
      position: { x: 5, y: 0 },
    })
    const ogre = fighter('ogre', 20, {
      controller: 'dm',
      statBlockId: 'srd-5.1:ogre',
      currentHp: 80,
      maxHp: 80,
      position: { x: 10, y: 0 },
    })
    const hero = fighter('hero', 10, {
      armorClass: 16,
      currentHp: 100,
      maxHp: 100,
      position: { x: 30, y: 0 },
    })
    const weakened = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('monster-weakening-ability', [dragon, spy, ogre, hero]),
      {
        type: 'monster-area-action',
        actorId: 'dragon',
        actionId: 'breath-weapons',
        resolution: {
          schemaVersion: 1,
          variantId: 'weakening-breath',
          targetIds: ['spy', 'ogre'],
          targetSavingThrows: [
            { targetId: 'spy', d20: 1 },
            { targetId: 'ogre', d20: 1 },
          ],
          damageRolls: [],
        },
      },
    )
    expect(weakened.ok, weakened.ok ? undefined : weakened.reason).toBe(true)
    if (!weakened.ok) return

    const dexMeleeState = structuredClone(weakened.state)
    dexMeleeState.initiativeIndex = dexMeleeState.initiativeOrder.indexOf('spy')
    dexMeleeState.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('spy', 'hero')]: 5,
    }
    const dexMelee = resolveDnd5eHeadlessAction(dexMeleeState, {
      type: 'monster-action',
      actorId: 'spy',
      actionId: 'shortsword',
      rolls: [{
        targetId: 'hero',
        d20: 19,
        d20Second: 1,
        damageRolls: [[1]],
      }],
    })
    expect(dexMelee.ok, dexMelee.ok ? undefined : dexMelee.reason).toBe(true)
    if (!dexMelee.ok) return
    expect(dexMelee.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      actorId: 'spy',
      d20: 19,
    }))

    const strengthThrownState = structuredClone(weakened.state)
    strengthThrownState.initiativeIndex = strengthThrownState.initiativeOrder.indexOf('ogre')
    strengthThrownState.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('ogre', 'hero')]: 30,
    }
    const strengthThrown = resolveDnd5eHeadlessAction(strengthThrownState, {
      type: 'monster-action',
      actorId: 'ogre',
      actionId: 'javelin',
      rolls: [{
        targetId: 'hero',
        d20: 19,
        d20Second: 1,
        damageRolls: [],
      }],
    })
    expect(strengthThrown.ok, strengthThrown.ok ? undefined : strengthThrown.reason).toBe(true)
    if (!strengthThrown.ok) return
    expect(strengthThrown.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      actorId: 'ogre',
      d20: 1,
      hit: false,
    }))

    const dexRangedState = structuredClone(weakened.state)
    dexRangedState.initiativeIndex = dexRangedState.initiativeOrder.indexOf('spy')
    dexRangedState.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('spy', 'hero')]: 30,
    }
    const dexRanged = resolveDnd5eHeadlessAction(dexRangedState, {
      type: 'monster-action',
      actorId: 'spy',
      actionId: 'hand-crossbow',
      rolls: [{
        targetId: 'hero',
        d20: 19,
        d20Second: 1,
        damageRolls: [[1]],
      }],
    })
    expect(dexRanged.ok, dexRanged.ok ? undefined : dexRanged.reason).toBe(true)
    if (!dexRanged.ok) return
    expect(dexRanged.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      actorId: 'spy',
      d20: 19,
    }))
  })
})
