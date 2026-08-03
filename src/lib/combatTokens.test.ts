import { describe, expect, it } from 'vitest'
import type { Token } from '../store/maps'
import type { Character } from '../types/character'
import { characterNeedsDeathSave, checkCombatOutcome, decideTurnAction, getTokenCombatSide, isTokenAlive } from './combatTokens'

function token(patch: Partial<Token>): Token {
  return {
    id: 'token',
    label: 'Token',
    x: 0,
    y: 0,
    color: '#fff',
    emoji: '',
    size: 1,
    type: 'player',
    ...patch,
  }
}

describe('combat token liveness', () => {
  it('does not treat a linked token as defeated while its character is still syncing', () => {
    const linkedPlayer = token({ id: 'player-token', type: 'player', characterId: 'missing-character' })
    const enemy = token({ id: 'enemy-token', type: 'enemy', hp: 12, maxHp: 12 })

    expect(isTokenAlive(linkedPlayer, [])).toBe(true)
    expect(checkCombatOutcome([linkedPlayer, enemy], [])).toEqual({ ended: false })
  })

  it('ends combat immediately when the only player character enters death saves', () => {
    const linkedPlayer = token({ id: 'player-token', type: 'player', characterId: 'hero' })
    const enemy = token({ id: 'enemy-token', type: 'enemy', hp: 12, maxHp: 12 })
    const hero = { id: 'hero', currentHp: 0, deathSaveFailures: 0, deathSaveStable: false } as Character

    expect(isTokenAlive(linkedPlayer, [hero])).toBe(false)
    expect(characterNeedsDeathSave(hero)).toBe(true)
    expect(decideTurnAction(linkedPlayer, [hero])).toBe('player')
    expect(checkCombatOutcome([linkedPlayer, enemy], [hero])).toMatchObject({
      ended: true,
      winner: 'enemy',
      reason: 'party-downed',
    })
  })

  it('waits until every participating player character is down', () => {
    const firstPlayer = token({ id: 'player-one', type: 'player', characterId: 'hero-one' })
    const secondPlayer = token({ id: 'player-two', type: 'player', characterId: 'hero-two' })
    const enemy = token({ id: 'enemy-token', type: 'enemy', hp: 12, maxHp: 12 })
    const firstHero = { id: 'hero-one', currentHp: 0, deathSaveFailures: 0, deathSaveStable: false } as Character
    const secondHero = { id: 'hero-two', currentHp: 8, deathSaveFailures: 0, deathSaveStable: false } as Character

    expect(checkCombatOutcome([firstPlayer, secondPlayer, enemy], [firstHero, secondHero]))
      .toEqual({ ended: false })
    expect(checkCombatOutcome(
      [firstPlayer, secondPlayer, enemy],
      [firstHero, { ...secondHero, currentHp: 0 }],
    )).toMatchObject({ ended: true, reason: 'party-downed' })
  })

  it('only counts player characters included in the current initiative', () => {
    const downPlayer = token({ id: 'down-player', type: 'player', characterId: 'down-hero' })
    const spectatorCharacter = token({ id: 'spectator', type: 'player', characterId: 'spectator-hero' })
    const enemy = token({ id: 'enemy-token', type: 'enemy', hp: 12, maxHp: 12 })
    const characters = [
      { id: 'down-hero', currentHp: 0, deathSaveFailures: 0, deathSaveStable: false },
      { id: 'spectator-hero', currentHp: 10, deathSaveFailures: 0, deathSaveStable: false },
    ] as Character[]

    expect(checkCombatOutcome(
      [downPlayer, spectatorCharacter, enemy],
      characters,
      { participantTokenIds: [downPlayer.id, enemy.id] },
    )).toMatchObject({ ended: true, reason: 'party-downed' })
  })

  it('counts a DM-controlled allied summon on the player side for combat outcome', () => {
    const summon = token({
      id: 'summon', type: 'enemy', hp: 11, maxHp: 11,
      dnd5eSummon: {
        schemaVersion: 1, pluginId: 'com.example', featureId: 'com.example:wolf',
        sourceCharacterId: 'hero', sourceTokenId: 'hero-token', createdRound: 1,
        expiresAfterRound: 10, side: 'player',
      },
    })
    const defeatedEnemy = token({ id: 'enemy', type: 'enemy', hp: 0, maxHp: 7 })
    expect(checkCombatOutcome([summon, defeatedEnemy], [])).toMatchObject({ ended: true, winner: 'ally' })
  })

  it('treats ordinary NPC tokens as allies instead of neutral by default', () => {
    const npc = token({ id: 'guide', type: 'npc', hp: 8, maxHp: 8 })
    const defeatedEnemy = token({ id: 'enemy', type: 'enemy', hp: 0, maxHp: 7 })
    expect(getTokenCombatSide(npc)).toBe('ally')
    expect(checkCombatOutcome([npc, defeatedEnemy], [])).toMatchObject({ ended: true, winner: 'ally' })
  })

  it('does not end combat while enemies are pending regeneration or undead fortitude', () => {
    const hero = token({ id: 'hero', type: 'player', characterId: 'hero', hp: 12, maxHp: 12 })
    const regenerating = token({
      id: 'troll',
      type: 'enemy',
      hp: 0,
      maxHp: 84,
      dnd5eCombatState: { monsterRegenerationPendingAtZero: true },
    })
    const fortitude = token({
      id: 'zombie',
      type: 'enemy',
      hp: 0,
      maxHp: 22,
      dnd5eCombatState: { undeadFortitudePending: { dc: 10, damage: 5 } },
    })
    const characters = [{ id: 'hero', currentHp: 12, deathSaveFailures: 0, deathSaveStable: false }] as Character[]

    expect(checkCombatOutcome([hero, regenerating], characters)).toEqual({ ended: false })
    expect(checkCombatOutcome([hero, fortitude], characters)).toEqual({ ended: false })
    expect(checkCombatOutcome(
      [hero, token({ id: 'dead', type: 'enemy', hp: 0, maxHp: 10 })],
      characters,
    )).toMatchObject({ ended: true, reason: 'enemies-defeated' })
  })
})
