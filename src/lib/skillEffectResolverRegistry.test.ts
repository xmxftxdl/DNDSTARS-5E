import { describe, expect, it } from 'vitest'
import { missingSkillActorCondition, registerSkillEffectResolver, resolveAoeSkillEffects, resolveSingleTargetSkillEffects } from './skillEffectResolverRegistry'

describe('skill effect resolver registry', () => {
  it('resolves AOE save and control rules without UI skill-name branches', () => {
    expect(resolveAoeSkillEffects('focusShot', 3)).toMatchObject({ saveMode: 'fail-half', stunOnFailedSave: false })
    expect(resolveAoeSkillEffects('focusShot', 4)).toMatchObject({ saveMode: 'fail-half', stunOnFailedSave: true })
    expect(resolveAoeSkillEffects('whirlwindKick', 1)).toMatchObject({ saveMode: 'half', knockbackOnFailedSave: true })
  })

  it('resolves rank-sensitive single-target effects', () => {
    expect(resolveSingleTargetSkillEffects('burstKick', 2).stunOnFailedEffectSave).toBeUndefined()
    expect(resolveSingleTargetSkillEffects('burstKick', 3)).toMatchObject({
      effectSaveAbility: 'con',
      stunOnFailedEffectSave: true,
    })
    expect(resolveSingleTargetSkillEffects('antiMagicArrow', 5)).toMatchObject({
      vulnerableOnHit: true,
      clearTargetStatusesOnHit: true,
      selfCooldownReductionPerClearedStatus: true,
    })
  })

  it('exposes actor-state requirements to both UI and headless validation', () => {
    expect(missingSkillActorCondition('riseKick', [])).toBe('倒地')
    expect(missingSkillActorCondition('riseKick', ['倒地'])).toBeUndefined()
  })

  it('accepts effects registered by a new class module', () => {
    const dispose = registerSkillEffectResolver({
      skillTreeId: 'test-frost',
      singleTarget: () => ({ effectSaveAbility: 'con', restrainedOnFailedEffectSave: true }),
    })
    try {
      expect(resolveSingleTargetSkillEffects('test-frost', 1)).toMatchObject({
        effectSaveAbility: 'con',
        restrainedOnFailedEffectSave: true,
      })
    } finally {
      dispose()
    }
  })
})
