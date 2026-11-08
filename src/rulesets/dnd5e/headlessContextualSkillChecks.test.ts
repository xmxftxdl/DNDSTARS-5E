import { describe, expect, it } from 'vitest'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { createDnd5eCombatant, dnd5eCombatantPairKey, dnd5eAbilityCheckRollMode, dnd5eSkillCheckMovementThisTurn, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'

function setup(level = 3) {
  const actor = createDnd5eCombatant({ id: 'hero', name: 'Hero', controller: 'player', initiative: 20,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 },
    proficiencyBonus: 2, armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30,
    position: { x: 0, y: 0 }, concentrating: false, classId: 'rogue', level, skillProficiencies: ['insight'],
  })
  actor.classState.activeEffects = [createDnd5eMechanicalEffect({
    definitionId: 'synthetic:contextual', label: 'Contextual', targetId: actor.id,
    source: { kind: 'feature', actorId: actor.id },
    modifiers: {
      minimumSkillCheckD20: [{ ability: 'wis', skill: 'insight', purpose: 'detect-lies', minimum: 8 }],
      skillCheckAdvantagesWithinHalfSpeed: [{ ability: 'wis', skill: 'perception' }, { ability: 'int', skill: 'investigation' }],
    },
  })]
  const other = createDnd5eCombatant({ ...actor, id: 'other', name: 'Other', initiative: 10 })
  other.classState.activeEffects = []
  return startDnd5eHeadlessCombat('contextual', [actor, other])
}

const check = { type: 'ability-check' as const, actorId: 'hero', ability: 'wis' as const, skill: 'insight', d20: 2 }

