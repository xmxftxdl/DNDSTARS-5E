import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import type { DeclarativeSubclassDefinitionV1 } from './declarativeSubclassAbility'
import {
  prepareDnd5eCoreSpellAreaMove,
  resolvePreparedDnd5eCoreSpellAreaMove,
} from './coreSpellAreaAction'
import { getDnd5eCoreSpellAreaDeclaration } from './coreSpellAreas'
import { resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot } from './mapBridge'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { getDnd5eSrdCombatSpell } from './spells'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import {
  dnd5eUtilityProjectionAttackAdvantageApplies,
  dnd5eUtilityProjectionMovementEconomy,
  dnd5eUtilityProjectionTargetDistanceFeet,
} from './utilityProjection'
import { dnd5eUtilityProjectionDistanceKey } from './utilityProjectionState'

const PLUGIN_ID = 'com.example.utility-projection'
const SUBCLASS_ID = `${PLUGIN_ID}:projection-user`
const ADVANTAGE_FEATURE_ID = `${SUBCLASS_ID}.projection-advantage`

const definition: DeclarativeSubclassDefinitionV1 = {
  schemaVersion: 1,
  id: 'projection-user',
  classId: 'rogue',
  name: 'Projection User',
  summary: 'Synthetic utility projection protocol fixture.',
  abilities: [{
    schemaVersion: 1,
    id: 'projection-control',
    name: 'Projection Control',
    description: 'Moves a utility projection with a different turn resource.',
    level: 3,
    trigger: { kind: 'active-use' },
    targeting: { kind: 'self' },
    mechanic: {
      kind: 'utility-projection-control',
      projectionId: 'mage-hand',
      economy: 'bonusAction',
    },
    effects: [],
    automation: 'partial',
  }, {
    schemaVersion: 1,
    id: 'projection-advantage',
    name: 'Projection Advantage',
    description: 'Marks a target adjacent to an owned utility projection.',
    level: 13,
    trigger: { kind: 'active-use' },
    cost: { economy: 'bonusAction' },
    targeting: { kind: 'single-creature', relation: 'enemy' },
    mechanic: {
      kind: 'utility-projection-attack-advantage',
      projectionId: 'mage-hand',
      maximumDistanceFeet: 5,
    },
    duration: { kind: 'until-source-turn-end' },
    effects: [],
    automation: 'full',
  }],
}

function character(patch: Partial<Character> = {}): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1',
    id: 'projection-character',
    name: 'Projection User',
    player: 'P1',
    avatar: '',
    accent: '',
    race: 'human',
    charClass: '游荡者',
    level: 13,
    dnd5eClassLevels: { rogue: 13 },
    dnd5eClassChoices: {
      classes: {
        rogue: {
          subclass: SUBCLASS_ID,
        },
      },
    },
    background: '',
    experience: 0,
    reputation: 0,
    abilities: { str: 10, dex: 18, con: 12, int: 16, wis: 10, cha: 10 },
    savingThrows: ['dex', 'int'],
    skills: [],
    maxHp: 70,
    currentHp: 70,
    tempHp: 0,
    hitDice: '13d8',
    ac: 16,
    speed: 30,
    initiativeBonus: 4,
    saveDC: 15,
    passivePerception: 10,
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
    label: 'Token',
    x: 25,
    y: 25,
    color: '',
    emoji: '',
    size: 1,
    type: 'enemy',
    hp: 20,
    maxHp: 20,
    ...patch,
  }
}

function area(cells: Array<{ col: number; row: number }>): Dnd5ePluginArea {
  return {
    id: 'core-spell-area:projection',
    pluginId: 'core',
    featureId: 'core:mage-hand',
    sourceKind: 'core-spell',
    coreSpellId: 'mage-hand',
    label: 'Utility Projection',
    color: '#a78bfa',
    sourceCharacterId: 'projection-character',
    sourceTokenId: 'projection-token',
    cells,
    createdRound: 1,
    expiresAfterRound: 11,
    anchorMode: 'fixed',
    anchorCell: cells[0],
    movement: { economy: 'action', maximumFeet: 30 },
  }
}

function mapWithProjection(
  projectionCells: Array<{ col: number; row: number }> = [{ col: 3, row: 2 }],
): {
  map: BattleMap
  actorToken: Token
  targetToken: Token
  initiativeOrder: Array<{
    tokenId: string
    label: string
    emoji: string
    color: string
    roll: number
  }>
} {
  const actorToken = token({
    id: 'projection-token',
    label: 'Projection User',
    type: 'player',
    characterId: 'projection-character',
    x: 25,
    y: 25,
    hp: 70,
    maxHp: 70,
  })
  const targetToken = token({
    id: 'target-token',
    label: 'Target',
    type: 'enemy',
    x: 45,
    y: 25,
  })
  return {
    actorToken,
    targetToken,
    map: {
      id: 'projection-map',
      name: 'Projection Map',
      width: 100,
      height: 100,
      gridSize: 10,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [actorToken, targetToken],
      dnd5ePluginAreas: [area(projectionCells)],
    },
    initiativeOrder: [{
      tokenId: actorToken.id,
      label: actorToken.label,
      emoji: '',
      color: '',
      roll: 20,
    }, {
      tokenId: targetToken.id,
      label: targetToken.label,
      emoji: '',
      color: '',
      roll: 10,
    }],
  }
}

