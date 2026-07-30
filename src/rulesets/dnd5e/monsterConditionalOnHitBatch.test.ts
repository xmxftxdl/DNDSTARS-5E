import { describe, expect, it } from 'vitest'
import {
  dnd5eActiveEffectId,
  type Dnd5eActiveEffectInstance,
} from './activeEffects'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
  type Dnd5eHeadlessCombatState,
} from './headlessCombatEngine'
import { getDnd5eSrdMonster } from './monsters'

const abilities = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
} as const

function combatant(
  id: string,
  initiative: number,
  patch: Partial<Dnd5eCombatant> = {},
): Dnd5eCombatant {
  return createDnd5eCombatant({
    id,
    name: id,
    controller: 'player',
    initiative,
    abilities,
    proficiencyBonus: 2,
    armorClass: 1,
    currentHp: 20,
    maxHp: 20,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

function catalogMonster(
  slug: string,
  initiative = 30,
  id = slug,
): Dnd5eCombatant {
  const monster = getDnd5eSrdMonster(`srd-5.1:${slug}`)
  if (!monster) throw new Error(`missing SRD monster ${slug}`)
  return combatant(id, initiative, {
    controller: 'dm',
    statBlockId: monster.id,
    creatureType: monster.creatureType,
    armorClass: monster.armorClass.value,
    currentHp: monster.hitPoints.average,
    maxHp: monster.hitPoints.average,
    abilities: monster.abilities,
  })
}

function conditionEffect(
  combatant: Dnd5eCombatant,
  condition: NonNullable<Dnd5eActiveEffectInstance['standardCondition']>,
): Dnd5eActiveEffectInstance | undefined {
  return combatant.classState.activeEffects?.find(
    (effect) => effect.standardCondition === condition,
  )
}

function attackWithConditionalSave(input: {
  slug: 'drow' | 'pseudodragon' | 'bearded-devil' | 'couatl' | 'cockatrice'
  actionId: 'hand-crossbow' | 'sting' | 'beard' | 'bite'
  effectId:
    | 'crossbow-poisoned-unconscious'
    | 'sting-poisoned-unconscious'
    | 'beard-poisoned'
    | 'bite-poisoned-unconscious'
    | 'bite-petrification'
  saveD20: number
  saveD20Second?: number
  distanceFeet: number
  targetCurrentHp?: number
  targetPatch?: Partial<Dnd5eCombatant>
  additionalCombatants?: readonly Dnd5eCombatant[]
}) {
  const attacker = catalogMonster(input.slug)
  const target = combatant('target', 20, {
    currentHp: input.targetCurrentHp ?? 20,
    maxHp: 20,
    savingThrowBonuses: { con: 0 },
    ...input.targetPatch,
  })
  const state = startDnd5eHeadlessCombat(
    `conditional-on-hit:${input.slug}:${input.saveD20}`,
    [attacker, target, ...(input.additionalCombatants ?? [])],
  )
  state.distanceFeetByCombatantPair = {
    ...state.distanceFeetByCombatantPair,
    [dnd5eCombatantPairKey(attacker.id, target.id)]: input.distanceFeet,
  }
  const result = resolveDnd5eHeadlessAction(state, {
    type: 'monster-action',
    actorId: attacker.id,
    actionId: input.actionId,
    rolls: [{
      targetId: target.id,
      d20: 10,
      damageRolls: [[1]],
      onHitEffectRolls: [{
        effectId: input.effectId,
        d20: input.saveD20,
        d20Second: input.saveD20Second,
      }],
    }],
  })
  return { attacker, target, result }
}

function stableConditionEffectId(input: {
  actorId: string
  actionId: string
  effectId: string
  targetId?: string
  condition: NonNullable<Dnd5eActiveEffectInstance['standardCondition']>
}): string {
  return [
    'monster-on-hit-save',
    input.actorId,
    input.actionId,
    input.effectId,
    input.targetId ?? 'target',
    input.condition,
  ].join(':')
}

function putActorOnTurn(
  state: Dnd5eHeadlessCombatState,
  actorId: string,
): void {
  state.initiativeIndex = state.initiativeOrder.indexOf(actorId)
  state.combatants[actorId].turn.actionAvailable = true
}

describe('conditional catalog weapon riders', () => {
  it('applies only Drow poison when the Constitution save fails by less than five', () => {
    const { attacker, target, result } = attackWithConditionalSave({
      slug: 'drow',
      actionId: 'hand-crossbow',
      effectId: 'crossbow-poisoned-unconscious',
      saveD20: 10,
      distanceFeet: 10,
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    const resolvedTarget = result.state.combatants[target.id]
    expect(resolvedTarget.conditions).toContain('poisoned')
    expect(resolvedTarget.conditions).not.toContain('unconscious')
    expect(conditionEffect(resolvedTarget, 'poisoned')).toMatchObject({
      id: stableConditionEffectId({
        actorId: attacker.id,
        actionId: 'hand-crossbow',
        effectId: 'crossbow-poisoned-unconscious',
        condition: 'poisoned',
      }),
      dependsOnEffectId: undefined,
    })
  })

  it('keeps Drow unconscious after the triggering hit, then later damage wakes only that condition', () => {
    const striker = combatant('striker', 10, { controller: 'dm' })
    const { attacker, target, result } = attackWithConditionalSave({
      slug: 'drow',
      actionId: 'hand-crossbow',
      effectId: 'crossbow-poisoned-unconscious',
      saveD20: 8,
      distanceFeet: 10,
      additionalCombatants: [striker],
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    const resolvedTarget = result.state.combatants[target.id]
    const poison = conditionEffect(resolvedTarget, 'poisoned')
    const unconscious = conditionEffect(resolvedTarget, 'unconscious')
    expect(resolvedTarget.currentHp).toBe(17)
    expect(resolvedTarget.conditions).toEqual(
      expect.arrayContaining(['poisoned', 'unconscious']),
    )
    expect(poison).toMatchObject({
      id: stableConditionEffectId({
        actorId: attacker.id,
        actionId: 'hand-crossbow',
        effectId: 'crossbow-poisoned-unconscious',
        condition: 'poisoned',
      }),
    })
    expect(unconscious).toMatchObject({
      id: stableConditionEffectId({
        actorId: attacker.id,
        actionId: 'hand-crossbow',
        effectId: 'crossbow-poisoned-unconscious',
        condition: 'unconscious',
      }),
      dependsOnEffectId: poison?.id,
      breakOn: expect.arrayContaining(['takes-damage']),
    })

    putActorOnTurn(result.state, striker.id)
    result.state.distanceFeetByCombatantPair = {
      ...result.state.distanceFeetByCombatantPair,
      [dnd5eCombatantPairKey(striker.id, target.id)]: 5,
    }
    const damaged = resolveDnd5eHeadlessAction(result.state, {
      type: 'attack',
      actorId: striker.id,
      targetId: target.id,
      attackModifier: 20,
      d20: 10,
      d20Second: 9,
      damage: {
        count: 1,
        sides: 4,
        bonus: 0,
        rolls: [1, 1],
        type: 'bludgeoning',
      },
    })

    expect(damaged.ok, damaged.ok ? undefined : damaged.reason).toBe(true)
    if (!damaged.ok) return
    expect(damaged.state.combatants[target.id].conditions).toContain('poisoned')
    expect(damaged.state.combatants[target.id].conditions).not.toContain('unconscious')
    expect(conditionEffect(damaged.state.combatants[target.id], 'poisoned')?.id).toBe(poison?.id)
    expect(conditionEffect(damaged.state.combatants[target.id], 'unconscious')).toBeUndefined()
  })

  it.each([
    { saveD20: 8, unconscious: false },
    { saveD20: 6, unconscious: true },
  ])(
    'uses Pseudodragon failure margin for unconscious (d20=$saveD20)',
    ({ saveD20, unconscious: expectedUnconscious }) => {
      const { attacker, target, result } = attackWithConditionalSave({
        slug: 'pseudodragon',
        actionId: 'sting',
        effectId: 'sting-poisoned-unconscious',
        saveD20,
        distanceFeet: 5,
      })

      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      const resolvedTarget = result.state.combatants[target.id]
      const poison = conditionEffect(resolvedTarget, 'poisoned')
      const unconscious = conditionEffect(resolvedTarget, 'unconscious')
      expect(poison?.id).toBe(stableConditionEffectId({
        actorId: attacker.id,
        actionId: 'sting',
        effectId: 'sting-poisoned-unconscious',
        condition: 'poisoned',
      }))
      expect(Boolean(unconscious)).toBe(expectedUnconscious)
      if (expectedUnconscious) {
        expect(unconscious).toMatchObject({
          id: stableConditionEffectId({
            actorId: attacker.id,
            actionId: 'sting',
            effectId: 'sting-poisoned-unconscious',
            condition: 'unconscious',
          }),
          dependsOnEffectId: poison?.id,
          breakOn: expect.arrayContaining(['takes-damage']),
        })
      }
    },
  )

  it('blocks healing from Bearded Devil poison and permits it after the end-turn save removes the effect', () => {
    const paladin = combatant('paladin', 10, {
      classId: 'paladin',
      level: 5,
      classResources: {
        'dnd5e-lay-on-hands': { current: 20, max: 25 },
      },
    })
    const { attacker, target, result } = attackWithConditionalSave({
      slug: 'bearded-devil',
      actionId: 'beard',
      effectId: 'beard-poisoned',
      saveD20: 1,
      distanceFeet: 5,
      targetCurrentHp: 10,
      additionalCombatants: [paladin],
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    const poison = conditionEffect(result.state.combatants[target.id], 'poisoned')
    expect(poison).toMatchObject({
      id: stableConditionEffectId({
        actorId: attacker.id,
        actionId: 'beard',
        effectId: 'beard-poisoned',
        condition: 'poisoned',
      }),
      modifiers: { preventHealing: true },
    })
    const hpAfterBeard = result.state.combatants[target.id].currentHp

    const blockedState = structuredClone(result.state)
    putActorOnTurn(blockedState, paladin.id)
    const blocked = resolveDnd5eHeadlessAction(blockedState, {
      type: 'paladin-lay-on-hands',
      actorId: paladin.id,
      targetId: target.id,
      amount: 5,
    })
    expect(blocked.ok, blocked.ok ? undefined : blocked.reason).toBe(true)
    if (!blocked.ok) return
    expect(blocked.state.combatants[target.id].currentHp).toBe(hpAfterBeard)
    expect(blocked.events).toContainEqual({
      type: 'healing-applied',
      targetId: target.id,
      amount: 0,
      hpBefore: hpAfterBeard,
      hpAfter: hpAfterBeard,
    })

    const targetTurn = resolveDnd5eHeadlessAction(result.state, {
      type: 'end-turn',
      actorId: attacker.id,
    })
    expect(targetTurn.ok, targetTurn.ok ? undefined : targetTurn.reason).toBe(true)
    if (!targetTurn.ok || !poison) return
    const saved = resolveDnd5eHeadlessAction(targetTurn.state, {
      type: 'end-turn',
      actorId: target.id,
      activeEffectSavingThrows: [{
        effectId: poison.id,
        d20: 20,
      }],
    })
    expect(saved.ok, saved.ok ? undefined : saved.reason).toBe(true)
    if (!saved.ok) return
    expect(conditionEffect(saved.state.combatants[target.id], 'poisoned')).toBeUndefined()

    const healed = resolveDnd5eHeadlessAction(saved.state, {
      type: 'paladin-lay-on-hands',
      actorId: paladin.id,
      targetId: target.id,
      amount: 5,
    })
    expect(healed.ok, healed.ok ? undefined : healed.reason).toBe(true)
    if (!healed.ok) return
    expect(healed.state.combatants[target.id].currentHp).toBe(hpAfterBeard + 5)
    expect(healed.events).toContainEqual({
      type: 'healing-applied',
      targetId: target.id,
      amount: 5,
      hpBefore: hpAfterBeard,
      hpAfter: hpAfterBeard + 5,
    })
  })

  it('links Couatl unconscious to its source-specific poisoned effect', () => {
    const helper = combatant('helper', 10)
    const { attacker, target, result } = attackWithConditionalSave({
      slug: 'couatl',
      actionId: 'bite',
      effectId: 'bite-poisoned-unconscious',
      saveD20: 1,
      distanceFeet: 5,
      additionalCombatants: [helper],
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    const resolvedTarget = result.state.combatants[target.id]
    const poison = conditionEffect(resolvedTarget, 'poisoned')
    const unconscious = conditionEffect(resolvedTarget, 'unconscious')
    expect(poison).toMatchObject({
      id: stableConditionEffectId({
        actorId: attacker.id,
        actionId: 'bite',
        effectId: 'bite-poisoned-unconscious',
        condition: 'poisoned',
      }),
      duration: {
        type: 'rounds',
        remainingRounds: 14_400,
        tickOn: 'target-turn-end',
      },
    })
    expect(unconscious).toMatchObject({
      id: stableConditionEffectId({
        actorId: attacker.id,
        actionId: 'bite',
        effectId: 'bite-poisoned-unconscious',
        condition: 'unconscious',
      }),
      duration: {
        type: 'rounds',
        remainingRounds: 14_400,
        tickOn: 'target-turn-end',
      },
      dependsOnEffectId: poison?.id,
      breakOn: expect.arrayContaining(['awakened']),
    })

    putActorOnTurn(result.state, helper.id)
    result.state.distanceFeetByCombatantPair = {
      ...result.state.distanceFeetByCombatantPair,
      [dnd5eCombatantPairKey(helper.id, target.id)]: 5,
    }
    const awakened = resolveDnd5eHeadlessAction(result.state, {
      type: 'wake-sleeping-creature',
      actorId: helper.id,
      targetId: target.id,
    })
    expect(awakened.ok, awakened.ok ? undefined : awakened.reason).toBe(true)
    if (!awakened.ok) return
    expect(awakened.state.combatants[target.id].conditions).toContain('poisoned')
    expect(awakened.state.combatants[target.id].conditions).not.toContain('unconscious')
    expect(awakened.events).toContainEqual({
      type: 'sleeping-creature-awakened',
      actorId: helper.id,
      targetId: target.id,
      sourceRulesIds: [
        `monster:${attacker.statBlockId}:${attacker.id}:bite:bite-poisoned-unconscious`,
      ],
    })
  })

  it('marks Cockatrice Bite as magical and uses both Magic Resistance save dice before restraining', () => {
    const cockatrice = getDnd5eSrdMonster('srd-5.1:cockatrice')
    expect(cockatrice?.actions.find((action) => action.id === 'bite')).toMatchObject({
      automation: 'headless',
      attack: {
        onHitEffects: [{
          id: 'bite-petrification',
          kind: 'saving-throw-condition',
          ability: 'con',
          dc: 11,
          magical: true,
        }],
      },
    })

    const missingSecondDie = attackWithConditionalSave({
      slug: 'cockatrice',
      actionId: 'bite',
      effectId: 'bite-petrification',
      saveD20: 1,
      distanceFeet: 5,
      targetPatch: { magicResistance: true },
    }).result
    expect(missingSecondDie).toMatchObject({
      ok: false,
      reason: 'invalid-dice',
    })

    const { attacker, target, result } = attackWithConditionalSave({
      slug: 'cockatrice',
      actionId: 'bite',
      effectId: 'bite-petrification',
      saveD20: 1,
      saveD20Second: 2,
      distanceFeet: 5,
      targetPatch: { magicResistance: true },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved',
      targetId: target.id,
      d20: 2,
      dc: 11,
      success: false,
    }))
    const restrained = result.state.combatants[target.id].classState.activeEffects?.find(
      (effect) => effect.standardCondition === 'restrained',
    )
    expect(restrained).toMatchObject({
      id: stableConditionEffectId({
        actorId: attacker.id,
        actionId: 'bite',
        effectId: 'bite-petrification',
        condition: 'restrained',
      }),
      source: {
        kind: 'monster',
        actorId: attacker.id,
        magical: true,
      },
      duration: {
        type: 'rounds',
        remainingRounds: 1,
        tickOn: 'target-turn-end',
      },
      repeatSave: {
        ability: 'con',
        dc: 11,
        timing: 'target-turn-end',
        onFailureTransition: {
          replaceWithCondition: 'petrified',
          duration: 'permanent',
        },
        onSuccess: 'remove',
      },
    })
  })

  it('removes Cockatrice restraint when the magical end-turn repeat save succeeds', () => {
    const { attacker, target, result } = attackWithConditionalSave({
      slug: 'cockatrice',
      actionId: 'bite',
      effectId: 'bite-petrification',
      saveD20: 1,
      saveD20Second: 2,
      distanceFeet: 5,
      targetPatch: { magicResistance: true },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    const restrained = result.state.combatants[target.id].classState.activeEffects?.find(
      (effect) => effect.standardCondition === 'restrained',
    )
    expect(restrained).toBeDefined()
    if (!restrained) return

    const targetTurn = resolveDnd5eHeadlessAction(result.state, {
      type: 'end-turn',
      actorId: attacker.id,
    })
    expect(targetTurn.ok, targetTurn.ok ? undefined : targetTurn.reason).toBe(true)
    if (!targetTurn.ok) return
    const saved = resolveDnd5eHeadlessAction(targetTurn.state, {
      type: 'end-turn',
      actorId: target.id,
      activeEffectSavingThrows: [{
        effectId: restrained.id,
        d20: 1,
        d20Second: 20,
      }],
    })

    expect(saved.ok, saved.ok ? undefined : saved.reason).toBe(true)
    if (!saved.ok) return
    expect(saved.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-save-resolved',
      targetId: target.id,
      effectId: restrained.id,
      total: 20,
      success: true,
    }))
    expect(saved.state.combatants[target.id].conditions).not.toEqual(
      expect.arrayContaining(['restrained', 'petrified']),
    )
    expect(saved.state.combatants[target.id].classState.activeEffects).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: restrained.id }),
      ]),
    )
  })

  it('replaces failed Cockatrice restraint with stable permanent magical petrification', () => {
    const { attacker, target, result } = attackWithConditionalSave({
      slug: 'cockatrice',
      actionId: 'bite',
      effectId: 'bite-petrification',
      saveD20: 1,
      saveD20Second: 2,
      distanceFeet: 5,
      targetPatch: { magicResistance: true },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    const restrained = result.state.combatants[target.id].classState.activeEffects?.find(
      (effect) => effect.standardCondition === 'restrained',
    )
    expect(restrained?.source.magical).toBe(true)
    if (!restrained) return

    const targetTurn = resolveDnd5eHeadlessAction(result.state, {
      type: 'end-turn',
      actorId: attacker.id,
    })
    expect(targetTurn.ok, targetTurn.ok ? undefined : targetTurn.reason).toBe(true)
    if (!targetTurn.ok) return
    const failed = resolveDnd5eHeadlessAction(targetTurn.state, {
      type: 'end-turn',
      actorId: target.id,
      activeEffectSavingThrows: [{
        effectId: restrained.id,
        d20: 1,
        d20Second: 2,
      }],
    })

    expect(failed.ok, failed.ok ? undefined : failed.reason).toBe(true)
    if (!failed.ok) return
    const resolvedTarget = failed.state.combatants[target.id]
    expect(resolvedTarget.conditions).not.toContain('restrained')
    expect(resolvedTarget.conditions).toContain('petrified')
    const petrified = resolvedTarget.classState.activeEffects?.find(
      (effect) => effect.standardCondition === 'petrified',
    )
    expect(petrified).toMatchObject({
      id: dnd5eActiveEffectId('condition:petrified', attacker.id, target.id),
      definitionId: 'condition:petrified',
      source: {
        kind: 'monster',
        actorId: attacker.id,
        magical: true,
        rulesId: [
          'monster',
          attacker.statBlockId,
          attacker.id,
          'bite',
          'bite-petrification',
        ].join(':') + ':failed-repeat-save',
      },
      duration: { type: 'permanent' },
      repeatSave: undefined,
      stackingKey: [
        'condition-transition',
        'petrified',
        attacker.id,
        target.id,
      ].join(':'),
    })
    expect(resolvedTarget.classState.activeEffects).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: restrained.id }),
      ]),
    )
  })
})
