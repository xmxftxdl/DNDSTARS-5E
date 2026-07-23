import { afterEach, describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { DND5E_SHIELD } from './equipment'
import { buildDnd5eCustomMonster, createDnd5eCustomMonsterDraft, createDnd5eCustomMonsterMechanicDraft } from './customMonsterWorkshop'
import { setDnd5eRoomMonsterCatalog } from './monsters'
import {
  prepareDnd5eMonsterAfterHitMechanics,
  prepareDnd5eMonsterAttack,
  previewDnd5eMonsterAttack,
  resolvePreparedDnd5eMonsterAttack,
} from './monsterAttackAction'

function character(): Character {
  return { id: 'hero', name: '英雄', player: 'P1', avatar: '', accent: '', race: '', charClass: '', level: 1, background: '', experience: 0, reputation: 0, abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 }, savingThrows: [], skills: [], maxHp: 40, currentHp: 40, tempHp: 0, hitDice: '1d10', ac: 16, speed: 30, initiativeBonus: 0, saveDC: 10, passivePerception: 10, inspiration: 0, conditions: [], notes: '', dmNotes: '', visibleToPlayers: true }
}

function token(patch: Partial<Token>): Token {
  return { id: 'token', label: 'Token', x: 0, y: 0, color: '', emoji: '', size: 1, type: 'enemy', hp: 10, maxHp: 10, ...patch }
}

