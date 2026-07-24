import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { resolveDnd5eMonsterDodge } from './monsterBasicAction'

function character(): Character {
  return {
    id: 'hero', name: '英雄', player: 'P1', avatar: '', accent: '', race: '', charClass: '',
    level: 1, background: '', experience: 0, reputation: 0,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: [], skills: [], maxHp: 20, currentHp: 20, tempHp: 0, hitDice: '1d8',
    ac: 14, speed: 30, initiativeBonus: 0, saveDC: 10, passivePerception: 10,
    inspiration: 0, conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
  }
}

function token(patch: Partial<Token>): Token {
  return {
    id: 'token', label: 'Token', x: 5, y: 5, color: '', emoji: '', size: 1,
    type: 'enemy', hp: 10, maxHp: 10, ...patch,
  }
}

describe('monster basic Headless actions', () => {
  it('settles Dodge through the authoritative combat snapshot', () => {
    const goblin = token({ id: 'goblin', label: '哥布林', poolId: 'srd-5.1:goblin', hp: 7, maxHp: 7 })
    const hero = character()
    const heroToken = token({ id: 'hero-token', type: 'player', characterId: hero.id, x: 45 })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 100, height: 50, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [goblin, heroToken],
    }
    const resolved = resolveDnd5eMonsterDodge({
      combatId: 'combat',
      round: 1,
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: goblin.id, label: goblin.label, emoji: '', color: '', roll: 20 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: goblin.id,
      turnEconomy: createDnd5eTurnEconomyCounts('1:goblin', 30),
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.result).toMatchObject({ ok: true })
    if (!resolved.result.ok) return
    expect(resolved.result.state.combatants[goblin.id]).toMatchObject({
      dodging: true,
      turn: { actionAvailable: false },
    })
    expect(resolved.application?.changedTokenIds).toContain(goblin.id)
  })
})
