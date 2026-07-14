import { describe, expect, it } from 'vitest'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'

describe('D&D 5e 2014 ruleset adapter', () => {
  it('uses standard ability modifiers and proficiency progression', () => {
    expect([1, 8, 10, 11, 20].map((score) => rules.abilityModifier(score))).toEqual([-5, -1, 0, 0, 5])
    expect([1, 5, 9, 13, 17, 20].map((level) => rules.proficiencyBonus(level))).toEqual([2, 3, 4, 5, 6, 6])
  })

  it('tracks action, bonus action, reaction, and movement independently', () => {
    const start = rules.createTurn(30)
    const moved = rules.spendTurnCost(start, { resource: 'movement', amount: 20 })
    const acted = rules.spendTurnCost(moved, { resource: 'action' })
    expect(acted).toEqual({
      actionAvailable: false,
      bonusActionAvailable: true,
      reactionAvailable: true,
      movementRemaining: 10,
    })
    expect(rules.validateTurnCost(acted, { resource: 'action' })).toEqual({ valid: false, reason: 'action-unavailable' })
    expect(rules.validateTurnCost(acted, { resource: 'movement', amount: 15 })).toEqual({ valid: false, reason: 'insufficient-movement' })
  })

  it('resolves advantage, disadvantage, automatic attack misses, and critical hits', () => {
    expect(rules.resolveD20({ rolls: [4, 17], mode: 'advantage', modifier: 3 }).total).toBe(20)
    expect(rules.resolveD20({ rolls: [4, 17], mode: 'disadvantage', modifier: 3 }).total).toBe(7)
    expect(rules.resolveAttack({ rolls: [1], modifier: 99, targetAc: 10 })).toMatchObject({ hit: false, critical: false })
    expect(rules.resolveAttack({ rolls: [20], modifier: -99, targetAc: 30 })).toMatchObject({ hit: true, critical: true })
  })

  it('doubles damage dice on a critical hit without doubling the modifier', () => {
    expect(rules.resolveDamage({ count: 1, sides: 8, bonus: 3, critical: true, rolls: [5, 7] })).toMatchObject({
      diceTotal: 12,
      bonus: 3,
      total: 15,
    })
  })

  it('applies resistance, vulnerability, and concentration DC', () => {
    expect(rules.adjustDamage(7, 'resistance')).toBe(3)
    expect(rules.adjustDamage(7, 'vulnerability')).toBe(14)
    expect(rules.concentrationCheckDc(21)).toBe(10)
    expect(rules.concentrationCheckDc(22)).toBe(11)
  })

  it('spends Hit Dice on a short rest and restores half the maximum on a 2014 long rest', () => {
    const creature = {
      currentHp: 5,
      maxHp: 20,
      temporaryHp: 4,
      constitutionModifier: 2,
      hitDice: [{ sides: 8, current: 2, max: 3 }],
    }
    const rested = rules.takeShortRest(creature, [{ sides: 8, rolls: [6, 1] }])
    expect(rested.currentHp).toBe(16)
    expect(rested.hitDice[0].current).toBe(0)
    expect(rules.takeLongRest(rested)).toMatchObject({ currentHp: 20, temporaryHp: 0, hitDice: [{ sides: 8, current: 1, max: 3 }] })
  })

  it('recovers half of total Hit Dice across multiclass pools', () => {
    const rested = rules.takeLongRest({
      currentHp: 1,
      maxHp: 20,
      constitutionModifier: 2,
      hitDice: [{ sides: 10, current: 0, max: 3 }, { sides: 8, current: 0, max: 3 }],
    })
    expect(rested.hitDice.reduce((total, pool) => total + pool.current, 0)).toBe(3)
  })

  it('tracks death save natural 1, natural 20, stability, and damage failures', () => {
    const initial = { successes: 0, failures: 0, stable: false, dead: false, currentHp: 0 }
    expect(rules.resolveDeathSave(initial, 1)).toMatchObject({ failures: 2, dead: false })
    expect(rules.resolveDeathSave(initial, 20)).toMatchObject({ currentHp: 1, successes: 0, failures: 0 })
    const stable = [10, 11, 12].reduce((state, roll) => rules.resolveDeathSave(state, roll), initial)
    expect(stable).toMatchObject({ successes: 3, stable: true, dead: false })
    expect(rules.applyDamageAtZeroHp(initial, true)).toMatchObject({ failures: 2 })
  })
})
