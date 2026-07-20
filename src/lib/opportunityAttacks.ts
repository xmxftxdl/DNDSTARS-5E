import type { Token } from '../store/maps'

export function dnd5eCombatTokenSide(token: Token): 'player' | 'enemy' | undefined {
  if (token.dnd5eSummon) return token.dnd5eSummon.side
  if (token.type === 'player' || token.type === 'enemy') return token.type
  return undefined
}

/** D&D 5e 敌对阵营判断；反应是否可用由 Headless 回合经济验证。 */
export function areOpposedCombatTokens(a: Token, b: Token): boolean {
  const left = dnd5eCombatTokenSide(a)
  const right = dnd5eCombatTokenSide(b)
  return !!left && !!right && left !== right
}
