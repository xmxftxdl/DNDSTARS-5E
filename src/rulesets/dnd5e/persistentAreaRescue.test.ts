import { expect, it } from 'vitest'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5ePersistentAreaTrigger, resolveDnd5eHeadlessAction, dnd5eCombatantPairKey, dnd5eDirectedCombatantPairKey } from './headlessCombatEngine'
import { normalizeDnd5eActiveEffects } from './activeEffects'
import { normalizeDnd5ePersistentAreaTriggerDeclaration, normalizeDnd5ePersistentAreaTriggerSnapshot, resolveDnd5ePersistentAreaTriggerSourceDc } from './persistentAreaTypes'

const declaration = { id: 'capture', label: 'Capture', timing: 'on-enter' as const,
  condition: { condition: 'restrained' as const, duration: { expiresAt: 'target-turn-end-save' as const, remainingRounds: 4800, saveAbility: 'dex' as const, saveDc: 'source-save-dc' as const },
    removalAction: { label: '解救', economy: 'action' as const, maxDistanceFeet: 5,
      abilityCheck: { ability: 'int' as const, skill: 'arcana' as const, dc: 'source-save-dc' as const } } } }

function fixture(suspend = false) {
  const trigger = resolveDnd5ePersistentAreaTriggerSourceDc({ ...declaration,
    condition: { ...declaration.condition, ...(suspend ? { endsWithArea: true, suspendAboveGroundFeet: 3 } : {}) } }, 15)!
  const state = startDnd5eHeadlessCombat('rescue', ['helper', 'caster', 'target'].map(id => createDnd5eCombatant({
    id, name: id, controller: 'player', initiative: id === 'helper' ? 20 : 10,
    abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 }, skillProficiencies: ['arcana'],
    proficiencyBonus: 2, armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0,
    speed: 30, position: { x: id === 'target' ? 0 : 10, y: 0 }, concentrating: false,
  })))
  state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('helper', 'target')]: 5 }
  state.combatants.target.elevationFeet = 0
  state.combatants.target.groundElevationFeet = 0
  const captured = resolveDnd5ePersistentAreaTrigger(state, { areaId: 'trap', sourceId: 'caster', targetId: 'target', trigger })
  expect(captured.ok).toBe(true)
  const target = captured.state.combatants.target
  target.classState.activeEffects = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify(target.classState.activeEffects)))
  const effect = target.classState.activeEffects!.find(e => e.standardCondition === 'restrained')!
  expect(effect.removal?.action?.abilityCheck).toEqual({ ability: 'int', skill: 'arcana', dc: 15 })
  expect(effect.repeatSave).toMatchObject({ ability: 'dex', dc: 15, timing: 'target-turn-end', onSuccess: 'remove' })
  return { state: captured.state, effect, action: { type: 'remove-active-effect' as const, actorId: 'helper', targetId: 'target', effectId: effect.id, d20: 10 } }
}

it('binds and persists the original source DC for both escape paths', () => {
  const normalized = normalizeDnd5ePersistentAreaTriggerDeclaration(declaration)!
  expect(normalized.condition?.removalAction?.abilityCheck?.dc).toBe('source-save-dc')
  const bound = resolveDnd5ePersistentAreaTriggerSourceDc(normalized, 17)!
  expect(normalizeDnd5ePersistentAreaTriggerSnapshot(JSON.parse(JSON.stringify(bound)))?.condition?.removalAction?.abilityCheck?.dc).toBe(17)
  expect(resolveDnd5ePersistentAreaTriggerSourceDc(normalized, undefined)).toBeUndefined()
  expect(normalizeDnd5ePersistentAreaTriggerSnapshot(declaration)).toBeUndefined()
})

it.each([true, false])('spends one action on a successful or failed Arcana rescue: %s', success => {
  const f = fixture()
  const result = resolveDnd5eHeadlessAction(f.state, { ...f.action, d20: success ? 10 : 1 })
  expect(result.ok, result.ok ? '' : result.reason).toBe(true)
  expect(result.state.combatants.helper.turn.actionAvailable).toBe(false)
  expect(result.state.combatants.target.conditions.includes('restrained')).toBe(!success)
  expect(result.events).toContainEqual(expect.objectContaining({ type: 'ability-check-resolved', skill: 'arcana', ability: 'int', dc: 15, success }))
  expect(resolveDnd5eHeadlessAction(result.state, f.action).ok).toBe(false)
})

it('rejects out-of-reach rescue without spending an action or clearing restraint', () => {
  const f = fixture()
  f.state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('helper', 'target')]: 10 }
  const result = resolveDnd5eHeadlessAction(f.state, f.action)
  expect(result).toMatchObject({ ok: false, reason: 'invalid-target' })
  expect(result.state.combatants.helper.turn.actionAvailable).toBe(true)
  expect(result.state.combatants.target.conditions).toContain('restrained')
})

it('rejects rescue through a wall even at a valid distance', () => {
  const f = fixture()
  f.state.lineOfEffectBlockedByCombatantPair = { [dnd5eDirectedCombatantPairKey('helper', 'target')]: true }
  const result = resolveDnd5eHeadlessAction(f.state, f.action)
  expect(result).toMatchObject({ ok: false, reason: 'invalid-target' })
  expect(result.state.combatants.helper.turn.actionAvailable).toBe(true)
})

it('holds a restrained creature three feet up and resolves its fall when rescued', () => {
  const f = fixture(true)
  expect(f.state.combatants.target.elevationFeet).toBe(3)
  expect(f.state.combatants.target.airborne).toBe(true)
  expect(f.effect.modifiers?.magicallyHeldAloft).toBe(true)
  const rescued = resolveDnd5eHeadlessAction(f.state, f.action)
  expect(rescued.ok, rescued.ok ? '' : rescued.reason).toBe(true)
  expect(rescued.state.combatants.target.elevationFeet).toBe(0)
  expect(rescued.state.combatants.target.airborne).toBe(false)
  expect(rescued.state.combatants.target.currentHp).toBe(20)
})

it.each([true, false])('resolves a suspended target end-turn save and lands only after success: %s', success => {
  const f = fixture(true)
  let state = f.state
  for (const actorId of ['helper', 'caster']) {
    const advance = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId })
    expect(advance.ok).toBe(true)
    state = advance.state
  }
  const result = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: 'target',
    activeEffectSavingThrows: [{ effectId: f.effect.id, d20: 20, d20Second: success ? 20 : 1 }] })
  expect(result.ok, result.ok ? '' : result.reason).toBe(true)
  expect(result.events).toContainEqual(expect.objectContaining({ type: 'saving-throw-resolved',
    targetId: 'target', rollMode: 'disadvantage', success }))
  expect(result.state.combatants.target.conditions.includes('restrained')).toBe(!success)
  expect(result.state.combatants.target.elevationFeet).toBe(success ? 0 : 3)
  expect(result.state.combatants.target.currentHp).toBe(20)
})

it.each(['stealth', '', 42, ['arcana']])('rejects unsupported rescue skills instead of silently dropping them: %s', skill => {
  expect(normalizeDnd5ePersistentAreaTriggerDeclaration({ ...declaration, condition: { ...declaration.condition,
    removalAction: { ...declaration.condition.removalAction, abilityCheck: { ability: 'int', skill, dc: 15 } } } })).toBeUndefined()
})
