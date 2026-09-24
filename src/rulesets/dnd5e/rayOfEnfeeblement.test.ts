import { describe, expect, it } from 'vitest'
import { createDnd5eCombatant, dnd5eCombatantPairKey, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { ensureDnd5eCoreSpellActivitiesRegisteredV1 } from './activities/dnd5eCoreSpellActivities'

function cast(d20 = 15) {
  ensureDnd5eCoreSpellActivitiesRegisteredV1()
  const base = {
    abilities: { str: 16, dex: 16, con: 10, int: 18, wis: 10, cha: 10 },
    proficiencyBonus: 3, armorClass: 14, currentHp: 50, maxHp: 50,
    temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false,
  }
  const caster = createDnd5eCombatant({ ...base, id: 'caster', name: 'caster', controller: 'player', initiative: 20,
    classId: 'wizard', level: 5, classLevels: { wizard: 5 }, saveDc: 15,
    classSelections: { 'spell-prepared': ['ray-of-enfeeblement'] },
    classResources: { 'dnd5e-spell-slot-2': { current: 2, max: 2 } },
  })
  const target = createDnd5eCombatant({ ...base, id: 'target', name: 'target', controller: 'dm', initiative: 10,
    position: { x: 6, y: 0 }, savingThrowBonuses: { con: 0 },
  })
  const state = startDnd5eHeadlessCombat('ray-audit', [caster, target])
  state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('caster', 'target')]: 30 }
  const result = resolveDnd5eHeadlessAction(state, {
    type: 'plugin-spell-activity', actorId: caster.id,
    pluginAction: {
      type: 'plugin', pluginId: 'srd-5.1', actionId: 'spell:ray-of-enfeeblement',
      transactionId: 'ray-cast', actorId: caster.id, targetId: target.id, targetIds: [target.id],
      castLevel: 2, rolls: { 'spell-attack-d20:target': { values: [d20], modifier: 0, total: d20 } },
    },
    spell: { castingClassId: 'wizard', spellId: 'ray-of-enfeeblement', spellName: '衰弱射线',
      spellLevel: 2, slotLevel: 2, castingTime: 'action', declaredTargetIds: [target.id], spellSchool: 'necromancy',
      concentrationRounds: 10, concentrationTargetIds: [target.id] },
  })
  expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
  if (!result.ok) throw new Error(result.reason)
  return result
}

describe('Ray of Enfeeblement authoritative spell settlement', () => {
  it('spends a slot on a miss without applying the debuff or direct damage', () => {
    const result = cast(1)
    expect(result.state.combatants.caster.classResources['dnd5e-spell-slot-2'].current).toBe(1)
    expect(result.state.combatants.target.currentHp).toBe(50)
    expect(result.state.combatants.target.classState.activeEffects ?? []).toHaveLength(0)
  })

  it('applies exactly one concentrating effect with a target-end Constitution save on hit', () => {
    const result = cast()
    expect(result.state.combatants.target.currentHp).toBe(50)
    expect(result.state.combatants.caster.concentrating).toBe(true)
    expect(result.state.combatants.target.classState.activeEffects).toEqual([expect.objectContaining({
      modifiers: expect.objectContaining({ weaponDamageMultipliers: [{ multiplier: 0.5, ability: 'str' }] }),
      repeatSave: expect.objectContaining({ ability: 'con', dc: 15, timing: 'target-turn-end' }),
    })])
  })

  it.each([true, false])('halves only Strength weapon damage (strengthBased=%s)', (strengthBased) => {
    const result = cast()
    const turn = resolveDnd5eHeadlessAction(result.state, { type: 'end-turn', actorId: 'caster' })
    expect(turn.ok).toBe(true)
    if (!turn.ok) return
    turn.state.combatants.target.position = { x: 0, y: 0 }
    turn.state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('caster', 'target')]: 5 }
    const attack = resolveDnd5eHeadlessAction(turn.state, {
      type: 'attack', actorId: 'target', targetId: 'caster', attackModifier: 6, d20: 15,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [6], type: 'slashing' },
      classDamageContext: { mode: 'melee', finesse: !strengthBased, strengthBased,
        weaponDamageSides: 8, damageType: 'slashing', adjacentEnemyOfTarget: false },
    })
    expect(attack.ok, attack.ok ? undefined : attack.reason).toBe(true)
    if (!attack.ok) return
    expect(attack.state.combatants.caster.currentHp).toBe(strengthBased ? 46 : 41)
  })

  it.each([1, 20])('checks once at target turn end and removes only on success (d20=%s)', (d20) => {
    const result = cast()
    const effect = result.state.combatants.target.classState.activeEffects![0]!
    const turn = resolveDnd5eHeadlessAction(result.state, { type: 'end-turn', actorId: 'caster' })
    expect(turn.ok).toBe(true)
    if (!turn.ok) return
    const end = resolveDnd5eHeadlessAction(turn.state, {
      type: 'end-turn', actorId: 'target', activeEffectSavingThrows: [{ effectId: effect.id, d20 }],
    })
    expect(end.ok, end.ok ? undefined : end.reason).toBe(true)
    if (!end.ok) return
    expect(end.events.filter(event => event.type === 'active-effect-save-resolved')).toHaveLength(1)
    expect(end.state.combatants.target.classState.activeEffects ?? []).toHaveLength(d20 === 20 ? 0 : 1)
    expect(end.state.combatants.caster.concentrating).toBe(d20 !== 20)
  })

  it('removes the debuff when the caster fails concentration', () => {
    const result = cast()
    const ended = resolveDnd5eHeadlessAction(result.state, {
      type: 'concentration-save', actorId: 'caster', d20: 1, dc: 10,
    })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.state.combatants.caster.concentrating).toBe(false)
    expect(ended.state.combatants.target.classState.activeEffects ?? []).toHaveLength(0)
  })

  it('expires at the tenth subsequent caster turn end even when every repeat save fails', () => {
    let { state } = cast()
    const effectId = state.combatants.target.classState.activeEffects![0]!.id
    for (let round = 0; round < 10; round++) {
      const casterEnd = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: 'caster' })
      expect(casterEnd.ok).toBe(true)
      if (!casterEnd.ok) return
      const targetEnd = resolveDnd5eHeadlessAction(casterEnd.state, {
        type: 'end-turn', actorId: 'target', activeEffectSavingThrows: [{ effectId, d20: 1 }],
      })
      expect(targetEnd.ok, targetEnd.ok ? undefined : targetEnd.reason).toBe(true)
      if (!targetEnd.ok) return
      state = targetEnd.state
    }
    // The casting turn is not counted as a full elapsed round.
    expect(state.combatants.caster.classState.concentrationRoundsRemaining).toBe(1)
    const expired = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: 'caster' })
    expect(expired.ok).toBe(true)
    if (!expired.ok) return
    expect(expired.state.combatants.target.classState.activeEffects ?? []).toHaveLength(0)
    expect(expired.state.combatants.caster.concentrating).toBe(false)
  })
})
