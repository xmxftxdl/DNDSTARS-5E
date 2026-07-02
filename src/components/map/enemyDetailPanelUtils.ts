import type { Token } from '../../store/maps'

export function canShowEnemyDetail(token: Token): boolean {
  return token.type === 'enemy'
}
