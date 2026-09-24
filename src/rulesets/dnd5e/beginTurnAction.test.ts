import { tokenOccupiedCellsAt } from '../../lib/gridCombat'
import { getDnd5eCoreSpellAreaDeclaration } from './coreSpellAreas'
import { collectDnd5ePersistentAreaTriggers } from './pluginAreas'
import { prepareDnd5ePersistentAreaTrigger, resolvePreparedDnd5ePersistentAreaTrigger } from './pluginAreaTransactions'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { afterEach, describe, expect, it } from 'vitest'
import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import { setMapGeometryRuntime } from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  createDnd5eMechanicalEffect,
  dnd5eWaterWalkSurfaceRiseElevation,
} from './activeEffects'
import {
  prepareDnd5eBeginTurn,
  resolveDnd5eBeginTurn,
} from './beginTurnAction'
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

function settleCloudBeforeBegin(input: ReturnType<typeof fixture>, actorId: string, failed: boolean) {
  const actor = input.map.tokens.find(token => token.id === actorId)!
  const source = input.map.tokens.find(token => token.id !== actorId)!
  source.dnd5eCombatState = { ...source.dnd5eCombatState, concentrationSpellId: 'stinking-cloud', concentrationSpellLevel: 3 }
  const sourceCharacter = input.characters.find(character => character.id === source.characterId)
  if (sourceCharacter) {
    sourceCharacter.concentrating = true
    sourceCharacter.dnd5eCombatState = { ...sourceCharacter.dnd5eCombatState, concentrationSpellId: 'stinking-cloud', concentrationSpellLevel: 3 }
  }
  const slotId = input.initiativeOrder[input.initiativeIndex].slotId!
  const trigger = getDnd5eCoreSpellAreaDeclaration('stinking-cloud')!.triggers![0]
  input.map.dnd5ePluginAreas = [{
    id: 'cloud', pluginId: 'srd', featureId: 'stinking-cloud', sourceKind: 'core-spell',
    coreSpellId: 'stinking-cloud', label: 'cloud', color: '#aaa', createdRound: 1, expiresAfterRound: 11,
    sourceTokenId: source.id, sourceCharacterId: source.characterId ?? source.id,
    includeSelf: true, cells: tokenOccupiedCellsAt(actor, input.map, actor),
    triggers: [{ id: trigger.id, label: trigger.label, timing: trigger.timing, oncePerTurn: true,
      consumeActionOnFailedSave: trigger.consumeActionOnFailedSave, savingThrow: { ...trigger.savingThrow!, dc: 15 } }],
  }]
  const candidate = collectDnd5ePersistentAreaTriggers({ map: input.map, timing: 'turn-start',
    round: input.round, turnKey: `${input.round}:${slotId}`, targetTokenId: actorId })[0]
  expect(candidate).toBeDefined()
  const prepared = prepareDnd5ePersistentAreaTrigger({ ...input, candidate })
  if (!prepared.ok) throw new Error(prepared.reason)
  const settled = resolvePreparedDnd5ePersistentAreaTrigger({ prepared: prepared.prepared, d20: failed ? 1 : 20 })
  expect(settled.result.ok, settled.result.ok ? undefined : settled.result.reason).toBe(true)
  const event = settled.result.events.find(event => event.type === 'persistent-area-triggered')
  expect(event).toMatchObject({ saveSuccess: !failed, actionConsumed: failed })
  input.map = settled.application!.map
  input.characters = settled.application!.characters
  const economy = createDnd5eTurnEconomyCounts(`${COMBAT_ID}:${input.round}:${slotId}`)
  economy.action.current = event?.type === 'persistent-area-triggered' && event.actionConsumed ? 0 : 1
  return economy
}

