export function shouldHideMonsterCombatRoll(input: {
  mode: 'dm' | 'player' | null
  combatActive: boolean
  combatRollsVisible: boolean
  currentTurnTokenType?: string
}): boolean {
  return input.mode === 'dm' &&
    input.combatActive &&
    !input.combatRollsVisible &&
    input.currentTurnTokenType === 'enemy'
}

export function redactSecretMonsterCombatLog(text: string): string {
  const normalized = text.replace(/\s+/g, ' ')
  if (/豁免[^。；]*成功|成功[^。；]*豁免/.test(normalized)) return '怪物暗骰：豁免成功。'
  if (/豁免[^。；]*(失败|未通过)|(?:失败|未通过)[^。；]*豁免/.test(normalized)) return '怪物暗骰：豁免失败。'
  if (/未命中|没有命中/.test(normalized)) return '怪物暗骰：攻击未命中。'
  if (/命中/.test(normalized)) return '怪物暗骰：攻击命中。'
  if (/充能[^。；]*(完成|成功)|恢复[^。；]*充能/.test(normalized)) return '怪物暗骰：充能成功。'
  if (/未充能|充能[^。；]*(失败|不可用)/.test(normalized)) return '怪物暗骰：充能失败。'
  if (/失败|未通过|拒绝|取消/.test(normalized)) return '怪物暗骰：失败。'
  return '怪物暗骰：成功。'
}
