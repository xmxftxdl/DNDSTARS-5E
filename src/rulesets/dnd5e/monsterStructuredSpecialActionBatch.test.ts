import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'
import { auditDnd5eMonsterHeadlessCoverage } from './monsterHeadlessCoverage'
import { getDnd5eSrdMonster } from './monsters'
import { planDnd5eMonsterTurn } from './monsterTurnPlanner'
import { createDnd5eConditionEffect } from './activeEffects'

const abilities = { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 } as const

function combatant(id: string, initiative: number, patch: Record<string, unknown> = {}) {
  return createDnd5eCombatant({
    id,
    name: id,
    controller: 'dm',
    initiative,
    abilities,
    proficiencyBonus: 2,
    armorClass: 12,
    currentHp: 200,
    maxHp: 200,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

function token(patch: Partial<Token>): Token {
  return {
    id: 'token', label: 'Token', x: 5, y: 45, color: '', emoji: '', size: 1,
    type: 'enemy', hp: 100, maxHp: 100, ...patch,
  }
}

function map(tokens: Token[]): BattleMap {
  return {
    id: 'structured-special-actions', name: 'Structured special actions',
    width: 300, height: 100, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0,
    showGrid: true, feetPerCell: 5, tokens,
  }
}

function character(id: string): Character {
  return {
    id, name: id, player: 'P1', avatar: '', accent: '', race: '', charClass: '',
    level: 1, background: '', experience: 0, reputation: 0,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: [], skills: [], maxHp: 100, currentHp: 100, tempHp: 0,
    hitDice: '1d8', ac: 12, speed: 30, initiativeBonus: 0, saveDC: 10,
    passivePerception: 10, inspiration: 0, conditions: [], notes: '', dmNotes: '',
    visibleToPlayers: true,
  }
}

describe('reviewed SRD structured special-action batch', () => {
  it('promotes exactly the reviewed combat actions to executable structure', () => {
    const expected = [
      ['cloaker', 'actions', 'moan'],
      ['gorgon', 'actions', 'petrifying-breath'],
      ['quasit', 'actions', 'scare'],
      ['stone-golem', 'actions', 'slow'],
      ['storm-giant', 'actions', 'lightning-strike'],
      ['vrock', 'actions', 'stunning-screech'],
      ['lich', 'legendaryActions', 'frightening-gaze-costs-2-actions'],
      ['solar', 'legendaryActions', 'blinding-gaze-costs-3-actions'],
    ] as const
    const rows = new Map(auditDnd5eMonsterHeadlessCoverage().actions.rows
      .map((row) => [`${row.slug}:${row.section}:${row.actionId}`, row]))
    for (const [slug, section, actionId] of expected) {
      expect(rows.get(`${slug}:${section}:${actionId}`), `${slug}:${actionId}`).toMatchObject({
        effectiveAutomation: 'headless', structure: 'rule', reasonCodes: [],
      })
    }
    expect(getDnd5eSrdMonster('srd-5.1:vrock')?.actions
      .find((action) => action.id === 'stunning-screech')?.usage).toEqual({
        kind: 'recharge', dieSides: 6, minimum: 6,
      })
  })

  it('resolves Storm Giant Lightning Strike damage, half damage, and recharge atomically', () => {
    const giant = combatant('giant', 20, {
      statBlockId: 'srd-5.1:storm-giant',
      classState: { monsterRechargeReadyByActionId: { 'lightning-strike': true } },
    })
    const failed = combatant('failed', 10, { controller: 'player', savingThrowBonuses: { dex: 0 } })
    const saved = combatant('saved', 5, { controller: 'player', savingThrowBonuses: { dex: 0 } })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('storm-giant-lightning', [giant, failed, saved]),
      {
        type: 'monster-area-action', actorId: 'giant', actionId: 'lightning-strike',
        resolution: {
          schemaVersion: 1, targetIds: ['failed', 'saved'],
          targetSavingThrows: [{ targetId: 'failed', d20: 1 }, { targetId: 'saved', d20: 20 }],
          damageRolls: Array.from({ length: 12 }, () => 8),
        },
      },
    )
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.failed.currentHp).toBe(104)
    expect(result.state.combatants.saved.currentHp).toBe(152)
    expect(result.state.combatants.giant.classState.monsterRechargeReadyByActionId)
      .toEqual({ 'lightning-strike': false })
  })

  it('applies Gorgon staged petrification and Stone Golem mechanical Slow', () => {
    const gorgon = combatant('gorgon', 20, {
      statBlockId: 'srd-5.1:gorgon',
      classState: { monsterRechargeReadyByActionId: { 'petrifying-breath': true } },
    })
    const hero = combatant('hero', 10, { controller: 'player', savingThrowBonuses: { con: 0 } })
    const petrifying = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('gorgon-petrifying-breath', [gorgon, hero]),
      {
        type: 'monster-area-action', actorId: 'gorgon', actionId: 'petrifying-breath',
        resolution: {
          schemaVersion: 1, targetIds: ['hero'],
          targetSavingThrows: [{ targetId: 'hero', d20: 1 }], damageRolls: [],
        },
      },
    )
    expect(petrifying.ok, petrifying.ok ? undefined : petrifying.reason).toBe(true)
    if (!petrifying.ok) return
    expect(petrifying.state.combatants.hero.classState.activeEffects).toContainEqual(
      expect.objectContaining({
        standardCondition: 'restrained',
        repeatSave: expect.objectContaining({
          onFailureTransition: { replaceWithCondition: 'petrified', duration: 'permanent' },
        }),
      }),
    )

    const golem = combatant('golem', 20, {
      statBlockId: 'srd-5.1:stone-golem',
      classState: { monsterRechargeReadyByActionId: { slow: true } },
    })
    const slowed = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('stone-golem-slow', [golem, hero]),
      {
        type: 'monster-area-action', actorId: 'golem', actionId: 'slow',
        resolution: {
          schemaVersion: 1, targetIds: ['hero'],
          targetSavingThrows: [{ targetId: 'hero', d20: 1 }], damageRolls: [],
        },
      },
    )
    expect(slowed.ok, slowed.ok ? undefined : slowed.reason).toBe(true)
    if (!slowed.ok) return
    expect(slowed.state.combatants.hero.classState.activeEffects).toContainEqual(
      expect.objectContaining({
        definitionId: 'monster-area:stone-golem-slow',
        modifiers: expect.objectContaining({
          speedMultiplier: 0.5, preventReactions: true,
          maximumAttacksPerTurn: 1, actionOrBonusActionOnly: true,
        }),
      }),
    )
  })

  it('rejects deafened and excluded creature types before spending Stunning Screech', () => {
    const vrock = combatant('vrock', 20, {
      statBlockId: 'srd-5.1:vrock', creatureType: 'fiend (demon)',
      classState: { monsterRechargeReadyByActionId: { 'stunning-screech': true } },
    })
    const deafened = combatant('deafened', 10, {
      controller: 'player', savingThrowBonuses: { con: 0 },
      classState: {
        activeEffects: [createDnd5eConditionEffect({
          condition: 'deafened', targetId: 'deafened', source: { kind: 'dm' },
        })],
      },
    })
    const demon = combatant('demon', 5, {
      controller: 'player', creatureType: 'fiend (demon)', savingThrowBonuses: { con: 0 },
    })
    for (const targetId of ['deafened', 'demon']) {
      const result = resolveDnd5eHeadlessAction(
        startDnd5eHeadlessCombat(`vrock-${targetId}`, [vrock, deafened, demon]),
        {
          type: 'monster-area-action', actorId: 'vrock', actionId: 'stunning-screech',
          resolution: {
            schemaVersion: 1, targetIds: [targetId],
            targetSavingThrows: [{ targetId, d20: 1 }], damageRolls: [],
          },
        },
      )
      expect(result).toMatchObject({ ok: false, reason: 'invalid-dice' })
      expect(result.state.combatants.vrock.turn.actionAvailable).toBe(true)
      expect(result.state.combatants.vrock.classState.monsterRechargeReadyByActionId)
        .toEqual({ 'stunning-screech': true })
    }
  })

  it('spends Lich legendary points and grants source-specific immunity on a success', () => {
    const hero = combatant('hero', 20, {
      controller: 'player', position: { x: 5, y: 0 }, savingThrowBonuses: { wis: 20 },
    })
    const lich = combatant('lich', 10, {
      statBlockId: 'srd-5.1:lich', position: { x: 0, y: 0 },
      classState: { monsterLegendaryActionPoints: 3 },
    })
    const state = startDnd5eHeadlessCombat('lich-frightening-gaze', [hero, lich])
    state.distanceFeetByCombatantPair = { ['hero\u0000lich']: 5 }
    const result = resolveDnd5eHeadlessAction(
      state,
      {
        type: 'monster-legendary-special-action', actorId: 'lich',
        actionId: 'frightening-gaze-costs-2-actions', targetId: 'hero', d20: 20,
      },
    )
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.lich.classState.monsterLegendaryActionPoints).toBe(1)
    expect(result.state.combatants.hero.conditions).not.toContain('frightened')
    expect(result.state.combatants.hero.classState.monsterActionImmunityRoundsByKey)
      .toEqual({ 'source-action:lich:frightening-gaze-costs-2-actions': 14_400 })
  })

  it('planner excludes demons from Vrock Screech while retaining a valid humanoid target', () => {
    const vrock = token({
      id: 'vrock', poolId: 'srd-5.1:vrock', hp: 104, maxHp: 104,
      dnd5eCombatState: { monsterRechargeReadyByActionId: { 'stunning-screech': true } },
    })
    const hero = token({ id: 'hero', type: 'player', characterId: 'hero-character', x: 15 })
    const demon = token({ id: 'demon', type: 'player', poolId: 'srd-5.1:dretch', x: 25 })
    const plan = planDnd5eMonsterTurn(map([vrock, hero, demon]), vrock, [character('hero-character')], {
      requiredActionId: 'stunning-screech',
      requiredTargetId: hero.id,
    })
    expect(plan.areaAction).toMatchObject({
      actionId: 'stunning-screech', targetTokenIds: [hero.id],
      saveAbility: 'con', saveDc: 14,
    })
  })
})
