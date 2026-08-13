import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'

const abilities = { str: 10, dex: 14, con: 14, int: 18, wis: 18, cha: 18 } as const

function caster(
  id: string,
  classId: 'bard' | 'druid' | 'sorcerer' | 'warlock' | 'wizard',
  spellId: string,
  level: number,
  slotLevel?: number,
) {
  return createDnd5eCombatant({
    id,
    name: id,
    controller: 'player',
    initiative: 20,
    abilities,
    proficiencyBonus: level >= 9 ? 4 : 3,
    armorClass: 14,
    currentHp: 30,
    maxHp: 30,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    classId,
    level,
    classSelections: {
      [classId === 'druid' && spellId === 'produce-flame' ? 'spell-cantrips' :
        classId === 'bard' || classId === 'sorcerer' || classId === 'warlock' ? 'spell-known' : 'spell-prepared']:
        [spellId],
    },
    classResources: slotLevel == null ? {} : {
      [`dnd5e-spell-slot-${slotLevel}`]: { current: 1, max: 1 },
    },
  })
}

function enemy(id: string, hp = 60) {
  return createDnd5eCombatant({
    id,
    name: id,
    controller: 'dm',
    initiative: 10,
    abilities,
    proficiencyBonus: 2,
    armorClass: 10,
    currentHp: hp,
    maxHp: hp,
    temporaryHp: 0,
    speed: 30,
    position: { x: 5, y: 0 },
    concentrating: false,
  })
}