describe('generic utility projection protocol', () => {
  let dispose: (() => void) | undefined

  beforeAll(() => {
    dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: PLUGIN_ID,
        name: 'Utility Projection Test',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Test',
        license: 'CC0-1.0',
      },
      setup(api) {
        api.registerDeclarativeSubclass(definition)
      },
    })
  })

  afterAll(() => dispose?.())

  it('registers the SRD projection spell and its movable map declaration', () => {
    expect(getDnd5eSrdCombatSpell('mage-hand')).toMatchObject({
      level: 0,
      effect: 'persistent-area',
      effectDurationRounds: 10,
      area: { radiusFeet: 0, placeRangeFeet: 30 },
    })
    expect(getDnd5eCoreSpellAreaDeclaration('mage-hand')).toMatchObject({
      durationRounds: 10,
      concentration: false,
      movement: { economy: 'action', maximumFeet: 30 },
    })
  })

  it('derives projection distance from Host map cells and ignores actor distance', () => {
    const fixture = mapWithProjection()
    const actor = character()
    const snapshot = createDnd5eMapCombatSnapshot({
      combatId: 'projection-distance',
      map: fixture.map,
      characters: [actor],
      initiativeOrder: fixture.initiativeOrder,
    })
    expect(snapshot.state.utilityProjectionDistanceFeetByPair?.[
      dnd5eUtilityProjectionDistanceKey(
        fixture.actorToken.id,
        'mage-hand',
        fixture.targetToken.id,
      )
    ]).toBe(5)
    expect(dnd5eUtilityProjectionTargetDistanceFeet({
      character: actor,
      featureId: ADVANTAGE_FEATURE_ID,
      map: fixture.map,
      targetToken: fixture.targetToken,
    })).toBe(5)
  })

  it('uses a bonus action to move the projection for an eligible owner', () => {
    const fixture = mapWithProjection()
    const actor = character()
    expect(dnd5eUtilityProjectionMovementEconomy(
      actor,
      'mage-hand',
      'action',
    )).toBe('bonus-action')
    expect(dnd5eUtilityProjectionMovementEconomy(
      character({
        dnd5eClassChoices: { classes: { rogue: {} } },
      }),
      'mage-hand',
      'action',
    )).toBe('action')

    const action: SharedPlayerActionState = {
      id: 'move-projection',
      mapId: fixture.map.id,
      combatId: 'projection-move',
      sourceMode: 'player',
      status: 'pending',
      type: 'dnd5e-persistent-area-move',
      actorTokenId: fixture.actorToken.id,
      characterId: actor.id,
      dnd5ePersistentAreaMove: {
        areaId: fixture.map.dnd5ePluginAreas![0].id,
        targetCell: { col: 4, row: 2 },
      },
      round: 1,
      initiativeIndex: 0,
      seq: 1,
      updatedAt: 1,
    }
    const prepared = prepareDnd5eCoreSpellAreaMove({
      action,
      map: fixture.map,
      characters: [actor],
      initiativeOrder: fixture.initiativeOrder,
      turnEconomy: createDnd5eTurnEconomyCounts('projection-move-turn'),
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.economy).toBe('bonusAction')
    const resolved = resolvePreparedDnd5eCoreSpellAreaMove({
      prepared: prepared.prepared,
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent',
      actorId: fixture.actorToken.id,
      resource: 'bonusAction',
    }))
  })

  it('authoritatively marks only an adjacent target and grants attacks advantage for the current turn', () => {
    const fixture = mapWithProjection()
    const snapshot = createDnd5eMapCombatSnapshot({
      combatId: 'projection-advantage',
      map: fixture.map,
      characters: [character()],
      initiativeOrder: fixture.initiativeOrder,
    })
    const activated = resolveDnd5eHeadlessAction(snapshot.state, {
      type: 'plugin',
      pluginId: PLUGIN_ID,
      actionId: 'decl.projection-user.projection-advantage',
      featureId: ADVANTAGE_FEATURE_ID,
      transactionId: 'projection-advantage-tx',
      actorId: fixture.actorToken.id,
      targetId: fixture.targetToken.id,
      targetIds: [fixture.targetToken.id],
      distanceFeet: 999,
    })
    expect(activated.ok, activated.ok ? undefined : activated.reason).toBe(true)
    if (!activated.ok) return
    const actor = activated.state.combatants[fixture.actorToken.id]
    const target = activated.state.combatants[fixture.targetToken.id]
    expect(actor.turn.bonusActionAvailable).toBe(false)
    expect(dnd5eUtilityProjectionAttackAdvantageApplies(
      activated.state,
      actor,
      target,
    )).toBe(true)

    const attack = resolveDnd5eHeadlessAction(activated.state, {
      type: 'attack',
      actorId: actor.id,
      targetId: target.id,
      attackModifier: 0,
      d20: 5,
      d20Second: 20,
      mode: 'normal',
      spendAction: false,
      damage: {
        count: 1,
        sides: 4,
        bonus: 0,
        rolls: [2, 2],
        type: 'piercing',
      },
    })
    expect(attack.ok, attack.ok ? undefined : attack.reason).toBe(true)
    expect(attack.state.combatants[target.id].currentHp).toBe(16)

    const farFixture = mapWithProjection([{ col: 0, row: 2 }])
    const farSnapshot = createDnd5eMapCombatSnapshot({
      combatId: 'projection-too-far',
      map: farFixture.map,
      characters: [character()],
      initiativeOrder: farFixture.initiativeOrder,
    })
    expect(resolveDnd5eHeadlessAction(farSnapshot.state, {
      type: 'plugin',
      pluginId: PLUGIN_ID,
      actionId: 'decl.projection-user.projection-advantage',
      featureId: ADVANTAGE_FEATURE_ID,
      transactionId: 'projection-too-far-tx',
      actorId: farFixture.actorToken.id,
      targetId: farFixture.targetToken.id,
      targetIds: [farFixture.targetToken.id],
      distanceFeet: 0,
    })).toMatchObject({ ok: false, reason: 'invalid-target' })
  })
})
