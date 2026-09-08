import { describe, expect, it } from 'vitest'
import { dnd5eActiveEffectSaveOutcomeText } from './dnd5eActiveEffectSaveLog'

describe('dnd5e active-effect save log', () => {
  it('does not claim that a cumulative save ended the effect before its threshold', () => {
    expect(dnd5eActiveEffectSaveOutcomeText({
      success: true,
      repeatSave: { successesRequired: 3, successes: 0 },
    })).toBe('成功，累计 1/3；状态继续')
  })

  it('reports removal only when the cumulative success threshold is reached', () => {
    expect(dnd5eActiveEffectSaveOutcomeText({
      success: true,
      repeatSave: { successesRequired: 3, successes: 2 },
    })).toBe('成功，相关状态结束')
  })

  it('shows cumulative failures and the retain-effect threshold', () => {
    const repeatSave = {
      failuresRequired: 3,
      failures: 1,
      onFailureTransition: { outcome: 'retain-effect' as const },
    }
    expect(dnd5eActiveEffectSaveOutcomeText({ success: false, repeatSave }))
      .toBe('失败，累计 2/3；状态继续')
    expect(dnd5eActiveEffectSaveOutcomeText({
      success: false,
      repeatSave: { ...repeatSave, failures: 2 },
    })).toBe('失败，累计 3/3；效果固定，不再重复豁免')
  })

  it('preserves ordinary one-success save-ends wording', () => {
    expect(dnd5eActiveEffectSaveOutcomeText({
      success: true,
      repeatSave: { successesRequired: 1 },
    })).toBe('成功，相关状态结束')
  })
})
