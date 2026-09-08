function signed(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}`
}

/** Builds the public attack arithmetic from every die that changed the total. */
export function dnd5eMonsterAttackRollExpression(input: {
  d20: number
  baseModifier: number
  total: number
  blessRoll?: number
  baneRoll?: number
  bardicInspirationRoll?: number
  cuttingWordsRoll?: number
}): string {
  return [
    String(input.d20),
    signed(input.baseModifier),
    input.blessRoll != null ? `+${input.blessRoll}` : '',
    input.baneRoll != null ? `-${input.baneRoll}` : '',
    input.bardicInspirationRoll != null ? `+${input.bardicInspirationRoll}` : '',
    input.cuttingWordsRoll != null ? `-${input.cuttingWordsRoll}` : '',
    `=${input.total}`,
  ].join('')
}
