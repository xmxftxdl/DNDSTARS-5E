import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { createDnd5eMechanicalEffect } from './activeEffects'
import {
  prepareDnd5eMonsterSpecialAction,
  resolvePreparedDnd5eMonsterSpecialAction,
} from './monsterSpecialAction'

function token(patch: Partial<Token>): Token {
  return {
    id: 'token', label: 'Token', x: 5, y: 5, color: '', emoji: '', size: 1,
    type: 'enemy', hp: 40, maxHp: 40, ...patch,
  }
}

function character(protectedFromFiends: boolean): Character {
  const activeEffects = protectedFromFiends
    ? [createDnd5eMechanicalEffect({
        definitionId: 'activity:protection-from-evil-and-good',
        label: 'Protection from Evil and Good',
        source: {
          kind: 'spell', actorId: 'hero-token',
          rulesId: 'protection-from-evil-and-good', magical: true,
        },
        targetId: 'hero-token',
        modifiers: {
          conditionImmunitiesBySourceCreatureType: [{
            conditions: ['charmed', 'frightened', 'possessed'],
            sourceCreatureTypes: [
              'aberration', 'celestial', 'elemental', 'fey', 'fiend', 'undead',
            ],
          }],
          savingThrowAdvantagesBySourceCreatureType: [{
            conditions: ['charmed', 'frightened', 'possessed'],
            sourceCreatureTypes: [
              'aberration', 'celestial', 'elemental', 'fey', 'fiend', 'undead',
            ],
          }],
        },
      })]
    : undefined
  return {
    id: 'hero-character', name: 'Hero', player: 'P1', avatar: '', accent: '',
    race: '', charClass: 'Fighter', level: 5, background: '', experience: 0,
    reputation: 0, rulesetId: 'dnd5e-2014-srd-5.1',
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
    savingThrows: ['str', 'con'], skills: [], maxHp: 40, currentHp: 40,
    tempHp: 0, hitDice: '5d10', ac: 14, speed: 30, initiativeBonus: 2,
    saveDC: 10, passivePerception: 10, inspiration: 0, conditions: [],
    notes: '', dmNotes: '', visibleToPlayers: true,
    dnd5eCombatState: activeEffects ? { activeEffects } : undefined,
  }
}

function scene(protectedFromFiends: boolean): {
  map: BattleMap
  characters: Character[]
  initiativeOrder: Array<{ tokenId: string; label: string; emoji: string; color: string; roll: number }>
  succubus: Token
  hero: Token
} {
  const succubus = token({
    id: 'succubus', label: 'Succubus', poolId: 'srd-5.1:succubus-incubus',
  })
  const hero = token({
    id: 'hero-token', label: 'Hero', type: 'player', characterId: 'hero-character',
    x: 15,
  })
  const map: BattleMap = {
    id: 'targeted-condition-map', name: 'Targeted condition',
    width: 200, height: 100, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0,
    showGrid: true, feetPerCell: 5, tokens: [succubus, hero],
  }
  return {
    map,
    characters: [character(protectedFromFiends)],
    // Keep the monster away from initiative index zero so this exercises the
    // authoritative turn cursor instead of succeeding by fixture coincidence.
    initiativeOrder: [hero, succubus].map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    })),
    succubus,
    hero,
  }
}

describe('Headless targeted monster condition actions', () => {
  it('prepares Succubus Charm with a concrete target and applies it after a failed save', () => {
    const testScene = scene(false)
    const prepared = prepareDnd5eMonsterSpecialAction({
      combatId: 'charm-control', map: testScene.map,
      characters: testScene.characters, initiativeOrder: testScene.initiativeOrder,
      actorTokenId: testScene.succubus.id, targetTokenId: testScene.hero.id,
      actionId: 'charm',
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eMonsterSpecialAction({
      prepared: prepared.prepared,
      savingThrow: { d20: 1 },
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0]?.conditions).toContain('charmed')
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: testScene.hero.id, success: false,
    }))
  })

  it('rolls Charm with advantage but blocks the condition after a failed save under Protection from Evil and Good', () => {
    const testScene = scene(true)
    const prepared = prepareDnd5eMonsterSpecialAction({
      combatId: 'charm-protected', map: testScene.map,
      characters: testScene.characters, initiativeOrder: testScene.initiativeOrder,
      actorTokenId: testScene.succubus.id, targetTokenId: testScene.hero.id,
      actionId: 'charm',
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eMonsterSpecialAction({
      prepared: prepared.prepared,
      savingThrow: { d20: 1, d20Second: 2 },
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0]?.conditions).not.toContain('charmed')
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: testScene.hero.id, d20: 2, success: false,
    }))
    expect(resolved.result.ok &&
      resolved.result.state.combatants[testScene.succubus.id]?.turn.actionAvailable,
    ).toBe(false)
  })
})
