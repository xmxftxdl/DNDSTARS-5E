import { describe, expect, it } from 'vitest'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { DND5E_FIGHTER_STARTING_EQUIPMENT, DND5E_QUARTERSTAFF } from './equipment'
import { createDnd5eConditionEffect } from './activeEffects'
import {
  findDnd5eOpportunityAttackersForMove,
  dnd5eOpportunityAttackClassDamageDefinitions,
  prepareDnd5eOpportunityAttack,
  previewDnd5eOpportunityAttack,
  resolvePreparedDnd5eOpportunityAttack,
} from './opportunityAttackAction'
import { registerDnd5eRulesPlugin } from './pluginApi'

function hero(): Character {
  return {
    id: 'hero', name: '英雄', player: 'P1', avatar: '', accent: '', race: '人类', charClass: '战士', level: 3,
    background: '', experience: 0, reputation: 0, rulesetId: 'dnd5e-2014-srd-5.1',
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }, savingThrows: [], skills: [],
    maxHp: 30, currentHp: 30, tempHp: 0, hitDice: '3d10', ac: 16, speed: 30, initiativeBonus: 1,
    saveDC: 0, passivePerception: 10, inspiration: 0, 
    conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
  }
}

function fixture() {
  const character = hero()
  const map: BattleMap = {
    id: 'map', name: '地图', width: 200, height: 100, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0,
    showGrid: true, feetPerCell: 5,
    tokens: [
      { id: 'kobold', label: '狗头人', poolId: 'srd-5.1:kobold', x: 5, y: 5, color: '', emoji: '', size: 1, type: 'enemy', hp: 5, maxHp: 5 },
      { id: 'hero-token', label: '英雄', characterId: 'hero', x: 15, y: 5, color: '', emoji: '', size: 1, type: 'player', hp: 30, maxHp: 30 },
    ],
  }
  const initiativeOrder = [
    { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
    { tokenId: 'kobold', label: '狗头人', emoji: '', color: '', roll: 10 },
  ]
  return { character, map, initiativeOrder }
}

describe('D&D 5e opportunity attack bridge', () => {
  it('detects leaving reach from reaction availability rather than AP', () => {
    const { character, map } = fixture()
    expect(findDnd5eOpportunityAttackersForMove({
      map,
      characters: [character],
      movingToken: map.tokens[1],
      to: { x: 45, y: 5 },
      turnEconomyByToken: {},
    }).map((token) => token.id)).toEqual(['kobold'])
  })

  it('suppresses opportunity attacks from creatures the Mobile owner attacked in melee this turn', () => {
    const pluginId = 'local.test.mobile-feat'
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId, name: 'Mobile Feat Test', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerFeat({
          id: 'mobile', name: 'Mobile', summary: 'Synthetic feat.', description: 'Synthetic feat.',
          automation: 'partial', automationReasons: ['One movement rule remains manual.'],
          staticModifiers: { preventOpportunityAttacksFromMeleeAttackTargets: true },
        })
      },
    })
    try {
      const { character, map, initiativeOrder } = fixture()
      const mobile = {
        ...character,
        dnd5eFeatIds: [`${pluginId}:mobile`],
        dnd5eCombatState: { meleeAttackTargetIdsThisTurn: ['kobold'] },
      }
      expect(findDnd5eOpportunityAttackersForMove({
        map, characters: [mobile], movingToken: map.tokens[1], to: { x: 45, y: 5 },
        turnEconomyByToken: {},
      })).toEqual([])
      expect(prepareDnd5eOpportunityAttack({
        combatId: 'combat', map, characters: [mobile], initiativeOrder,
        actorTokenId: 'kobold', targetTokenId: 'hero-token',
        turnEconomy: createDnd5eTurnEconomyCounts('kobold-turn', 30),
      })).toEqual({ ok: false, reason: 'invalid-target' })
    } finally {
      dispose()
    }
  })

  it('uses a registered weapon whitelist to detect entering reach', () => {
    const pluginId = 'local.test.polearm-feat'
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId, name: 'Polearm Feat Test', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerFeat({
          id: 'polearm-master', name: 'Polearm Master', summary: 'Synthetic feat.',
          description: 'Synthetic feat.', automation: 'full',
          staticModifiers: { opportunityAttacksOnEnterReachWeaponIds: ['dnd5e-quarterstaff'] },
        })
      },
    })
    try {
      const { character, map } = fixture()
      const polearmUser: Character = {
        ...character,
        equipment: { mainWeapon: DND5E_QUARTERSTAFF },
        dnd5eFeatIds: [`${pluginId}:polearm-master`],
      }
      map.tokens[0] = { ...map.tokens[0], x: 45 }
      expect(findDnd5eOpportunityAttackersForMove({
        map,
        characters: [polearmUser],
        movingToken: map.tokens[0],
        to: { x: 25, y: 5 },
        path: [{ x: 45, y: 5 }, { x: 35, y: 5 }, { x: 25, y: 5 }],
        turnEconomyByToken: {},
      }).map((token) => token.id)).toEqual(['hero-token'])
    } finally {
      dispose()
    }
  })

  it('lets Sentinel ignore Disengage and stops movement on a qualifying hit', () => {
    const pluginId = 'local.test.sentinel-feat'
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId, name: 'Sentinel Feat Test', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerFeat({
          id: 'sentinel', name: 'Sentinel', summary: 'Synthetic feat.',
          description: 'Synthetic feat.', automation: 'full',
          staticModifiers: {
            opportunityAttacksIgnoreDisengage: true,
            opportunityAttackHitStopsMovement: true,
          },
        })
      },
    })
    try {
      const { character, map, initiativeOrder } = fixture()
      const sentinel: Character = {
        ...character,
        equipment: DND5E_FIGHTER_STARTING_EQUIPMENT,
        dnd5eFeatIds: [`${pluginId}:sentinel`],
      }
      map.tokens[0] = { ...map.tokens[0], x: 25 }
      expect(findDnd5eOpportunityAttackersForMove({
        map,
        characters: [sentinel],
        movingToken: map.tokens[0],
        to: { x: 45, y: 5 },
        path: [{ x: 25, y: 5 }, { x: 35, y: 5 }, { x: 45, y: 5 }],
        turnEconomyByToken: {},
        disengaged: true,
      }).map((token) => token.id)).toEqual(['hero-token'])

      const prepared = prepareDnd5eOpportunityAttack({
        combatId: 'combat', round: 1, map, characters: [sentinel], initiativeOrder,
        actorTokenId: 'hero-token', targetTokenId: 'kobold',
        turnEconomy: createDnd5eTurnEconomyCounts('sentinel-turn', 30),
      })
      expect(prepared.ok).toBe(true)
      if (!prepared.ok) return
      const resolved = resolvePreparedDnd5eOpportunityAttack({
        prepared: prepared.prepared, d20: 20, damageRolls: [4, 4],
      })
      expect(resolved.result.ok).toBe(true)
      if (!resolved.result.ok) return
      expect(resolved.result.state.combatants.kobold.turn.movementRemaining).toBe(0)
      expect(resolved.result.state.combatants.kobold.classState.movementStoppedTurnKey)
        .toBe('combat:1:kobold')
    } finally {
      dispose()
    }
  })

  it('spends a reaction in the 5e Headless engine and leaves legacy AP untouched', () => {
    const { character, map, initiativeOrder } = fixture()
    const prepared = prepareDnd5eOpportunityAttack({
      combatId: 'combat', map, characters: [character], initiativeOrder,
      actorTokenId: 'kobold', targetTokenId: 'hero-token',
      turnEconomy: createDnd5eTurnEconomyCounts('kobold-turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eOpportunityAttack({ prepared: prepared.prepared, d20: 20, damageRolls: [2, 3] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({ type: 'turn-resource-spent', resource: 'reaction' }))
    expect(resolved.application?.characters[0].currentHp).toBeLessThan(30)
  })

  it('does not treat an expanded critical miss as a preview hit', () => {
    const { character, map, initiativeOrder } = fixture()
    const prepared = prepareDnd5eOpportunityAttack({
      combatId: 'combat', map, characters: [character], initiativeOrder,
      actorTokenId: 'kobold', targetTokenId: 'hero-token',
      turnEconomy: createDnd5eTurnEconomyCounts('kobold-turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    prepared.prepared.criticalThreshold = 19
    prepared.prepared.targetArmorClass = 30
    const preview = previewDnd5eOpportunityAttack(prepared.prepared, 19)
    expect(preview.hit).toBe(false)
    expect(preview.critical).toBe(false)
  })

  it('forces disadvantage on opportunity attacks against a Hunter with Escape the Horde', () => {
    const { character, map, initiativeOrder } = fixture()
    const ranger: Character = {
      ...character,
      charClass: '游侠',
      level: 7,
      dnd5eClassChoices: {
        classes: { ranger: { subclass: 'hunter', selections: { 'defensive-tactics': ['escape-the-horde'] } } },
      },
    }
    const prepared = prepareDnd5eOpportunityAttack({
      combatId: 'combat', map, characters: [ranger], initiativeOrder,
      actorTokenId: 'kobold', targetTokenId: 'hero-token',
      turnEconomy: createDnd5eTurnEconomyCounts('kobold-turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.attackMode).toBe('disadvantage')
    expect(previewDnd5eOpportunityAttack(prepared.prepared, 20, 2).hit).toBe(false)
    const resolved = resolvePreparedDnd5eOpportunityAttack({
      prepared: prepared.prepared, d20: 20, d20Second: 2, damageRolls: [],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].currentHp).toBe(30)
  })

  it('includes the attacker condition disadvantage while preparing an opportunity attack', () => {
    const { character, map, initiativeOrder } = fixture()
    map.tokens[0].dnd5eCombatState = {
      schemaVersion: 2,
      activeEffects: [createDnd5eConditionEffect({
        condition: 'poisoned', targetId: 'kobold',
        source: { kind: 'dm', label: 'DM 裁定' }, appliedAt: 1,
      })],
    }
    const prepared = prepareDnd5eOpportunityAttack({
      combatId: 'combat', map, characters: [character], initiativeOrder,
      actorTokenId: 'kobold', targetTokenId: 'hero-token',
      turnEconomy: createDnd5eTurnEconomyCounts('kobold-turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.attackMode).toBe('disadvantage')
  })

  it('prepares Berserker Retaliation only for a level-14 Berserker in melee reach', () => {
    const { character, map, initiativeOrder } = fixture()
    const berserker: Character = {
      ...character,
      charClass: '野蛮人',
      level: 14,
      equipment: DND5E_FIGHTER_STARTING_EQUIPMENT,
      dnd5eClassChoices: { classes: { barbarian: { subclass: 'berserker', selections: {} } } },
      dnd5eCombatState: {
        berserkerRetaliationTrigger: { sourceId: 'kobold', round: 1 },
      },
    }
    const prepared = prepareDnd5eOpportunityAttack({
      combatId: 'combat', round: 1, map, characters: [berserker], initiativeOrder,
      actorTokenId: 'hero-token', targetTokenId: 'kobold',
      turnEconomy: createDnd5eTurnEconomyCounts('berserker-turn', 30),
      reactionFeature: 'berserker-retaliation',
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.reactionFeature).toBe('berserker-retaliation')
    const resolved = resolvePreparedDnd5eOpportunityAttack({
      prepared: prepared.prepared, d20: 15, damageRolls: [5],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent', actorId: 'hero-token', resource: 'reaction',
    }))

    const invalid = prepareDnd5eOpportunityAttack({
      combatId: 'combat', map, characters: [character], initiativeOrder,
      actorTokenId: 'hero-token', targetTokenId: 'kobold',
      turnEconomy: createDnd5eTurnEconomyCounts('fighter-turn', 30),
      reactionFeature: 'berserker-retaliation',
    })
    expect(invalid).toEqual({ ok: false, reason: 'invalid-actor' })
  })

  it('prepares Hunter Giant Killer only when the Hunter selected it', () => {
    const { character, map, initiativeOrder } = fixture()
    const hunter: Character = {
      ...character,
      charClass: '游侠',
      level: 3,
      equipment: DND5E_FIGHTER_STARTING_EQUIPMENT,
      dnd5eClassChoices: {
        classes: { ranger: { subclass: 'hunter', selections: { 'hunters-prey': ['giant-killer'] } } },
      },
    }
    const prepared = prepareDnd5eOpportunityAttack({
      combatId: 'combat', map, characters: [hunter], initiativeOrder,
      actorTokenId: 'hero-token', targetTokenId: 'kobold',
      turnEconomy: createDnd5eTurnEconomyCounts('hunter-turn', 30),
      reactionFeature: 'hunter-giant-killer',
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.reactionFeature).toBe('hunter-giant-killer')
    const resolved = resolvePreparedDnd5eOpportunityAttack({ prepared: prepared.prepared, d20: 15, damageRolls: [5] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual({
      type: 'turn-resource-spent', actorId: 'hero-token', resource: 'reaction',
    })

    const invalid = prepareDnd5eOpportunityAttack({
      combatId: 'combat', map, characters: [{ ...hunter, dnd5eClassChoices: { classes: { ranger: { subclass: 'hunter', selections: {} } } } }], initiativeOrder,
      actorTokenId: 'hero-token', targetTokenId: 'kobold',
      turnEconomy: createDnd5eTurnEconomyCounts('hunter-turn', 30),
      reactionFeature: 'hunter-giant-killer',
    })
    expect(invalid).toEqual({ ok: false, reason: 'invalid-actor' })
  })

  it('carries Divine Favor through the player opportunity-attack authority bridge', () => {
    const { character, map, initiativeOrder } = fixture()
    const paladin: Character = {
      ...character,
      charClass: '圣武士',
      level: 2,
      equipment: DND5E_FIGHTER_STARTING_EQUIPMENT,
      dnd5eClassChoices: {
        classes: { paladin: { selections: { 'spell-prepared': ['divine-favor'] } } },
      },
      concentrating: true,
      dnd5eCombatState: {
        schemaVersion: 2,
        concentrationSpellId: 'divine-favor',
        concentrationTargetIds: ['hero-token'],
        concentrationEffectsBySource: { 'hero-token': 'divine-favor' },
      },
    }
    const prepared = prepareDnd5eOpportunityAttack({
      combatId: 'combat', map, characters: [paladin], initiativeOrder,
      actorTokenId: 'hero-token', targetTokenId: 'kobold',
      turnEconomy: createDnd5eTurnEconomyCounts('paladin-turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(dnd5eOpportunityAttackClassDamageDefinitions(prepared.prepared, false)).toContainEqual({
      source: 'divine-favor', count: 1, sides: 4, type: 'radiant', doubleOnCritical: true,
    })
    const resolved = resolvePreparedDnd5eOpportunityAttack({
      prepared: prepared.prepared,
      d20: 15,
      damageRolls: [1],
      classDamageRolls: [{ source: 'divine-favor', rolls: [4] }],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual({
      type: 'class-damage-applied', actorId: 'hero-token', targetId: 'kobold',
      source: 'divine-favor', amount: 4,
    })
  })
})
