import { afterEach, describe, expect, it } from 'vitest'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  dnd5eAvailableMonsterSpellSlotLevels,
  prepareDnd5eMonsterCoreSpell,
  resolvePreparedDnd5eMonsterCoreSpell,
} from './monsterCoreSpellAction'
import {
  prepareDnd5eMonsterAreaAction,
  resolvePreparedDnd5eMonsterAreaAction,
} from './monsterAreaAction'
import { planDnd5eMonsterTurn } from './monsterTurnPlanner'
import { getDnd5eSrdMonster } from './monsters'

function token(patch: Partial<Token>): Token {
  return {
    id: 'token',
    label: 'Token',
    x: 5,
    y: 5,
    color: '',
    emoji: '',
    size: 1,
    type: 'enemy',
    hp: 40,
    maxHp: 40,
    ...patch,
  }
}

function character(): Character {
  return {
    id: 'hero',
    name: '英雄',
    player: 'P1',
    avatar: '',
    accent: '',
    race: '',
    charClass: '战士',
    level: 5,
    background: '',
    experience: 0,
    reputation: 0,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
    savingThrows: ['str', 'con'],
    skills: [],
    maxHp: 40,
    currentHp: 40,
    tempHp: 0,
    hitDice: '5d10',
    ac: 14,
    speed: 30,
    initiativeBonus: 2,
    saveDC: 10,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
  }
}

