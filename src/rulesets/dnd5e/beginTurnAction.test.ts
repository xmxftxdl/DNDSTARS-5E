import { afterEach, describe, expect, it } from 'vitest'
import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { prepareDnd5eBeginTurn, resolveDnd5eBeginTurn } from './beginTurnAction'
import {
  buildDnd5eCustomMonster,
  createDnd5eCustomMonsterDraft,
  createDnd5eCustomMonsterTraitDraft,
} from './customMonsterWorkshop'
import { setDnd5eRoomMonsterCatalog } from './monsters'

const COMBAT_ID = 'begin-turn-gaze'

function hero(): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1',
    id: 'hero',
    name: 'Hero',
    player: 'P1',
    avatar: '',
    accent: '',
    race: 'human',
    charClass: '战士',
    level: 1,
    background: '',
    experience: 0,
    reputation: 0,
    abilities: { str: 12, dex: 12, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: [],
    skills: [],
    maxHp: 20,
    currentHp: 20,
    tempHp: 0,
    hitDice: '1d10',
    ac: 14,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 10,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    dnd5eCombatState: { surprisedCombatId: COMBAT_ID },
  }
}

function fixture(order: 'hero-first' | 'basilisk-first' = 'hero-first') {
  const character = hero()
  const heroToken: Token = {
    id: 'hero-token',
    label: character.name,
    x: 0,
    y: 0,
    color: '',
    emoji: '',
    size: 1,
    type: 'player',
    characterId: character.id,
    hp: character.currentHp,
    maxHp: character.maxHp,
  }
  const basiliskToken: Token = {
    id: 'basilisk-token',
    label: 'Basilisk',
    x: 20,
    y: 0,
    color: '',
    emoji: '',
    size: 2,
    type: 'enemy',
    poolId: 'srd-5.1:basilisk',
    hp: 52,
    maxHp: 52,
  }
  const map: BattleMap = {
    id: 'begin-turn-map',
    name: 'Begin turn map',
    width: 200,
    height: 200,
    gridSize: 10,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    feetPerCell: 5,
    tokens: [heroToken, basiliskToken],
  }
  const orderedTokens = order === 'hero-first'
    ? [heroToken, basiliskToken]
    : [basiliskToken, heroToken]
  const initiativeOrder: InitiativeEntry[] = orderedTokens.map((token, index) => ({
    slotId: `${token.id}:normal`,
    tokenId: token.id,
    label: token.label,
    emoji: '',
    color: '',
    roll: 20 - index * 10,
  }))
  return {
    combatId: COMBAT_ID,
    round: 1,
    initiativeIndex: 0,
    map,
    characters: [character],
    initiativeOrder,
  }
}

