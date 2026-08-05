import { describe, expect, it, vi } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { Dnd5eMonsterStatBlock } from './monsters'
import {
  createMonsterStructuredSpecialActionCandidates,
  type MonsterStructuredSpecialCandidateServices,
} from './monsterStructuredSpecialCandidates'

describe('monster structured special candidates', () => {
  it('does not inspect geometry when the monster action is already spent', () => {
    const enemy = { id: 'enemy', type: 'enemy', label: '怪物' } as unknown as Token
    const target = { id: 'target', type: 'player', label: '目标' } as unknown as Token
    const map = { id: 'map', tokens: [enemy, target] } as unknown as BattleMap
    const monster = { id: 'monster', actions: [] } as unknown as Dnd5eMonsterStatBlock
    const services: MonsterStructuredSpecialCandidateServices = {
      hitPoints: vi.fn(() => ({ current: 1, maximum: 1 })),
      armorClass: vi.fn(() => 10),
      distanceFeet: vi.fn(() => 0),
      preferredDistanceFeet: vi.fn(() => 5),
      conditions: vi.fn(() => []),
      tacticalDistanceImprovement: vi.fn(() => 0),
      coverBonus: vi.fn(() => 0),
    }

    expect(createMonsterStructuredSpecialActionCandidates({
      map,
      enemy,
      monster,
      target,
      characters: [],
      canUseAction: false,
      role: 'melee',
      behaviorStyle: 'balanced',
      services,
    })).toEqual([])
    expect(services.hitPoints).not.toHaveBeenCalled()
  })
})
