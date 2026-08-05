import { describe, expect, it, vi } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import {
  expectedPersistentAreaTurnEndDamageAt,
  type MonsterPersistentAreaHazardServices,
} from './monsterPersistentAreaHazardScoring'

describe('monster persistent-area hazard scoring', () => {
  it('returns zero without persistent areas and avoids damage resolution', () => {
    const token = { id: 'monster' } as unknown as Token
    const map = { id: 'map', tokens: [token], dnd5ePluginAreas: [] } as unknown as BattleMap
    const services: MonsterPersistentAreaHazardServices = {
      monsterForToken: vi.fn(() => undefined),
      savingThrowModifier: vi.fn(() => 0),
      resolveDamage: vi.fn(() => 0),
      moralAlignment: vi.fn(() => undefined),
    }

    expect(expectedPersistentAreaTurnEndDamageAt({
      map,
      token,
      characters: [],
      position: { x: 0, y: 0 },
    }, services)).toBe(0)
    expect(services.resolveDamage).not.toHaveBeenCalled()
  })
})
