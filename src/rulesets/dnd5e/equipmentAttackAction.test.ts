import { describe, expect, it } from 'vitest'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { DND5E_FIGHTER_STARTING_EQUIPMENT, DND5E_LONGBOW, DND5E_OFFHAND_SHORTSWORD, DND5E_SHORTSWORD, defaultEquipmentForDnd5eCharacter } from './equipment'
import {
  dnd5eEquipmentClassDamageDefinitions,
  prepareDnd5eEquipmentAttack,
  previewDnd5eEquipmentAttack,
  resolvePreparedDnd5eEquipmentAttack,
} from './equipmentAttackAction'
import { createDnd5eTurnEconomyCounts, spendDnd5eTurnResource } from './turnEconomy'

function fighter(): Character {
  return {
    id: 'fighter', name: '战士', player: '', avatar: '', accent: '', race: '人类', charClass: '战士', level: 5, background: '士兵', experience: 6500, reputation: 0,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }, savingThrows: ['str', 'con'], skills: ['athletics'], maxHp: 44, currentHp: 44, tempHp: 0, hitDice: '1d10', ac: 10, speed: 30, initiativeBonus: 0,
    saveDC: 10, passivePerception: 10, inspiration: 0, conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    equipment: DND5E_FIGHTER_STARTING_EQUIPMENT,
  }
}

function token(patch: Partial<Token>): Token {
  return { id: 'token', label: 'Token', x: 25, y: 25, color: '', emoji: '', size: 1, type: 'enemy', hp: 20, maxHp: 20, ...patch }
}

