import type { Token } from '../store/maps'

/** D&D 5e 敌对阵营判断；反应是否可用由 Headless 回合经济验证。 */
export function areOpposedCombatTokens(a: Token, b: Token): boolean {
  return (a.type === 'player' && b.type === 'enemy') || (a.type === 'enemy' && b.type === 'player')
}
