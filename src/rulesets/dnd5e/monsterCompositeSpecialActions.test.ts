import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  dnd5eCombatantCanSee,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
  type Dnd5eHeadlessCombatState,
} from './headlessCombatEngine'
import { getDnd5eSrdMonster } from './monsters'

function combatant(input: {
  id: string
  initiative: number
  controller: 'dm' | 'player'
  statBlockId?: string
  x?: number
}): Dnd5eCombatant {
  return createDnd5eCombatant({
    id: input.id,
    name: input.id,
    controller: input.controller,
    initiative: input.initiative,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2,
    armorClass: 10,
    currentHp: 300,
    maxHp: 300,
    temporaryHp: 0,
    speed: 30,
    position: { x: input.x ?? 0, y: 0 },
    concentrating: false,
    statBlockId: input.statBlockId,
  })
}

function encounter(slug: string): Dnd5eHeadlessCombatState {
  const state = startDnd5eHeadlessCombat(`special-${slug}`, [
    combatant({
      id: 'monster',
      initiative: 20,
      controller: 'dm',
      statBlockId: `srd-5.1:${slug}`,
    }),
    combatant({ id: 'hero', initiative: 10, controller: 'player', x: 5 }),
  ])
  state.distanceFeetByCombatantPair = { 'hero\u0000monster': 5 }
  return state
}

function areaAction(actionId: string, d20: number) {
  return {
    type: 'monster-area-action' as const,
    actorId: 'monster',
    actionId,
    resolution: {
      schemaVersion: 1 as const,
      targetIds: ['hero'],
      targetSavingThrows: [{ targetId: 'hero', d20 }],
      damageRolls: [],
    },
  }
}

