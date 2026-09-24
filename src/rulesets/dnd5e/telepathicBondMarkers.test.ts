import type { Character } from '../../types/character'
import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import { applyTelepathicBondCharacterMarkers, applyTelepathicBondMarkers, validateTelepathicBondTargets } from './telepathicBondMarkers'
import { dnd5eTokenStatusMarkersFromActiveEffects } from './tokenStatusMarkers'
const npc = (id: string, type: Token['type'] = 'npc'): Token => ({ id, label: id, type, x: 25, y: 25, size: 1, emoji: '', color: '' })
const map = (id: string, tokens: Token[]): BattleMap => ({ id, name: id, width: 100, height: 100, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens })
describe('optional cross-map Telepathic Bond markers', () => {
  it('accepts NPCs across maps and leaves an empty selection untouched', () => {
    const maps = [map('a', [npc('same')]), map('b', [{ ...npc('same', 'enemy'), dnd5eSide: 'player' }])]
    const targets = [{ mapId: 'a', tokenId: 'same' }, { mapId: 'b', tokenId: 'same' }]
    expect(validateTelepathicBondTargets(targets, maps)).toBe(true)
    const input = { maps, targets, sourceTokenId: 'caster', castId: 'cast', round: 1 }
    const result = applyTelepathicBondMarkers(input)
    for (const changed of result) expect(changed.tokens[0].dnd5eCombatState?.activeEffects).toEqual([
      expect.objectContaining({ label: '心灵联结', legacyCondition: 'telepathic-bond', duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' } }),
    ])
    const refreshed = applyTelepathicBondMarkers({ ...input, maps: result, castId: 'again' })
    for (const changed of result) {
      const effects = changed.tokens[0].dnd5eCombatState?.activeEffects ?? []
      expect(dnd5eTokenStatusMarkersFromActiveEffects(effects)).toEqual([
        expect.objectContaining({ statusId: 'telepathic-bond', activeEffectId: effects[0].id, sourceActorId: 'caster', mechanical: true }),
      ])
      expect(dnd5eTokenStatusMarkersFromActiveEffects(effects.map(effect => ({ ...effect, suspendedBy: ['antimagic'] })))).toEqual([])
    }
    expect(dnd5eTokenStatusMarkersFromActiveEffects([])).toEqual([])
    expect(refreshed[0].tokens[0].dnd5eCombatState?.activeEffects).toHaveLength(1)
    expect(applyTelepathicBondMarkers({ ...input, targets: [] })[0]).toBe(maps[0])
  })
  it('rejects stale, duplicate, excessive and non-creature targets', () => {
    const maps = [map('a', [npc('npc'), npc('pc', 'player'), npc('object', 'obstacle'),
      npc('enemy', 'enemy'), { ...npc('hostile-npc'), dnd5eSide: 'enemy' }])]
    expect(validateTelepathicBondTargets([], maps)).toBe(true)
    expect(validateTelepathicBondTargets([{ mapId: 'a', tokenId: 'pc' }], maps)).toBe(true)
    for (const tokenId of ['missing', 'object', 'enemy', 'hostile-npc']) {
      const targets = [{ mapId: 'a', tokenId }]
      expect(validateTelepathicBondTargets(targets, maps)).toBe(false)
      expect(applyTelepathicBondMarkers({ maps, targets, sourceTokenId: 'caster', castId: 'cast', round: 1 })[0].tokens)
        .toEqual(maps[0].tokens)
    }
    expect(validateTelepathicBondTargets(Array(9).fill({ mapId: 'a', tokenId: 'npc' }), maps)).toBe(false)
    expect(validateTelepathicBondTargets(Array(2).fill({ mapId: 'a', tokenId: 'npc' }), maps)).toBe(false)
  })
})

  it('applies allied player markers to their character sheets and preserves unrelated characters', () => {
    const pc = { ...npc('pc', 'player'), characterId: 'hero' }
    const maps = [map('a', [pc, npc('friend', 'npc')])]
    const targets = [{ mapId: 'a', tokenId: 'pc' }, { mapId: 'a', tokenId: 'friend' }]
    expect(validateTelepathicBondTargets(targets, maps)).toBe(true)
    const markedMaps = applyTelepathicBondMarkers({ maps, targets, sourceTokenId: 'caster', castId: 'cast', round: 1 })
    const characters = [{ id: 'hero' }, { id: 'other' }] as Character[]
    const result = applyTelepathicBondCharacterMarkers({ characters, maps: markedMaps, targets, sourceTokenId: 'caster' })
    expect(result[0].dnd5eCombatState?.activeEffects).toEqual([expect.objectContaining({ label: '心灵联结', id: 'telepathic-bond:cast:a:pc' })])
    expect(dnd5eTokenStatusMarkersFromActiveEffects(result[0].dnd5eCombatState?.activeEffects)).toEqual([
      expect.objectContaining({ statusId: 'telepathic-bond', activeEffectId: 'telepathic-bond:cast:a:pc' }),
    ])
    expect(result[1]).toBe(characters[1])
    expect(applyTelepathicBondCharacterMarkers({ characters: result, maps: markedMaps, targets, sourceTokenId: 'caster' })[0].dnd5eCombatState?.activeEffects).toHaveLength(1)
  })

