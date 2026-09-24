import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import { createDnd5eMechanicalEffect } from '../../rulesets/dnd5e/activeEffects'
import { telekinesisControlledTarget } from './telekinesisControlledTarget'

const controlled = (id: string, caster: string, suspended = false): Token => ({
  id, type: 'enemy', x: 100, y: 100, size: 1, label: '牛头人', color: '', emoji: '',
  dnd5eCombatState: { activeEffects: [createDnd5eMechanicalEffect({
    definitionId: 'telekinesis-restrained', label: '心灵遥控·束缚', targetId: id,
    source: { kind: 'spell', actorId: caster, rulesId: 'spell:telekinesis' },
    tags: ['telekinesis-controlled'], suspendedBy: suspended ? ['antimagic'] : undefined,
  })] },
})
const map = (tokens: Token[]): BattleMap => ({ id: 'map', name: 'map', width: 500, height: 500,
  gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens })

describe('current Telekinesis target', () => {
  it('automatically reuses this caster’s controlled monster rather than another caster’s target', () => {
    const battleMap = map([controlled('other', 'other-caster'), controlled('minotaur', 'wizard')])
    expect(telekinesisControlledTarget(battleMap, [], 'wizard')?.id).toBe('minotaur')
  })
  it('does not reuse removed or suspended control', () => {
    expect(telekinesisControlledTarget(map([]), [], 'wizard')).toBeUndefined()
    expect(telekinesisControlledTarget(map([controlled('minotaur', 'wizard', true)]), [], 'wizard')).toBeUndefined()
  })
})