function fixture(targetX = 75) {
  const actor = fighter()
  const actorToken = token({ id: 'fighter-token', type: 'player', characterId: actor.id, label: actor.name })
  const targetToken = token({ id: 'enemy-token', label: '哥布林', x: targetX })
  const map: BattleMap = { id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [actorToken, targetToken] }
  const action: SharedPlayerActionState = { id: 'action', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending', type: 'dnd5e-weapon-attack', actorTokenId: actorToken.id, characterId: actor.id, targetTokenId: targetToken.id, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1 }
  const initiativeOrder = [
    { tokenId: actorToken.id, label: actor.name, emoji: '', color: '', roll: 20 },
    { tokenId: targetToken.id, label: targetToken.label, emoji: '', color: '', roll: 10 },
  ]
  return { actor, actorToken, targetToken, map, action, initiativeOrder }
}

describe('D&D 5e equipment attack authority', () => {
  it('validates range and resolves equipment damage through the 5e headless engine', () => {
    const input = fixture()
    const prepared = prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ distanceFeet: 5, attackNumber: 1, attacksAllowed: 2, targetArmorClass: 10, spendsAction: true })
    expect(previewDnd5eEquipmentAttack(prepared.prepared, 15)).toMatchObject({ hit: true, critical: false })
    const resolved = resolvePreparedDnd5eEquipmentAttack({ prepared: prepared.prepared, d20: 15, damageRolls: [5] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((item) => item.id === input.targetToken.id)?.hp).toBe(12)
  })

  it('grants half cover from an intervening creature and accepts a DM-only one-attack override', () => {
    const input = fixture(225)
    input.actor.equipment = { mainWeapon: DND5E_LONGBOW }
    input.map.tokens.push(token({ id: 'intervening-creature', type: 'player', x: 125, y: 25 }))
    const automatic = prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 0 })
    expect(automatic.ok).toBe(true)
    if (!automatic.ok) return
    expect(automatic.prepared).toMatchObject({
      targetArmorClass: 12,
      cover: { cover: 'half', armorClassBonus: 2, overriddenByDm: false },
    })

    const dmOverride = prepareDnd5eEquipmentAttack({
      ...input,
      action: {
        ...input.action,
        sourceMode: 'dm',
        dnd5eWeaponAttackOptions: { coverOverride: 'none' },
      },
      characters: [input.actor],
      attacksUsed: 0,
    })
    expect(dmOverride.ok).toBe(true)
    if (!dmOverride.ok) return
    expect(dmOverride.prepared).toMatchObject({
      targetArmorClass: 10,
      cover: { cover: 'none', armorClassBonus: 0, overriddenByDm: true },
    })
  })

  it('rejects a player request that forges a DM cover override', () => {
    const input = fixture()
    expect(prepareDnd5eEquipmentAttack({
      ...input,
      action: { ...input.action, dnd5eWeaponAttackOptions: { coverOverride: 'total' } },
      characters: [input.actor],
      attacksUsed: 0,
    })).toEqual({ ok: false, reason: 'invalid-action' })
  })

  it('accepts a trusted DM-host override while settling a player request', () => {
    const input = fixture()
    const prepared = prepareDnd5eEquipmentAttack({
      ...input,
      dmCoverOverride: 'three-quarters',
      characters: [input.actor],
      attacksUsed: 0,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      targetArmorClass: 15,
      cover: { cover: 'three-quarters', armorClassBonus: 5, overriddenByDm: true },
    })
  })

  it('rejects out-of-range melee targets and a spent Attack action', () => {
    const distant = fixture(175)
    expect(prepareDnd5eEquipmentAttack({ ...distant, characters: [distant.actor], attacksUsed: 0 })).toEqual({ ok: false, reason: 'target-out-of-range' })
    const adjacent = fixture()
    expect(prepareDnd5eEquipmentAttack({ ...adjacent, characters: [adjacent.actor], attacksUsed: 2 })).toEqual({ ok: false, reason: 'attack-action-spent' })
  })

  it('allows long-range weapon attacks with disadvantage and rejects targets beyond long range', () => {
    const longRange = fixture(2025)
    longRange.actor.equipment = { mainWeapon: DND5E_LONGBOW }
    const prepared = prepareDnd5eEquipmentAttack({ ...longRange, characters: [longRange.actor], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ distanceFeet: 200, attackMode: 'disadvantage' })

    const beyondLongRange = fixture(6075)
    beyondLongRange.actor.equipment = { mainWeapon: DND5E_LONGBOW }
    expect(prepareDnd5eEquipmentAttack({
      ...beyondLongRange,
      characters: [beyondLongRange.actor],
      attacksUsed: 0,
    })).toEqual({ ok: false, reason: 'target-out-of-range' })
  })

  it('applies disadvantage to a ranged weapon attack while a hostile creature is within 5 feet', () => {
    const input = fixture(775)
    input.actor.equipment = { mainWeapon: DND5E_LONGBOW }
    input.map.tokens.push(token({ id: 'adjacent-enemy', type: 'enemy', x: 75, y: 25 }))
    const prepared = prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.attackMode).toBe('disadvantage')
  })

  it('prepares two d20s when an allied Help marker grants attack advantage', () => {
    const input = fixture()
    const helper = token({ id: 'helper-token', type: 'player', x: 75, y: 75 })
    input.targetToken.dnd5eCombatState = {
      helpedAttackSourceId: helper.id,
      helpedAttackSourceTurnKey: '1:helper-token',
    }
    input.map.tokens.push(helper)
    input.initiativeOrder.push({
      tokenId: helper.id, label: helper.label, emoji: '', color: '', roll: 5,
    })
    const prepared = prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.attackMode).toBe('advantage')
  })

  it('grants a second full Attack action after Action Surge', () => {
    const input = fixture()
    const prepared = prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 2, attackActionsAvailable: 2 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ attackNumber: 3, attacksAllowed: 4 })
  })

  it('spends an action only on the first attack of each Attack action', () => {
    const input = fixture()
    const noAction = spendDnd5eTurnResource(createDnd5eTurnEconomyCounts('turn'), 'action').economy
    expect(prepareDnd5eEquipmentAttack({
      ...input,
      characters: [input.actor],
      attacksUsed: 0,
      turnEconomy: noAction,
    })).toEqual({ ok: false, reason: 'attack-action-spent' })

    const extraAttack = prepareDnd5eEquipmentAttack({
      ...input,
      characters: [input.actor],
      attacksUsed: 1,
      turnEconomy: noAction,
    })
    expect(extraAttack.ok).toBe(true)
    if (!extraAttack.ok) return
    expect(extraAttack.prepared.spendsAction).toBe(false)
    expect(resolvePreparedDnd5eEquipmentAttack({
      prepared: extraAttack.prepared,
      d20: 15,
      damageRolls: [5],
    }).result.ok).toBe(true)
  })

  it('allows one light off-hand attack as a bonus action after taking the Attack action', () => {
    const input = fixture()
    const dualWielder: Character = {
      ...input.actor,
      equipment: { mainWeapon: DND5E_SHORTSWORD, offHand: DND5E_OFFHAND_SHORTSWORD },
      dnd5eClassChoices: { fighter: { fightingStyles: ['two-weapon-fighting'] } },
    }
    const first = prepareDnd5eEquipmentAttack({
      ...input, characters: [dualWielder], attacksUsed: 0,
      turnEconomy: createDnd5eTurnEconomyCounts('turn'),
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const firstResolved = resolvePreparedDnd5eEquipmentAttack({ prepared: first.prepared, d20: 15, damageRolls: [3] })
    expect(firstResolved.result.ok).toBe(true)
    const saved = firstResolved.application?.characters[0]
    expect(saved?.dnd5eCombatState?.weaponAttackActionTurnKey).toBe('combat:1:fighter-token')
    if (!saved || !firstResolved.application) return

    const offHandAction: SharedPlayerActionState = {
      ...input.action,
      id: 'off-hand-action',
      dnd5eWeaponAttackOptions: { offHandAttack: true },
    }
    const offHand = prepareDnd5eEquipmentAttack({
      ...input,
      action: offHandAction,
      map: firstResolved.application.map,
      characters: [saved],
      attacksUsed: 1,
      turnEconomy: createDnd5eTurnEconomyCounts('turn'),
    })
    expect(offHand.ok).toBe(true)
    if (!offHand.ok) return
    expect(offHand.prepared).toMatchObject({
      offHandAttack: true, spendsAction: false, spendsBonusAction: true, countsTowardAttackAction: false,
      profile: { weaponName: '短剑', damage: { bonus: 3 } },
    })
    const resolved = resolvePreparedDnd5eEquipmentAttack({ prepared: offHand.prepared, d20: 15, damageRolls: [2] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual({
      type: 'turn-resource-spent', actorId: 'fighter-token', resource: 'bonusAction',
    })
  })

  it('uses the same authoritative weapon path for another SRD class', () => {
    const input = fixture()
    const rogue = {
      ...input.actor,
      charClass: '游荡者',
      equipment: defaultEquipmentForDnd5eCharacter({ charClass: '游荡者' }),
    }
    const prepared = prepareDnd5eEquipmentAttack({ ...input, characters: [rogue], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ actor: { charClass: '游荡者' }, attacksAllowed: 1 })
  })

  it('applies Rogue Sneak Attack once per turn and persists the use marker', () => {
    const input = fixture()
    const rogue: Character = {
      ...input.actor,
      charClass: '游荡者',
      level: 5,
      equipment: defaultEquipmentForDnd5eCharacter({ charClass: '游荡者' }),
    }
    const ally = token({ id: 'ally-token', type: 'player', label: '盟友', x: 75, y: 75 })
    const map = { ...input.map, tokens: [...input.map.tokens, ally] }
    const initiativeOrder = [...input.initiativeOrder, { tokenId: ally.id, label: ally.label, emoji: '', color: '', roll: 5 }]
    const prepared = prepareDnd5eEquipmentAttack({ ...input, map, initiativeOrder, characters: [rogue], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(dnd5eEquipmentClassDamageDefinitions(prepared.prepared, false)).toEqual([
      { source: 'sneak-attack', count: 3, sides: 6, type: 'piercing', doubleOnCritical: true },
    ])
    const resolved = resolvePreparedDnd5eEquipmentAttack({
      prepared: prepared.prepared,
      d20: 15,
      damageRolls: [5],
      classDamageRolls: [{ source: 'sneak-attack', rolls: [1, 2, 3] }],
    })
    expect(resolved.result.ok).toBe(true)
    const savedRogue = resolved.application?.characters.find((character) => character.id === rogue.id)
    expect(savedRogue?.dnd5eCombatState?.sneakAttackTurnKey).toBe('combat:1:fighter-token')
    if (!savedRogue || !resolved.application) return
    const second = prepareDnd5eEquipmentAttack({
      ...input,
      map: resolved.application.map,
      initiativeOrder,
      characters: [savedRogue],
      attacksUsed: 1,
      attackActionsAvailable: 2,
    })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(dnd5eEquipmentClassDamageDefinitions(second.prepared, false)).toEqual([])

    const nextRound = prepareDnd5eEquipmentAttack({
      ...input,
      action: { ...input.action, round: 2 },
      map: resolved.application.map,
      initiativeOrder,
      characters: [savedRogue],
      attacksUsed: 0,
    })
    expect(nextRound.ok).toBe(true)
    if (!nextRound.ok) return
    expect(dnd5eEquipmentClassDamageDefinitions(nextRound.prepared, false))
      .toContainEqual(expect.objectContaining({ source: 'sneak-attack', count: 3 }))
  })

  it('adds Hunter Colossus Slayer only against an already wounded target', () => {
    const input = fixture()
    const ranger: Character = {
      ...input.actor,
      charClass: '游侠',
      level: 3,
      equipment: defaultEquipmentForDnd5eCharacter({ charClass: '游侠' }),
      dnd5eClassChoices: {
        classes: { ranger: { subclass: 'hunter', selections: { 'hunters-prey': ['colossus-slayer'] } } },
      },
    }
    const woundedTarget = { ...input.targetToken, hp: 10, maxHp: 20 }
    const map = { ...input.map, tokens: [input.actorToken, woundedTarget] }
    const prepared = prepareDnd5eEquipmentAttack({ ...input, map, characters: [ranger], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(dnd5eEquipmentClassDamageDefinitions(prepared.prepared, false)).toEqual([
      { source: 'colossus-slayer', count: 1, sides: 8, type: 'piercing', doubleOnCritical: true },
    ])
  })

  it('adds the correct number of Brutal Critical weapon dice without doubling them again', () => {
    const input = fixture()
    const barbarian: Character = {
      ...input.actor,
      charClass: '野蛮人',
      level: 13,
      equipment: defaultEquipmentForDnd5eCharacter({ charClass: '野蛮人' }),
    }
    const prepared = prepareDnd5eEquipmentAttack({ ...input, characters: [barbarian], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(dnd5eEquipmentClassDamageDefinitions(prepared.prepared, true)).toContainEqual({
      source: 'brutal-critical', count: 2, sides: 12, type: 'slashing', doubleOnCritical: false,
    })
  })

  it('applies Improved Divine Smite and optional Divine Smite, spending the slot only on a hit', () => {
    const input = fixture()
    const paladin: Character = {
      ...input.actor,
      charClass: '圣武士',
      level: 11,
      equipment: defaultEquipmentForDnd5eCharacter({ charClass: '圣武士' }),
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    }
    const undeadTarget = { ...input.targetToken, poolId: 'srd-5.1:skeleton', hp: 50, maxHp: 50 }
    const map = { ...input.map, tokens: [input.actorToken, undeadTarget] }
    const action = { ...input.action, dnd5eWeaponAttackOptions: { divineSmiteSlotLevel: 2 } }
    const prepared = prepareDnd5eEquipmentAttack({ ...input, action, map, characters: [paladin], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(dnd5eEquipmentClassDamageDefinitions(prepared.prepared, false)).toEqual([
      { source: 'improved-divine-smite', count: 1, sides: 8, type: 'radiant', doubleOnCritical: true },
      { source: 'divine-smite', count: 4, sides: 8, type: 'radiant', doubleOnCritical: true },
    ])
    const hit = resolvePreparedDnd5eEquipmentAttack({
      prepared: prepared.prepared,
      d20: 15,
      damageRolls: [5],
      classDamageRolls: [
        { source: 'improved-divine-smite', rolls: [4] },
        { source: 'divine-smite', rolls: [1, 2, 3, 4] },
      ],
    })
    expect(hit.result.ok).toBe(true)
    expect(hit.application?.characters[0].classResources?.['dnd5e-spell-slot-2']?.current).toBe(0)

    const miss = resolvePreparedDnd5eEquipmentAttack({ prepared: prepared.prepared, d20: 1, damageRolls: [] })
    expect(miss.result.ok).toBe(true)
    expect(miss.application?.characters[0].classResources?.['dnd5e-spell-slot-2']?.current).toBe(1)
  })

  it('rejects a Divine Smite request from a non-paladin', () => {
    const input = fixture()
    const action = { ...input.action, dnd5eWeaponAttackOptions: { divineSmiteSlotLevel: 1 } }
    expect(prepareDnd5eEquipmentAttack({ ...input, action, characters: [input.actor], attacksUsed: 0 }))
      .toEqual({ ok: false, reason: 'divine-smite-unavailable' })
  })

  it('authoritatively applies Reckless Attack to the first and subsequent Strength melee attacks this turn', () => {
    const input = fixture()
    const barbarian: Character = {
      ...input.actor,
      charClass: '野蛮人',
      level: 5,
      equipment: defaultEquipmentForDnd5eCharacter({ charClass: '野蛮人' }),
    }
    const action = { ...input.action, dnd5eWeaponAttackOptions: { recklessAttack: true } }
    const prepared = prepareDnd5eEquipmentAttack({ ...input, action, characters: [barbarian], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.attackMode).toBe('advantage')
    expect(previewDnd5eEquipmentAttack(prepared.prepared, 2, 18).roll.d20).toBe(18)
    const resolved = resolvePreparedDnd5eEquipmentAttack({
      prepared: prepared.prepared,
      d20: 2,
      d20Second: 18,
      damageRolls: [5],
    })
    expect(resolved.result.ok).toBe(true)
    const saved = resolved.application?.characters[0]
    expect(saved?.dnd5eCombatState?.recklessAttackTurnKey).toBe('combat:1:fighter-token')
    if (!saved || !resolved.application) return

    const subsequent = prepareDnd5eEquipmentAttack({
      ...input,
      action: { ...input.action, dnd5eWeaponAttackOptions: undefined },
      map: resolved.application.map,
      characters: [saved],
      attacksUsed: 1,
    })
    expect(subsequent.ok).toBe(true)
    if (!subsequent.ok) return
    expect(subsequent.prepared.attackMode).toBe('advantage')

    expect(prepareDnd5eEquipmentAttack({ ...input, action, characters: [barbarian], attacksUsed: 1 }))
      .toEqual({ ok: false, reason: 'reckless-attack-unavailable' })
  })

  it('marks a Monk Attack action as eligible for Martial Arts and Flurry of Blows', () => {
    const input = fixture()
    const monk: Character = {
      ...input.actor,
      charClass: '武僧',
      level: 5,
      abilities: { ...input.actor.abilities, str: 10, dex: 16, wis: 16 },
      equipment: defaultEquipmentForDnd5eCharacter({ charClass: '武僧' }),
    }
    const prepared = prepareDnd5eEquipmentAttack({ ...input, characters: [monk], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eEquipmentAttack({ prepared: prepared.prepared, d20: 15, damageRolls: [5] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].dnd5eCombatState).toMatchObject({
      monkAttackActionTurnKey: 'combat:1:fighter-token',
      monkMartialArtsTurnKey: 'combat:1:fighter-token',
    })
  })

  it('settles a Berserker Frenzy attack as a bonus action without consuming the Attack action', () => {
    const input = fixture()
    const barbarian: Character = {
      ...input.actor,
      charClass: '野蛮人',
      level: 5,
      equipment: defaultEquipmentForDnd5eCharacter({ charClass: '野蛮人' }),
      dnd5eClassChoices: { classes: { barbarian: { subclass: 'berserker' } } },
      dnd5eCombatState: {
        raging: true,
        rageTurnsRemaining: 9,
        frenzying: true,
        frenzyStartedTurnKey: 'combat:1:fighter-token',
      },
    }
    const action = {
      ...input.action,
      round: 2,
      dnd5eWeaponAttackOptions: { frenzyAttack: true },
    }
    const prepared = prepareDnd5eEquipmentAttack({
      ...input,
      action,
      characters: [barbarian],
      attacksUsed: 0,
      turnEconomy: createDnd5eTurnEconomyCounts('combat:2:fighter-token'),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ spendsAction: false, spendsBonusAction: true, countsTowardAttackAction: false })
    const resolved = resolvePreparedDnd5eEquipmentAttack({ prepared: prepared.prepared, d20: 15, damageRolls: [5] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual({ type: 'turn-resource-spent', actorId: 'fighter-token', resource: 'bonusAction' })

    const sameTurn = prepareDnd5eEquipmentAttack({
      ...input,
      action: { ...action, round: 1 },
      characters: [barbarian],
      attacksUsed: 0,
      turnEconomy: createDnd5eTurnEconomyCounts('combat:1:fighter-token'),
    })
    expect(sameTurn).toEqual({ ok: false, reason: 'frenzy-attack-unavailable' })
  })

  it('applies level-three exhaustion disadvantage to weapon attacks', () => {
    const input = fixture()
    const exhausted = { ...input.actor, exhaustionLevel: 3 }
    const prepared = prepareDnd5eEquipmentAttack({ ...input, characters: [exhausted], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.attackMode).toBe('disadvantage')
    expect(previewDnd5eEquipmentAttack(prepared.prepared, 18, 2).roll.d20).toBe(2)
  })

  it('grants Hunter Horde Breaker once per turn against another creature within 5 feet of the original target', () => {
    const input = fixture()
    const ranger: Character = {
      ...input.actor,
      charClass: '游侠',
      level: 3,
      equipment: defaultEquipmentForDnd5eCharacter({ charClass: '游侠' }),
      dnd5eClassChoices: {
        classes: { ranger: { subclass: 'hunter', selections: { 'hunters-prey': ['horde-breaker'] } } },
      },
    }
    const secondTarget = token({ id: 'second-enemy', label: '第二目标', x: 75, y: 75, hp: 20, maxHp: 20 })
    const map = { ...input.map, tokens: [...input.map.tokens, secondTarget] }
    const initiativeOrder = [
      ...input.initiativeOrder,
      { tokenId: secondTarget.id, label: secondTarget.label, emoji: '', color: '', roll: 5 },
    ]
    const first = prepareDnd5eEquipmentAttack({ ...input, map, initiativeOrder, characters: [ranger], attacksUsed: 0 })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const firstResolved = resolvePreparedDnd5eEquipmentAttack({ prepared: first.prepared, d20: 15, damageRolls: [2] })
    expect(firstResolved.result.ok).toBe(true)
    const savedAfterFirst = firstResolved.application?.characters[0]
    expect(savedAfterFirst?.dnd5eCombatState).toMatchObject({
      hordeBreakerOpportunityTurnKey: 'combat:1:fighter-token',
      hordeBreakerSourceTargetId: 'enemy-token',
    })
    if (!savedAfterFirst || !firstResolved.application) return

    const hordeAction = {
      ...input.action,
      targetTokenId: secondTarget.id,
      dnd5eWeaponAttackOptions: { hordeBreakerAttack: true },
    }
    const horde = prepareDnd5eEquipmentAttack({
      ...input,
      action: hordeAction,
      map: firstResolved.application.map,
      initiativeOrder,
      characters: [savedAfterFirst],
      attacksUsed: 1,
    })
    expect(horde.ok).toBe(true)
    if (!horde.ok) return
    expect(horde.prepared).toMatchObject({ spendsAction: false, spendsBonusAction: false, countsTowardAttackAction: false })
    const hordeResolved = resolvePreparedDnd5eEquipmentAttack({ prepared: horde.prepared, d20: 15, damageRolls: [3] })
    expect(hordeResolved.result.ok).toBe(true)
    const savedAfterHorde = hordeResolved.application?.characters[0]
    expect(savedAfterHorde?.dnd5eCombatState?.hordeBreakerUsedTurnKey).toBe('combat:1:fighter-token')
    if (!savedAfterHorde || !hordeResolved.application) return
    expect(prepareDnd5eEquipmentAttack({
      ...input,
      action: hordeAction,
      map: hordeResolved.application.map,
      initiativeOrder,
      characters: [savedAfterHorde],
      attacksUsed: 1,
    })).toEqual({ ok: false, reason: 'horde-breaker-unavailable' })
  })

  it('spends Ki on a hit for Stunning Strike and persists a failed Constitution save', () => {
    const input = fixture()
    const monk: Character = {
      ...input.actor,
      charClass: '武僧',
      level: 5,
      abilities: { ...input.actor.abilities, str: 10, dex: 16, wis: 16 },
      equipment: defaultEquipmentForDnd5eCharacter({ charClass: '武僧' }),
      classResources: { 'dnd5e-ki': { current: 2, max: 5 } },
    }
    const action = { ...input.action, dnd5eWeaponAttackOptions: { stunningStrike: true } }
    const prepared = prepareDnd5eEquipmentAttack({ ...input, action, characters: [monk], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.stunningStrike).toEqual({
      saveDc: 14, saveModifier: 0, saveMode: 'normal', blessed: false, baned: false,
    })
    const resolved = resolvePreparedDnd5eEquipmentAttack({
      prepared: prepared.prepared,
      d20: 15,
      stunningStrikeSaveD20: 5,
      damageRolls: [4],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].classResources?.['dnd5e-ki']).toEqual({ current: 1, max: 5 })
    expect(resolved.application?.map.tokens.find((entry) => entry.id === input.targetToken.id)?.dnd5eCombatState).toMatchObject({
      stunnedByActorId: 'fighter-token',
      stunnedAppliedTurnKey: 'combat:1:fighter-token',
    })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: 'enemy-token', ability: 'con', dc: 14, success: false,
    }))
    expect(resolved.result.events).toContainEqual({ type: 'condition-applied', actorId: 'fighter-token', targetId: 'enemy-token', condition: '震慑' })
  })

  it('does not spend Stunning Strike Ki when the weapon attack misses', () => {
    const input = fixture()
    const monk: Character = {
      ...input.actor,
      charClass: '武僧', level: 5,
      equipment: defaultEquipmentForDnd5eCharacter({ charClass: '武僧' }),
      classResources: { 'dnd5e-ki': { current: 1, max: 5 } },
    }
    const action = { ...input.action, dnd5eWeaponAttackOptions: { stunningStrike: true } }
    const prepared = prepareDnd5eEquipmentAttack({ ...input, action, characters: [monk], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eEquipmentAttack({ prepared: prepared.prepared, d20: 1, damageRolls: [] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].classResources?.['dnd5e-ki']).toEqual({ current: 1, max: 5 })
  })
})
