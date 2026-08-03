import { describe, expect, it } from 'vitest'
import { cellsForAoe } from '../../lib/skillTargeting'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  createDnd5eCoreSpellArea,
  getDnd5eCoreSpellAreaDeclaration,
} from './coreSpellAreas'
import { auditDnd5eMonsterHeadlessCoverage } from './monsterHeadlessCoverage'
import {
  collectDnd5ePersistentAreaTriggers,
  dnd5ePersistentAreaDifficultTerrainMultiplierAt,
} from './pluginAreas'
import {
  prepareDnd5ePersistentAreaTrigger,
  resolvePreparedDnd5ePersistentAreaTrigger,
} from './pluginAreaTransactions'
import { dnd5eSpellbookEntries } from './spellbook'
import { getDnd5eSrdCombatSpell } from './spells'

function character(patch: Partial<Character> = {}): Character {
  return {
    id: 'caster', name: '施法者', player: '', avatar: '', accent: '', race: '人类', charClass: '法师', level: 10,
    background: '', experience: 0, reputation: 0,
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    savingThrows: [], skills: [], maxHp: 100, currentHp: 100, tempHp: 0, hitDice: '10d6',
    ac: 10, speed: 30, initiativeBonus: 0, saveDC: 16, passivePerception: 10, inspiration: 0,
    conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    ...patch,
  }
}

function token(patch: Partial<Token>): Token {
  return {
    id: 'token', label: 'Token', x: 25, y: 25, color: '#fff', emoji: '', size: 1,
    type: 'player', hp: 100, maxHp: 100,
    ...patch,
  }
}

