import { describe, expect, it } from 'vitest'
import { DND5E_SRD_MONSTERS, getDnd5eSrdMonster } from './monsters'
import {
  dnd5eMonsterEffectiveWeaponAttack,
  dnd5eMonsterGenericAbilities,
  dnd5eMonsterHasGenericAbility,
  dnd5eMonsterHasMagicResistance,
  dnd5eLimitedMagicImmunityNegatesSpell,
  dnd5eMonsterLimitedMagicImmunityRule,
  dnd5eMonsterPackTacticsRule,
  dnd5eMonsterRechargeActions,
  dnd5eMonsterRegenerationRule,
  dnd5eMonsterWeaponAttacksAreMagical,
  dnd5eMonsterWeaponAttackAtDistance,
} from './monsterGenericAbilities'

describe('D&D 5e monster generic abilities', () => {
  it('recognizes reusable Headless abilities from SRD stat blocks', () => {
    const wolf = getDnd5eSrdMonster('srd-5.1:wolf')!
    expect(dnd5eMonsterHasGenericAbility(wolf, 'pack-tactics')).toBe(true)
    expect(dnd5eMonsterGenericAbilities(wolf)).toContainEqual({
      id: 'pack-tactics',
      name: '集群战术',
      automation: 'headless',
    })
    expect(dnd5eMonsterPackTacticsRule(wolf)).toEqual({
      kind: 'pack-tactics',
      allyDistanceFeet: 5,
      requiresAllyNotIncapacitated: true,
    })
  })

  it('migrates every SRD Pack Tactics trait to the structured Headless rule', () => {
    const traits = DND5E_SRD_MONSTERS.flatMap((monster) =>
      monster.traits.filter((trait) => /集群战术|pack tactics/i.test(trait.name)))
    expect(traits.length).toBeGreaterThanOrEqual(17)
    expect(traits.every((trait) =>
      trait.automation === 'headless' &&
      trait.rule?.kind === 'pack-tactics')).toBe(true)
  })

  it('migrates every canonical magical-weapon monster trait to one structured rule', () => {
    const slugs = [
      'androsphinx', 'balor', 'clay-golem', 'couatl', 'deva', 'erinyes',
      'flesh-golem', 'gynosphinx', 'iron-golem', 'marilith', 'oni', 'pit-fiend',
      'planetar', 'solar', 'stone-golem', 'unicorn',
    ]
    for (const slug of slugs) {
      const monster = getDnd5eSrdMonster(`srd-5.1:${slug}`)!
      expect(dnd5eMonsterWeaponAttacksAreMagical(monster), slug).toBe(true)
      expect(monster.traits).toContainEqual(expect.objectContaining({
        automation: 'headless',
        rule: {
          kind: 'magic-weapons',
          weaponAttacksMagical: true,
        },
      }))
    }
  })

  it('projects Limited Magic Immunity to saving-throw magic resistance', () => {
    const rakshasa = getDnd5eSrdMonster('srd-5.1:rakshasa')!
    expect(dnd5eMonsterLimitedMagicImmunityRule(rakshasa)).toEqual({
      kind: 'limited-magic-immunity',
      maximumSpellLevel: 6,
      advantageAboveMaximum: true,
      allowsWilling: true,
    })
    expect(dnd5eMonsterHasMagicResistance(rakshasa)).toBe(true)
    const rule = dnd5eMonsterLimitedMagicImmunityRule(rakshasa)
    expect(dnd5eLimitedMagicImmunityNegatesSpell({
      rule,
      spellLevel: 6,
      target: 'hostile',
      willing: false,
    })).toBe(true)
    expect(dnd5eLimitedMagicImmunityNegatesSpell({
      rule,
      spellLevel: 7,
      target: 'hostile',
      willing: false,
    })).toBe(false)
    expect(dnd5eLimitedMagicImmunityNegatesSpell({
      rule,
      spellLevel: 2,
      target: 'ally',
      willing: true,
    })).toBe(false)
    expect(dnd5eLimitedMagicImmunityNegatesSpell({
      rule,
      spellLevel: 2,
      target: 'hostile',
      willing: true,
    })).toBe(true)
  })

  it('exposes structured regeneration as a Headless lifecycle ability', () => {
    const monster = getDnd5eSrdMonster('srd-5.1:troll')!
    expect(dnd5eMonsterGenericAbilities(monster)).toContainEqual({
      id: 'regeneration',
      name: '再生',
      automation: 'headless',
    })
    expect(dnd5eMonsterRegenerationRule(monster)).toEqual({
      kind: 'regeneration', amount: 10, requiresPositiveHp: false,
      suppressedByDamageTypes: ['acid', 'fire'], diesAtZeroWhenSuppressed: true,
    })
  })

  it('loads recharge, spellcasting, legendary attack and swarm half-HP structures from the SRD catalog', () => {
    const dragon = getDnd5eSrdMonster('srd-5.1:adult-black-dragon')!
    expect(dnd5eMonsterRechargeActions(dragon)).toContainEqual(expect.objectContaining({
      id: 'acid-breath', usage: { kind: 'recharge', dieSides: 6, minimum: 5 },
    }))
    expect(dragon.legendaryActions).toContainEqual(expect.objectContaining({
      id: 'tail-attack', referencedActionId: 'tail', legendaryCost: 1, automation: 'headless',
    }))
    const mage = getDnd5eSrdMonster('srd-5.1:mage')!
    expect(mage.spellcasting).toMatchObject({
      ability: 'int', saveDc: 14, attackBonus: 6, slots: { 1: 4, 5: 1 }, automation: 'headless',
    })
    expect(mage.spellcasting?.spells).toContainEqual({ id: 'fireball', name: '火球术', level: 3 })

    const swarm = getDnd5eSrdMonster('srd-5.1:swarm-of-rats')!
    const bite = swarm.actions.find((action) => action.id === 'bites')?.attack
    expect(bite).toBeDefined()
    expect(dnd5eMonsterEffectiveWeaponAttack(bite!, 12, 24).damage).toEqual([
      { average: 3, count: 1, sides: 6, bonus: 0, type: 'piercing' },
    ])
  })

  it('normalizes the Bugbear javelin to its melee or ranged damage at the authoritative distance', () => {
    const javelin = getDnd5eSrdMonster('srd-5.1:bugbear')!
      .actions.find((action) => action.id === 'javelin')!.attack!
    expect(dnd5eMonsterWeaponAttackAtDistance(javelin, 5)).toMatchObject({
      mode: 'melee',
      damage: [{ average: 9, count: 2, sides: 6, bonus: 2 }],
    })
    expect(dnd5eMonsterWeaponAttackAtDistance(javelin, 30)).toMatchObject({
      mode: 'ranged',
      damage: [{ average: 5, count: 1, sides: 6, bonus: 2 }],
    })
  })

  it('honors a parent Multiattack mode restriction for hybrid child attacks', () => {
    const dagger = getDnd5eSrdMonster('srd-5.1:cult-fanatic')!
      .actions.find((action) => action.id === 'dagger')!.attack!
    expect(dnd5eMonsterWeaponAttackAtDistance(dagger, 30, 'melee')).toMatchObject({
      mode: 'melee',
      damage: [{ average: 4, count: 1, sides: 4, bonus: 2 }],
    })
    expect(dnd5eMonsterWeaponAttackAtDistance(dagger, 5, 'ranged')).toMatchObject({
      mode: 'ranged',
      damage: [{ average: 4, count: 1, sides: 4, bonus: 2 }],
    })
  })
})