function battleMap(tokens: Token[]): BattleMap {
  return {
    id: 'map',
    name: 'Map',
    width: 200,
    height: 100,
    gridSize: 10,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    feetPerCell: 5,
    tokens,
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

describe('monster core spell map action', () => {
  afterEach(() => setMapGeometryRuntime([]))

  it('prepares and resolves a listed SRD spell through the authoritative map snapshot', () => {
    const mage = token({
      id: 'mage',
      label: '法师',
      poolId: 'srd-5.1:mage',
      dnd5eCombatState: { monsterSpellSlots: {} },
    })
    const heroToken = token({
      id: 'hero-token',
      label: '英雄',
      type: 'player',
      characterId: 'hero',
      x: 35,
    })
    const map = battleMap([mage, heroToken])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'combat',
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: mage.id,
      targetTokenIds: [heroToken.id],
      spellId: 'fire-bolt',
      slotLevel: 0,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      diceCount: 2,
      spellAttackMode: 'normal',
    })

    const resolved = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: {
        d20: 15,
        effectRolls: [[5, 6]],
      },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.characters[0].currentHp).toBe(29)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'monster-core-spell-resolved',
      spellId: 'fire-bolt',
    }))
  })

  it('derives an adult black dragon breath target set from map cells and rejects a partial client submission', () => {
    const dragon = token({
      id: 'dragon', label: '成年黑龙', poolId: 'srd-5.1:adult-black-dragon',
      hp: 195, maxHp: 195,
      dnd5eCombatState: { monsterRechargeReadyByActionId: { 'acid-breath': true } },
    })
    const first = token({
      id: 'first', label: '第一名英雄', type: 'player', characterId: 'first-character', x: 45, y: 5,
    })
    const second = token({
      id: 'second', label: '第二名英雄', type: 'player', characterId: 'second-character', x: 85, y: 5,
    })
    const battle = battleMap([dragon, first, second])
    const characters = [
      { ...character(), id: 'first-character', name: '第一名英雄', currentHp: 120, maxHp: 120 },
      { ...character(), id: 'second-character', name: '第二名英雄', currentHp: 120, maxHp: 120 },
    ]
    const plan = planDnd5eMonsterTurn(battle, dragon, characters)
    expect(plan.areaAction).toMatchObject({ actionId: 'acid-breath' })
    if (!plan.areaAction) return

    const prepared = prepareDnd5eMonsterAreaAction({
      combatId: 'acid-map',
      map: battle,
      characters,
      initiativeOrder: initiative(battle.tokens),
      actorTokenId: dragon.id,
      actionId: plan.areaAction.actionId,
      targetTokenIds: plan.areaAction.targetTokenIds,
      areaTargetCell: plan.areaAction.areaTargetCell,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetTokens.map((target) => target.id)).toEqual(expect.arrayContaining([first.id, second.id]))
    const settled = resolvePreparedDnd5eMonsterAreaAction({
      prepared: prepared.prepared,
      resolution: {
        targetSavingThrows: prepared.prepared.targetTokens.map((target) => ({ targetId: target.id, d20: 1 })),
        damageRolls: Array.from({ length: 12 }, () => 1),
      },
    })
    expect(settled.result.ok, settled.result.ok ? undefined : settled.result.reason).toBe(true)
    expect(settled.application?.characters).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'first-character', currentHp: 108 }),
      expect.objectContaining({ id: 'second-character', currentHp: 108 }),
    ]))
    expect(prepareDnd5eMonsterAreaAction({
      combatId: 'acid-map',
      map: battle,
      characters,
      initiativeOrder: initiative(battle.tokens),
      actorTokenId: dragon.id,
      actionId: plan.areaAction.actionId,
      targetTokenIds: [first.id],
      areaTargetCell: plan.areaAction.areaTargetCell,
    })).toMatchObject({ ok: false, reason: 'invalid-target' })
  })

  it('prepares Magic Missile and applies its repeated projectile targets through the map bridge', () => {
    const mage = token({
      id: 'mage',
      label: '法师',
      poolId: 'srd-5.1:mage',
      dnd5eCombatState: {
        monsterSpellSlots: { 1: { current: 1, max: 1 } },
      },
    })
    const heroToken = token({
      id: 'hero-token',
      label: '英雄',
      type: 'player',
      characterId: 'hero',
      x: 35,
    })
    const map = battleMap([mage, heroToken])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'magic-missile-map',
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: mage.id,
      targetTokenIds: [heroToken.id],
      spellId: 'magic-missile',
      slotLevel: 1,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: {
        projectileTargetIds: [heroToken.id, heroToken.id, heroToken.id],
        effectRolls: [[4], [3], [2]],
      },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.characters[0].currentHp).toBe(28)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === mage.id)
      ?.dnd5eCombatState?.monsterSpellSlots?.['1'].current).toBe(0)
  })

  it('prepares and resolves a monster Misty Step into a visible unoccupied cell', () => {
    const mage = token({
      id: 'mage',
      label: '法师',
      poolId: 'srd-5.1:mage',
      dnd5eCombatState: {
        monsterSpellSlots: { 2: { current: 1, max: 1 } },
      },
    })
    const heroToken = token({
      id: 'hero-token',
      label: '英雄',
      type: 'player',
      characterId: 'hero',
      x: 85,
    })
    const map = battleMap([mage, heroToken])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'monster-misty-step',
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: mage.id,
      targetTokenIds: [],
      areaTargetCell: { col: 4, row: 0 },
      spellId: 'misty-step',
      slotLevel: 2,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: { effectRolls: [] },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === mage.id))
      .toMatchObject({ x: 45, y: 5 })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'teleported',
      actorId: mage.id,
      spellId: 'misty-step',
      distanceFeet: 20,
    }))
    expect(resolved.application?.map.tokens.find((entry) => entry.id === mage.id)
      ?.dnd5eCombatState?.monsterSpellSlots?.['2'].current).toBe(0)
  })

  it('prepares and resolves a monster Charm Person with combat advantage and per-day usage', () => {
    const lamia = token({
      id: 'lamia',
      label: '拉米亚',
      poolId: 'srd-5.1:lamia',
      dnd5eCombatState: {
        monsterSpellUsesBySpellId: {
          'charm-person': { current: 3, max: 3 },
        },
      },
    })
    const heroToken = token({
      id: 'hero-token',
      label: '英雄',
      type: 'player',
      characterId: 'hero',
      x: 35,
    })
    const map = battleMap([lamia, heroToken])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'monster-charm-person',
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: lamia.id,
      targetTokenIds: [heroToken.id],
      spellId: 'charm-person',
      slotLevel: 1,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: {
        targetSavingThrows: [{
          targetId: heroToken.id,
          d20: 1,
          d20Second: 2,
        }],
        effectRolls: [],
      },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved',
      targetId: heroToken.id,
      d20: 2,
      success: false,
    }))
    expect(resolved.result.state.combatants[heroToken.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({
        standardCondition: 'charmed',
        source: expect.objectContaining({ actorId: lamia.id, rulesId: 'charm-person' }),
        duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
      }),
    )
    expect(resolved.application?.map.tokens.find((entry) => entry.id === lamia.id)
      ?.dnd5eCombatState?.monsterSpellUsesBySpellId?.['charm-person'].current).toBe(2)
  })

  it('rejects a spell when a wall blocks line of effect', () => {
    const mage = token({ id: 'mage', poolId: 'srd-5.1:mage' })
    const heroToken = token({
      id: 'hero-token',
      type: 'player',
      characterId: 'hero',
      x: 35,
    })
    const map = battleMap([mage, heroToken])
    const geometry = createEmptyMapGeometry(map.id, 1)
    geometry.walls.push({
      id: 'wall',
      kind: 'wall',
      label: 'Wall',
      points: [{ x: 20, y: 0 }, { x: 20, y: 20 }],
      material: 'stone',
      blocksVision: true,
      blocksMovement: true,
      blocksLineOfEffect: true,
      baseHeightFeet: 0,
      heightFeet: 10,
      createdAt: 1,
    })
    setMapGeometryRuntime([geometry])

    expect(prepareDnd5eMonsterCoreSpell({
      combatId: 'combat',
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: mage.id,
      targetTokenIds: [heroToken.id],
      spellId: 'fire-bolt',
      slotLevel: 0,
    })).toMatchObject({ ok: false, reason: 'line-of-effect-blocked' })
  })

  it('puts safe monster spells in the same tactical candidate pool as weapon attacks', () => {
    const mage = token({ id: 'mage', label: '法师', poolId: 'srd-5.1:mage' })
    const heroToken = token({
      id: 'hero-token',
      label: '英雄',
      type: 'player',
      characterId: 'hero',
      x: 65,
    })
    const plan = planDnd5eMonsterTurn(
      battleMap([mage, heroToken]),
      mage,
      [character()],
    )

    expect(plan).toMatchObject({
      attacked: false,
      attackerTokenId: mage.id,
      targetTokenId: heroToken.id,
      spellCast: {
        spellId: 'magic-missile',
        slotLevel: 5,
        targetTokenIds: [heroToken.id],
        projectileTargetIds: Array.from({ length: 7 }, () => heroToken.id),
      },
      decision: {
        providerId: 'dnd5e:deterministic-tactical-v3',
      },
    })
  })

  it('selects a safe fireball placement that covers clustered hostiles and is revalidated by the Host', () => {
    const mage = token({
      id: 'mage',
      label: '法师',
      poolId: 'srd-5.1:mage',
      dnd5eCombatState: {
        monsterSpellSlots: {
          '3': { current: 1, max: 1 },
        },
      },
    })
    const first = token({
      id: 'hero-one',
      label: '英雄一',
      type: 'player',
      characterId: 'hero',
      x: 105,
      y: 45,
    })
    const second = token({
      id: 'hero-two',
      label: '英雄二',
      type: 'player',
      x: 115,
      y: 45,
    })
    const map = battleMap([mage, first, second])
    const plan = planDnd5eMonsterTurn(map, mage, [character()])
    expect(plan.spellCast).toMatchObject({
      spellId: 'fireball',
      targetTokenIds: expect.arrayContaining([first.id, second.id]),
      area: { shape: 'circle', radiusFeet: 20 },
      areaTargetCell: expect.any(Object),
    })

    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'combat',
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: mage.id,
      targetTokenIds: plan.spellCast!.targetTokenIds,
      areaTargetCell: plan.spellCast!.areaTargetCell,
      spellId: plan.spellCast!.spellId,
      slotLevel: plan.spellCast!.slotLevel,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) throw new Error('expected fireball to prepare')
    const settled = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: {
        targetSavingThrows: prepared.prepared.targetTokens.map((target) => ({
          targetId: target.id,
          d20: 1,
        })),
        effectRolls: [Array.from({ length: 8 }, () => 6)],
      },
    })
    expect(settled.result.ok).toBe(true)
    expect(settled.result.state.combatants[first.id].currentHp).toBe(0)
    expect(settled.result.state.combatants[second.id].currentHp).toBe(0)
    expect(prepareDnd5eMonsterCoreSpell({
      combatId: 'combat',
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: mage.id,
      targetTokenIds: [first.id],
      areaTargetCell: plan.spellCast!.areaTargetCell,
      spellId: plan.spellCast!.spellId,
      slotLevel: plan.spellCast!.slotLevel,
    })).toMatchObject({ ok: false, reason: 'invalid-target' })
  })

  it('uses a healing spell when an allied monster is badly wounded', () => {
    const acolyte = token({
      id: 'acolyte',
      label: '侍僧',
      poolId: 'srd-5.1:acolyte',
      hp: 1,
      maxHp: 9,
    })
    const heroToken = token({
      id: 'hero-token',
      label: '英雄',
      type: 'player',
      characterId: 'hero',
      x: 25,
    })
    const statBlock = getDnd5eSrdMonster(acolyte.poolId!)!
    const cureWounds = statBlock.spellcasting!.spells!.find((spell) => spell.id === 'cure-wounds')!
    expect(dnd5eAvailableMonsterSpellSlotLevels({
      monster: statBlock,
      token: acolyte,
      spell: cureWounds,
    })).toEqual([1])
    const plan = planDnd5eMonsterTurn(
      battleMap([acolyte, heroToken]),
      acolyte,
      [character()],
    )
    expect(plan).toMatchObject({
      attacked: false,
      targetTokenId: acolyte.id,
      spellCast: {
        spellId: 'cure-wounds',
        targetTokenIds: [acolyte.id],
      },
    })
    const map = battleMap([acolyte, heroToken])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'healing-combat',
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: acolyte.id,
      targetTokenIds: [acolyte.id],
      spellId: 'cure-wounds',
      slotLevel: 1,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: { effectRolls: [[5]] },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === acolyte.id)?.hp).toBe(8)
  })
})