describe('D&D 5e authoritative begin-turn bridge', () => {
  it.each([false, true])('resolves player delayed spells after area action loss: consumed=%s', (consumed) => {
    const input = fixture()
    input.round = 2
    input.map.tokens[1].poolId = undefined
    input.characters[0] = {
      ...hero(), charClass: '法师', level: 5,
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['magic-missile'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 0, max: 4 } },
      dnd5eCombatState: { slowDelayedSpell: {
        schemaVersion: 1, createdTurnKey: `${COMBAT_ID}:1:hero-token:normal`,
        action: { type: 'cast-spell', actorId: 'hero-token', targetId: 'basilisk-token',
          targetIds: ['basilisk-token'], projectileTargetIds: Array(3).fill('basilisk-token'),
          spellId: 'magic-missile', slotLevel: 1, effectRolls: [1, 1, 1] },
      } },
    }
    const turnEconomy = settleCloudBeforeBegin(input, 'hero-token', consumed)
    const resolved = resolveDnd5eBeginTurn({ ...input, turnEconomy })
    expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
    if (!resolved.ok) return
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: consumed ? 'slow-delayed-spell-wasted' : 'slow-delayed-spell-completed',
      actorId: 'hero-token', spellId: 'magic-missile',
    }))
    expect(resolved.result.state.combatants['hero-token'].classState.slowDelayedSpell).toBeUndefined()
    expect(resolved.result.state.combatants['hero-token'].turn.actionAvailable).toBe(false)
    expect(resolved.result.state.combatants['hero-token'].classResources['dnd5e-spell-slot-1'].current).toBe(0)
    expect(resolved.result.events.some(event => event.type === 'damage-applied')).toBe(!consumed)
  })

  it.each([false, true])('resolves monster pending spells after area action loss: consumed=%s', (consumed) => {
    const input = fixture('basilisk-first')
    input.round = 2
    const actor = input.map.tokens[1]
    actor.poolId = 'srd-5.1:drow'
    actor.dnd5eCombatState = { slowDelayedMonsterSpell: {
      createdTurnKey: `${COMBAT_ID}:1:basilisk-token:normal`,
      intent: { spellId: 'faerie-fire', spellName: '妖火术', slotLevel: 1,
        targetTokenIds: ['hero-token'], effect: 'saving-throw', diceCount: 0,
        diceSides: 4, castingTime: 'action', areaTargetCell: { col: 0, row: 0 } },
    }, monsterSpellUsesBySpellId: { 'faerie-fire': { current: 0, max: 1 } } }
    const turnEconomy = settleCloudBeforeBegin(input, 'basilisk-token', consumed)
    const resolved = resolveDnd5eBeginTurn({ ...input, turnEconomy })
    expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
    if (!resolved.ok) return
    const caster = resolved.result.state.combatants[actor.id]
    expect(caster.classState.slowDelayedMonsterSpell != null).toBe(!consumed)
    expect(caster.classState.monsterSpellUsesBySpellId?.['faerie-fire'].current).toBe(0)
    expect(resolved.result.events.some(event => event.type === 'slow-delayed-spell-wasted')).toBe(consumed)
  })

  afterEach(() => {
    setDnd5eRoomMonsterCatalog([])
    setMapGeometryRuntime([])
  })

  it('raises an underwater Water Walk target by 60 feet at the start of its turn', () => {
    const input = fixture()
    input.characters[0] = {
      ...input.characters[0],
      dnd5eCombatState: {
        activeEffects: [createDnd5eMechanicalEffect({
          definitionId: 'activity:water-walk:water-walk:modifiers:0',
          label: 'Water Walk',
          source: {
            kind: 'spell',
            actorId: input.map.tokens[0].id,
            rulesId: 'water-walk',
            spellLevel: 3,
            magical: true,
          },
          targetId: input.map.tokens[0].id,
          duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
          modifiers: {
            environmentalCapabilities: {
              treatLiquidSurfacesAsSolidGround: true,
              riseTowardLiquidSurfaceFeetPerRound: 60,
            },
          },
        })],
      },
    }
    const firstRise = dnd5eWaterWalkSurfaceRiseElevation({
      elevationFeet: -120,
      activeEffects: input.characters[0].dnd5eCombatState?.activeEffects,
      underwater: true,
    })
    expect(firstRise).toBe(-60)

    const secondRise = dnd5eWaterWalkSurfaceRiseElevation({
      elevationFeet: firstRise,
      activeEffects: input.characters[0].dnd5eCombatState?.activeEffects,
      underwater: true,
    })
    expect(secondRise).toBe(0)
    expect(dnd5eWaterWalkSurfaceRiseElevation({
      elevationFeet: -120,
      activeEffects: input.characters[0].dnd5eCombatState?.activeEffects,
      underwater: false,
    })).toBe(-120)
  })

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

  it('starts an explicit map combat turn with a sole initiative participant', () => {
    const input = fixture()
    input.map.tokens = [input.map.tokens[0]]
    input.initiativeOrder = [input.initiativeOrder[0]]

    const resolved = resolveDnd5eBeginTurn(input)

    expect(resolved.ok).toBe(true)
    if (!resolved.ok || !resolved.result.ok) return
    expect(resolved.result.state).toMatchObject({
      active: true,
      round: 1,
      initiativeIndex: 0,
      initiativeOrder: ['hero-token'],
      turnSlotId: 'hero-token:normal',
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