describe('composite Multiattack special children', () => {
  it('declares all reviewed non-spell special children as Headless rules', () => {
    const expected = [
      ['gibbering-mouther', 'blinding-spittle', 'area-saving-throw'],
      ['nalfeshnee', 'horror-nimbus', 'area-saving-throw'],
      ['tarrasque', 'frightful-presence', 'area-saving-throw'],
      ['chuul', 'tentacles', 'saving-throw-condition'],
      ['mummy', 'dreadful-glare', 'saving-throw-condition'],
      ['mummy-lord', 'dreadful-glare', 'saving-throw-condition'],
    ] as const

    for (const [slug, actionId, ruleKind] of expected) {
      const action = getDnd5eSrdMonster(`srd-5.1:${slug}`)?.actions.find(
        (candidate) => candidate.id === actionId,
      )
      expect(action, `${slug}/${actionId}`).toMatchObject({
        kind: 'other',
        automation: 'headless',
        rule: { kind: ruleKind },
      })
    }
    expect(getDnd5eSrdMonster('srd-5.1:chuul')?.actions.find(
      (action) => action.id === 'tentacles',
    )?.relationRequirement).toEqual({
      kind: 'target-linked-to-source',
      slotGroup: 'pincer',
    })
  })

  it('resolves Blinding Spittle inside Multiattack and only permits skipping when recharge is unavailable', () => {
    const action = {
      type: 'monster-multiattack-composite' as const,
      schemaVersion: 1 as const,
      actorId: 'monster',
      actionId: 'multiattack',
      steps: [
        {
          kind: 'weapon' as const,
          actionId: 'bites',
          roll: { targetId: 'hero', d20: 1, damageRolls: [] },
        },
        {
          kind: 'area' as const,
          actionId: 'blinding-spittle',
          resolution: areaAction('blinding-spittle', 1).resolution,
        },
      ],
    }
    const resolved = resolveDnd5eHeadlessAction(encounter('gibbering-mouther'), action)
    expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
    if (!resolved.ok) return
    expect(resolved.state.combatants.hero.conditions).toContain('blinded')
    expect(resolved.state.combatants.monster.classState.monsterRechargeReadyByActionId)
      .toMatchObject({ 'blinding-spittle': false })

    const unavailable = encounter('gibbering-mouther')
    unavailable.combatants.monster.classState.monsterRechargeReadyByActionId = {
      'blinding-spittle': false,
    }
    const skipped = resolveDnd5eHeadlessAction(unavailable, {
      ...action,
      steps: [
        action.steps[0],
        { kind: 'skip', actionId: 'blinding-spittle' },
      ],
    })
    expect(skipped.ok, skipped.ok ? undefined : skipped.reason).toBe(true)

    const illegalSkip = resolveDnd5eHeadlessAction(encounter('gibbering-mouther'), {
      ...action,
      steps: [
        action.steps[0],
        { kind: 'skip', actionId: 'blinding-spittle' },
      ],
    })
    expect(illegalSkip).toMatchObject({ ok: false, reason: 'invalid-monster-action' })
  })

  it('requires a Chuul Pincer relation, then applies and jointly clears poisoned plus paralyzed', () => {
    const initial = encounter('chuul')
    const rejected = resolveDnd5eHeadlessAction(initial, {
      type: 'monster-special-action',
      actorId: 'monster',
      actionId: 'tentacles',
      targetId: 'hero',
      d20: 1,
    })
    expect(rejected).toMatchObject({ ok: false, reason: 'invalid-monster-action' })

    const pincer = getDnd5eSrdMonster('srd-5.1:chuul')!.actions.find(
      (action) => action.id === 'pincer',
    )!
    const linked = resolveDnd5eHeadlessAction(encounter('chuul'), {
      type: 'monster-action',
      actorId: 'monster',
      actionId: 'pincer',
      rolls: [{
        targetId: 'hero',
        d20: 10,
        damageRolls: pincer.attack!.damage.map((damage) =>
          Array(damage.count).fill(1)),
        onHitEffectRolls: [{ effectId: 'pincer-grapple' }],
      }],
    })
    expect(linked.ok, linked.ok ? undefined : linked.reason).toBe(true)
    if (!linked.ok) return
    linked.state.combatants.monster.turn.actionAvailable = true

    const resolved = resolveDnd5eHeadlessAction(linked.state, {
      type: 'monster-multiattack-composite',
      schemaVersion: 1,
      actorId: 'monster',
      actionId: 'multiattack-pincers-and-tentacles',
      steps: [
        {
          kind: 'weapon',
          actionId: 'pincer',
          roll: { targetId: 'hero', d20: 1, damageRolls: [] },
        },
        {
          kind: 'weapon',
          actionId: 'pincer',
          roll: { targetId: 'hero', d20: 1, damageRolls: [] },
        },
        {
          kind: 'special',
          actionId: 'tentacles',
          targetId: 'hero',
          d20: 1,
        },
      ],
    })
    expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
    if (!resolved.ok) return
    expect(resolved.state.combatants.hero.conditions).toEqual(
      expect.arrayContaining(['grappled', 'poisoned', 'paralyzed']),
    )

    const monsterEnd = resolveDnd5eHeadlessAction(resolved.state, {
      type: 'end-turn',
      actorId: 'monster',
    })
    expect(monsterEnd.ok, monsterEnd.ok ? undefined : monsterEnd.reason).toBe(true)
    if (!monsterEnd.ok) return
    const poison = monsterEnd.state.combatants.hero.classState.activeEffects?.find(
      (effect) => effect.standardCondition === 'poisoned',
    )
    expect(poison).toBeTruthy()
    const heroEnd = resolveDnd5eHeadlessAction(monsterEnd.state, {
      type: 'end-turn',
      actorId: 'hero',
      activeEffectSavingThrows: [{ effectId: poison!.id, d20: 20 }],
    })
    expect(heroEnd.ok, heroEnd.ok ? undefined : heroEnd.reason).toBe(true)
    if (!heroEnd.ok) return
    expect(heroEnd.state.combatants.hero.conditions).not.toContain('poisoned')
    expect(heroEnd.state.combatants.hero.conditions).not.toContain('paralyzed')
    expect(heroEnd.state.combatants.hero.conditions).toContain('grappled')
  })

  it('enforces Horror Nimbus visibility, recharge consumption, and source immunity', () => {
    const resolved = resolveDnd5eHeadlessAction(
      encounter('nalfeshnee'),
      areaAction('horror-nimbus', 20),
    )
    expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
    if (!resolved.ok) return
    expect(resolved.state.combatants.monster.classState.monsterRechargeReadyByActionId)
      .toEqual({ 'horror-nimbus': false })
    expect(resolved.state.combatants.hero.classState.monsterActionImmunityRoundsByKey)
      .toEqual({ 'source-action:monster:horror-nimbus': 14_400 })

    const unseen = encounter('nalfeshnee')
    unseen.lineOfSightBlockedByCombatantPair = { 'hero\u0000monster': true }
    expect(resolveDnd5eHeadlessAction(
      unseen,
      areaAction('horror-nimbus', 1),
    )).toMatchObject({ ok: false, reason: 'invalid-dice' })
  })

  it('uses line-of-sight disadvantage for the Tarrasque repeat save and grants source immunity on success', () => {
    const frightened = resolveDnd5eHeadlessAction(
      encounter('tarrasque'),
      areaAction('frightful-presence', 1),
    )
    expect(frightened.ok, frightened.ok ? undefined : frightened.reason).toBe(true)
    if (!frightened.ok) return
    const monsterEnd = resolveDnd5eHeadlessAction(frightened.state, {
      type: 'end-turn',
      actorId: 'monster',
    })
    expect(monsterEnd.ok, monsterEnd.ok ? undefined : monsterEnd.reason).toBe(true)
    if (!monsterEnd.ok) return
    const effect = monsterEnd.state.combatants.hero.classState.activeEffects?.find(
      (candidate) => candidate.standardCondition === 'frightened',
    )
    expect(effect).toBeTruthy()
    const disadvantaged = resolveDnd5eHeadlessAction(monsterEnd.state, {
      type: 'end-turn',
      actorId: 'hero',
      activeEffectSavingThrows: [{ effectId: effect!.id, d20: 20, d20Second: 1 }],
    })
    expect(disadvantaged.ok, disadvantaged.ok ? undefined : disadvantaged.reason).toBe(true)
    if (!disadvantaged.ok) return
    expect(disadvantaged.state.combatants.hero.conditions).toContain('frightened')

    disadvantaged.state.lineOfSightBlockedByCombatantPair = {
      'hero\u0000monster': true,
    }
    const nextMonsterEnd = resolveDnd5eHeadlessAction(disadvantaged.state, {
      type: 'end-turn',
      actorId: 'monster',
    })
    expect(nextMonsterEnd.ok, nextMonsterEnd.ok ? undefined : nextMonsterEnd.reason).toBe(true)
    if (!nextMonsterEnd.ok) return
    const repeat = nextMonsterEnd.state.combatants.hero.classState.activeEffects?.find(
      (candidate) => candidate.standardCondition === 'frightened',
    )
    const succeeded = resolveDnd5eHeadlessAction(nextMonsterEnd.state, {
      type: 'end-turn',
      actorId: 'hero',
      activeEffectSavingThrows: [{ effectId: repeat!.id, d20: 20 }],
    })
    expect(succeeded.ok, succeeded.ok ? undefined : succeeded.reason).toBe(true)
    if (!succeeded.ok) return
    expect(succeeded.state.combatants.hero.conditions).not.toContain('frightened')
    expect(succeeded.state.combatants.hero.classState.monsterActionImmunityRoundsByKey)
      .toMatchObject({ 'source-action:monster:frightful-presence': 14_399 })

    succeeded.state.combatants.monster.turn.actionAvailable = true
    const immuneTarget = resolveDnd5eHeadlessAction(
      succeeded.state,
      areaAction('frightful-presence', 20),
    )
    expect(immuneTarget).toMatchObject({ ok: false, reason: 'invalid-dice' })
  })

  it('applies Dreadful Glare failure-margin paralysis and its distinct mummy-family immunity', () => {
    const mummyEncounter = encounter('mummy')
    expect(dnd5eCombatantCanSee(mummyEncounter, 'monster', 'hero')).toBe(true)
    expect(dnd5eCombatantCanSee(mummyEncounter, 'hero', 'monster')).toBe(true)
    const failed = resolveDnd5eHeadlessAction(mummyEncounter, {
      type: 'monster-special-action',
      actorId: 'monster',
      actionId: 'dreadful-glare',
      targetId: 'hero',
      d20: 6,
    })
    expect(failed.ok, failed.ok ? undefined : failed.reason).toBe(true)
    if (!failed.ok) return
    expect(failed.state.combatants.hero.conditions).toEqual(
      expect.arrayContaining(['frightened', 'paralyzed']),
    )

    const mummySuccess = resolveDnd5eHeadlessAction(encounter('mummy'), {
      type: 'monster-special-action',
      actorId: 'monster',
      actionId: 'dreadful-glare',
      targetId: 'hero',
      d20: 20,
    })
    expect(mummySuccess.ok, mummySuccess.ok ? undefined : mummySuccess.reason).toBe(true)
    if (!mummySuccess.ok) return
    expect(mummySuccess.state.combatants.hero.classState.monsterActionImmunityRoundsByKey)
      .toEqual({ 'catalog-action:mummy:dreadful-glare': 14_400 })

    const lordSuccess = resolveDnd5eHeadlessAction(encounter('mummy-lord'), {
      type: 'monster-special-action',
      actorId: 'monster',
      actionId: 'dreadful-glare',
      targetId: 'hero',
      d20: 20,
    })
    expect(lordSuccess.ok, lordSuccess.ok ? undefined : lordSuccess.reason).toBe(true)
    if (!lordSuccess.ok) return
    expect(lordSuccess.state.combatants.hero.classState.monsterActionImmunityRoundsByKey)
      .toEqual({
        'catalog-action:mummy:dreadful-glare': 14_400,
        'catalog-action:mummy-lord:dreadful-glare': 14_400,
      })

    const unseen = encounter('mummy')
    unseen.lineOfSightBlockedByCombatantPair = { 'hero\u0000monster': true }
    expect(resolveDnd5eHeadlessAction(unseen, {
      type: 'monster-special-action',
      actorId: 'monster',
      actionId: 'dreadful-glare',
      targetId: 'hero',
      d20: 1,
    })).toMatchObject({ ok: false, reason: 'invalid-target' })
  })
})