describe('combat-impacting persistent spell batch', () => {
  it('adds structured definitions without claiming unsupported rules are fully automated', () => {
    expect(getDnd5eSrdCombatSpell('insect-plague')).toMatchObject({
      effect: 'persistent-area', saveAbility: 'con', damageOnSuccessfulSave: 'half',
      dice: { count: 4, sides: 10, perHigherSlot: 1 }, damageType: 'piercing',
      concentration: true,
      area: { shape: 'circle', radiusFeet: 20, placeRangeFeet: 300 },
    })
    expect(getDnd5eSrdCombatSpell('cloudkill')).toMatchObject({
      effect: 'persistent-area', saveAbility: 'con', damageOnSuccessfulSave: 'half',
      dice: { count: 5, sides: 8, perHigherSlot: 1 }, damageType: 'poison',
      concentration: true,
    })
    expect(getDnd5eSrdCombatSpell('blade-barrier')).toMatchObject({
      effect: 'persistent-area', saveAbility: 'dex', damageOnSuccessfulSave: 'half',
      dice: { count: 6, sides: 10 }, damageType: 'slashing',
      concentration: true,
    })

    const spellbook = new Map(dnd5eSpellbookEntries([]).map((entry) => [entry.id, entry]))
    for (const spellId of ['insect-plague', 'cloudkill', 'blade-barrier']) {
      expect(spellbook.get(spellId)).toMatchObject({
        headless: true,
        automationLevel: 'partial',
        catalogOnly: false,
      })
      expect(spellbook.get(spellId)?.automationReason).toBeTruthy()
    }

    const occurrences = auditDnd5eMonsterHeadlessCoverage().spells.occurrences
      .filter((row) => ['insect-plague', 'cloudkill', 'blade-barrier'].includes(row.spellId))
    expect(occurrences).toHaveLength(5)
    expect(occurrences.every((row) => row.definition === 'present')).toBe(true)
    expect(occurrences.filter((row) => row.spellId === 'cloudkill')
      .every((row) => row.compatibility === 'manual')).toBe(true)
    expect(occurrences.filter((row) => row.spellId !== 'cloudkill')
      .every((row) => row.compatibility === 'full')).toBe(true)
  })

  it('declares upcast damage, shared per-turn frequency, difficult terrain, and vertical volumes', () => {
    const insectPlague = getDnd5eCoreSpellAreaDeclaration('insect-plague')!
    const cloudkill = getDnd5eCoreSpellAreaDeclaration('cloudkill')!
    const bladeBarrier = getDnd5eCoreSpellAreaDeclaration('blade-barrier')!

    const insectArea = createDnd5eCoreSpellArea({
      declaration: insectPlague,
      actionId: 'insect-plague-cast', sourceCharacterId: 'caster', sourceTokenId: 'caster-token',
      slotLevel: 7, sourceSaveDc: 16, round: 1,
      cells: [{ col: 1, row: 0 }], anchorCell: { col: 1, row: 0 }, baseElevationFeet: 30,
    })
    expect(insectArea).toMatchObject({
      movementCostMultiplier: 2,
      vertical: { mode: 'volume', baseElevationFeet: 10, heightFeet: 40, anchorOffsetFeet: -20 },
      triggers: [
        {
          id: 'insect-plague-create',
          damage: { count: 6, sides: 10, type: 'piercing' },
          savingThrow: { ability: 'con', dc: 16, onSuccess: 'half' },
        },
        {
          id: 'insect-plague-enter', frequencyGroupId: 'insect-plague-damage', oncePerTurn: true,
          damage: { count: 6, sides: 10, type: 'piercing' },
          savingThrow: { ability: 'con', dc: 16, onSuccess: 'half' },
        },
        {
          id: 'insect-plague-turn-end', frequencyGroupId: 'insect-plague-damage', oncePerTurn: true,
          damage: { count: 6, sides: 10, type: 'piercing' },
        },
      ],
    })

    const cloudArea = createDnd5eCoreSpellArea({
      declaration: cloudkill,
      actionId: 'cloudkill-cast', sourceCharacterId: 'caster', sourceTokenId: 'caster-token',
      slotLevel: 7, sourceSaveDc: 16, round: 1,
      cells: [{ col: 1, row: 0 }], anchorCell: { col: 1, row: 0 }, baseElevationFeet: 20,
    })
    expect(cloudArea.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'cloudkill-enter', frequencyGroupId: 'cloudkill-damage',
        damage: { count: 7, sides: 8, modifier: 0, type: 'poison' },
      }),
      expect.objectContaining({
        id: 'cloudkill-turn-start', frequencyGroupId: 'cloudkill-damage',
        damage: { count: 7, sides: 8, modifier: 0, type: 'poison' },
      }),
    ]))

    const bladeArea = createDnd5eCoreSpellArea({
      declaration: bladeBarrier,
      actionId: 'blade-barrier-cast', sourceCharacterId: 'caster', sourceTokenId: 'caster-token',
      slotLevel: 6, sourceSaveDc: 16, round: 1,
      cells: [{ col: 1, row: 0 }], anchorCell: { col: 1, row: 0 }, baseElevationFeet: 0,
    })
    expect(bladeArea).toMatchObject({
      movementCostMultiplier: 2,
      vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 20 },
      triggers: [
        {
          id: 'blade-barrier-create',
          damage: { count: 6, sides: 10, type: 'slashing' },
          savingThrow: { ability: 'dex', dc: 16, onSuccess: 'half' },
        },
        expect.anything(),
        expect.anything(),
      ],
    })
    expect(bladeArea.triggers?.every((trigger) =>
      trigger.damage?.count === 6 && trigger.damage.sides === 10 && trigger.damage.type === 'slashing',
    )).toBe(true)
  })

  it('settles Insect Plague creation damage through the authoritative area transaction', () => {
    const area = createDnd5eCoreSpellArea({
      declaration: getDnd5eCoreSpellAreaDeclaration('insect-plague')!,
      actionId: 'insect-plague-cast', sourceCharacterId: 'caster', sourceTokenId: 'caster-token',
      slotLevel: 7, sourceSaveDc: 16, round: 1,
      cells: [{ col: 1, row: 0 }], anchorCell: { col: 1, row: 0 }, baseElevationFeet: 20,
    })
    const casterToken = token({ id: 'caster-token', characterId: 'caster', x: 25, y: 25 })
    const targetToken = token({ id: 'target-token', characterId: 'target', x: 75, y: 25 })
    const map: BattleMap = {
      id: 'insect-map', name: 'Insect Map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [casterToken, targetToken], dnd5ePluginAreas: [area],
    }
    const characters = [
      character({
        id: 'caster', concentrating: true,
        dnd5eCombatState: { concentrationSpellId: 'insect-plague' },
      }),
      character({ id: 'target', name: '目标', currentHp: 100, maxHp: 100 }),
    ]
    const candidate = collectDnd5ePersistentAreaTriggers({
      map, timing: 'on-create', round: 1, areaId: area.id, turnKey: '1:caster-token',
    }).find((entry) => entry.targetToken.id === targetToken.id)
    expect(candidate).toBeDefined()
    if (!candidate) return

    const prepared = prepareDnd5ePersistentAreaTrigger({
      combatId: 'insect-combat', round: 1, map, characters,
      initiativeOrder: [
        { tokenId: casterToken.id, roll: 15, label: '施法者', emoji: '', color: '#fff', slotId: 'caster-slot' },
        { tokenId: targetToken.id, roll: 10, label: '目标', emoji: '', color: '#fff', slotId: 'target-slot' },
      ],
      candidate,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5ePersistentAreaTrigger({
      prepared: prepared.prepared,
      d20: 20,
      damageRolls: [10, 10, 10, 10, 10, 10],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'persistent-area-triggered', triggerId: 'insect-plague-create',
      saveSuccess: true, damage: 30,
    }))
    expect(resolved.application?.characters.find((entry) => entry.id === 'target')?.currentHp).toBe(70)
  })

  it('settles Cloudkill through the authoritative area transaction with half damage on a successful save', () => {
    const declaration = getDnd5eCoreSpellAreaDeclaration('cloudkill')!
    const area = createDnd5eCoreSpellArea({
      declaration,
      actionId: 'cloudkill-cast', sourceCharacterId: 'caster', sourceTokenId: 'caster-token',
      slotLevel: 5, sourceSaveDc: 16, round: 1,
      cells: [{ col: 1, row: 0 }], anchorCell: { col: 1, row: 0 }, baseElevationFeet: 0,
    })
    const casterToken = token({ id: 'caster-token', characterId: 'caster', x: 25, y: 25 })
    const targetToken = token({ id: 'target-token', characterId: 'target', x: 75, y: 25 })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [casterToken, targetToken], dnd5ePluginAreas: [area],
    }
    const characters = [
      character({
        id: 'caster', concentrating: true,
        dnd5eCombatState: { concentrationSpellId: 'cloudkill' },
      }),
      character({ id: 'target', name: '目标', currentHp: 100, maxHp: 100 }),
    ]
    const candidate = collectDnd5ePersistentAreaTriggers({
      map, timing: 'turn-start', round: 2, targetTokenId: targetToken.id,
      turnKey: '2:target-token',
    })[0]
    expect(candidate).toBeDefined()
    if (!candidate) return
    const prepared = prepareDnd5ePersistentAreaTrigger({
      combatId: 'combat', round: 2, map, characters,
      initiativeOrder: [
        { tokenId: casterToken.id, roll: 15, label: '施法者', emoji: '', color: '#fff', slotId: 'caster-slot' },
        { tokenId: targetToken.id, roll: 10, label: '目标', emoji: '', color: '#fff', slotId: 'target-slot' },
      ],
      candidate,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5ePersistentAreaTrigger({
      prepared: prepared.prepared,
      d20: 20,
      damageRolls: [8, 8, 8, 8, 8],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'persistent-area-triggered', saveSuccess: true, damage: 20,
    }))
    expect(resolved.application?.characters.find((entry) => entry.id === 'target')?.currentHp).toBe(80)
    expect(resolved.application?.map.dnd5ePluginAreas?.[0].triggerReceipts).toHaveLength(1)
    expect(dnd5ePersistentAreaDifficultTerrainMultiplierAt({
      map: { ...map, dnd5ePluginAreas: [area] }, token: targetToken, position: targetToken,
    })).toBe(1)
  })

  it('prepares and settles Flaming Sphere turn-end damage against Magic Resistance with advantage', () => {
    const area = createDnd5eCoreSpellArea({
      declaration: getDnd5eCoreSpellAreaDeclaration('flaming-sphere')!,
      actionId: 'flaming-sphere-cast', sourceCharacterId: 'caster', sourceTokenId: 'caster-token',
      slotLevel: 3, sourceSaveDc: 18, round: 1,
      cells: [{ col: 1, row: 0 }], anchorCell: { col: 1, row: 0 }, baseElevationFeet: 0,
    })
    const casterToken = token({ id: 'caster-token', characterId: 'caster', x: 25, y: 25 })
    const targetToken = token({
      id: 'flesh-golem-token', label: '血肉魔像', type: 'enemy', characterId: undefined,
      poolId: 'srd-5.1:flesh-golem', x: 75, y: 25, hp: 93, maxHp: 93,
    })
    const map: BattleMap = {
      id: 'flaming-sphere-map', name: 'Flaming Sphere Map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [casterToken, targetToken], dnd5ePluginAreas: [area],
    }
    const characters = [character({
      id: 'caster', concentrating: true,
      dnd5eCombatState: { concentrationSpellId: 'flaming-sphere', concentrationSpellLevel: 3 },
    })]
    const candidate = collectDnd5ePersistentAreaTriggers({
      map, timing: 'turn-end', round: 1, targetTokenId: targetToken.id,
      turnKey: '1:flesh-golem-token',
    })[0]
    expect(candidate).toBeDefined()
    const prepared = prepareDnd5ePersistentAreaTrigger({
      combatId: 'flaming-sphere-combat', round: 1, map, characters,
      initiativeOrder: [
        { tokenId: casterToken.id, roll: 15, label: '施法者', emoji: '', color: '#fff', slotId: 'caster-slot' },
        { tokenId: targetToken.id, roll: 10, label: '血肉魔像', emoji: '', color: '#fff', slotId: 'golem-slot' },
      ],
      candidate,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.save?.mode).toBe('advantage')

    const missingAdvantageDie = resolvePreparedDnd5ePersistentAreaTrigger({
      prepared: prepared.prepared,
      d20: 2,
      damageRolls: [6, 6, 6],
    })
    expect(missingAdvantageDie.result).toMatchObject({ ok: false, reason: 'invalid-dice' })

    const resolved = resolvePreparedDnd5ePersistentAreaTrigger({
      prepared: prepared.prepared,
      d20: 2,
      d20Second: 20,
      damageRolls: [6, 6, 6],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'persistent-area-triggered', triggerId: 'flaming-sphere-turn-end',
      saveSuccess: true, damage: 9,
    }))
    expect(resolved.application?.map.tokens.find((entry) => entry.id === targetToken.id)?.hp).toBe(84)
    expect(resolved.application?.map.dnd5ePluginAreas?.[0].triggerReceipts).toHaveLength(1)
  })

  it('automatically settles 2d6 Flaming Sphere damage when a character ends its turn within 5 feet', () => {
    const declaration = getDnd5eCoreSpellAreaDeclaration('flaming-sphere')!
    const anchorCell = { col: 2, row: 2 }
    const area = createDnd5eCoreSpellArea({
      declaration,
      actionId: 'flaming-sphere-level-2-cast',
      sourceCharacterId: 'caster',
      sourceTokenId: 'caster-token',
      slotLevel: 2,
      sourceSaveDc: 16,
      round: 1,
      cells: cellsForAoe(declaration.template, anchorCell, anchorCell),
      anchorCell,
      baseElevationFeet: 0,
    })
    const turnEndTrigger = area.triggers?.find((trigger) =>
      trigger.id === 'flaming-sphere-turn-end')
    expect(turnEndTrigger).toMatchObject({
      timing: 'turn-end',
      damage: { count: 2, sides: 6, modifier: 0, type: 'fire' },
      savingThrow: { ability: 'dex', dc: 16, onSuccess: 'half' },
    })
    // A fully structured core-spell trigger must not stop the automatic turn
    // transaction to wait indefinitely for a separate DM adjudication window.
    expect(turnEndTrigger?.dmAdjustable).not.toBe(true)

    const casterToken = token({
      id: 'caster-token', characterId: 'caster', x: 25, y: 125,
    })
    const adjacentToken = token({
      id: 'adjacent-token', characterId: 'adjacent', x: 175, y: 125,
    })
    const outsideToken = token({
      id: 'outside-token', characterId: 'outside', x: 225, y: 125,
    })
    const map: BattleMap = {
      id: 'flaming-sphere-character-map',
      name: 'Flaming Sphere Character Map',
      width: 500,
      height: 500,
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [casterToken, adjacentToken, outsideToken],
      dnd5ePluginAreas: [area],
    }
    const characters = [
      character({
        id: 'caster',
        concentrating: true,
        dnd5eCombatState: {
          concentrationSpellId: 'flaming-sphere',
          concentrationSpellLevel: 2,
        },
      }),
      character({ id: 'adjacent', name: 'Adjacent', currentHp: 100, maxHp: 100 }),
      character({ id: 'outside', name: 'Outside', currentHp: 100, maxHp: 100 }),
    ]
    const turnKey = '1:adjacent-token'
    const candidates = collectDnd5ePersistentAreaTriggers({
      map,
      timing: 'turn-end',
      round: 1,
      targetTokenId: adjacentToken.id,
      turnKey,
    })
    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({
      targetToken: { id: adjacentToken.id },
      trigger: { id: 'flaming-sphere-turn-end' },
      turnKey,
    })
    expect(collectDnd5ePersistentAreaTriggers({
      map,
      timing: 'turn-end',
      round: 1,
      targetTokenId: outsideToken.id,
      turnKey: '1:outside-token',
    })).toHaveLength(0)

    const initiativeOrder = [
      { tokenId: casterToken.id, roll: 15, label: 'Caster', emoji: '', color: '#fff', slotId: 'caster-slot' },
      { tokenId: adjacentToken.id, roll: 10, label: 'Adjacent', emoji: '', color: '#fff', slotId: 'adjacent-slot' },
      { tokenId: outsideToken.id, roll: 5, label: 'Outside', emoji: '', color: '#fff', slotId: 'outside-slot' },
    ]
    const prepared = prepareDnd5ePersistentAreaTrigger({
      combatId: 'flaming-sphere-character-combat',
      round: 1,
      map,
      characters,
      initiativeOrder,
      candidate: candidates[0],
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5ePersistentAreaTrigger({
      prepared: prepared.prepared,
      d20: 20,
      damageRolls: [6, 6],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'persistent-area-triggered',
      targetId: adjacentToken.id,
      triggerId: 'flaming-sphere-turn-end',
      saveSuccess: true,
      damage: 6,
    }))
    expect(resolved.application?.characters.find((entry) => entry.id === 'adjacent')?.currentHp)
      .toBe(94)
    expect(resolved.application?.characters.find((entry) => entry.id === 'outside')?.currentHp)
      .toBe(100)
  })
})