describe('shared sustained spell controls', () => {
  it('uses Expeditious Retreat as a bonus-action Dash only while its concentration effect exists', () => {
    const actor = caster('wizard', 'wizard', 'expeditious-retreat', 5, 1)
    const cast = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('expeditious-retreat', [actor, enemy('enemy')]),
      {
        type: 'cast-spell', actorId: actor.id, targetId: actor.id,
        spellId: 'expeditious-retreat', slotLevel: 1, effectRolls: [],
      },
    )
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants[actor.id].classState.concentrationSpellId).toBe('expeditious-retreat')
    cast.state.combatants[actor.id].turn.bonusActionAvailable = true
    const dash = resolveDnd5eHeadlessAction(cast.state, {
      type: 'dash', actorId: actor.id, sourceSpellId: 'expeditious-retreat',
    })
    expect(dash.ok).toBe(true)
    if (!dash.ok) return
    expect(dash.state.combatants[actor.id].turn).toMatchObject({
      actionAvailable: true,
      bonusActionAvailable: false,
      movementRemaining: 60,
    })
    expect(resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('forged-expeditious-retreat', [actor, enemy('enemy')]),
      { type: 'dash', actorId: actor.id, sourceSpellId: 'expeditious-retreat' },
    )).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('repeats Heat Metal with a bonus action and locks it to the original concentration target', () => {
    const actor = caster('bard', 'bard', 'heat-metal', 5, 3)
    const target = enemy('marked')
    const other = enemy('other')
    const cast = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('heat-metal', [actor, target, other]),
      {
        type: 'cast-spell', actorId: actor.id, targetId: target.id,
        targetIds: [target.id], spellId: 'heat-metal', slotLevel: 3,
        effectRolls: [4, 4, 4],
      },
    )
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants[target.id].currentHp).toBe(48)
    expect(cast.state.combatants[actor.id].classState.concentrationTargetIds).toEqual([target.id])
    cast.state.combatants[actor.id].turn.bonusActionAvailable = true
    const repeated = resolveDnd5eHeadlessAction(cast.state, {
      type: 'cast-spell', actorId: actor.id, targetId: target.id, targetIds: [target.id],
      spellId: 'heat-metal', slotLevel: 3, sustainedEffectAttack: 'heat-metal',
      effectRolls: [3, 3, 3],
    })
    expect(repeated.ok).toBe(true)
    if (!repeated.ok) return
    expect(repeated.state.combatants[target.id].currentHp).toBe(39)
    expect(repeated.state.combatants[actor.id].turn.bonusActionAvailable).toBe(false)
    cast.state.combatants[actor.id].turn.bonusActionAvailable = true
    expect(resolveDnd5eHeadlessAction(cast.state, {
      type: 'cast-spell', actorId: actor.id, targetId: other.id, targetIds: [other.id],
      spellId: 'heat-metal', slotLevel: 3, sustainedEffectAttack: 'heat-metal',
      effectRolls: [3, 3, 3],
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('heals Vampiric Touch from actual damage and preserves its original slot for repeat attacks', () => {
    const actor = caster('wizard', 'wizard', 'vampiric-touch', 5, 3)
    actor.currentHp = 10
    const target = enemy('target')
    const cast = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('vampiric-touch', [actor, target]),
      {
        type: 'cast-spell', actorId: actor.id, targetId: target.id,
        targetIds: [target.id], spellId: 'vampiric-touch', slotLevel: 3,
        d20: 15, effectRolls: [6, 4, 2],
      },
    )
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants[actor.id].currentHp).toBe(16)
    expect(cast.state.combatants[target.id].currentHp).toBe(48)
    cast.state.combatants[actor.id].turn.actionAvailable = true
    const repeated = resolveDnd5eHeadlessAction(cast.state, {
      type: 'cast-spell', actorId: actor.id, targetId: target.id, targetIds: [target.id],
      spellId: 'vampiric-touch', slotLevel: 3, sustainedEffectAttack: 'vampiric-touch',
      d20: 15, effectRolls: [6, 6, 6],
    })
    expect(repeated.ok).toBe(true)
    if (!repeated.ok) return
    expect(repeated.state.combatants[actor.id].currentHp).toBe(25)
    expect(repeated.state.combatants[target.id].currentHp).toBe(30)
    expect(repeated.state.combatants[actor.id].classResources['dnd5e-spell-slot-3']).toEqual({ current: 0, max: 1 })
  })

  it('repeats Sunbeam as a new saving-throw line and applies its one-round blindness', () => {
    const actor = caster('wizard', 'wizard', 'sunbeam', 11, 6)
    const first = enemy('first', 100)
    const second = enemy('second', 100)
    const cast = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('sunbeam', [actor, first, second]),
      {
        type: 'cast-spell', actorId: actor.id, targetId: first.id,
        targetIds: [first.id, second.id], spellId: 'sunbeam', slotLevel: 6,
        targetSavingThrows: [{ targetId: first.id, d20: 1 }, { targetId: second.id, d20: 20 }],
        effectRolls: [8, 8, 8, 8, 8, 8],
      },
    )
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants[first.id].currentHp).toBe(52)
    expect(cast.state.combatants[second.id].currentHp).toBe(76)
    expect(cast.state.combatants[first.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({ standardCondition: 'blinded' }),
    )
    cast.state.combatants[actor.id].turn.actionAvailable = true
    const repeated = resolveDnd5eHeadlessAction(cast.state, {
      type: 'cast-spell', actorId: actor.id, targetId: second.id, targetIds: [second.id],
      spellId: 'sunbeam', slotLevel: 6, sustainedEffectAttack: 'sunbeam',
      savingThrowD20: 1, effectRolls: [1, 1, 1, 1, 1, 1],
    })
    expect(repeated.ok).toBe(true)
    if (!repeated.ok) return
    expect(repeated.state.combatants[second.id].currentHp).toBe(70)
    expect(repeated.state.combatants[actor.id].turn.actionAvailable).toBe(false)
  })

  it('holds Produce Flame as an effect, then consumes it when the flame is thrown', () => {
    const actor = caster('druid', 'druid', 'produce-flame', 5)
    const target = enemy('target')
    const cast = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('produce-flame', [actor, target]),
      {
        type: 'cast-spell', actorId: actor.id, targetId: actor.id,
        targetIds: [actor.id], spellId: 'produce-flame', slotLevel: 0, effectRolls: [],
      },
    )
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants[actor.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({ definitionId: 'srd-5.1:spell:produce-flame', potency: 0 }),
    )
    cast.state.combatants[actor.id].turn.actionAvailable = true
    const thrown = resolveDnd5eHeadlessAction(cast.state, {
      type: 'cast-spell', actorId: actor.id, targetId: target.id, targetIds: [target.id],
      spellId: 'produce-flame', slotLevel: 0, sustainedEffectAttack: 'produce-flame',
      d20: 15, effectRolls: [8, 8],
    })
    expect(thrown.ok).toBe(true)
    if (!thrown.ok) return
    expect(thrown.state.combatants[target.id].currentHp).toBe(44)
    expect(thrown.state.combatants[actor.id].classState.activeEffects ?? []).not.toContainEqual(
      expect.objectContaining({ definitionId: 'srd-5.1:spell:produce-flame' }),
    )
  })
})
