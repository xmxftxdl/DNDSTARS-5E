import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'

function character(): Character {
  return { id: 'char', name: 'Hero', player: 'P1', avatar: '', accent: '', race: '', charClass: '', level: 1, background: '', experience: 0, reputation: 0, abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 }, savingThrows: [], skills: [], maxHp: 20, currentHp: 20, tempHp: 0, hitDice: '1d10', ac: 16, speed: 30, initiativeBonus: 0, saveDC: 10, actionPoints: 8, currentAP: 8, passivePerception: 10, inspiration: 0, mana: 0, maxMana: 0, traits: [], combatSkills: [], conditions: [], notes: '', dmNotes: '', visibleToPlayers: true }
}

function token(patch: Partial<Token>): Token {
  return { id: 'token', label: 'Token', x: 0, y: 0, color: '', emoji: '', size: 1, type: 'enemy', hp: 10, maxHp: 10, ...patch }
}

describe('D&D 5e map bridge', () => {
  it('creates combatants keyed by token and applies authoritative HP/position only', () => {
    const hero = character()
    const heroToken = token({ id: 'hero-token', type: 'player', characterId: hero.id, label: hero.name, hp: 20, maxHp: 20 })
    const enemy = token({ id: 'enemy-token', label: 'Enemy', x: 30 })
    const map: BattleMap = { id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [heroToken, enemy] }
    const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'combat', map, characters: [hero], initiativeOrder: [{ tokenId: heroToken.id, label: hero.name, emoji: '', color: '', roll: 20 }, { tokenId: enemy.id, label: enemy.label, emoji: '', color: '', roll: 10 }] })
    const attack = resolveDnd5eHeadlessAction(snapshot.state, { type: 'attack', actorId: heroToken.id, targetId: enemy.id, attackModifier: 5, d20: 15, damage: { count: 1, sides: 8, bonus: 3, rolls: [5] } })
    expect(attack.ok).toBe(true)
    if (!attack.ok) return
    const plan = planDnd5eMapResultApplication({ state: attack.state, map, characters: [hero], characterIdByCombatantId: snapshot.characterIdByCombatantId })
    expect(plan.map.tokens.find((item) => item.id === enemy.id)?.hp).toBe(2)
    expect(plan.characters[0].currentAP).toBe(8)
    expect(plan.changedTokenIds).toEqual([enemy.id])
  })
})
