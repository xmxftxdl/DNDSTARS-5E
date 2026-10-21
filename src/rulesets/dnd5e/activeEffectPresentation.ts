import { dnd5eActiveEffectRemainingLabel, type Dnd5eActiveEffectDuration, type Dnd5eActiveEffectModifiers, type Dnd5eActiveEffectSource } from './activeEffects'

/** Generate display text from the saved effect, without depending on a spell name. */
export function dnd5eActiveEffectMechanicalDescription(effect: {
  modifiers?: Dnd5eActiveEffectModifiers
  duration?: Dnd5eActiveEffectDuration
  sourceAttitude?: 'friendly'
  source?: Pick<Dnd5eActiveEffectSource, 'actorName'>
}): string | undefined {
  const modifiers = effect.modifiers ?? {}
  const parts: string[] = []
  if (effect.sourceAttitude === 'friendly') parts.push(`效果生效期间，视${effect.source?.actorName || '此效果的来源生物'}为友好。`)
  const die = modifiers.optionalBonusDie
  if (die) {
    const kinds = die.appliesTo.map(kind => kind === 'saving-throw' ? '豁免' : '属性／技能检定').join('或')
    const lifetime = die.consumeOnUse ? '使用后移除此效果，跳过则保留至到期' : '使用后仍保留，持续期间每次对应检定均可选择使用'
    parts.push(`进行${kinds}时，可选择加掷 1d${die.sides}，加入本次总值。选择使用时才掷骰；${lifetime}。`)
  }
  if (modifiers.preventHealing) parts.push('无法恢复生命值；仍可获得临时生命值。')
  else if (modifiers.preventNonmagicalHealing) parts.push('无法通过非魔法治疗恢复生命值。')
  if (modifiers.speedPenaltyFeet) parts.push(`移动速度降低 ${modifiers.speedPenaltyFeet} 尺。`)
  if (modifiers.speedBonusFeet) parts.push(`移动速度增加 ${modifiers.speedBonusFeet} 尺。`)
  if (!parts.length) return undefined
  if (effect.duration) parts.push(`持续时间：${dnd5eActiveEffectRemainingLabel({duration:effect.duration})}。`)
  return parts.join(' ')
}