describe('D&D 5e authoritative begin-turn bridge', () => {
  afterEach(() => setDnd5eRoomMonsterCatalog([]))

  it('rejects a forged first-round-only slot after round one', () => {
    const input = fixture()
    input.round = 2
    input.initiativeOrder[0] = {
      ...input.initiativeOrder[0],
      firstRoundOnly: true,
    }
    expect(prepareDnd5eBeginTurn(input)).toEqual({
      ok: false,
      reason: 'invalid-action',
    })
  })

  it('forces a surprised first-slot target to face gaze and keeps the slot stationary', () => {
    const input = fixture()
    const prepared = prepareDnd5eBeginTurn(input)

    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.turnSlotId).toBe('hero-token:normal')
    expect(prepared.prepared.turnStartGazeRequirements).toEqual([
      expect.objectContaining({
        sourceId: 'basilisk-token',
        targetId: 'hero-token',
        ruleId: 'petrifying-gaze',
        canAvertEyes: false,
      }),
    ])

    const rejected = resolveDnd5eBeginTurn({
      ...input,
      turnStartGazeResolutions: [{
        sourceId: 'basilisk-token',
        targetId: 'hero-token',
        ruleId: 'petrifying-gaze',
        sourceUsesGaze: true,
        choice: 'avert-eyes',
      }],
    })
    expect(rejected).toEqual({ ok: false, reason: 'invalid-action' })
    expect(input.characters[0].conditions).toEqual([])

    const resolved = resolveDnd5eBeginTurn({
      ...input,
      turnStartGazeResolutions: [{
        sourceId: 'basilisk-token',
        targetId: 'hero-token',
        ruleId: 'petrifying-gaze',
        sourceUsesGaze: true,
        choice: 'face-gaze',
        save: { d20: 11 },
      }],
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok || !resolved.result.ok) return
    expect(resolved.result.state).toMatchObject({
      round: 1,
      initiativeIndex: 0,
      turnSlotId: 'hero-token:normal',
    })
    expect(resolved.result.events.filter((event) => event.type === 'turn-started'))
      .toEqual([{ type: 'turn-started', actorId: 'hero-token', round: 1 }])
    expect(resolved.application.characters[0].conditions).toContain('restrained')
    expect(resolved.application.characters[0].dnd5eCombatState)
      .toMatchObject({ turnStartResolvedTurnKey: `${COMBAT_ID}:1:hero-token:normal` })
  })

  it('makes an applied first-slot lifecycle idempotent across a map snapshot rebuild', () => {
    const input = fixture()
    const first = resolveDnd5eBeginTurn({
      ...input,
      turnStartGazeResolutions: [{
        sourceId: 'basilisk-token',
        targetId: 'hero-token',
        ruleId: 'petrifying-gaze',
        sourceUsesGaze: false,
      }],
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const retryInput = {
      ...input,
      map: first.application.map,
      characters: first.application.characters,
    }
    const retryPrepared = prepareDnd5eBeginTurn(retryInput)
    expect(retryPrepared.ok).toBe(true)
    if (!retryPrepared.ok) return
    expect(retryPrepared.prepared).toMatchObject({
      alreadyResolved: true,
      turnStartActiveEffectSavingThrows: [],
      turnStartGazeRequirements: [],
      monsterRechargeRolls: [],
      monsterMechanicRolls: [],
    })

    const retry = resolveDnd5eBeginTurn(retryInput)
    expect(retry.ok).toBe(true)
    if (!retry.ok || !retry.result.ok) return
    expect(retry.result.events).toEqual([])
  })

  it('persists the stable begin-turn marker for an unlinked monster token', () => {
    const input = fixture('basilisk-first')
    const resolved = resolveDnd5eBeginTurn(input)

    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    const basilisk = resolved.application.map.tokens.find((token) =>
      token.id === 'basilisk-token')
    expect(basilisk?.dnd5eCombatState).toMatchObject({
      turnStartResolvedTurnKey: `${COMBAT_ID}:1:basilisk-token:normal`,
    })
    expect(prepareDnd5eBeginTurn({
      ...input,
      map: resolved.application.map,
      characters: resolved.application.characters,
    })).toMatchObject({
      ok: true,
      prepared: { alreadyResolved: true },
    })
  })

  it('previews and commits zero-HP native regeneration before start-of-turn choices', () => {
    const draft = createDnd5eCustomMonsterDraft()
    draft.name = 'Regenerating watcher'
    draft.hitPointsAverage = 30
    draft.traits = [{
      ...createDnd5eCustomMonsterTraitDraft(),
      name: 'Regeneration',
      description: 'Regains 10 hit points at the start of its turn.',
      automation: 'headless',
      ruleKind: 'regeneration',
      amount: 10,
      requiresPositiveHp: false,
      damageTypes: ['fire'],
    }]
    const monster = buildDnd5eCustomMonster(draft)
    setDnd5eRoomMonsterCatalog([monster])
    const input = fixture('basilisk-first')
    const token = input.map.tokens.find((candidate) =>
      candidate.id === 'basilisk-token')!
    token.poolId = monster.id
    token.hp = 0
    token.maxHp = monster.hitPoints.average
    token.dnd5eCombatState = {
      schemaVersion: 2,
      monsterRegenerationPendingAtZero: true,
    }

    const prepared = prepareDnd5eBeginTurn(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.state.combatants[token.id].currentHp).toBe(0)

    const resolved = resolveDnd5eBeginTurn(input)
    expect(resolved.ok).toBe(true)
    if (!resolved.ok || !resolved.result.ok) return
    expect(resolved.result.state.combatants[token.id]).toMatchObject({
      currentHp: 10,
      classState: {
        turnStartResolvedTurnKey: `${COMBAT_ID}:1:basilisk-token:normal`,
      },
    })
    expect(resolved.result.events).toContainEqual({
      type: 'monster-regenerated',
      actorId: token.id,
      amount: 10,
      hpAfter: 10,
    })
  })
})
