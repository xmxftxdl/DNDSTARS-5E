import { describe, expect, it } from 'vitest'
import { createDnd5eMechanicalEffect, dnd5eActiveMinimumSkillCheckD20, dnd5eActiveHalfSpeedSkillCheckAdvantage, normalizeDnd5eActiveEffects } from './activeEffects'
import { normalizeDnd5eHalfSpeedSkillChecks, normalizeDnd5eMinimumSkillCheckD20 } from './contextualSkillChecks'
import { resolveDnd5eAbilityCheck } from './checks'
import type { Character } from '../../types/character'

const effect = createDnd5eMechanicalEffect({
  definitionId: 'synthetic:contextual-checks', label: 'Contextual checks', targetId: 'hero',
  source: { kind: 'feature', actorId: 'hero', rulesId: 'synthetic' },
  modifiers: {
    minimumSkillCheckD20: [{ ability: 'wis', skill: 'insight', purpose: 'detect-lies', minimum: 8 }],
    skillCheckAdvantagesWithinHalfSpeed: [{ ability: 'wis', skill: 'perception' }, { ability: 'int', skill: 'investigation' }],
  },
})

describe('purpose-scoped minimum d20 and current-turn movement checks', () => {
  it('only raises the stated skill, ability and Host-established purpose', () => {
    expect(dnd5eActiveMinimumSkillCheckD20([effect], { ability: 'wis', skill: 'insight', purpose: 'detect-lies' })).toBe(8)
    for (const context of [
      { ability: 'wis' as const, skill: 'insight' },
      { ability: 'wis' as const, skill: 'perception', purpose: 'detect-lies' as const },
      { ability: 'cha' as const, skill: 'insight', purpose: 'detect-lies' as const },
      { ability: 'wis' as const, purpose: 'detect-lies' as const },
    ]) expect(dnd5eActiveMinimumSkillCheckD20([effect], context)).toBe(1)
  })

  it('uses actual movement in the current turn and the current speed, with an inclusive half-speed boundary', () => {
    const context = { ability: 'wis' as const, skill: 'perception', currentSpeedFeet: 30 }
    expect(dnd5eActiveHalfSpeedSkillCheckAdvantage([effect], { ...context, movementThisTurnFeet: 15 })).toBe(true)
    expect(dnd5eActiveHalfSpeedSkillCheckAdvantage([effect], { ...context, movementThisTurnFeet: 16 })).toBe(false)
    // Reaction movement on another creature's turn uses exactly the same accounting.
    expect(dnd5eActiveHalfSpeedSkillCheckAdvantage([effect], { ...context, movementThisTurnFeet: 20 })).toBe(false)
    expect(dnd5eActiveHalfSpeedSkillCheckAdvantage([effect], { ...context, movementThisTurnFeet: 0 })).toBe(true)
    expect(dnd5eActiveHalfSpeedSkillCheckAdvantage([effect], { ...context, currentSpeedFeet: 20, movementThisTurnFeet: 15 })).toBe(false)
    expect(dnd5eActiveHalfSpeedSkillCheckAdvantage([effect], { ...context, currentSpeedFeet: 0, movementThisTurnFeet: 0 })).toBe(true)
    expect(dnd5eActiveHalfSpeedSkillCheckAdvantage([effect], context)).toBe(false)
    expect(dnd5eActiveHalfSpeedSkillCheckAdvantage([effect], { ...context, movementThisTurnFeet: -1 })).toBe(false)
    expect(dnd5eActiveHalfSpeedSkillCheckAdvantage([effect], { ...context, movementThisTurnFeet: NaN })).toBe(false)
    expect(dnd5eActiveHalfSpeedSkillCheckAdvantage([effect], { ...context, skill: 'insight', movementThisTurnFeet: 0 })).toBe(false)
  })

  it('preserves contextual modifiers through persistence and ignores suspended effects', () => {
    const restored = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([effect])))
    expect(restored[0]?.modifiers?.minimumSkillCheckD20).toEqual(effect.modifiers?.minimumSkillCheckD20)
    expect(restored[0]?.modifiers?.skillCheckAdvantagesWithinHalfSpeed).toEqual(effect.modifiers?.skillCheckAdvantagesWithinHalfSpeed)
    expect(dnd5eActiveMinimumSkillCheckD20([{ ...effect, suspendedBy: ['antimagic'] }], { ability: 'wis', skill: 'insight', purpose: 'detect-lies' })).toBe(1)
    expect(dnd5eActiveHalfSpeedSkillCheckAdvantage([{ ...effect, suspendedBy: ['antimagic'] }], { ability: 'int', skill: 'investigation', movementThisTurnFeet: 0, currentSpeedFeet: 30 })).toBe(false)
  })

  it('rejects invented purposes, malformed abilities and broad or empty rules', () => {
    expect(normalizeDnd5eMinimumSkillCheckD20([{ ability: 'wis', skill: 'insight', purpose: 'anything', minimum: 8 }])).toBeUndefined()
    expect(normalizeDnd5eMinimumSkillCheckD20([{ ability: 'wis', skill: 'insight', minimum: 8 }])).toBeUndefined()
    expect(normalizeDnd5eMinimumSkillCheckD20([{ ability: 'wis', skill: 'insight', purpose: 'detect-lies', minimum: 21 }])).toBeUndefined()
    expect(normalizeDnd5eHalfSpeedSkillChecks([{ ability: 'wis', skill: 'investigation' }])).toBeUndefined()
    expect(normalizeDnd5eHalfSpeedSkillChecks([])).toBeUndefined()
  })

  it('combines with Reliable Talent and preserves modifiers and disadvantage cancellation', () => {
    const character = { charClass: '游荡者', level: 11, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 },
      dnd5eCombatState: { activeEffects: [effect] } } as Character
    const scope = { skill: 'insight', purpose: 'detect-lies' as const }
    const lowLevel = resolveDnd5eAbilityCheck({ character: { ...character, level: 3 }, ability: 'wis', rolls: [2], context: scope, additionalModifier: 3 })
    expect(lowLevel.roll.d20).toBe(8)
    expect(lowLevel.roll.total).toBe(13)
    expect(resolveDnd5eAbilityCheck({ character, ability: 'wis', rolls: [2], context: scope, proficiencyRank: 1 })).toMatchObject({ roll: { d20: 10, total: 16 }, reliableTalentApplied: true })
    const context = { skill: 'perception', movementThisTurnFeet: 15, currentSpeedFeet: 30 }
    expect(resolveDnd5eAbilityCheck({ character, ability: 'wis', rolls: [2, 18], context }).roll.d20).toBe(18)
    expect(resolveDnd5eAbilityCheck({ character: { ...character, exhaustionLevel: 1 }, ability: 'wis', rolls: [7], context }).roll.d20).toBe(7)
  })
})

