import { describe, expect, it, vi } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { Dnd5eMonsterStatBlock } from './monsters'
import {
  createMonsterHealingCandidates,
  type MonsterSupportCandidateServices,
} from './monsterSupportCandidateGenerators'

describe('monster support candidate generators', () => {
  it('does not invent healing candidates when the stat block declares no healing spell', () => {
    const enemy = { id: 'enemy', type: 'enemy', label: '怪物' } as unknown as Token
    const map = { id: 'map', tokens: [enemy] } as unknown as BattleMap
    const monster = { id: 'monster', actions: [], spellcasting: undefined } as unknown as Dnd5eMonsterStatBlock
    const services: MonsterSupportCandidateServices = {
      hitPoints: vi.fn(() => ({ current: 1, maximum: 1 })),
      armorClass: vi.fn(() => 10),
      distanceFeet: vi.fn(() => 0),
      activeEffects: vi.fn(() => []),
      monsterForToken: vi.fn(() => undefined),
    }

    expect(createMonsterHealingCandidates({
      map,
      enemy,
      monster,
      characters: [],
      canUseAction: true,
      canUseBonusAction: true,
    }, services)).toEqual([])
    expect(services.distanceFeet).not.toHaveBeenCalled()
  })
})
