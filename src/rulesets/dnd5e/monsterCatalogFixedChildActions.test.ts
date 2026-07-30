import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'
import { auditDnd5eMonsterHeadlessCoverage } from './monsterHeadlessCoverage'
import {
  getDnd5eSrdMonsterBySlug,
  type Dnd5eMonsterAction,
  type Dnd5eMonsterDamage,
} from './monsters'

function action(slug: string, actionId: string): Dnd5eMonsterAction {
  const found = getDnd5eSrdMonsterBySlug(slug)?.actions.find((candidate) =>
    candidate.id === actionId)
  if (!found) throw new Error(`Missing ${slug}/${actionId}`)
  return found
}

function damage(
  average: number,
  count: number,
  sides: number,
  bonus: number,
  type: Dnd5eMonsterDamage['type'],
): Dnd5eMonsterDamage {
  return { average, count, sides, bonus, type }
}

describe('catalog fixed-branch Multiattack child actions', () => {
  it.each([
    {
      slug: 'djinni',
      actionId: 'scimitar',
      mode: 'melee',
      toHit: 9,
      damage: [
        damage(12, 2, 6, 5, 'slashing'),
        damage(3, 1, 6, 0, 'lightning'),
      ],
    },
    {
      slug: 'drider',
      actionId: 'longsword',
      mode: 'melee',
      toHit: 6,
      damage: [damage(7, 1, 8, 3, 'slashing')],
    },
    {
      slug: 'erinyes',
      actionId: 'longsword',
      mode: 'melee',
      toHit: 8,
      damage: [
        damage(8, 1, 8, 4, 'slashing'),
        damage(13, 3, 8, 0, 'poison'),
      ],
    },
    {
      slug: 'wight',
      actionId: 'longsword',
      mode: 'melee',
      toHit: 4,
      damage: [damage(6, 1, 8, 2, 'slashing')],
    },
    {
      slug: 'gladiator',
      actionId: 'spear',
      mode: 'melee-or-ranged',
      toHit: 7,
      damage: [damage(11, 2, 6, 4, 'piercing')],
    },
    {
      slug: 'sahuagin',
      actionId: 'spear',
      mode: 'melee-or-ranged',
      toHit: 3,
      damage: [damage(4, 1, 6, 1, 'piercing')],
    },
    {
      slug: 'salamander',
      actionId: 'spear',
      mode: 'melee-or-ranged',
      toHit: 7,
      damage: [
        damage(11, 2, 6, 4, 'piercing'),
        damage(3, 1, 6, 0, 'fire'),
      ],
    },
    {
      slug: 'werewolf-human',
      actionId: 'spear',
      mode: 'melee-or-ranged',
      toHit: 4,
      damage: [damage(5, 1, 6, 2, 'piercing')],
    },
    {
      slug: 'horned-devil',
      actionId: 'hurl-flame',
      mode: 'ranged',
      toHit: 7,
      damage: [damage(14, 4, 6, 0, 'fire')],
    },
    {
      slug: 'oni',
      actionId: 'glaive',
      mode: 'melee',
      toHit: 7,
      damage: [damage(15, 2, 10, 4, 'slashing')],
    },
  ])('makes $slug/$actionId a complete Headless weapon child', ({
    slug,
    actionId,
    mode,
    toHit,
    damage: expectedDamage,
  }) => {
    const child = action(slug, actionId)

    expect(child).toMatchObject({
      kind: 'weapon-attack',
      automation: 'headless',
      attack: {
        mode,
        toHit,
        damage: expectedDamage,
      },
    })
  })

  it.each([
    {
      slug: 'djinni',
      actionId: 'scimitar-thunder',
      damage: [
        damage(12, 2, 6, 5, 'slashing'),
        damage(3, 1, 6, 0, 'thunder'),
      ],
    },
    {
      slug: 'drider',
      actionId: 'longsword-two-handed',
      damage: [damage(8, 1, 10, 3, 'slashing')],
    },
    {
      slug: 'erinyes',
      actionId: 'longsword-two-handed',
      damage: [
        damage(9, 1, 10, 4, 'slashing'),
        damage(13, 3, 8, 0, 'poison'),
      ],
    },
    {
      slug: 'wight',
      actionId: 'longsword-two-handed',
      damage: [damage(7, 1, 10, 2, 'slashing')],
    },
    {
      slug: 'gladiator',
      actionId: 'spear-two-handed',
      damage: [damage(13, 2, 8, 4, 'piercing')],
    },
    {
      slug: 'sahuagin',
      actionId: 'spear-two-handed',
      damage: [damage(5, 1, 8, 1, 'piercing')],
    },
    {
      slug: 'salamander',
      actionId: 'spear-two-handed',
      damage: [
        damage(13, 2, 8, 4, 'piercing'),
        damage(3, 1, 6, 0, 'fire'),
      ],
    },
    {
      slug: 'werewolf-human',
      actionId: 'spear-two-handed',
      damage: [damage(6, 1, 8, 2, 'piercing')],
    },
    {
      slug: 'oni',
      actionId: 'glaive-small-or-medium',
      damage: [damage(9, 1, 10, 4, 'slashing')],
    },
  ])('exposes the legal fixed sibling $slug/$actionId', ({
    slug,
    actionId,
    damage: expectedDamage,
  }) => {
    const child = action(slug, actionId)

    expect(child).toMatchObject({
      kind: 'weapon-attack',
      automation: 'headless',
      attack: { damage: expectedDamage },
    })
  })

  it('retains explicit one-handed/ranged and two-handed spear damage', () => {
    for (const slug of ['gladiator', 'sahuagin', 'salamander', 'werewolf-human']) {
      const standard = action(slug, 'spear')
      const twoHanded = action(slug, 'spear-two-handed')

      expect(standard.attack).toMatchObject({
        mode: 'melee-or-ranged',
        reachFeet: 5,
        rangeFeet: { normal: 20, long: 60 },
        rangedDamage: standard.attack?.damage,
      })
      expect(twoHanded.attack).toMatchObject({
        mode: 'melee',
        reachFeet: 5,
      })
      expect(twoHanded.attack?.rangeFeet).toBeUndefined()
    }
  })

  it('unblocks every Multiattack that only depended on these fixed children', () => {
    const expected = [
      ['djinni', 'multiattack'],
      ['drider', 'multiattack-longsword'],
      ['drider', 'multiattack-bite-and-longsword'],
      ['erinyes', 'multiattack'],
      ['erinyes', 'multiattack-two-longswords-and-longbow'],
      ['erinyes', 'multiattack-longsword-and-two-longbows'],
      ['erinyes', 'multiattack-longbow'],
      ['gladiator', 'multiattack'],
      ['gladiator', 'multiattack-shield-bash-and-two-spears'],
      ['gladiator', 'multiattack-two-shield-bashes-and-spear'],
      ['gladiator', 'multiattack-spears-ranged'],
      ['horned-devil', 'multiattack-forks-and-hurl-flame'],
      ['horned-devil', 'multiattack-fork-and-two-hurl-flames'],
      ['horned-devil', 'multiattack-hurl-flames'],
      ['oni', 'multiattack-glaive'],
      ['sahuagin', 'multiattack-bite-and-spear'],
      ['werewolf-human', 'multiattack'],
      ['werewolf-human', 'multiattack-spears-ranged'],
      ['wight', 'multiattack-longsword'],
      ['wight', 'multiattack-life-drain-and-longsword'],
    ] as const
    const rows = auditDnd5eMonsterHeadlessCoverage().actions.rows

    for (const [slug, actionId] of expected) {
      const row = rows.find((candidate) =>
        candidate.slug === slug && candidate.actionId === actionId)
      expect(row, `${slug}/${actionId}`).toMatchObject({
        effectiveAutomation: 'headless',
        blockedChildIds: [],
      })
    }
  })

  it('models the Erinyes longbow poison save as persistent and removable', () => {
    const longbow = action('erinyes', 'longbow')
    const effect = longbow.attack?.onHitEffects?.[0]

    expect(effect).toEqual({
      id: 'longbow-poisoned',
      kind: 'saving-throw-condition',
      ability: 'con',
      dc: 14,
      conditionOnFailedSave: {
        condition: 'poisoned',
        durationRounds: 1_000_000,
        repeatSaveAtEndOfTargetTurn: false,
      },
    })

    const erinyes = createDnd5eCombatant({
      id: 'erinyes',
      name: 'Erinyes',
      controller: 'dm',
      initiative: 20,
      abilities: { str: 18, dex: 16, con: 18, int: 14, wis: 14, cha: 18 },
      proficiencyBonus: 4,
      armorClass: 18,
      currentHp: 153,
      maxHp: 153,
      temporaryHp: 0,
      speed: 30,
      position: { x: 0, y: 0 },
      concentrating: false,
      statBlockId: 'srd-5.1:erinyes',
    })
    const target = createDnd5eCombatant({
      id: 'target',
      name: 'Target',
      controller: 'player',
      initiative: 10,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      proficiencyBonus: 2,
      armorClass: 5,
      currentHp: 100,
      maxHp: 100,
      temporaryHp: 0,
      speed: 30,
      position: { x: 30, y: 0 },
      concentrating: false,
      savingThrowBonuses: { con: 0 },
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('erinyes-longbow-poison', [erinyes, target]),
      {
        type: 'monster-action',
        actorId: erinyes.id,
        actionId: longbow.id,
        rolls: [{
          targetId: target.id,
          d20: 10,
          damageRolls: [[1], [1, 1, 1]],
          onHitEffectRolls: [{
            effectId: 'longbow-poisoned',
            d20: 1,
          }],
        }],
      },
    )

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[target.id].conditions).toContain('poisoned')
    expect(result.state.combatants[target.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({
        standardCondition: 'poisoned',
        duration: {
          type: 'rounds',
          remainingRounds: 1_000_000,
          tickOn: 'target-turn-end',
        },
        repeatSave: undefined,
        source: expect.objectContaining({
          kind: 'monster',
          actorId: erinyes.id,
        }),
      }),
    )
  })

  it('gives each Manticore tail spike a 24-per-long-rest resource', () => {
    expect(action('manticore', 'tail-spike').usage).toEqual({
      kind: 'per-day',
      max: 24,
    })
    expect(action('manticore', 'multiattack-tail-spikes')).toMatchObject({
      automation: 'headless',
      sequence: ['tail-spike', 'tail-spike', 'tail-spike'],
    })
  })
})
