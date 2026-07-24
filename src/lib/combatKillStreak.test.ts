import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eHeadlessResolutionObservation,
} from '../rulesets/dnd5e/headlessCombatEngine'
import {
  advanceCombatKillStreak,
  combatKillStreakClassId,
  combatKillStreakStyleForClass,
  dnd5eCombatKillCredits,
} from './combatKillStreak'

function observation(events: Dnd5eHeadlessResolutionObservation['result']['events']) {
  return {
    action: { type: 'attack', actorId: 'hero' },
    source: { combatId: 'combat', round: 2, initiativeIndex: 1 },
    result: {
      ok: true,
      state: {
        combatId: 'combat',
        round: 2,
        initiativeIndex: 1,
        combatants: {
          hero: { classState: {} },
          enemy1: { currentHp: 0, usesDeathSaves: false, deathSaves: { dead: true }, classState: {} },
          enemy2: { currentHp: 0, usesDeathSaves: false, deathSaves: { dead: true }, classState: {} },
          enemy3: { currentHp: 0, usesDeathSaves: false, deathSaves: { dead: true }, classState: {} },
        },
      },
      events,
    },
  } as unknown as Dnd5eHeadlessResolutionObservation
}

describe('combat kill streak presentation', () => {
  it('credits unique enemy deaths to the authoritative player source', () => {
    const resolved = observation([
      { type: 'damage-applied', sourceId: 'hero', targetId: 'enemy1', amount: 10, hpBefore: 10, hpAfter: 0, temporaryHpBefore: 0, temporaryHpAfter: 0 },
      { type: 'damage-applied', sourceId: 'hero', targetId: 'enemy1', amount: 5, hpBefore: 0, hpAfter: 0, temporaryHpBefore: 0, temporaryHpAfter: 0 },
      { type: 'damage-applied', sourceId: 'enemy1', targetId: 'hero', amount: 2, hpBefore: 20, hpAfter: 18, temporaryHpBefore: 0, temporaryHpAfter: 0 },
    ])
    expect(dnd5eCombatKillCredits({
      observation: resolved,
      sideByCombatantId: { hero: 'player', enemy1: 'enemy' },
    })).toEqual([{ killerId: 'hero', targetId: 'enemy1' }])
  })

  it('triggers once on the third distinct kill and resets on a new turn', () => {
    const first = advanceCombatKillStreak({
      current: {},
      turnKey: 'combat:2:1',
      credits: [
        { killerId: 'hero', targetId: 'enemy1' },
        { killerId: 'hero', targetId: 'enemy2' },
      ],
    })
    expect(first.triggeredKillerIds).toEqual([])
    const third = advanceCombatKillStreak({
      current: first.next,
      turnKey: 'combat:2:1',
      credits: [{ killerId: 'hero', targetId: 'enemy3' }],
    })
    expect(third.triggeredKillerIds).toEqual(['hero'])
    expect(advanceCombatKillStreak({
      current: third.next,
      turnKey: 'combat:2:1',
      credits: [{ killerId: 'hero', targetId: 'enemy4' }],
    }).triggeredKillerIds).toEqual([])
    expect(advanceCombatKillStreak({
      current: third.next,
      turnKey: 'combat:2:2',
      credits: [{ killerId: 'hero', targetId: 'enemy5' }],
    }).next.hero.targetIds).toEqual(['enemy5'])
  })

  it('classifies full spellcasting classes separately from martial classes', () => {
    expect(combatKillStreakStyleForClass('bard')).toBe('arcane')
    expect(combatKillStreakStyleForClass('wizard')).toBe('arcane')
    expect(combatKillStreakStyleForClass('cleric')).toBe('arcane')
    expect(combatKillStreakStyleForClass('paladin')).toBe('martial')
    expect(combatKillStreakStyleForClass('fighter')).toBe('martial')
  })

  it('uses the casting class for a multiclass spell kill streak', () => {
    const resolved = observation([])
    resolved.action = {
      type: 'cast-spell',
      actorId: 'hero',
      targetId: 'enemy1',
      spellId: 'shatter',
      slotLevel: 2,
      castingClassId: 'bard',
      effectRolls: [],
    }
    resolved.result.state.combatants.hero = {
      classId: 'fighter',
      classLevels: { fighter: 1, bard: 5 },
      classState: {},
    } as never
    expect(combatKillStreakClassId(resolved, 'hero')).toBe('bard')
    expect(combatKillStreakStyleForClass(combatKillStreakClassId(resolved, 'hero'))).toBe('arcane')
  })

  it('credits a bard for three enemies defeated by one Shatter cast', () => {
    const abilities = { str: 10, dex: 14, con: 14, int: 10, wis: 12, cha: 20 } as const
    const bard = createDnd5eCombatant({
      id: 'bard',
      name: '吟游诗人',
      controller: 'player',
      initiative: 20,
      abilities,
      proficiencyBonus: 6,
      armorClass: 14,
      currentHp: 80,
      maxHp: 80,
      temporaryHp: 0,
      speed: 30,
      position: { x: 0, y: 0 },
      concentrating: false,
      classId: 'bard',
      level: 20,
      classSelections: { 'spell-known': ['shatter'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } },
    })
    const enemies = ['goblin-1', 'goblin-2', 'goblin-3'].map((id, index) => createDnd5eCombatant({
      id,
      name: id,
      controller: 'dm',
      initiative: 10 - index,
      abilities: { str: 8, dex: 14, con: 10, int: 8, wis: 8, cha: 8 },
      proficiencyBonus: 2,
      armorClass: 12,
      currentHp: 7,
      maxHp: 7,
      temporaryHp: 0,
      speed: 30,
      position: { x: index + 1, y: 0 },
      concentrating: false,
    }))
    const source = startDnd5eHeadlessCombat('bard-shatter', [bard, ...enemies])
    const result = resolveDnd5eHeadlessAction(source, {
      type: 'cast-spell',
      actorId: 'bard',
      targetId: 'goblin-1',
      targetIds: enemies.map((enemy) => enemy.id),
      spellId: 'shatter',
      slotLevel: 2,
      effectRolls: [8, 8, 8],
      targetSavingThrows: enemies.map((enemy) => ({ targetId: enemy.id, d20: 20 })),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(dnd5eCombatKillCredits({
      observation: {
        action: {
          type: 'cast-spell',
          actorId: 'bard',
          targetId: 'goblin-1',
          targetIds: enemies.map((enemy) => enemy.id),
          spellId: 'shatter',
          slotLevel: 2,
          effectRolls: [8, 8, 8],
          targetSavingThrows: enemies.map((enemy) => ({ targetId: enemy.id, d20: 20 })),
        },
        source,
        result,
      },
      sideByCombatantId: {
        bard: 'player',
        'goblin-1': 'enemy',
        'goblin-2': 'enemy',
        'goblin-3': 'enemy',
      },
    })).toEqual([
      { killerId: 'bard', targetId: 'goblin-1' },
      { killerId: 'bard', targetId: 'goblin-2' },
      { killerId: 'bard', targetId: 'goblin-3' },
    ])
  })
})
