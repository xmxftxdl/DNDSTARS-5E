import { describe, expect, it } from 'vitest'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  createMapViewportCharacterSelector,
  mapViewportRelevantCharacterIds,
} from './mapViewportCharacters'

function character(id: string, patch: Partial<Character> = {}): Character {
  return {
    id,
    name: id,
    player: 'player',
    avatar: 'hero',
    accent: 'blue',
    race: 'human',
    charClass: 'wizard',
    level: 1,
    background: '',
    experience: 0,
    reputation: 0,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: [],
    skills: [],
    maxHp: 10,
    currentHp: 10,
    tempHp: 0,
    hitDice: '1d6',
    ac: 10,
    initiativeBonus: 0,
    speed: 30,
    passivePerception: 10,
    inspiration: 0,
    saveDC: 12,
    conditions: [],
    equipment: {},
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    ...patch,
  }
}

function token(id: string, characterId?: string): Token {
  return {
    id,
    characterId,
    type: 'player',
    label: id,
    emoji: 'hero',
    color: '#fff',
    x: 50,
    y: 50,
    size: 1,
  }
}

describe('map viewport character projection', () => {
  it('keeps the exact result identity for off-map and unrelated-field updates', () => {
    const tokens = [token('hero-token', 'hero')]
    const select = createMapViewportCharacterSelector(tokens)
    const hero = character('hero')
    const offMap = character('off-map')
    const first = select({ characters: [hero, offMap] })

    const afterOffMapUpdate = select({
      characters: [hero, { ...offMap, currentHp: 1 }],
    })
    expect(afterOffMapUpdate).toBe(first)

    const afterInventoryUpdate = select({
      characters: [{ ...hero, equipment: { armor: undefined } }, offMap],
    })
    expect(afterInventoryUpdate).toBe(first)
  })

  it('changes the projection for viewport-visible hp and status updates', () => {
    const select = createMapViewportCharacterSelector([token('hero-token', 'hero')])
    const hero = character('hero')
    const first = select({ characters: [hero] })
    const hpUpdate = select({ characters: [{ ...hero, currentHp: 4 }] })
    expect(hpUpdate).not.toBe(first)
    expect(hpUpdate[0]?.currentHp).toBe(4)

    const effectUpdate = select({
      characters: [{
        ...hero,
        dnd5eCombatState: {
          activeEffects: [{
            schemaVersion: 1 as const,
            id: 'effect-1',
            definitionId: 'srd-5.1:spell:guidance',
            label: 'Guidance',
            kind: 'buff',
            source: { kind: 'spell', actorId: 'hero', rulesId: 'guidance' },
            duration: { type: 'permanent' },
            appliedAt: 1,
            stackingKey: 'guidance',
            stackingPolicy: 'replace',
          }],
        },
      }],
    })
    expect(effectUpdate).not.toBe(hpUpdate)
  })

  it('includes an off-map source character needed to color a visible status', () => {
    const tokens = [{
      ...token('target-token', 'target'),
      dnd5eCombatState: {
        activeEffects: [{
          schemaVersion: 1 as const,
          id: 'effect-1',
          definitionId: 'srd-5.1:spell:guidance',
          label: 'Guidance',
          kind: 'buff' as const,
          source: { kind: 'spell' as const, actorId: 'caster', rulesId: 'guidance' },
          duration: { type: 'permanent' as const },
          appliedAt: 1,
          stackingKey: 'guidance',
          stackingPolicy: 'replace' as const,
        }],
      },
    }]
    expect(mapViewportRelevantCharacterIds(
      [character('target'), character('caster'), character('irrelevant')],
      tokens,
    )).toEqual(['target', 'caster'])
  })
})
