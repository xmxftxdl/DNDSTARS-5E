import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../store/maps'
import type { Character } from '../types/character'
import {
  BULLET_CELL_COUNT,
  BULLET_GRID_SIZE,
  BULLET_TYPE_COUNT,
  createSeededBulletRandom,
  planSwapCascade,
} from './bulletMatch'
import { resolveHeadlessDmAction, type HeadlessDmCombatState } from './headlessDmCombatEngine'

function puzzle() {
  const grid = Array.from({ length: BULLET_CELL_COUNT }, (_, index) => {
    const row = Math.floor(index / BULLET_GRID_SIZE)
    const col = index % BULLET_GRID_SIZE
    return (row * 3 + col * 2) % BULLET_TYPE_COUNT
  })
  grid[0] = 1
  grid[1] = 0
  grid[2] = 1
  grid[BULLET_GRID_SIZE + 1] = 1
  return { grid, ready: Array(BULLET_TYPE_COUNT).fill(0) }
}

function combatState(): HeadlessDmCombatState {
  const playerToken: Token = {
    id: 'gunner-token',
    label: 'Gunner',
    x: 75,
    y: 75,
    color: '#34d399',
    emoji: '',
    type: 'player',
    size: 1,
    characterId: 'gunner',
  }
  const enemyToken: Token = {
    id: 'enemy-token',
    label: 'Enemy',
    x: 175,
    y: 75,
    color: '#f87171',
    emoji: '',
    type: 'enemy',
    size: 1,
    poolId: 'goblin',
    hp: 12,
    maxHp: 12,
  }
  const map: BattleMap = {
    id: 'map-1',
    name: 'Bullet authority',
    width: 500,
    height: 500,
    gridSize: 50,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    tokens: [playerToken, enemyToken],
  }
  const character = {
    id: 'gunner',
    name: 'Gunner',
    charClass: '重炮手',
    currentHp: 20,
    maxHp: 20,
    currentAP: 2,
    actionPoints: 2,
    bulletPuzzle: puzzle(),
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: [],
    skills: [],
    traits: [],
    combatSkills: [],
    conditions: [],
  } as unknown as Character
  return {
    map,
    characters: [character],
    active: true,
    round: 1,
    initiativeIndex: 0,
    initiativeOrder: [{ tokenId: playerToken.id, label: playerToken.label, emoji: '', color: playerToken.color, roll: 20 }],
    enemyApByToken: { [enemyToken.id]: { current: 2, max: 2 } },
    disengagedCharacterIds: [],
  }
}

describe('bullet match DM authority', () => {
  it('replays the same cascade from the same seed', () => {
    const first = planSwapCascade(puzzle(), 1, BULLET_GRID_SIZE + 1, createSeededBulletRandom(42))
    const second = planSwapCascade(puzzle(), 1, BULLET_GRID_SIZE + 1, createSeededBulletRandom(42))
    expect(first).not.toBeNull()
    expect(second).toEqual(first)
  })

  it('validates the swap and spends AP exactly once', () => {
    const result = resolveHeadlessDmAction(combatState(), {
      type: 'bullet-match-swap',
      actorTokenId: 'gunner-token',
      characterId: 'gunner',
      from: 1,
      to: BULLET_GRID_SIZE + 1,
      seed: 42,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const gunner = result.state.characters.find((character) => character.id === 'gunner')
    expect(gunner?.currentAP).toBe(1)
    expect(gunner?.bulletPuzzle).not.toEqual(puzzle())
    expect(result.events.filter((event) => event.type === 'ap-spent')).toHaveLength(1)
  })
})
