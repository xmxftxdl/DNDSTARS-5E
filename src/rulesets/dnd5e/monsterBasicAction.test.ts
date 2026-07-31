import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { createDnd5eConditionEffect } from './activeEffects'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import {
  prepareDnd5eMonsterEscapeActiveEffect,
  prepareDnd5eMonsterEscapeGrapple,
  resolveDnd5eMonsterDodge,
  resolveDnd5eMonsterEscapeActiveEffect,
  resolveDnd5eMonsterReleaseGrapple,
  resolvePreparedDnd5eMonsterEscapeGrapple,
  resolvePreparedDnd5eMonsterEscapeActiveEffect,
} from './monsterBasicAction'

function character(patch: Partial<Character> = {}): Character {
  return {
    id: 'hero', name: '英雄', player: 'P1', avatar: '', accent: '', race: '', charClass: '',
    level: 1, background: '', experience: 0, reputation: 0,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: [], skills: [], maxHp: 20, currentHp: 20, tempHp: 0, hitDice: '1d8',
    ac: 14, speed: 30, initiativeBonus: 0, saveDC: 10, passivePerception: 10,
    inspiration: 0, conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    ...patch,
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

  it('prepares the authoritative fixed-DC escape mode and consumes the action on failure', () => {
    const poisoned = createDnd5eConditionEffect({
      id: 'poisoned:goblin',
      condition: 'poisoned',
      targetId: 'goblin',
      source: { kind: 'system', rulesId: 'test-poison' },
    })
    const restraint = createDnd5eConditionEffect({
      id: 'web:restrained:goblin',
      condition: 'restrained',
      targetId: 'goblin',
      source: { kind: 'spell', actorId: 'hero-token', rulesId: 'web' },
      escapeCheck: { ability: 'str', dc: 13, economy: 'action' },
    })
    const goblin = token({
      id: 'goblin',
      label: '哥布林',
      poolId: 'srd-5.1:goblin',
      hp: 7,
      maxHp: 7,
      dnd5eCombatState: {
        schemaVersion: 2,
        activeEffects: [poisoned, restraint],
      },
    })
    const hero = character()
    const heroToken = token({ id: 'hero-token', type: 'player', characterId: hero.id, x: 45 })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 100, height: 50, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [goblin, heroToken],
    }
    const common = {
      combatId: 'combat',
      round: 1,
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: goblin.id, label: goblin.label, emoji: '', color: '', roll: 20 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: goblin.id,
      effectId: restraint.id,
      turnEconomy: createDnd5eTurnEconomyCounts('1:goblin', 30),
    }
    const prepared = prepareDnd5eMonsterEscapeActiveEffect(common)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      dc: 13,
      ability: 'str',
      rollMode: 'disadvantage',
    })

    const resolved = resolvePreparedDnd5eMonsterEscapeActiveEffect({
      prepared: prepared.prepared,
      d20: 20,
      d20Second: 2,
    })
    expect(resolved.result).toMatchObject({ ok: true })
    if (!resolved.result.ok) return
    expect(resolved.result.state.combatants[goblin.id].turn.actionAvailable).toBe(false)
    expect(resolved.result.state.combatants[goblin.id].classState.activeEffects)
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: restraint.id })]))
    expect(resolved.result.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'ability-check-resolved',
        actorId: goblin.id,
        dc: 13,
        mode: 'disadvantage',
        success: false,
      }),
    ]))
  })

  it('removes a fixed-DC active effect and maps the successful escape back to the token', () => {
    const restraint = createDnd5eConditionEffect({
      id: 'web:restrained:goblin',
      condition: 'restrained',
      targetId: 'goblin',
      source: { kind: 'spell', actorId: 'hero-token', rulesId: 'web' },
      escapeCheck: { ability: 'str', dc: 13, economy: 'action' },
    })
    const goblin = token({
      id: 'goblin',
      label: '哥布林',
      poolId: 'srd-5.1:goblin',
      hp: 7,
      maxHp: 7,
      dnd5eCombatState: { schemaVersion: 2, activeEffects: [restraint] },
    })
    const hero = character()
    const heroToken = token({ id: 'hero-token', type: 'player', characterId: hero.id, x: 45 })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 100, height: 50, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [goblin, heroToken],
    }
    const resolved = resolveDnd5eMonsterEscapeActiveEffect({
      combatId: 'combat',
      round: 1,
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: goblin.id, label: goblin.label, emoji: '', color: '', roll: 20 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: goblin.id,
      effectId: restraint.id,
      d20: 20,
      turnEconomy: createDnd5eTurnEconomyCounts('1:goblin', 30),
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.result).toMatchObject({ ok: true })
    if (!resolved.result.ok) return
    expect(resolved.result.state.combatants[goblin.id].classState.activeEffects ?? []).toEqual([])
    const mappedGoblin = resolved.application?.map.tokens.find((candidate) => candidate.id === goblin.id)
    expect(mappedGoblin?.dnd5eCombatState?.activeEffects ?? []).toEqual([])
    expect(resolved.application?.changedTokenIds).toContain(goblin.id)
  })

  it('resolves a basic grapple escape as an opposed check with both roll modes', () => {
    const grapple = createDnd5eConditionEffect({
      id: 'basic-action:grapple:hero-token:goblin',
      condition: 'grappled',
      targetId: 'goblin',
      source: { kind: 'feature', actorId: 'hero-token', rulesId: 'basic-action:grapple' },
      relation: {
        schemaVersion: 1,
        kind: 'grapple',
        sourceActorId: 'hero-token',
        sourceActionId: 'basic-action:grapple',
        slotGroup: 'free-hand',
        maxDistanceFeet: 5,
        movement: 'drag-target',
        endsOnSourceIncapacitated: true,
      },
    })
    const goblin = token({
      id: 'goblin',
      label: '哥布林',
      poolId: 'srd-5.1:goblin',
      hp: 7,
      maxHp: 7,
      dnd5eCombatState: { schemaVersion: 2, activeEffects: [grapple] },
    })
    const hero = character({
      abilities: { str: 18, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      skills: ['athletics'],
    })
    const heroToken = token({ id: 'hero-token', type: 'player', characterId: hero.id, x: 15 })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 100, height: 50, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [goblin, heroToken],
    }
    const prepared = prepareDnd5eMonsterEscapeGrapple({
      combatId: 'combat',
      round: 1,
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: goblin.id, label: goblin.label, emoji: '', color: '', roll: 20 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: goblin.id,
      grapplerId: heroToken.id,
      turnEconomy: createDnd5eTurnEconomyCounts('1:goblin', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      actorSkill: 'acrobatics',
      actorRollMode: 'normal',
      grapplerRollMode: 'normal',
    })
    const resolved = resolvePreparedDnd5eMonsterEscapeGrapple({
      prepared: prepared.prepared,
      actorD20: 20,
      grapplerD20: 1,
    })
    expect(resolved.result).toMatchObject({ ok: true })
    if (!resolved.result.ok) return
    expect(resolved.result.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'contest-resolved',
        contest: 'escape-grapple',
        actorSkill: 'acrobatics',
        success: true,
      }),
    ]))
    expect(resolved.result.state.combatants[goblin.id].classState.activeEffects ?? []).toEqual([])
    expect(resolved.application?.changedTokenIds).toContain(goblin.id)
  })

  it('lets an SRD monster release its own source-linked grapple through the map adapter', () => {
    const grapple = createDnd5eConditionEffect({
      id: 'relation:grapple:ankheg:bite:hero-token',
      condition: 'grappled',
      targetId: 'hero-token',
      source: {
        kind: 'monster',
        actorId: 'ankheg',
        rulesId: 'monster:srd-5.1:ankheg:bite:bite-grapple',
      },
      duration: { type: 'permanent' },
      escapeCheck: {
        ability: 'str',
        skill: 'athletics',
        alternativeAbility: 'dex',
        alternativeSkill: 'acrobatics',
        dc: 13,
        economy: 'action',
      },
      relation: {
        schemaVersion: 1,
        kind: 'grapple',
        sourceActorId: 'ankheg',
        sourceActionId: 'bite',
        slotGroup: 'bite',
        maxDistanceFeet: 5,
        movement: 'drag-target',
        endsOnSourceIncapacitated: true,
      },
      stackingKey: 'relation:grapple:ankheg:bite:hero-token',
    })
    const hero = character({
      dnd5eCombatState: { schemaVersion: 2, activeEffects: [grapple] },
    })
    const ankheg = token({
      id: 'ankheg',
      label: 'Ankheg',
      poolId: 'srd-5.1:ankheg',
      x: 5,
      y: 5,
      hp: 39,
      maxHp: 39,
    })
    const heroToken = token({
      id: 'hero-token',
      label: hero.name,
      type: 'player',
      characterId: hero.id,
      x: 15,
      y: 5,
      hp: hero.currentHp,
      maxHp: hero.maxHp,
    })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 100, height: 50, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [ankheg, heroToken],
    }
    const resolved = resolveDnd5eMonsterReleaseGrapple({
      combatId: 'combat',
      round: 1,
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 20 },
        { tokenId: ankheg.id, label: ankheg.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: ankheg.id,
      targetTokenId: heroToken.id,
      effectId: grapple.id,
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.result).toMatchObject({ ok: true })
    if (!resolved.result.ok) return
    expect(resolved.result.state.combatants[heroToken.id].conditions).not.toContain('grappled')
    expect(resolved.result.state.combatants[heroToken.id].classState.activeEffects ?? []).toEqual([])
    expect(resolved.application?.changedCharacterIds).toContain(hero.id)
  })
})
