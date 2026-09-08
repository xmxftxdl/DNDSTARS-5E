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

export function shouldHideCombatRollForExplicitRoller(input: {
  hideCurrentMonsterRoll: boolean
  /** Global DM policy. Unlike hideCurrentMonsterRoll this is not tied to the initiative cursor. */
  hideMonsterRolls?: boolean
  explicitRollerSide?: 'player' | 'enemy'
}): boolean {
  // Saving throws and reactions frequently occur during another creature's
  // turn. An explicitly identified player roller must never inherit the
  // current monster's hidden-roll policy. Conversely, a monster saving throw
  // made during a player's spell still follows the DM's global secret-roll
  // setting rather than the current (player) initiative owner.
  if (input.explicitRollerSide === 'player') return false
  if (input.explicitRollerSide === 'enemy') {
    return input.hideMonsterRolls ?? input.hideCurrentMonsterRoll
  }
  return input.hideCurrentMonsterRoll
}

/**
 * Saving throws and ability checks name their roller in the presentation
 * target field. Attack rolls instead name the defender, so they must retain
 * an explicitly supplied attacker and may never infer ownership from the
 * presentation target.
 */
export function resolveCombatD20RollerSide(input: {
  rollKind?: 'attack' | 'ability-check' | 'saving-throw'
  explicitRollerSide?: 'player' | 'enemy'
  namedTargetSide?: 'player' | 'enemy'
}): 'player' | 'enemy' | undefined {
  if (input.explicitRollerSide) return input.explicitRollerSide
  return input.rollKind === 'saving-throw' || input.rollKind === 'ability-check'
    ? input.namedTargetSide
    : undefined
}

export function shouldRedactSecretMonsterSavingThrow(input: {
  hideMonsterRolls: boolean
  events: readonly { type: string; targetId?: string }[]
  enemyTokenIds: ReadonlySet<string>
}): boolean {
  return input.hideMonsterRolls && input.events.some((event) =>
    event.type === 'saving-throw-resolved' &&
    typeof event.targetId === 'string' &&
    input.enemyTokenIds.has(event.targetId))
}

export function redactSecretMonsterCombatLog(text: string): string {
  const normalized = text.replace(/\s+/g, ' ')
  const outcomes: string[] = []
  const saveSucceeded = /豁免[^。；]*成功|成功[^。；]*豁免/.test(normalized)
  const saveFailed = /豁免[^。；]*(失败|未通过)|(?:失败|未通过)[^。；]*豁免/.test(normalized)
  if (saveSucceeded) outcomes.push('豁免成功')
  else if (saveFailed) outcomes.push('豁免失败')

  const textWithoutMisses = normalized
    .replace(/未命中|没有命中/g, '')
    .replace(/命中(?:检定|加值|投掷)/g, '')
  const hasHit = /命中/.test(textWithoutMisses)
  const hasMiss = /未命中|没有命中|攻击落空/.test(normalized)
  if (hasHit && hasMiss) outcomes.push('攻击已结算（包含命中与未命中）')
  else if (hasHit) outcomes.push('攻击命中')
  else if (hasMiss) outcomes.push('攻击未命中')

  const aggregateDamage = normalized.match(/共造成\s*(\d+)\s*点(?:[^。；]*?)伤害/u)
  const explicitFinalDamage = normalized.match(/最终(?:造成\s*)?(\d+)\s*点(?:[^。；]*?)伤害/u) ??
    normalized.match(/最终伤害(?:为)?\s*(\d+)(?:\s*点)?/u)
  const individualDamage = [...normalized.matchAll(/造成\s*(\d+)\s*点(?:[^。；]*?)伤害/gu)]
  const finalDamage = aggregateDamage?.[1] ?? explicitFinalDamage?.[1] ?? individualDamage.at(-1)?.[1]
  if (finalDamage != null) outcomes.push(`最终造成 ${Number(finalDamage)} 点伤害`)

  if (/充能[^。；]*(完成|成功)|恢复[^。；]*充能/.test(normalized)) outcomes.push('充能成功')
  else if (/未充能|充能[^。；]*(失败|不可用)/.test(normalized)) outcomes.push('充能失败')

  if (outcomes.length === 0) {
    outcomes.push(/失败|未通过|拒绝|取消/.test(normalized) ? '失败' : '结算完成')
  }
  return `怪物暗骰：${[...new Set(outcomes)].join('；')}。`
}
