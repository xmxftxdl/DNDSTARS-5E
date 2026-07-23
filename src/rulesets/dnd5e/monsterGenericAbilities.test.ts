import { describe, expect, it } from 'vitest'
import { getDnd5eSrdMonster } from './monsters'
import {
  dnd5eMonsterEffectiveWeaponAttack,
  dnd5eMonsterGenericAbilities,
  dnd5eMonsterHasGenericAbility,
  dnd5eMonsterRechargeActions,
  dnd5eMonsterRegenerationRule,
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
})
