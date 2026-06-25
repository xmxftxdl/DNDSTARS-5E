import type { BattleMap, Token } from '../store/maps'
import type { Character } from '../types/character'
import { isTokenAlive } from './combatTokens'
import { cellDistance, pixelToCell } from './gridCombat'

export interface OpportunityEnemyApState {
  current: number
  max?: number
}

export interface OpportunityAttackersRequest {
  map: BattleMap
  characters: Character[]
  movingToken: Token
  to: { x: number; y: number }
  disengagedCharacterIds?: ReadonlySet<string>
  enemyApByToken?: Record<string, OpportunityEnemyApState>
}

export function areOpposedCombatTokens(a: Token, b: Token): boolean {
  return (a.type === 'player' && b.type === 'enemy') || (a.type === 'enemy' && b.type === 'player')
}

export function findOpportunityAttackersForMove(request: OpportunityAttackersRequest): Token[] {
  const movingCharacterId = request.movingToken.characterId
  if (movingCharacterId && request.disengagedCharacterIds?.has(movingCharacterId)) return []

  const fromCell = pixelToCell(request.movingToken.x, request.movingToken.y, request.map)
  const toCell = pixelToCell(request.to.x, request.to.y, request.map)

  return request.map.tokens.filter((token) => {
    if (token.id === request.movingToken.id || !areOpposedCombatTokens(token, request.movingToken)) return false
    if (!isTokenAlive(token, request.characters)) return false

    if (token.characterId) {
      const attacker = request.characters.find((character) => character.id === token.characterId)
      if (!attacker || attacker.currentAP < 1 || attacker.currentHp <= 0) return false
    } else if (token.type === 'enemy') {
      const ap = request.enemyApByToken?.[token.id] ?? { current: 2 }
      if (ap.current < 1) return false
    } else {
      return false
    }

    const attackerCell = pixelToCell(token.x, token.y, request.map)
    return cellDistance(attackerCell, fromCell) <= 1 && cellDistance(attackerCell, toCell) > 1
  })
}
