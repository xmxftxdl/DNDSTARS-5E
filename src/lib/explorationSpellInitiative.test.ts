import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../store/maps'
import type { Character } from '../types/character'
import type { SharedPlayerActionState } from './sharedCombatTypes'
import {
  prepareDnd5eSpellCast,
  resolvePreparedDnd5eSpellCast,
} from '../rulesets/dnd5e/spellAction'
import {
  prepareDnd5eCoreSpellAreaMove,
  resolvePreparedDnd5eCoreSpellAreaMove,
} from '../rulesets/dnd5e/coreSpellAreaAction'
import { createDnd5eTurnEconomyCounts } from '../rulesets/dnd5e/turnEconomy'
import {
  dnd5eSpellAuthorityResolutionContext,
  dnd5eSpellResolutionInitiativeOrder,
} from '../pages/maps/spellSettlementCoordinator'

function token(id: string, type: Token['type']): Token {
  return {
    id,
    type,
    label: id,
    x: 0,
    y: 0,
    size: 1,
    emoji: '',
    color: '#fff',
  }
}

function map(): BattleMap {
  return {
    id: 'map-1',
    name: 'Map',
    width: 1000,
    height: 1000,
    gridSize: 50,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    tokens: [token('enemy-b', 'enemy'), token('obstacle', 'obstacle'), token('hero', 'player'), token('enemy-a', 'enemy')],
  }
}