describe('Host contextual checks', () => {
  it('keeps exploration and stale cross-combat movement unknown without changing the ledger', () => {
    const state = setup()
    const ledger = { turnKey: 'previous-combat:1:hero', distanceByActor: { hero: 25 } }
    state.skillCheckMovement = ledger
    expect(dnd5eSkillCheckMovementThisTurn(state, 'hero')).toBeUndefined()
    expect(dnd5eAbilityCheckRollMode(state.combatants.hero, { state, ability: 'wis', skill: 'perception' })).toBe('normal')
    const checked = resolveDnd5eHeadlessAction(state, check)
    expect(checked.ok).toBe(true)
    expect(dnd5eSkillCheckMovementThisTurn(checked.state, 'hero')).toBeUndefined()
    expect(state.skillCheckMovement).toBe(ledger)
    state.active = false
    state.skillCheckMovement = { turnKey: 'contextual:1:hero', distanceByActor: {} }
    expect(dnd5eSkillCheckMovementThisTurn(state, 'hero')).toBeUndefined()
    expect(dnd5eAbilityCheckRollMode(state.combatants.hero, { state, ability: 'int', skill: 'investigation' })).toBe('normal')
  })

  it('counts actual forced movement on another creature turn', () => {
    const state = setup()
    state.initiativeIndex = 1
    state.combatants.other.controller = 'dm'
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('hero', 'other')]: 5 }
    state.combatants.hero.position = { x: 5, y: 0 }
    const pushed = resolveDnd5eHeadlessAction(state, { type: 'shove', actorId: 'other', targetId: 'hero', actorD20: 20, targetD20: 1,
      targetDefense: 'athletics', outcome: 'push', pushTo: { x: 10, y: 0 }, pushDistanceFeet: 5 })
    expect(pushed.ok, JSON.stringify(pushed)).toBe(true)
    expect(dnd5eSkillCheckMovementThisTurn(pushed.state, 'hero')).toBe(5)
  })

  it('preserves Reliable Talent when the purpose-scoped floor is lower', () => {
    const result = resolveDnd5eHeadlessAction(setup(11), check, {}, { abilityCheckPurpose: 'detect-lies' })
    expect(result.ok).toBe(true)
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'ability-check-resolved', d20: 10, reliableTalentApplied: true }))
  })

  it('excludes forced-sleep immunity from Sleep without granting unconscious immunity', () => {
    const state = setup()
    const caster = state.combatants.hero
    caster.classId = 'wizard'
    caster.level = 3
    caster.classSelections = { 'spell-prepared': ['sleep'] }
    caster.classResources = { 'dnd5e-spell-slot-1': { current: 1, max: 1 } }
    const target = state.combatants.other
    target.currentHp = 1
    target.cannotBeForcedToSleep = true
    const cast = resolveDnd5eHeadlessAction(state, { type: 'cast-spell', actorId: 'hero', targetId: 'other', spellId: 'sleep', slotLevel: 1, effectRolls: [8, 8, 8, 8, 8] })
    expect(cast.ok, JSON.stringify(cast)).toBe(true)
    expect(cast.state.combatants.other.conditions).not.toContain('unconscious')
    expect(cast.state.combatants.other.conditionImmunities).not.toContain('unconscious')
    expect(cast.state.combatants.hero.classResources['dnd5e-spell-slot-1']?.current).toBe(0)
  })

  it('requires a trusted explicit lie-detection purpose and preserves report-only outcomes', () => {
    const state = setup()
    const ordinary = resolveDnd5eHeadlessAction(state, check)
    expect(ordinary.ok).toBe(true)
    expect(ordinary.events).toContainEqual(expect.objectContaining({ type: 'ability-check-resolved', d20: 2, success: undefined }))
    const trusted = resolveDnd5eHeadlessAction(state, check, {}, { abilityCheckPurpose: 'detect-lies' })
    expect(trusted.ok).toBe(true)
    expect(trusted.events).toContainEqual(expect.objectContaining({ type: 'ability-check-resolved', d20: 8 }))
    const spoofed = resolveDnd5eHeadlessAction(state, { ...check, purpose: 'detect-lies' } as typeof check)
    expect(spoofed.events).toContainEqual(expect.objectContaining({ type: 'ability-check-resolved', d20: 2 }))
    expect(resolveDnd5eHeadlessAction(state, { ...check, skill: 'perception' }, {}, { abilityCheckPurpose: 'detect-lies' }).ok).toBe(false)
  })

  it('tracks actual movement separately from spent movement and resets each global turn', () => {
    const state = setup()
    state.combatants.hero.turn.movementSpent = 10
    const moved = resolveDnd5eHeadlessAction(state, { type: 'move', actorId: 'hero', to: { x: 15, y: 0 }, distance: 15 })
    expect(moved.ok, JSON.stringify(moved)).toBe(true)
    expect(dnd5eSkillCheckMovementThisTurn(moved.state, 'hero')).toBe(15)
    expect(dnd5eAbilityCheckRollMode(moved.state.combatants.hero, { state: moved.state, ability: 'wis', skill: 'perception' })).toBe('advantage')
    const farther = resolveDnd5eHeadlessAction(moved.state, { type: 'move', actorId: 'hero', to: { x: 16, y: 0 }, distance: 1 })
    expect(farther.ok).toBe(true)
    expect(dnd5eAbilityCheckRollMode(farther.state.combatants.hero, { state: farther.state, ability: 'wis', skill: 'perception' })).toBe('normal')
    const next = resolveDnd5eHeadlessAction(farther.state, { type: 'end-turn', actorId: 'hero' })
    expect(next.ok).toBe(true)
    expect(dnd5eSkillCheckMovementThisTurn(next.state, 'hero')).toBe(0)
    expect(dnd5eAbilityCheckRollMode(next.state.combatants.hero, { state: next.state, ability: 'int', skill: 'investigation' })).toBe('advantage')
    next.state.skillCheckMovement!.distanceByActor.hero = 20
    expect(dnd5eAbilityCheckRollMode(next.state.combatants.hero, { state: next.state, ability: 'int', skill: 'investigation' })).toBe('normal')
  })

  it('does not assume an old snapshot has no movement and cancels advantage against exhaustion', () => {
    const state = setup()
    delete state.skillCheckMovement
    expect(dnd5eAbilityCheckRollMode(state.combatants.hero, { state, ability: 'wis', skill: 'perception' })).toBe('normal')
    const next = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: 'hero' })
    expect(next.ok).toBe(true)
    next.state.combatants.hero.exhaustionLevel = 1
    expect(dnd5eAbilityCheckRollMode(next.state.combatants.hero, { state: next.state, ability: 'wis', skill: 'perception' })).toBe('normal')
  })
})
