import { describe, expect, it } from 'vitest'
import { createDnd5eMechanicalEffect } from '../rulesets/dnd5e/activeEffects'
import type { BattleMap } from '../store/maps'
import type { Character } from '../types/character'
import { dnd5eTelepathicBondNetworksForMap } from './dnd5eTelepathicBondCommunications'

function bondedCharacter(id: string, actorId: string): Character {
  return {
    id,
    name: id,
    avatar: '🧙',
    player: 'player',
    accent: 'violet',
    race: '人类',
    charClass: '法师',
    level: 20,
    background: '侍僧',
    dnd5eCombatState: {
      activeEffects: [createDnd5eMechanicalEffect({
        definitionId: 'activity:telepathic-bond',
        label: '心灵联结',
        targetId: id,
        source: { kind: 'spell', rulesId: 'telepathic-bond', actorId },
        legacyCondition: 'telepathic-bond',
        duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
      })],
    },
  } as Character
}

describe('telepathic bond communication networks', () => {
  it('groups linked characters on the same map without a distance check', () => {
    const map = {
      id: 'material', name: 'Material Plane', width: 10_000, height: 10_000,
      gridSize: 20, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: [
        { id: 'a-token', characterId: 'a', x: 0, y: 0 },
        { id: 'b-token', characterId: 'b', x: 9_000, y: 9_000 },
      ],
    } as BattleMap
    expect(dnd5eTelepathicBondNetworksForMap([
      bondedCharacter('a', 'caster'), bondedCharacter('b', 'caster'), bondedCharacter('off-plane', 'caster'),
    ], map)).toMatchObject([{
      key: 'caster:telepathic-bond',
      participants: [{ id: 'a' }, { id: 'b' }],
    }])
  })
})