describe('SRD monster map action adapter', () => {
  afterEach(() => setDnd5eRoomMonsterCatalog([]))

  it('applies Pack Tactics only while a conscious ally is within 5 feet of the target', () => {
    const hero = character()
    const wolf = token({ id: 'wolf', x: 0, poolId: 'srd-5.1:wolf' })
    const ally = token({ id: 'ally', x: 20, poolId: 'srd-5.1:wolf' })
    const heroToken = token({ id: 'hero-token', x: 10, type: 'player', characterId: hero.id })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10, feetPerCell: 5,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [wolf, ally, heroToken],
    }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'combat', map, characters: [hero],
      initiativeOrder: [wolf, ally, heroToken].map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })),
      actorTokenId: wolf.id, targetTokenId: heroToken.id,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.packTactics).toBe(true)
    expect(prepared.prepared.targetAttackMode).toBe('advantage')
  })

  it('prepares the owlbear multiattack and returns one authoritative map application', () => {
    const hero = character()
    const owlbear = token({ id: 'owlbear', label: '枭熊', poolId: 'srd-5.1:owlbear', hp: 59, maxHp: 59 })
    const heroToken = token({ id: 'hero-token', label: hero.name, type: 'player', characterId: hero.id, hp: 40, maxHp: 40 })
    const map: BattleMap = { id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [owlbear, heroToken] }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'combat',
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: owlbear.id, label: owlbear.label, emoji: '', color: '', roll: 20 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: owlbear.id,
      targetTokenId: heroToken.id,
      actionIndex: 1,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.action.id).toBe('multiattack')
    expect(prepared.prepared.attacks.map((entry) => entry.id)).toEqual(['beak', 'claws'])
    expect(previewDnd5eMonsterAttack(prepared.prepared, 0, 10).hit).toBe(true)

    const resolved = resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [
        { d20: 10, damageRolls: [[5]] },
        { d20: 10, damageRolls: [[4, 4]] },
      ],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].currentHp).toBe(17)
    expect(resolved.application?.changedCharacterIds).toEqual([hero.id])
    expect(resolved.application?.changedTokenIds).toEqual(['owlbear', heroToken.id])
  })

  it('executes a V2 after-hit damage and condition mechanism through the authoritative attack transaction', () => {
    const hero = character()
    const draft = createDnd5eCustomMonsterDraft()
    draft.name = '烬爪'
    draft.headlessMechanics = [{
      ...createDnd5eCustomMonsterMechanicDraft(),
      id: 'burning-strike',
      name: '灼热追击',
      trigger: 'after-hit',
      effectKind: 'damage',
      effectTarget: 'trigger-target',
      healingDice: '1d6',
      damageType: 'fire',
      hpPercentageAtOrBelow: 100,
      limit: 'once-per-turn',
      preservedEffects: [
        { id: 'effect-0', kind: 'damage', target: 'trigger-target', dice: { count: 1, sides: 6, bonus: 0 }, damageType: 'fire' },
        { id: 'frighten', kind: 'standard-condition', target: 'trigger-target', condition: 'frightened', duration: { kind: 'rounds', rounds: 1 } },
      ],
    }]
    const monster = buildDnd5eCustomMonster(draft)
    setDnd5eRoomMonsterCatalog([monster])
    const enemy = token({ id: 'ember-claw', label: monster.name, poolId: monster.id, hp: monster.hitPoints.average, maxHp: monster.hitPoints.average })
    const heroToken = token({ id: 'hero-token', label: hero.name, type: 'player', characterId: hero.id, hp: 40, maxHp: 40 })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [enemy, heroToken],
    }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'combat', map, characters: [hero],
      initiativeOrder: [
        { tokenId: enemy.id, label: enemy.label, emoji: '', color: '', roll: 20 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: enemy.id, targetTokenId: heroToken.id,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepareDnd5eMonsterAfterHitMechanics(prepared.prepared, true)).toEqual([expect.objectContaining({
      mechanicId: 'burning-strike', targetId: heroToken.id,
      effects: [{ effectId: 'effect-0', effectName: '额外伤害', count: 1, sides: 6, bonus: 0 }],
    })])
    expect(resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [{ d20: 15, damageRolls: [[4]] }],
    }).result).toMatchObject({ ok: false, reason: 'invalid-dice' })
    expect(resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [{ d20: 15, damageRolls: [[4]] }],
      mechanicRolls: [{
        actorId: enemy.id,
        mechanicId: 'burning-strike',
        targetId: enemy.id,
        effectRolls: [{ effectId: 'effect-0', rolls: [5] }],
      }],
    }).result).toMatchObject({ ok: false, reason: 'invalid-dice' })

    const resolved = resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [{ d20: 15, damageRolls: [[4]] }],
      mechanicRolls: [{
        actorId: enemy.id,
        mechanicId: 'burning-strike',
        targetId: heroToken.id,
        effectRolls: [{ effectId: 'effect-0', rolls: [5] }],
      }],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.characters[0].currentHp).toBe(30)
    expect(resolved.application?.characters[0].conditions).toContain('frightened')
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'monster-mechanic-v2-triggered', actorId: enemy.id, mechanicId: 'burning-strike', trigger: 'after-hit',
    }))
  })

  it('uses one target reaction to halve one attack in a monster Multiattack', () => {
    const rogue: Character = {
      ...character(), rulesetId: 'dnd5e-2014-srd-5.1', charClass: '游荡者', level: 5,
    }
    const owlbear = token({ id: 'owlbear', label: '枭熊', poolId: 'srd-5.1:owlbear', hp: 59, maxHp: 59 })
    const rogueToken = token({ id: 'hero-token', label: rogue.name, type: 'player', characterId: rogue.id, hp: 40, maxHp: 40 })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [owlbear, rogueToken],
    }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'combat', map, characters: [rogue],
      initiativeOrder: [
        { tokenId: owlbear.id, label: owlbear.label, emoji: '', color: '', roll: 20 },
        { tokenId: rogueToken.id, label: rogueToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: owlbear.id, targetTokenId: rogueToken.id, actionIndex: 1,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [
        { d20: 10, uncannyDodge: true, damageRolls: [[5]] },
        { d20: 10, damageRolls: [[4, 4]] },
      ],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].currentHp).toBe(22)
    expect(resolved.result.events).toContainEqual({
      type: 'turn-resource-spent', actorId: rogueToken.id, resource: 'reaction',
    })
  })

  it('lets a nearby Lore Bard use Cutting Words against an SRD monster attack', () => {
    const hero = character()
    const bard: Character = {
      ...character(), id: 'bard', name: '吟游诗人', rulesetId: 'dnd5e-2014-srd-5.1',
      charClass: '吟游诗人', level: 5,
      dnd5eClassChoices: { classes: { bard: { subclass: 'lore', selections: {} } } },
      classResources: { 'dnd5e-bardic-inspiration': { current: 2, max: 3 } },
    }
    const owlbear = token({ id: 'owlbear', label: '枭熊', poolId: 'srd-5.1:owlbear', hp: 59, maxHp: 59 })
    const heroToken = token({ id: 'hero-token', label: hero.name, type: 'player', characterId: hero.id, hp: 40, maxHp: 40 })
    const bardToken = token({ id: 'bard-token', label: bard.name, type: 'player', characterId: bard.id, hp: 40, maxHp: 40 })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [owlbear, heroToken, bardToken],
    }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'combat', map, characters: [hero, bard],
      initiativeOrder: [
        { tokenId: owlbear.id, label: owlbear.label, emoji: '', color: '', roll: 20 },
        { tokenId: bardToken.id, label: bardToken.label, emoji: '', color: '', roll: 15 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: owlbear.id, targetTokenId: heroToken.id, actionIndex: 1,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [{
        d20: 10,
        cuttingWords: { bardId: bardToken.id, roll: 8, distanceFeet: 30 },
        damageRolls: [[]],
      }, {
        d20: 1,
        damageRolls: [[], []],
      }],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.characters.find((entry) => entry.id === hero.id)?.currentHp).toBe(40)
    expect(resolved.application?.characters.find((entry) => entry.id === bard.id)?.classResources?.['dnd5e-bardic-inspiration']).toEqual({ current: 1, max: 3 })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: owlbear.id, targetId: heroToken.id, total: 9, hit: false,
    }))
  })

  it('applies Cutting Words to an SRD monster damage roll before target defenses', () => {
    const hero = character()
    const bard: Character = {
      ...character(), id: 'bard', name: '吟游诗人', rulesetId: 'dnd5e-2014-srd-5.1',
      charClass: '吟游诗人', level: 5,
      dnd5eClassChoices: { classes: { bard: { subclass: 'lore', selections: {} } } },
      classResources: { 'dnd5e-bardic-inspiration': { current: 2, max: 3 } },
    }
    const owlbear = token({ id: 'owlbear', label: '枭熊', poolId: 'srd-5.1:owlbear', hp: 59, maxHp: 59 })
    const heroToken = token({ id: 'hero-token', label: hero.name, type: 'player', characterId: hero.id, hp: 40, maxHp: 40 })
    const bardToken = token({ id: 'bard-token', label: bard.name, type: 'player', characterId: bard.id, hp: 40, maxHp: 40 })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [owlbear, heroToken, bardToken],
    }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'combat', map, characters: [hero, bard],
      initiativeOrder: [
        { tokenId: owlbear.id, label: owlbear.label, emoji: '', color: '', roll: 20 },
        { tokenId: bardToken.id, label: bardToken.label, emoji: '', color: '', roll: 15 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: owlbear.id, targetTokenId: heroToken.id, actionIndex: 1,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [{
        d20: 10,
        cuttingWordsDamage: { bardId: bardToken.id, roll: 3, distanceFeet: 30 },
        damageRolls: [[5]],
      }, {
        d20: 1,
        damageRolls: [[], []],
      }],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.characters.find((entry) => entry.id === hero.id)?.currentHp).toBe(33)
    expect(resolved.application?.characters.find((entry) => entry.id === bard.id)?.classResources?.['dnd5e-bardic-inspiration']).toEqual({ current: 1, max: 3 })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: bardToken.id, targetId: owlbear.id,
      stateKey: 'cutting-words', value: 3,
    }))
  })

  it('lets Shield turn the triggering hit and later attacks in the same Multiattack into misses', () => {
    const wizard: Character = {
      ...character(), rulesetId: 'dnd5e-2014-srd-5.1', charClass: '法师', level: 1, ac: 14,
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['shield'] } } } },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 2 } },
    }
    const owlbear = token({ id: 'owlbear', label: '枭熊', poolId: 'srd-5.1:owlbear', hp: 59, maxHp: 59 })
    const wizardToken = token({ id: 'hero-token', label: wizard.name, type: 'player', characterId: wizard.id, hp: 40, maxHp: 40 })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [owlbear, wizardToken],
    }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'combat', map, characters: [wizard],
      initiativeOrder: [
        { tokenId: owlbear.id, label: owlbear.label, emoji: '', color: '', roll: 20 },
        { tokenId: wizardToken.id, label: wizardToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: owlbear.id, targetTokenId: wizardToken.id, actionIndex: 1,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [
        { d20: 10, shieldSpellReaction: true, damageRolls: [[]] },
        { d20: 10, damageRolls: [[], []] },
      ],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].currentHp).toBe(40)
    expect(resolved.result.events.filter((event) => event.type === 'attack-resolved')).toEqual([
      expect.objectContaining({ armorClass: 19, hit: false }),
      expect.objectContaining({ armorClass: 19, hit: false }),
    ])
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: wizardToken.id, stateKey: 'shield-spell', active: true,
    }))
  })

  it('lets an adjacent shield bearer impose disadvantage with Protection', () => {
    const hero = character()
    const protector: Character = {
      ...character(), id: 'protector', name: '守卫', rulesetId: 'dnd5e-2014-srd-5.1',
      charClass: '战士', equipment: { offHand: DND5E_SHIELD },
      dnd5eClassChoices: { fighter: { fightingStyles: ['protection'] } },
    }
    const owlbear = token({ id: 'owlbear', label: '枭熊', poolId: 'srd-5.1:owlbear', hp: 59, maxHp: 59 })
    const heroToken = token({ id: 'hero-token', label: hero.name, type: 'player', characterId: hero.id, hp: 40, maxHp: 40 })
    const protectorToken = token({ id: 'protector-token', label: protector.name, type: 'player', characterId: protector.id, hp: 40, maxHp: 40 })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [owlbear, heroToken, protectorToken],
    }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'combat', map, characters: [hero, protector],
      initiativeOrder: [
        { tokenId: owlbear.id, label: owlbear.label, emoji: '', color: '', roll: 20 },
        { tokenId: protectorToken.id, label: protectorToken.label, emoji: '', color: '', roll: 15 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: owlbear.id, targetTokenId: heroToken.id, actionIndex: 1,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(previewDnd5eMonsterAttack(prepared.prepared, 0, 18, 2, true).hit).toBe(false)
    const resolved = resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [
        { d20: 18, d20Second: 2, protectionReactionActorId: protectorToken.id, damageRolls: [[]] },
        { d20: 2, damageRolls: [[], []] },
      ],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual({
      type: 'turn-resource-spent', actorId: protectorToken.id, resource: 'reaction',
    })
    expect(resolved.application?.characters.find((entry) => entry.id === hero.id)?.currentHp).toBe(40)
  })

  it('rejects an SRD melee action when the map target is outside its reach', () => {
    const hero = character()
    const owlbear = token({ id: 'owlbear', label: '枭熊', poolId: 'srd-5.1:owlbear', hp: 59, maxHp: 59 })
    const heroToken = token({ id: 'hero-token', label: hero.name, type: 'player', characterId: hero.id, hp: 40, maxHp: 40, x: 90 })
    const map: BattleMap = { id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [owlbear, heroToken] }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'combat', map, characters: [hero],
      initiativeOrder: [
        { tokenId: owlbear.id, label: owlbear.label, emoji: '', color: '', roll: 20 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: owlbear.id, targetTokenId: heroToken.id, actionIndex: 1,
    })
    expect(prepared).toEqual({ ok: false, reason: 'target-out-of-range' })
  })

  it('forces advantage against a Barbarian who used Reckless Attack', () => {
    const hero = {
      ...character(),
      rulesetId: 'dnd5e-2014-srd-5.1' as const,
      charClass: '野蛮人',
      dnd5eCombatState: { recklessAttackTurnKey: 'combat:1:hero-token' },
    }
    const owlbear = token({ id: 'owlbear', label: '枭熊', poolId: 'srd-5.1:owlbear', hp: 59, maxHp: 59 })
    const heroToken = token({ id: 'hero-token', label: hero.name, type: 'player', characterId: hero.id, hp: 40, maxHp: 40 })
    const map: BattleMap = { id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [owlbear, heroToken] }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'combat', round: 1, map, characters: [hero],
      initiativeOrder: [
        { tokenId: owlbear.id, label: owlbear.label, emoji: '', color: '', roll: 20 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: owlbear.id, targetTokenId: heroToken.id, actionIndex: 1,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetAttackMode).toBe('advantage')
    expect(previewDnd5eMonsterAttack(prepared.prepared, 0, 2, 18).roll.d20).toBe(18)
  })

  it('forces disadvantage against Patient Defense and cancels it against Reckless Attack advantage', () => {
    const baseHero = {
      ...character(),
      rulesetId: 'dnd5e-2014-srd-5.1' as const,
      charClass: '武僧',
      dnd5eCombatState: { dodgingTurnKey: 'combat:1:hero-token' },
    }
    const owlbear = token({ id: 'owlbear', label: '枭熊', poolId: 'srd-5.1:owlbear', hp: 59, maxHp: 59 })
    const heroToken = token({ id: 'hero-token', label: baseHero.name, type: 'player', characterId: baseHero.id, hp: 40, maxHp: 40 })
    const map: BattleMap = { id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [owlbear, heroToken] }
    const prepare = (hero: Character) => prepareDnd5eMonsterAttack({
      combatId: 'combat', round: 1, map, characters: [hero],
      initiativeOrder: [
        { tokenId: owlbear.id, label: owlbear.label, emoji: '', color: '', roll: 20 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: owlbear.id, targetTokenId: heroToken.id, actionIndex: 1,
    })
    const dodging = prepare(baseHero)
    expect(dodging.ok).toBe(true)
    if (!dodging.ok) return
    expect(dodging.prepared.targetAttackMode).toBe('disadvantage')
    expect(previewDnd5eMonsterAttack(dodging.prepared, 0, 18, 2).roll.d20).toBe(2)

    const cancelled = prepare({
      ...baseHero,
      dnd5eCombatState: { ...baseHero.dnd5eCombatState, recklessAttackTurnKey: 'combat:1:hero-token' },
    })
    expect(cancelled.ok).toBe(true)
    if (!cancelled.ok) return
    expect(cancelled.prepared.targetAttackMode).toBe('normal')
  })

  it('grants monster attacks advantage against a stunned player target', () => {
    const hero = {
      ...character(),
      rulesetId: 'dnd5e-2014-srd-5.1' as const,
      charClass: '武僧',
      dnd5eCombatState: {
        stunnedByActorId: 'monk-token',
        stunnedAppliedTurnKey: 'combat:1:monk-token',
      },
    }
    const owlbear = token({ id: 'owlbear', label: '枭熊', poolId: 'srd-5.1:owlbear', hp: 59, maxHp: 59 })
    const heroToken = token({ id: 'hero-token', label: hero.name, type: 'player', characterId: hero.id, hp: 40, maxHp: 40 })
    const map: BattleMap = { id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [owlbear, heroToken] }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'combat', round: 1, map, characters: [hero],
      initiativeOrder: [
        { tokenId: owlbear.id, label: owlbear.label, emoji: '', color: '', roll: 20 },
        { tokenId: heroToken.id, label: heroToken.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: owlbear.id, targetTokenId: heroToken.id, actionIndex: 1,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targetAttackMode).toBe('advantage')
    expect(previewDnd5eMonsterAttack(prepared.prepared, 0, 2, 18).roll.d20).toBe(18)
  })

  it('uses a player Druid\'s active Wild Shape stat block for map attacks', () => {
    const druid: Character = {
      ...character(),
      id: 'druid',
      rulesetId: 'dnd5e-2014-srd-5.1',
      charClass: '德鲁伊',
      level: 2,
      currentHp: 30,
      maxHp: 30,
      dnd5eClassChoices: { classes: { druid: { selections: { 'wild-shape-known-forms': ['srd-5.1:wolf'] } } } },
      dnd5eCombatState: {
        wildShapeFormId: 'srd-5.1:wolf', wildShapeCurrentHp: 11, wildShapeRoundsRemaining: 600,
        wildShapeOriginalCurrentHp: 30, wildShapeOriginalMaxHp: 30, wildShapeOriginalArmorClass: 16,
        wildShapeOriginalSpeed: 30, wildShapeOriginalAbilities: character().abilities,
        wildShapeOriginalSavingThrowBonuses: { str: 3, dex: 2, con: 2, int: 0, wis: 0, cha: 0 },
      },
    }
    const druidToken = token({ id: 'druid-token', label: druid.name, type: 'player', characterId: druid.id, hp: 11, maxHp: 11 })
    const goblin = token({ id: 'goblin-token', label: '哥布林', poolId: 'srd-5.1:goblin', hp: 7, maxHp: 7 })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [druidToken, goblin],
    }
    const prepared = prepareDnd5eMonsterAttack({
      combatId: 'combat', map, characters: [druid],
      initiativeOrder: [
        { tokenId: druidToken.id, label: druidToken.label, emoji: '', color: '', roll: 20 },
        { tokenId: goblin.id, label: goblin.label, emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: druidToken.id, targetTokenId: goblin.id, actionIndex: 0,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.monster.id).toBe('srd-5.1:wolf')
    expect(prepared.prepared.action.id).toBe('bite')
    const resolved = resolvePreparedDnd5eMonsterAttack({
      prepared: prepared.prepared,
      rolls: [{ d20: 20, damageRolls: [[4, 4, 4, 4]] }],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === goblin.id)?.hp).toBe(0)
  })
})
