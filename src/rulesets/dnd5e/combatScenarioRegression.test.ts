import { afterEach, describe, expect, it } from 'vitest'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { createDnd5eMechanicalEffect, dnd5eConditionsFromActiveEffects } from './activeEffects'
import {
  dnd5eCombatantCanSee,
  dnd5eTargetArmorClassForAttack,
  resolveDnd5eHeadlessAction,
} from './headlessCombatEngine'
import { migrateLegacyDnd5eConditions } from './legacyActiveEffectMigration'
import { createDnd5eMapCombatSnapshot } from './mapBridge'
import { prepareDnd5ePlayerMove, resolvePreparedDnd5ePlayerMove } from './playerMoveAction'
import { prepareDnd5eSpellCast, resolvePreparedDnd5eSpellCast } from './spellAction'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'

function character(id: string, patch: Partial<Character> = {}): Character {
  return {
    id,
    name: id,
    player: 'scenario',
    avatar: '',
    accent: '',
    race: 'human',
    charClass: 'fighter',
    level: 5,
    background: '',
    experience: 0,
    reputation: 0,
    rulesetId: 'dnd5e-2014-srd-5.1',
    abilities: { str: 16, dex: 14, con: 14, int: 16, wis: 12, cha: 16 },
    savingThrows: [],
    skills: [],
    maxHp: 30,
    currentHp: 30,
    tempHp: 0,
    hitDice: '5d10',
    ac: 14,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 14,
    passivePerception: 12,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    ...patch,
  }
}

function token(patch: Partial<Token>): Token {
  return {
    id: 'token',
    label: 'token',
    x: 25,
    y: 25,
    color: '',
    emoji: '',
    size: 1,
    type: 'enemy',
    hp: 30,
    maxHp: 30,
    ...patch,
  }
}

function initiative(tokens: readonly Token[]) {
  return tokens.map((entry, index) => ({
    tokenId: entry.id,
    label: entry.label,
    emoji: '',
    color: '',
    roll: 20 - index,
  }))
}

function map(id: string, tokens: Token[]): BattleMap {
  return {
    id,
    name: id,
    width: 300,
    height: 150,
    gridSize: 50,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    feetPerCell: 5,
    tokens,
  }
}

/**
 * Small, fixed maps for rules that historically desynchronised between the
 * map, Headless settlement, and the combat log. These are intentionally
 * deterministic; run them with `npm run test:combat-scenarios`.
 */
