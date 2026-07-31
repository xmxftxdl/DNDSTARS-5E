import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { planMapsManualSettlement } from './manualSettlementTransaction'

const character = {
  id: 'hero',
  name: '冒险者',
  currentHp: 8,
  maxHp: 12,
  tempHp: 3,
} as Character

const playerToken = {
  id: 'hero-token',
  label: '冒险者',
  type: 'player',
  characterId: 'hero',
  x: 0,
  y: 0,
  size: 1,
  color: '#fff',
  emoji: '🧙',
} as Token

const monsterToken = {
  ...playerToken,
  id: 'goblin',
  label: '地精',
  type: 'enemy',
  characterId: undefined,
  hp: 7,
  maxHp: 7,
} as Token

const map = {
  id: 'map-1',
  tokens: [playerToken, monsterToken],
} as BattleMap

describe('planMapsManualSettlement', () => {
  it('absorbs damage with temporary hit points and emits one room HP command', () => {
    const plan = planMapsManualSettlement({
      map,
      characters: [character],
      targetId: playerToken.id,
      operation: 'damage',
      amount: 5,
    })
    expect(plan?.hitPoints).toMatchObject({
      characterId: 'hero',
      tokenId: 'hero-token',
      currentHp: 6,
      temporaryHp: 0,
    })
    expect(plan?.log.kind).toBe('damage')
  })

  it('supports token-only monster healing', () => {
    const plan = planMapsManualSettlement({
      map,
      characters: [],
      targetId: monsterToken.id,
      operation: 'healing',
      amount: 2,
    })
    expect(plan?.hitPoints).toMatchObject({
      tokenId: 'goblin',
      currentHp: 7,
      maxHp: 7,
    })
  })

  it('rejects temporary hit points for a token without a character projection', () => {
    expect(planMapsManualSettlement({
      map,
      characters: [],
      targetId: monsterToken.id,
      operation: 'temporary-hit-points',
      amount: 4,
    })).toBeNull()
  })
})
