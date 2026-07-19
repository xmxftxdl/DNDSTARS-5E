import { describe, expect, it } from 'vitest'
import { resolveEnemyAttackTokens } from './combatTokens'
import type { Token } from '../store/maps'

function token(patch: Partial<Token> & Pick<Token, 'id'>): Token {
  return {
    label: patch.id,
    x: 0,
    y: 0,
    color: '#fff',
    emoji: '',
    size: 1,
    type: 'enemy',
    ...patch,
  } as Token
}

describe('resolveEnemyAttackTokens', () => {
  const result = { attackerTokenId: 'goblin', targetTokenId: 'hero' }

  it('resolves values from the supplied token snapshot', () => {
    const stale = [token({ id: 'goblin' }), token({ id: 'hero', type: 'player', maxHp: 30, hp: 30 })]
    const live = [token({ id: 'goblin' }), token({ id: 'hero', type: 'player', maxHp: 30, hp: 5 })]

    expect(resolveEnemyAttackTokens(stale, result).targetToken?.hp).toBe(30)
    expect(resolveEnemyAttackTokens(live, result).targetToken?.hp).toBe(5)
  })

  it('returns undefined for ids absent from the supplied map', () => {
    const { actorToken, targetToken } = resolveEnemyAttackTokens([], result)
    expect(actorToken).toBeUndefined()
    expect(targetToken).toBeUndefined()
  })
})