describe('D&D 5e combat scenario regression suite', () => {
  afterEach(() => setMapGeometryRuntime([]))

  it('keeps a Thunderwave target on the plateau until it truly leaves its support, then projects a real fall', () => {
    const bard = character('bard', {
      charClass: 'wizard',
      dnd5eClassLevels: { wizard: 5 },
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['thunderwave'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 2, max: 4 } },
    })
    const bardToken = token({ id: 'bard-token', label: 'bard', type: 'player', characterId: bard.id, x: 75 })
    const target = token({ id: 'target', label: 'target', x: 125, elevationFeet: 40 })
    const battlefield = map('scenario-thunderwave-cliff', [bardToken, target])
    const geometry = {
      ...createEmptyMapGeometry(battlefield.id),
      obstacles: [{
        id: 'plateau',
        kind: 'obstacle' as const,
        label: 'plateau',
        cover: 'none' as const,
        points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }],
        baseHeightFeet: 0,
        heightFeet: 0,
        terrainElevationFeet: 40,
        terrainRegion: true,
        blocksVision: false,
        blocksMovement: false,
        blocksLineOfEffect: false,
        createdAt: 1,
      }],
    }
    setMapGeometryRuntime([geometry])
    const action: SharedPlayerActionState = {
      id: 'scenario-thunderwave',
      mapId: battlefield.id,
      combatId: 'scenario-thunderwave',
      sourceMode: 'player',
      status: 'pending',
      type: 'dnd5e-spell-cast',
      actorTokenId: bardToken.id,
      characterId: bard.id,
      targetTokenId: target.id,
      dnd5eSpellCast: {
        spellId: 'thunderwave',
        slotLevel: 1,
        targetTokenId: target.id,
        areaTargetCell: { col: 2, row: 0 },
      },
      round: 1,
      initiativeIndex: 0,
      seq: 1,
      updatedAt: 1,
    }
    const input = { action, map: battlefield, characters: [bard], initiativeOrder: initiative(battlefield.tokens) }

    const onPlateau = prepareDnd5eSpellCast(input)
    expect(onPlateau.ok, onPlateau.ok ? undefined : onPlateau.reason).toBe(true)
    if (!onPlateau.ok) return
    const noFall = resolvePreparedDnd5eSpellCast({
      prepared: onPlateau.prepared,
      savingThrowD20: 1,
      forcedMovements: [{ targetId: target.id, to: { x: 175, y: 25 }, distanceFeet: 10, toElevationFeet: 40 }],
      effectRolls: [2, 3],
    })
    expect(noFall.result.ok).toBe(true)
    expect(noFall.result.events.some((event) => event.type === 'falling-damage-resolved')).toBe(false)
    expect(noFall.application?.map.tokens.find((entry) => entry.id === target.id))
      .toMatchObject({ x: 175, y: 25, elevationFeet: 40 })

    const offPlateau = prepareDnd5eSpellCast(input)
    expect(offPlateau.ok).toBe(true)
    if (!offPlateau.ok) return
    const fallen = resolvePreparedDnd5eSpellCast({
      prepared: offPlateau.prepared,
      savingThrowD20: 1,
      forcedMovements: [{
        targetId: target.id,
        to: { x: 225, y: 25 },
        distanceFeet: 10,
        toElevationFeet: 0,
        fallingDamageRolls: [1, 2, 3, 4],
      }],
      effectRolls: [2, 3],
    })
    expect(fallen.result.ok).toBe(true)
    expect(fallen.result.events).toContainEqual(expect.objectContaining({
      type: 'falling-damage-resolved', actorId: target.id, distanceFeet: 40, damage: 10,
    }))
    expect(fallen.application?.map.tokens.find((entry) => entry.id === target.id))
      .toMatchObject({ x: 225, y: 25, elevationFeet: 0 })
  })

  it('compiles a solid wall into the same unseen, total-cover outcome used by Headless', () => {
    const hero = character('hero')
    const heroToken = token({ id: 'hero-token', label: 'hero', type: 'player', characterId: hero.id, x: 25, y: 75 })
    const enemy = token({ id: 'enemy-token', label: 'enemy', x: 275, y: 75, hp: 10, maxHp: 10 })
    const battlefield = map('scenario-wall-cover', [heroToken, enemy])
    setMapGeometryRuntime([{
      ...createEmptyMapGeometry(battlefield.id),
      walls: [{
        id: 'solid-wall',
        kind: 'wall',
        label: 'solid wall',
        points: [{ x: 150, y: 0 }, { x: 150, y: 150 }],
        blocksVision: true,
        blocksMovement: true,
        blocksLineOfEffect: true,
        baseHeightFeet: 0,
        heightFeet: 10,
        createdAt: 1,
      }],
    }])
    const snapshot = createDnd5eMapCombatSnapshot({
      combatId: battlefield.id,
      map: battlefield,
      characters: [hero],
      initiativeOrder: initiative(battlefield.tokens),
    })
    expect(dnd5eCombatantCanSee(snapshot.state, heroToken.id, enemy.id)).toBe(false)
    expect(dnd5eTargetArmorClassForAttack(snapshot.state, heroToken.id, enemy.id)).toBeGreaterThan(100)
    const attack = resolveDnd5eHeadlessAction(snapshot.state, {
      type: 'attack',
      actorId: heroToken.id,
      targetId: enemy.id,
      attackModifier: 99,
      d20: 20,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [8] },
    })
    expect(attack.ok).toBe(true)
    if (!attack.ok) return
    expect(attack.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', hit: false }))
    expect(attack.state.combatants[enemy.id].currentHp).toBe(10)
  })

  it('records a legal Shield reaction as a miss and projects the spent slot', () => {
    const wizard = character('wizard', {
      charClass: 'wizard',
      dnd5eClassLevels: { wizard: 5 },
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['shield'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 4 } },
    })
    const attacker = token({ id: 'attacker', label: 'attacker', x: 25, y: 25 })
    const wizardToken = token({ id: 'wizard-token', label: 'wizard', type: 'player', characterId: wizard.id, x: 75, y: 25 })
    const battlefield = map('scenario-shield-reaction', [attacker, wizardToken])
    const snapshot = createDnd5eMapCombatSnapshot({
      combatId: battlefield.id,
      map: battlefield,
      characters: [wizard],
      initiativeOrder: initiative(battlefield.tokens),
    })
    const resolved = resolveDnd5eHeadlessAction(snapshot.state, {
      type: 'attack',
      actorId: attacker.id,
      targetId: wizardToken.id,
      attackModifier: 4,
      d20: 12,
      shieldSpellReaction: true,
      damage: { count: 1, sides: 6, bonus: 2, rolls: [4] },
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', targetId: wizardToken.id,
      armorClass: snapshot.state.combatants[wizardToken.id].armorClass + 5,
      hit: false,
    }))
    expect(resolved.events).toContainEqual({ type: 'turn-resource-spent', actorId: wizardToken.id, resource: 'reaction' })
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: wizardToken.id, stateKey: 'shield-spell', active: true,
    }))
  })

  it('keeps a prone creature crawling when Hideous Laughter makes standing illegal', () => {
    const hero = character('hero')
    const prone = migrateLegacyDnd5eConditions({ targetId: hero.id, conditions: ['prone'] })
    const laughter = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:hideous-laughter:repeat-save',
      label: 'Hideous Laughter',
      targetId: hero.id,
      source: { kind: 'spell', actorId: 'enemy', rulesId: 'hideous-laughter' },
      duration: { type: 'concentration', sourceActorId: 'enemy' },
    })
    const activeEffects = [...prone, laughter]
    hero.conditions = dnd5eConditionsFromActiveEffects(activeEffects)
    hero.dnd5eCombatState = { schemaVersion: 2, activeEffects }
    const heroToken = token({ id: 'hero-token', label: 'hero', type: 'player', characterId: hero.id, x: 25 })
    const enemy = token({ id: 'enemy', label: 'enemy', x: 225 })
    const battlefield = map('scenario-prone-laughter', [heroToken, enemy])
    const action: SharedPlayerActionState = {
      id: 'scenario-crawl',
      mapId: battlefield.id,
      combatId: battlefield.id,
      sourceMode: 'player',
      status: 'pending',
      type: 'move-token',
      actorTokenId: heroToken.id,
      characterId: hero.id,
      targetPosition: { x: 75, y: 25 },
      dnd5eStandFromProne: true,
      round: 1,
      initiativeIndex: 0,
      seq: 1,
      updatedAt: 1,
    }
    const prepared = prepareDnd5ePlayerMove({
      action,
      map: battlefield,
      characters: [hero],
      initiativeOrder: initiative(battlefield.tokens),
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      standFromProne: false,
      standPreventedBy: 'hideous-laughter',
      movementCostFeet: 10,
    })
    const resolved = resolvePreparedDnd5ePlayerMove({ prepared: prepared.prepared })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.characters[0].conditions).toContain('prone')
  })
})
