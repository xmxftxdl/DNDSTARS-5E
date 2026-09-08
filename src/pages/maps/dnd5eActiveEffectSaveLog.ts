import type { Dnd5eActiveEffectRepeatSave } from '../../rulesets/dnd5e/activeEffects'

type RepeatSaveProgress = Pick<Dnd5eActiveEffectRepeatSave,
  'successesRequired' | 'failuresRequired' | 'successes' | 'failures' | 'onFailureTransition'>

export function dnd5eActiveEffectSaveOutcomeText(input: {
  success: boolean
  repeatSave?: RepeatSaveProgress
}): string {
  const repeatSave = input.repeatSave
  if (!repeatSave) return input.success ? '成功，相关状态结束' : '失败，状态继续'

  if (input.success) {
    const required = repeatSave.successesRequired ?? 1
    const successes = Math.min(required, (repeatSave.successes ?? 0) + 1)
    return successes >= required
      ? '成功，相关状态结束'
      : `成功，累计 ${successes}/${required}；状态继续`
  }

  const required = repeatSave.failuresRequired
  if (required == null) return '失败，状态继续'
  const failures = Math.min(required, (repeatSave.failures ?? 0) + 1)
  if (
    failures >= required &&
    repeatSave.onFailureTransition?.outcome === 'retain-effect'
  ) return `失败，累计 ${failures}/${required}；效果固定，不再重复豁免`
  return `失败，累计 ${failures}/${required}；状态继续`
}