describe('dnd5eSpellResolutionInitiativeOrder', () => {
  it('builds an actor-first ephemeral order containing every map combatant', () => {
    const order = dnd5eSpellResolutionInitiativeOrder({
      combatActive: false,
      map: map(),
      actorTokenId: 'hero',
      initiativeOrder: [],
    })

    expect(order.map((entry) => entry.tokenId)).toEqual(['hero', 'enemy-a', 'enemy-b'])
    expect(order.every((entry) => entry.slotId?.startsWith('exploration:'))).toBe(true)
  })

  it('preserves the live initiative order during combat', () => {
    const live = [{ tokenId: 'enemy-b', label: 'enemy-b', emoji: '', color: '#fff', roll: 17 }]
    expect(dnd5eSpellResolutionInitiativeOrder({
      combatActive: true,
      map: map(),
      actorTokenId: 'hero',
      initiativeOrder: live,
    })).toBe(live)
  })

  it('does not persist turn economy outside combat and preserves it during combat', () => {
    const economy = createDnd5eTurnEconomyCounts('combat:hero')
    const outside = dnd5eSpellAuthorityResolutionContext({
      combatActive: false,
      map: map(),
      actorTokenId: 'hero',
      initiativeOrder: [],
      turnEconomy: economy,
      turnEconomyByToken: { hero: economy },
    })
    expect(outside.exploration).toBe(true)
    expect(outside.turnEconomy).toBeUndefined()
    expect(outside.turnEconomyByToken).toBeUndefined()

    const inside = dnd5eSpellAuthorityResolutionContext({
      combatActive: true,
      combatId: 'combat-1',
      map: map(),
      actorTokenId: 'hero',
      initiativeOrder: [],
      turnEconomy: economy,
      turnEconomyByToken: { hero: economy },
    })
    expect(inside.exploration).toBe(false)
    expect(inside.turnEconomy).toBe(economy)
    expect(inside.turnEconomyByToken).toEqual({ hero: economy })
  })

  it('lets the normal Headless transaction spend a spell slot without starting combat', () => {
    const wizard: Character = {
      id: 'wizard',
      name: 'Wizard',
      player: 'Player',
      avatar: '',
      accent: '',
      race: 'Human',
      charClass: 'Wizard',
      rulesetId: 'dnd5e-2014-srd-5.1',
      level: 5,
      background: '',
      experience: 0,
      reputation: 0,
      abilities: { str: 10, dex: 14, con: 14, int: 16, wis: 12, cha: 10 },
      savingThrows: [],
      skills: [],
      maxHp: 30,
      currentHp: 30,
      tempHp: 0,
      hitDice: '5d6',
      ac: 12,
      speed: 30,
      initiativeBonus: 2,
      saveDC: 14,
      passivePerception: 11,
      inspiration: 0,
      conditions: [],
      notes: '',
      dmNotes: '',
      visibleToPlayers: true,
      dnd5eClassLevels: { wizard: 5 },
      dnd5eClassChoices: {
        classes: { wizard: { selections: { 'spell-prepared': ['magic-missile'] } } },
      },
      classResources: { 'dnd5e-spell-slot-1': { current: 2, max: 4 } },
    }
    const wizardToken = { ...token('wizard-token', 'player'), characterId: wizard.id, x: 25, y: 25 }
    const enemy = { ...token('enemy', 'enemy'), x: 125, y: 25, hp: 30, maxHp: 30 }
    const explorationMap = { ...map(), tokens: [wizardToken, enemy] }
    const action: SharedPlayerActionState = {
      id: 'exploration-cast',
      mapId: explorationMap.id,
      sourceMode: 'player',
      status: 'pending',
      type: 'dnd5e-spell-cast',
      actorTokenId: wizardToken.id,
      characterId: wizard.id,
      targetTokenId: enemy.id,
      targetTokenIds: [enemy.id],
      dnd5eSpellCast: {
        spellId: 'magic-missile',
        castingClassId: 'wizard',
        slotLevel: 1,
        targetTokenId: enemy.id,
        targetTokenIds: [enemy.id],
        projectileTargetIds: [enemy.id, enemy.id, enemy.id],
      },
      round: 1,
      initiativeIndex: 0,
      seq: 1,
      updatedAt: 1,
    }
    const initiativeOrder = dnd5eSpellResolutionInitiativeOrder({
      combatActive: false,
      map: explorationMap,
      actorTokenId: wizardToken.id,
      initiativeOrder: [],
    })

    const prepared = prepareDnd5eSpellCast({
      action,
      map: explorationMap,
      characters: [wizard],
      initiativeOrder,
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      effectRolls: [1, 2, 3],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.characters[0].classResources?.['dnd5e-spell-slot-1']).toEqual({
      current: 1,
      max: 4,
    })
    expect(resolved.application?.map.tokens.find((entry) => entry.id === enemy.id)?.hp).toBe(21)
    expect(action.combatId).toBeUndefined()
  })

  it('resolves Dancing Lights outside combat when the caster is the only map combatant', () => {
    const wizard: Character = {
      id: 'solo-wizard',
      name: 'Solo Wizard',
      player: 'Player',
      avatar: '',
      accent: '',
      race: 'Human',
      charClass: 'Wizard',
      rulesetId: 'dnd5e-2014-srd-5.1',
      level: 5,
      background: '',
      experience: 0,
      reputation: 0,
      abilities: { str: 10, dex: 14, con: 14, int: 16, wis: 12, cha: 10 },
      savingThrows: [],
      skills: [],
      maxHp: 30,
      currentHp: 30,
      tempHp: 0,
      hitDice: '5d6',
      ac: 12,
      speed: 30,
      initiativeBonus: 2,
      saveDC: 14,
      passivePerception: 11,
      inspiration: 0,
      conditions: [],
      notes: '',
      dmNotes: '',
      visibleToPlayers: true,
      dnd5eClassLevels: { wizard: 5 },
      dnd5eClassChoices: {
        classes: { wizard: { selections: { 'spell-cantrips': ['dancing-lights'] } } },
      },
    }
    const wizardToken = {
      ...token('solo-wizard-token', 'player'),
      characterId: wizard.id,
      x: 25,
      y: 25,
    }
    const explorationMap = { ...map(), tokens: [wizardToken] }
    const action: SharedPlayerActionState = {
      id: 'exploration-dancing-lights',
      mapId: explorationMap.id,
      sourceMode: 'player',
      status: 'pending',
      type: 'dnd5e-spell-cast',
      actorTokenId: wizardToken.id,
      characterId: wizard.id,
      targetTokenId: wizardToken.id,
      targetTokenIds: [],
      dnd5eSpellCast: {
        spellId: 'dancing-lights',
        castingClassId: 'wizard',
        slotLevel: 0,
        targetTokenId: wizardToken.id,
        targetTokenIds: [],
        areaTargetCells: [
          { col: 1, row: 0 },
          { col: 2, row: 0 },
          { col: 3, row: 0 },
          { col: 4, row: 0 },
        ],
      },
      round: 1,
      initiativeIndex: 0,
      seq: 1,
      updatedAt: 1,
    }
    const authority = dnd5eSpellAuthorityResolutionContext({
      combatActive: false,
      combatId: '',
      map: explorationMap,
      actorTokenId: wizardToken.id,
      initiativeOrder: [],
    })

    expect(authority.exploration).toBe(true)
    const prepared = prepareDnd5eSpellCast({
      action,
      map: explorationMap,
      characters: [wizard],
      initiativeOrder: authority.initiativeOrder,
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.state.active).toBe(true)

    const resolved = resolvePreparedDnd5eSpellCast({
      prepared: prepared.prepared,
      effectRolls: [],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.map.dnd5ePluginAreas?.[0]).toMatchObject({
      coreSpellId: 'dancing-lights',
      sourceTokenId: wizardToken.id,
      lightingAnchorCells: action.dnd5eSpellCast?.areaTargetCells,
      movement: { economy: 'bonus-action', maximumFeet: 60 },
    })

    const castApplication = resolved.application
    const area = castApplication?.map.dnd5ePluginAreas?.[0]
    expect(castApplication).toBeDefined()
    expect(area).toBeDefined()
    if (!castApplication || !area) return
    const moveAction: SharedPlayerActionState = {
      id: 'exploration-move-dancing-lights',
      mapId: explorationMap.id,
      sourceMode: 'player',
      status: 'pending',
      type: 'dnd5e-persistent-area-move',
      actorTokenId: wizardToken.id,
      characterId: wizard.id,
      targetCell: { col: 2, row: 1 },
      dnd5ePersistentAreaMove: {
        areaId: area.id,
        targetCell: { col: 2, row: 1 },
        targetCells: [
          { col: 2, row: 1 },
          { col: 3, row: 2 },
          { col: 4, row: 2 },
          { col: 5, row: 1 },
        ],
      },
      round: 1,
      initiativeIndex: 0,
      seq: 2,
      updatedAt: 2,
    }
    const preparedMove = prepareDnd5eCoreSpellAreaMove({
      action: moveAction,
      map: castApplication.map,
      characters: castApplication.characters,
      initiativeOrder: authority.initiativeOrder,
    })
    expect(preparedMove.ok, preparedMove.ok ? undefined : preparedMove.reason).toBe(true)
    if (!preparedMove.ok) return
    const moved = resolvePreparedDnd5eCoreSpellAreaMove({ prepared: preparedMove.prepared })
    expect(moved.result.ok, moved.result.ok ? undefined : moved.result.reason).toBe(true)
    expect(moved.application?.map.dnd5ePluginAreas?.[0].lightingAnchorCells).toEqual([
      { col: 2, row: 1 },
      { col: 3, row: 2 },
      { col: 4, row: 2 },
      { col: 5, row: 1 },
    ])
  })
})
