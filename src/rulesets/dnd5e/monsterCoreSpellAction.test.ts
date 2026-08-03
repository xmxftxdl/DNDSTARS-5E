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
import {
  collectDnd5ePersistentAreaTriggers,
  reconcileDnd5ePluginAreasOnMap,
} from './pluginAreas'
import {
  prepareDnd5ePersistentAreaTrigger,
  resolvePreparedDnd5ePersistentAreaTrigger,
} from './pluginAreaTransactions'
import { dnd5eMonsterCoreSpellCompatibility } from './monsterAdvancedAbilities'
import { getDnd5eSrdCombatSpell } from './spells'
import { createDnd5eConditionEffect } from './activeEffects'

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

  it.each([
    ['dryad', 'barkskin'],
    ['deep-gnome-svirfneblin', 'blur'],
    ['archmage', 'fly'],
    ['mage', 'greater-invisibility'],
    ['archmage', 'invisibility'],
    ['druid', 'longstrider'],
    ['mage', 'mage-armor'],
    ['couatl', 'protection-from-poison'],
  ] as const)('casts %s %s through a mechanical monster active-effect transaction', (slug, spellId) => {
    const monster = getDnd5eSrdMonster(`srd-5.1:${slug}`)!
    const listedSpell = monster.spellcasting!.spells!.find((spell) => spell.id === spellId)!
    const actor = token({
      id: slug,
      label: monster.name,
      poolId: monster.id,
      hp: monster.hitPoints.average,
      maxHp: monster.hitPoints.average,
      dnd5eCombatState: {
        monsterSpellSlots: listedSpell.level > 0 && !listedSpell.usage
          ? { [listedSpell.level]: { current: 1, max: 1 } }
          : undefined,
        monsterSpellUsesBySpellId: listedSpell.usage?.kind === 'per-day'
          ? { [spellId]: { current: 1, max: listedSpell.usage.max } }
          : undefined,
      },
    })
    const heroToken = token({
      id: 'hero-token',
      label: '英雄',
      type: 'player',
      characterId: 'hero',
      x: 155,
    })
    const map = battleMap([actor, heroToken])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: `active-effect-${spellId}`,
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: actor.id,
      targetTokenIds: [actor.id],
      spellId,
      slotLevel: listedSpell.level,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: { effectRolls: [] },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    const combatState = resolved.application?.map.tokens.find((entry) => entry.id === actor.id)
      ?.dnd5eCombatState
    const effect = combatState?.activeEffects?.find((entry) => entry.source.rulesId === spellId)
    expect(effect, spellId).toBeDefined()
    if (spellId === 'invisibility') {
      expect(effect).toMatchObject({
        standardCondition: 'invisible',
        breakOn: ['makes-attack', 'casts-spell'],
      })
    }
    if (spellId === 'greater-invisibility') {
      expect(effect).toMatchObject({ standardCondition: 'invisible' })
      expect(effect?.breakOn).toBeUndefined()
    }
    if (spellId === 'fly') expect(effect?.modifiers?.flySpeedFeet).toBe(60)
    if (spellId === 'longstrider') expect(effect?.modifiers?.speedBonusFeet).toBe(10)
    if (listedSpell.usage?.kind !== 'at-will' && listedSpell.level > 0) {
      if (listedSpell.usage?.kind === 'per-day') {
        expect(combatState?.monsterSpellUsesBySpellId?.[spellId]?.current).toBe(0)
      } else {
        expect(combatState?.monsterSpellSlots?.[String(listedSpell.level)]?.current).toBe(0)
      }
    }
    if (getDnd5eSrdCombatSpell(spellId)!.concentration) {
      expect(combatState).toMatchObject({
        concentrationSpellId: spellId,
        concentrationTargetIds: [actor.id],
      })
    }
  })

  it('rejects forged save dice on a monster buff before spending its slot', () => {
    const mage = token({
      id: 'mage',
      label: '法师',
      poolId: 'srd-5.1:mage',
      dnd5eCombatState: {
        monsterSpellSlots: { 3: { current: 1, max: 1 } },
      },
    })
    const heroToken = token({
      id: 'hero-token',
      label: '英雄',
      type: 'player',
      characterId: 'hero',
      x: 155,
    })
    const map = battleMap([mage, heroToken])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'forged-buff-dice',
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: mage.id,
      targetTokenIds: [mage.id],
      spellId: 'fly',
      slotLevel: 3,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: {
        targetSavingThrows: [{ targetId: mage.id, d20: 20 }],
        effectRolls: [],
      },
    })
    expect(resolved.result).toMatchObject({ ok: false, reason: 'invalid-dice' })
    expect(resolved.result.state.combatants[mage.id].classState.monsterSpellSlots?.['3'].current)
      .toBe(1)
  })

  it('settles monster Sleep by current HP while excluding undead targets', () => {
    const nightHag = token({
      id: 'night-hag',
      label: 'Night Hag',
      poolId: 'srd-5.1:night-hag',
      hp: 112,
      maxHp: 112,
      dnd5eCombatState: {
        monsterSpellUsesBySpellId: { sleep: { current: 1, max: 2 } },
      },
    })
    const ally = token({
      id: 'ally',
      label: 'Guard',
      poolId: 'srd-5.1:guard',
      hp: 3,
      maxHp: 11,
      x: 95,
      y: 45,
    })
    const heroToken = token({
      id: 'hero-token',
      label: 'Hero',
      type: 'player',
      characterId: 'hero',
      hp: 5,
      maxHp: 40,
      x: 105,
      y: 45,
    })
    const skeleton = token({
      id: 'skeleton',
      label: 'Skeleton',
      poolId: 'srd-5.1:skeleton',
      hp: 1,
      maxHp: 13,
      x: 115,
      y: 45,
    })
    const map = battleMap([nightHag, ally, heroToken, skeleton])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'monster-sleep',
      map,
      characters: [{ ...character(), currentHp: 5 }],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: nightHag.id,
      targetTokenIds: [ally.id, heroToken.id, skeleton.id],
      areaTargetCell: { col: 10, row: 4 },
      spellId: 'sleep',
      slotLevel: 1,
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: { effectRolls: [[2, 2, 2, 2, 2]] },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    const combatants = resolved.result.state.combatants
    expect(combatants.ally.conditions).toEqual(expect.arrayContaining(['unconscious', 'prone']))
    expect(combatants['hero-token'].conditions).toEqual(expect.arrayContaining(['unconscious', 'prone']))
    expect(combatants.skeleton.conditions).not.toContain('unconscious')
    expect(combatants['night-hag'].classState.monsterSpellUsesBySpellId?.sleep.current).toBe(0)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'sleep-resolved',
      hitPointPool: 10,
      remainingHitPoints: 2,
      affectedTargetIds: ['ally', 'hero-token'],
    }))
  })

  it('uses Lesser Restoration to remove the chosen condition from an allied monster', () => {
    const couatl = token({
      id: 'couatl',
      label: 'Couatl',
      poolId: 'srd-5.1:couatl',
      hp: 97,
      maxHp: 97,
      dnd5eCombatState: {
        monsterSpellUsesBySpellId: { 'lesser-restoration': { current: 1, max: 3 } },
      },
    })
    const ally = token({
      id: 'ally',
      label: 'Guard',
      poolId: 'srd-5.1:guard',
      x: 15,
      dnd5eCombatState: {
        schemaVersion: 2,
        activeEffects: [createDnd5eConditionEffect({
          condition: 'paralyzed',
          source: { kind: 'feature', actorId: 'source', rulesId: 'test-paralysis' },
          targetId: 'ally',
        })],
      },
    })
    const heroToken = token({
      id: 'hero-token',
      label: 'Hero',
      type: 'player',
      characterId: 'hero',
      x: 155,
    })
    const map = battleMap([couatl, ally, heroToken])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'monster-lesser-restoration',
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: couatl.id,
      targetTokenIds: [ally.id],
      spellId: 'lesser-restoration',
      slotLevel: 2,
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: { conditionChoice: 'paralyzed', effectRolls: [] },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.state.combatants.ally.conditions).not.toContain('paralyzed')
    expect(resolved.result.state.combatants.ally.classState.activeEffects ?? [])
      .not.toContainEqual(expect.objectContaining({ standardCondition: 'paralyzed' }))
    expect(resolved.result.state.combatants.couatl.classState
      .monsterSpellUsesBySpellId?.['lesser-restoration'].current).toBe(0)
  })

  it('pushes only a failed Thunderwave save and rejects forged movement before spending a slot', () => {
    const druid = token({
      id: 'druid',
      label: 'Druid',
      poolId: 'srd-5.1:druid',
      dnd5eCombatState: {
        monsterSpellSlots: { 1: { current: 1, max: 1 } },
      },
    })
    const heroToken = token({
      id: 'hero-token',
      label: 'Hero',
      type: 'player',
      characterId: 'hero',
      x: 25,
      y: 5,
    })
    const map = battleMap([druid, heroToken])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'monster-thunderwave',
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: druid.id,
      targetTokenIds: [heroToken.id],
      areaTargetCell: { col: 2, row: 0 },
      spellId: 'thunderwave',
      slotLevel: 1,
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return

    const forged = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: {
        targetSavingThrows: [{ targetId: heroToken.id, d20: 1 }],
        forcedMovements: [{ targetId: heroToken.id, to: { x: 15, y: 5 }, distanceFeet: 5 }],
        effectRolls: [[5, 6]],
      },
    })
    expect(forged.result).toMatchObject({ ok: false, reason: 'invalid-target' })
    expect(forged.result.state.combatants.druid.classState.monsterSpellSlots?.['1'].current).toBe(1)

    const resolved = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: {
        targetSavingThrows: [{ targetId: heroToken.id, d20: 1 }],
        forcedMovements: [{ targetId: heroToken.id, to: { x: 45, y: 5 }, distanceFeet: 10 }],
        effectRolls: [[5, 6]],
      },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.characters[0].currentHp).toBe(29)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === heroToken.id))
      .toMatchObject({ x: 45, y: 5 })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'moved', actorId: heroToken.id, distance: 10,
    }))
    expect(resolved.result.state.combatants.druid.classState.monsterSpellSlots?.['1'].current).toBe(0)

    const geometry = createEmptyMapGeometry(map.id, 1)
    geometry.walls.push({
      id: 'wall-behind-target',
      kind: 'wall',
      label: 'Wall',
      points: [{ x: 30, y: 0 }, { x: 30, y: 20 }],
      blocksVision: true,
      blocksMovement: true,
      blocksLineOfEffect: true,
      baseHeightFeet: 0,
      heightFeet: 10,
      createdAt: 1,
    })
    setMapGeometryRuntime([geometry])
    const blocked = prepareDnd5eMonsterCoreSpell({
      combatId: 'monster-thunderwave-blocked-push',
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: druid.id,
      targetTokenIds: [heroToken.id],
      areaTargetCell: { col: 2, row: 0 },
      spellId: 'thunderwave',
      slotLevel: 1,
    })
    expect(blocked.ok, blocked.ok ? undefined : blocked.reason).toBe(true)
    if (!blocked.ok) return
    const wallStopped = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: blocked.prepared,
      resolution: {
        targetSavingThrows: [{ targetId: heroToken.id, d20: 1 }],
        forcedMovements: [{
          targetId: heroToken.id,
          to: { x: heroToken.x, y: heroToken.y },
          distanceFeet: 0,
        }],
        effectRolls: [[5, 6]],
      },
    })
    expect(wallStopped.result.ok, wallStopped.result.ok ? undefined : wallStopped.result.reason)
      .toBe(true)
    expect(wallStopped.application?.map.tokens.find((entry) => entry.id === heroToken.id))
      .toMatchObject({ x: 25, y: 5 })
  })

  it('casts Insect Plague as a monster, persists its area, and settles creation damage through the shared area transaction', () => {
    const mummyLord = token({
      id: 'mummy-lord',
      label: 'Mummy Lord',
      poolId: 'srd-5.1:mummy-lord',
      hp: 97,
      maxHp: 97,
      dnd5eCombatState: {
        monsterSpellSlots: { 5: { current: 1, max: 1 } },
      },
    })
    const heroToken = token({
      id: 'hero-token',
      label: 'Hero',
      type: 'player',
      characterId: 'hero',
      x: 105,
      y: 5,
    })
    const map = battleMap([mummyLord, heroToken])
    const spell = getDnd5eSrdCombatSpell('insect-plague')!
    expect(dnd5eMonsterCoreSpellCompatibility(spell)).toEqual({ automation: 'full' })
    expect(dnd5eMonsterCoreSpellCompatibility(getDnd5eSrdCombatSpell('cloudkill')!))
      .toMatchObject({ automation: 'manual' })

    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'monster-persistent-area',
      round: 2,
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: mummyLord.id,
      targetTokenIds: [],
      areaTargetCell: { col: 10, row: 0 },
      areaTargetElevationFeet: 0,
      spellId: spell.id,
      slotLevel: 5,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    const cast = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: { effectRolls: [] },
    })
    expect(cast.result.ok, cast.result.ok ? undefined : cast.result.reason).toBe(true)
    expect(cast.createdAreaId).toBeTruthy()
    expect(cast.application?.map.tokens.find((entry) => entry.id === mummyLord.id)?.dnd5eCombatState)
      .toMatchObject({
        concentrationSpellId: 'insect-plague',
        concentrationSpellLevel: 5,
        monsterSpellSlots: { 5: { current: 0, max: 1 } },
      })
    const createdArea = cast.application?.map.dnd5ePluginAreas?.find((area) =>
      area.id === cast.createdAreaId)
    expect(createdArea).toMatchObject({
      sourceTokenId: mummyLord.id,
      coreSpellId: 'insect-plague',
      concentrationId: 'insect-plague',
      movementCostMultiplier: 2,
    })
    if (!cast.application || !createdArea) return
    expect(reconcileDnd5ePluginAreasOnMap(
      cast.application.map,
      cast.application.characters,
      2,
    ).dnd5ePluginAreas).toHaveLength(1)

    const candidate = collectDnd5ePersistentAreaTriggers({
      map: cast.application.map,
      timing: 'on-create',
      round: 2,
      areaId: createdArea.id,
      turnKey: '2:mummy-lord',
    }).find((entry) => entry.targetToken.id === heroToken.id)
    expect(candidate).toBeDefined()
    if (!candidate) return
    const trigger = prepareDnd5ePersistentAreaTrigger({
      combatId: 'monster-persistent-area',
      round: 2,
      map: cast.application.map,
      characters: cast.application.characters,
      initiativeOrder: initiative(map.tokens),
      candidate,
    })
    expect(trigger.ok).toBe(true)
    if (!trigger.ok) return
    const settled = resolvePreparedDnd5ePersistentAreaTrigger({
      prepared: trigger.prepared,
      d20: 1,
      damageRolls: [1, 1, 1, 1],
    })
    expect(settled.result.ok, settled.result.ok ? undefined : settled.result.reason).toBe(true)
    expect(settled.application?.characters[0].currentHp).toBe(36)
    expect(settled.application?.map.dnd5ePluginAreas?.[0].triggerReceipts).toHaveLength(1)
  })

  it('plans a monster persistent area as a placement transaction without instant target IDs', () => {
    const mummyLord = token({
      id: 'mummy-lord',
      label: 'Mummy Lord',
      poolId: 'srd-5.1:mummy-lord',
      hp: 97,
      maxHp: 97,
      dnd5eCombatState: {
        monsterSpellSlots: { 5: { current: 1, max: 1 } },
      },
    })
    const first = token({
      id: 'hero-one', type: 'player', characterId: 'hero', x: 105, y: 45,
    })
    const second = token({
      id: 'hero-two', type: 'player', x: 115, y: 45,
    })
    const plan = planDnd5eMonsterTurn(
      battleMap([mummyLord, first, second]),
      mummyLord,
      [character()],
      {
        decisionProvider: {
          id: 'test:prefer-insect-plague',
          schemaVersion: 1,
          scoreCandidate(_context, candidate) {
            return {
              candidateId: candidate.id,
              score: candidate.id.includes(':insect-plague:') ? 10_000 : -10_000,
              reasons: [],
            }
          },
        },
      },
    )
    expect(plan.spellCast).toMatchObject({
      spellId: 'insect-plague',
      targetTokenIds: [],
      areaTargetCell: expect.any(Object),
      effect: 'persistent-area',
    })
    expect(plan.decision?.metrics).toMatchObject({
      affectedEnemyCount: 2,
      affectedAllyCount: 0,
    })
  })

  it('applies monster Hold Person with concentration and a repeat save', () => {
    const fanatic = token({
      id: 'fanatic',
      label: 'Cult Fanatic',
      poolId: 'srd-5.1:cult-fanatic',
      dnd5eCombatState: {
        monsterSpellSlots: { 2: { current: 1, max: 1 } },
      },
    })
    const heroToken = token({
      id: 'hero-token', label: 'Hero', type: 'player', characterId: 'hero', x: 35,
    })
    const map = battleMap([fanatic, heroToken])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'monster-hold-person',
      map,
      characters: [character()],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: fanatic.id,
      targetTokenIds: [heroToken.id],
      spellId: 'hold-person',
      slotLevel: 2,
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: {
        targetSavingThrows: [{ targetId: heroToken.id, d20: 1 }],
        effectRolls: [],
      },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.state.combatants.fanatic.classState).toMatchObject({
      concentrationSpellId: 'hold-person',
      concentrationTargetIds: [heroToken.id],
      monsterSpellSlots: { 2: { current: 0, max: 1 } },
    })
    expect(resolved.result.state.combatants[heroToken.id].classState.activeEffects)
      .toContainEqual(expect.objectContaining({
        standardCondition: 'paralyzed',
        source: expect.objectContaining({ actorId: fanatic.id, rulesId: 'hold-person' }),
        repeatSave: expect.objectContaining({ ability: 'wis', timing: 'target-turn-end' }),
      }))
  })

  it('rejects Hold Person against a non-humanoid before spending its slot', () => {
    const fanatic = token({
      id: 'fanatic', poolId: 'srd-5.1:cult-fanatic',
      dnd5eCombatState: { monsterSpellSlots: { 2: { current: 1, max: 1 } } },
    })
    const wolf = token({ id: 'wolf', poolId: 'srd-5.1:wolf', x: 35 })
    const map = battleMap([fanatic, wolf])
    expect(prepareDnd5eMonsterCoreSpell({
      combatId: 'monster-hold-person-invalid',
      map,
      characters: [],
      initiativeOrder: initiative(map.tokens),
      actorTokenId: fanatic.id,
      targetTokenIds: [wolf.id],
      spellId: 'hold-person',
      slotLevel: 2,
    })).toMatchObject({ ok: false, reason: 'invalid-target' })
    expect(fanatic.dnd5eCombatState?.monsterSpellSlots?.['2'].current).toBe(1)
  })

  it('applies monster Banishment only after a failed save', () => {
    const archmage = token({
      id: 'archmage', poolId: 'srd-5.1:archmage', hp: 99, maxHp: 99,
      dnd5eCombatState: { monsterSpellSlots: { 4: { current: 1, max: 1 } } },
    })
    const heroToken = token({
      id: 'hero-token', type: 'player', characterId: 'hero', x: 35,
    })
    const map = battleMap([archmage, heroToken])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'monster-banishment', map, characters: [character()],
      initiativeOrder: initiative(map.tokens), actorTokenId: archmage.id,
      targetTokenIds: [heroToken.id], spellId: 'banishment', slotLevel: 4,
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: {
        targetSavingThrows: [{ targetId: heroToken.id, d20: 1 }],
        effectRolls: [],
      },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.state.combatants.archmage.classState.concentrationSpellId)
      .toBe('banishment')
    expect(resolved.result.state.combatants[heroToken.id].conditions)
      .toEqual(expect.arrayContaining(['banished', 'incapacitated']))
  })

  it('uses the actual active-effect slot level for monster Dispel Magic checks', () => {
    const sphinx = token({
      id: 'sphinx', poolId: 'srd-5.1:androsphinx', hp: 199, maxHp: 199,
      dnd5eCombatState: { monsterSpellSlots: { 3: { current: 1, max: 1 } } },
    })
    const held = createDnd5eConditionEffect({
      condition: 'paralyzed',
      source: {
        kind: 'spell', actorId: 'enemy-caster', rulesId: 'hold-person', spellLevel: 4,
      },
      targetId: 'hero-token',
    })
    const hero = {
      ...character(),
      dnd5eCombatState: { schemaVersion: 2 as const, activeEffects: [held] },
    }
    const heroToken = token({
      id: 'hero-token', type: 'player', characterId: hero.id, x: 35,
    })
    const map = battleMap([sphinx, heroToken])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'monster-dispel-magic', map, characters: [hero],
      initiativeOrder: initiative(map.tokens), actorTokenId: sphinx.id,
      targetTokenIds: [heroToken.id], spellId: 'dispel-magic', slotLevel: 3,
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: {
        dispelMagicChecks: [{ effectId: held.id, d20: 20 }],
        effectRolls: [],
      },
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'spell-dispelled', spellId: 'hold-person', spellLevel: 4,
      dc: 14, success: true,
    }))
    expect(resolved.application?.characters[0].dnd5eCombatState?.activeEffects ?? [])
      .not.toContainEqual(expect.objectContaining({ id: held.id }))
  })

  it('casts Entangle as a ground area and delegates its creation save to the shared trigger', () => {
    const druid = token({
      id: 'druid', poolId: 'srd-5.1:druid',
      dnd5eCombatState: { monsterSpellSlots: { 1: { current: 1, max: 1 } } },
    })
    const heroToken = token({
      id: 'hero-token', type: 'player', characterId: 'hero', x: 45, y: 5,
    })
    const map = battleMap([druid, heroToken])
    const prepared = prepareDnd5eMonsterCoreSpell({
      combatId: 'monster-entangle', round: 1, map, characters: [character()],
      initiativeOrder: initiative(map.tokens), actorTokenId: druid.id,
      targetTokenIds: [], areaTargetCell: { col: 4, row: 0 },
      spellId: 'entangle', slotLevel: 1,
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return
    const cast = resolvePreparedDnd5eMonsterCoreSpell({
      prepared: prepared.prepared,
      resolution: { effectRolls: [] },
    })
    expect(cast.result.ok, cast.result.ok ? undefined : cast.result.reason).toBe(true)
    const area = cast.application?.map.dnd5ePluginAreas?.find((entry) =>
      entry.id === cast.createdAreaId)
    expect(area).toMatchObject({
      coreSpellId: 'entangle',
      vertical: { mode: 'ground' },
      movementCostMultiplier: 2,
      concentrationId: 'entangle',
    })
    if (!cast.application || !area) return
    const candidate = collectDnd5ePersistentAreaTriggers({
      map: cast.application.map,
      timing: 'on-create', round: 1, areaId: area.id, turnKey: '1:druid',
    }).find((entry) => entry.targetToken.id === heroToken.id)
    expect(candidate).toBeDefined()
    if (!candidate) return
    const trigger = prepareDnd5ePersistentAreaTrigger({
      combatId: 'monster-entangle', round: 1, map: cast.application.map,
      characters: cast.application.characters, initiativeOrder: initiative(map.tokens), candidate,
    })
    expect(trigger.ok).toBe(true)
    if (!trigger.ok) return
    const settled = resolvePreparedDnd5ePersistentAreaTrigger({
      prepared: trigger.prepared,
      d20: 1,
      damageRolls: [],
    })
    expect(settled.result.ok, settled.result.ok ? undefined : settled.result.reason).toBe(true)
    expect(settled.result.state.combatants[heroToken.id].conditions).toContain('restrained')
  })
})
