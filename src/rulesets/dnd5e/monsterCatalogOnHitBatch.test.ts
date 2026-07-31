import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  dnd5eSourceLinkedRelations,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'
import {
  getDnd5eSrdMonsterBySlug,
  type Dnd5eMonsterAction,
} from './monsters'

const abilities = {
  str: 14,
  dex: 12,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
} as const

function combatant(id: string, initiative: number, patch = {}) {
  return createDnd5eCombatant({
    id,
    name: id,
    controller: 'player',
    initiative,
    abilities,
    proficiencyBonus: 2,
    armorClass: 5,
    currentHp: 100,
    maxHp: 100,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

function monsterAction(slug: string, actionId: string): Dnd5eMonsterAction {
  const action = getDnd5eSrdMonsterBySlug(slug)?.actions
    .find((candidate) => candidate.id === actionId)
  if (!action) throw new Error(`Missing ${slug}/${actionId}`)
  return action
}

function minimumDamageRolls(action: Dnd5eMonsterAction): number[][] {
  if (!action.attack) throw new Error(`${action.id} is missing its weapon attack`)
  return action.attack.damage.map((damage) => Array(damage.count).fill(1))
}

const sourceLinkedCases = [
  {
    slug: 'chuul',
    actionId: 'pincer',
    effectId: 'pincer-grapple',
    slotGroup: 'pincer',
    capacity: 2,
    maxDistanceFeet: 10,
    targetMaxSizeRank: 3,
    whenCapacityFull: 'skip-application',
    escapeDc: 14,
    conditions: [{ condition: 'grappled' }],
  },
  {
    slug: 'couatl',
    actionId: 'constrict',
    effectId: 'constrict-grapple',
    slotGroup: 'constrict',
    capacity: 1,
    maxDistanceFeet: 10,
    targetMaxSizeRank: 2,
    whenCapacityFull: 'linked-target-only',
    escapeDc: 15,
    conditions: [
      { condition: 'grappled' },
      { condition: 'restrained', dependsOnCondition: 'grappled' },
    ],
  },
  {
    slug: 'crocodile',
    actionId: 'bite',
    effectId: 'bite-grapple',
    slotGroup: 'bite',
    capacity: 1,
    maxDistanceFeet: 5,
    targetMaxSizeRank: 5,
    whenCapacityFull: 'linked-target-only',
    escapeDc: 12,
    conditions: [
      { condition: 'grappled' },
      { condition: 'restrained', dependsOnCondition: 'grappled' },
    ],
  },
  {
    slug: 'giant-crab',
    actionId: 'claw',
    effectId: 'claw-grapple',
    slotGroup: 'claw',
    capacity: 2,
    maxDistanceFeet: 5,
    targetMaxSizeRank: 5,
    whenCapacityFull: 'skip-application',
    escapeDc: 11,
    conditions: [{ condition: 'grappled' }],
  },
  {
    slug: 'giant-crocodile',
    actionId: 'bite',
    effectId: 'bite-grapple',
    slotGroup: 'bite',
    capacity: 1,
    maxDistanceFeet: 5,
    targetMaxSizeRank: 5,
    whenCapacityFull: 'linked-target-only',
    escapeDc: 16,
    conditions: [
      { condition: 'grappled' },
      { condition: 'restrained', dependsOnCondition: 'grappled' },
    ],
  },
  {
    slug: 'giant-frog',
    actionId: 'bite',
    effectId: 'bite-grapple',
    slotGroup: 'bite',
    capacity: 1,
    maxDistanceFeet: 5,
    targetMaxSizeRank: 5,
    whenCapacityFull: 'linked-target-only',
    escapeDc: 11,
    conditions: [
      { condition: 'grappled' },
      { condition: 'restrained', dependsOnCondition: 'grappled' },
    ],
  },
  {
    slug: 'giant-toad',
    actionId: 'bite',
    effectId: 'bite-grapple',
    slotGroup: 'bite',
    capacity: 1,
    maxDistanceFeet: 5,
    targetMaxSizeRank: 5,
    whenCapacityFull: 'linked-target-only',
    escapeDc: 13,
    conditions: [
      { condition: 'grappled' },
      { condition: 'restrained', dependsOnCondition: 'grappled' },
    ],
  },
  {
    slug: 'glabrezu',
    actionId: 'pincer',
    effectId: 'pincer-grapple',
    slotGroup: 'pincer',
    capacity: 2,
    maxDistanceFeet: 10,
    targetMaxSizeRank: 2,
    whenCapacityFull: 'skip-application',
    escapeDc: 15,
    conditions: [{ condition: 'grappled' }],
  },
  {
    slug: 'kraken',
    actionId: 'tentacle',
    effectId: 'tentacle-grapple',
    slotGroup: 'tentacle',
    capacity: 10,
    maxDistanceFeet: 30,
    targetMaxSizeRank: 5,
    whenCapacityFull: 'skip-application',
    escapeDc: 18,
    conditions: [
      { condition: 'grappled' },
      { condition: 'restrained', dependsOnCondition: 'grappled' },
    ],
  },
  {
    slug: 'otyugh',
    actionId: 'tentacle',
    effectId: 'tentacle-grapple',
    slotGroup: 'tentacle',
    capacity: 2,
    maxDistanceFeet: 10,
    targetMaxSizeRank: 2,
    whenCapacityFull: 'skip-application',
    escapeDc: 13,
    conditions: [
      { condition: 'grappled' },
      { condition: 'restrained', dependsOnCondition: 'grappled' },
    ],
  },
  {
    slug: 'remorhaz',
    actionId: 'bite',
    effectId: 'bite-grapple',
    slotGroup: 'bite',
    capacity: 1,
    maxDistanceFeet: 10,
    targetMaxSizeRank: 5,
    whenCapacityFull: 'linked-target-only',
    escapeDc: 17,
    conditions: [
      { condition: 'grappled' },
      { condition: 'restrained', dependsOnCondition: 'grappled' },
    ],
  },
  {
    slug: 'roc',
    actionId: 'talons',
    effectId: 'talons-grapple',
    slotGroup: 'talons',
    capacity: 1,
    maxDistanceFeet: 5,
    targetMaxSizeRank: 5,
    whenCapacityFull: 'linked-target-only',
    escapeDc: 19,
    conditions: [
      { condition: 'grappled' },
      { condition: 'restrained', dependsOnCondition: 'grappled' },
    ],
  },
  {
    slug: 'tarrasque',
    actionId: 'bite',
    effectId: 'bite-grapple',
    slotGroup: 'bite',
    capacity: 1,
    maxDistanceFeet: 10,
    targetMaxSizeRank: 5,
    whenCapacityFull: 'linked-target-only',
    escapeDc: 20,
    conditions: [
      { condition: 'grappled' },
      { condition: 'restrained', dependsOnCondition: 'grappled' },
    ],
  },
  {
    slug: 'tyrannosaurus-rex',
    actionId: 'bite',
    effectId: 'bite-grapple',
    slotGroup: 'bite',
    capacity: 1,
    maxDistanceFeet: 10,
    targetMaxSizeRank: 2,
    whenCapacityFull: 'linked-target-only',
    escapeDc: 17,
    conditions: [
      { condition: 'grappled' },
      { condition: 'restrained', dependsOnCondition: 'grappled' },
    ],
  },
] as const

const savingConditionCases = [
  {
    slug: 'deep-gnome-svirfneblin',
    actionId: 'poisoned-dart',
    effectId: 'dart-poisoned',
    ability: 'con',
    dc: 12,
    condition: 'poisoned',
  },
  {
    slug: 'ettercap',
    actionId: 'bite',
    effectId: 'bite-poisoned',
    ability: 'con',
    dc: 11,
    condition: 'poisoned',
  },
  {
    slug: 'lich',
    actionId: 'paralyzing-touch',
    effectId: 'touch-paralyzed',
    ability: 'con',
    dc: 18,
    condition: 'paralyzed',
  },
] as const

describe('SRD monster structured on-hit batch', () => {
  it('preserves the 14 source-linked catalog declarations exactly', () => {
    expect(sourceLinkedCases).toHaveLength(14)
    for (const expected of sourceLinkedCases) {
      const action = monsterAction(expected.slug, expected.actionId)
      const effect = action.attack?.onHitEffects?.find((candidate) =>
        candidate.kind === 'source-linked-condition')

      expect(action.automation, `${expected.slug}/${expected.actionId}`).toBe('headless')
      expect(effect, `${expected.slug}/${expected.actionId}`).toEqual({
        id: expected.effectId,
        kind: 'source-linked-condition',
        relation: {
          kind: 'grapple',
          slotGroup: expected.slotGroup,
          capacity: expected.capacity,
          maxDistanceFeet: expected.maxDistanceFeet,
          targetMaxSizeRank: expected.targetMaxSizeRank,
          whenCapacityFull: expected.whenCapacityFull,
          attackAdvantageAgainstLinkedTarget: undefined,
        },
        escapeDc: expected.escapeDc,
        conditions: expected.conditions,
      })
    }
  })

  it('preserves the original three condition-only saving throw declarations exactly', () => {
    expect(savingConditionCases).toHaveLength(3)
    for (const expected of savingConditionCases) {
      const action = monsterAction(expected.slug, expected.actionId)
      const effect = action.attack?.onHitEffects?.find((candidate) =>
        candidate.kind === 'saving-throw-condition')

      expect(action.automation, `${expected.slug}/${expected.actionId}`).toBe('headless')
      expect(effect, `${expected.slug}/${expected.actionId}`).toEqual({
        id: expected.effectId,
        kind: 'saving-throw-condition',
        ability: expected.ability,
        dc: expected.dc,
        conditionOnFailedSave: {
          condition: expected.condition,
          durationRounds: 10,
          repeatSaveAtEndOfTargetTurn: true,
        },
      })
    }
  })

  it.each([
    { slug: 'gibbering-mouther', actionId: 'bites', dc: 10 },
    { slug: 'gladiator', actionId: 'shield-bash', dc: 15 },
  ])(
    'automates the Medium-or-smaller prone rider for $slug/$actionId',
    ({ slug, actionId, dc }) => {
      const action = monsterAction(slug, actionId)
      expect(action).toMatchObject({
        automation: 'headless',
        attack: {
          targetMaxSizeRank: 2,
          onHitRule: {
            kind: 'saving-throw-condition',
            ability: 'str',
            dc,
            condition: 'prone',
          },
        },
      })
    },
  )

  it('enforces Chuul Pincer capacity while still resolving the excess hit', () => {
    const chuul = combatant('chuul', 20, {
      controller: 'dm',
      statBlockId: 'srd-5.1:chuul',
      sizeRank: 3,
    })
    const targets = ['first', 'second', 'excess'].map((id, index) =>
      combatant(id, 10 - index, {
        sizeRank: 2,
        position: { x: 5, y: index * 2 },
      }))
    let state = startDnd5eHeadlessCombat('chuul-capacity', [chuul, ...targets])
    const pincer = monsterAction('chuul', 'pincer')

    for (const target of targets) {
      const hpBefore = state.combatants[target.id].currentHp
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: chuul.id,
        actionId: pincer.id,
        rolls: [{
          targetId: target.id,
          d20: 10,
          damageRolls: minimumDamageRolls(pincer),
          onHitEffectRolls: [{ effectId: 'pincer-grapple' }],
        }],
      })
      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) throw new Error(result.reason)
      expect(result.state.combatants[target.id].currentHp).toBeLessThan(hpBefore)
      state = result.state
      state.combatants[chuul.id].turn.actionAvailable = true
    }

    expect(dnd5eSourceLinkedRelations(state, chuul.id, 'pincer')).toHaveLength(2)
    expect(state.combatants.first.conditions).toContain('grappled')
    expect(state.combatants.second.conditions).toContain('grappled')
    expect(state.combatants.excess.conditions).not.toContain('grappled')
  })

  it('resolves Chuul Pincer damage but rejects its grapple rider for an oversized target', () => {
    const chuul = combatant('chuul', 20, {
      controller: 'dm',
      statBlockId: 'srd-5.1:chuul',
      sizeRank: 3,
    })
    const hugeTarget = combatant('huge-target', 10, {
      sizeRank: 4,
      position: { x: 5, y: 0 },
    })
    const pincer = monsterAction('chuul', 'pincer')
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('chuul-size-limit', [chuul, hugeTarget]),
      {
        type: 'monster-action',
        actorId: chuul.id,
        actionId: pincer.id,
        rolls: [{
          targetId: hugeTarget.id,
          d20: 10,
          damageRolls: minimumDamageRolls(pincer),
          onHitEffectRolls: [{ effectId: 'pincer-grapple' }],
        }],
      },
    )

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[hugeTarget.id].currentHp).toBeLessThan(100)
    expect(result.state.combatants[hugeTarget.id].conditions).not.toContain('grappled')
    expect(dnd5eSourceLinkedRelations(result.state, chuul.id, 'pincer')).toHaveLength(0)
  })

  it('resolves Ettercap Bite and Claws together and applies the failed Bite save', () => {
    const ettercap = combatant('ettercap', 20, {
      controller: 'dm',
      statBlockId: 'srd-5.1:ettercap',
      sizeRank: 2,
    })
    const target = combatant('target', 10, {
      position: { x: 5, y: 0 },
      savingThrowBonuses: { con: 0 },
    })
    const bite = monsterAction('ettercap', 'bite')
    const claws = monsterAction('ettercap', 'claws')
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('ettercap-multiattack-save', [ettercap, target]),
      {
        type: 'monster-action',
        actorId: ettercap.id,
        actionId: 'multiattack',
        rolls: [
          {
            targetId: target.id,
            d20: 10,
            damageRolls: minimumDamageRolls(bite),
            onHitEffectRolls: [{
              effectId: 'bite-poisoned',
              d20: 1,
            }],
          },
          {
            targetId: target.id,
            d20: 10,
            damageRolls: minimumDamageRolls(claws),
          },
        ],
      },
    )

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.events.filter((event) => event.type === 'attack-resolved')).toHaveLength(2)
    expect(result.events.filter((event) => event.type === 'saving-throw-resolved')).toEqual([
      expect.objectContaining({
        targetId: target.id,
        ability: 'con',
        d20: 1,
        dc: 11,
        success: false,
      }),
    ])
    expect(result.state.combatants[target.id].conditions).toContain('poisoned')
    expect(result.state.combatants[target.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({
        standardCondition: 'poisoned',
        duration: expect.objectContaining({
          type: 'rounds',
          remainingRounds: 10,
          tickOn: 'target-turn-end',
        }),
        repeatSave: expect.objectContaining({
          ability: 'con',
          dc: 11,
          timing: 'target-turn-end',
          onSuccess: 'remove',
        }),
        source: expect.objectContaining({
          kind: 'monster',
          actorId: ettercap.id,
        }),
      }),
    )
  })
})
