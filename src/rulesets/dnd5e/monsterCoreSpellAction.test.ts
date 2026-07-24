import { afterEach, describe, expect, it } from 'vitest'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  dnd5eAvailableMonsterSpellSlotLevels,
  prepareDnd5eMonsterCoreSpell,
  resolvePreparedDnd5eMonsterCoreSpell,
} from './monsterCoreSpellAction'
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
    const mage = token({ id: 'mage', label: '法师', poolId: 'srd-5.1:mage' })
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
        spellId: 'fire-bolt',
        slotLevel: 0,
        targetTokenIds: [heroToken.id],
      },
      decision: {
        providerId: 'dnd5e:deterministic-tactical-v3',
      },
    })
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
