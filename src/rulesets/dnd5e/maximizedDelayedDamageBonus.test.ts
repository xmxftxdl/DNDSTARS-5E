import { expect, it } from 'vitest'
import { createDnd5eMechanicalEffect, normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict } from './activeEffects'
import { createDnd5eCombatant, dnd5eCombatantPairKey, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'

function cast() {
  const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative,
    controller: id === 'actor' ? 'player' : 'dm', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 5, armorClass: 10, currentHp: 50, maxHp: 50, temporaryHp: 0, speed: 30,
    concentrating: false, position: { x: 0, y: 0 } })
  const state = startDnd5eHeadlessCombat('maximum-delay', [make('actor', 20), make('target', 10)])
  Object.assign(state.combatants.actor, { classId: 'wizard', subclassId: 'evocation', subclassIds: { wizard: 'evocation' }, classLevels: { wizard: 14 }, level: 14,
    classSelections: { 'spell-prepared': ['acid-arrow'] }, classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } } })
  state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('actor', 'target')]: 30 }
  state.combatants.target.classState.activeEffects = [createDnd5eMechanicalEffect({ definitionId: 'mark', label: 'Mark',
    targetId: 'target', source: { kind: 'feature', actorId: 'actor' }, modifiers: { damageRollsBySourceBonus: 2 } })]
  const result = resolveDnd5eHeadlessAction(state, { type: 'cast-spell', actorId: 'actor', targetId: 'target',
    spellId: 'acid-arrow', slotLevel: 2, d20: 15, effectRolls: [], overchannel: true })
  expect(result.ok, JSON.stringify(result)).toBe(true)
  expect(result.state.combatants.target.currentHp).toBe(32)
  return result.state
}

it.each(['own', 'foreign', 'suspended', 'removed', 'legacy', 'resistant'] as const)(
  'maximum delayed dice retain provenance through reload and use current source marks: %s', mode => {
  const state = JSON.parse(JSON.stringify(cast())) as ReturnType<typeof cast>
  const target = state.combatants.target
  const pending = target.classState.activeEffects!.find(effect => effect.definitionId.endsWith(':delayed-damage'))!
  expect(pending).toMatchObject({ potency: 8, maximizedDamageRoll: { count: 2, sides: 4, bonus: 0 } })
  const mark = target.classState.activeEffects!.find(effect => effect.definitionId === 'mark')!
  if (mode === 'foreign') mark.source.actorId = 'other'
  if (mode === 'suspended') mark.suspendedBy = ['antimagic']
  if (mode === 'removed') target.classState.activeEffects = [pending]
  if (mode === 'legacy') delete pending.maximizedDamageRoll
  if (mode === 'resistant') target.damageResistances = ['acid']
  const endActor = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: 'actor' })
  expect(endActor.ok, JSON.stringify(endActor)).toBe(true)
  const endTarget = resolveDnd5eHeadlessAction(endActor.state, { type: 'end-turn', actorId: 'target' })
  expect(endTarget.ok, JSON.stringify(endTarget)).toBe(true)
  expect(endTarget.state.combatants.target.currentHp).toBe(mode === 'own' ? 22 : mode === 'resistant' ? 27 : 24)
  expect(endTarget.state.combatants.target.classState.activeEffects?.some(effect => effect.definitionId.endsWith(':delayed-damage')) ?? false).toBe(false)
  expect(endTarget.events.filter(event => event.type === 'damage-roll-bonus-applied')).toHaveLength(['own', 'resistant'].includes(mode) ? 1 : 0)
  const nextActor = resolveDnd5eHeadlessAction(endTarget.state, { type: 'end-turn', actorId: 'actor' })
  expect(nextActor.ok).toBe(true)
  const nextTarget = resolveDnd5eHeadlessAction(nextActor.state, { type: 'end-turn', actorId: 'target' })
  expect(nextTarget.ok).toBe(true)
  expect(nextTarget.state.combatants.target.currentHp).toBe(endTarget.state.combatants.target.currentHp)
  expect(nextTarget.events.some(event => event.type === 'delayed-spell-damage-triggered')).toBe(false)
})

it('rejects malformed or mismatched maximum-roll metadata instead of silently treating it as legacy potency', () => {
  const pending = cast().combatants.target.classState.activeEffects!.find(effect => effect.maximizedDamageRoll)!
  expect(validateDnd5eActiveEffectsStrict([pending]).ok).toBe(true)
  expect(normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([pending])))[0].maximizedDamageRoll).toEqual({ count: 2, sides: 4, bonus: 0 })
  for (const metadata of [{ count: 0, sides: 4, bonus: 8 }, { count: 101, sides: 4, bonus: 0 },
    { count: 2, sides: 3, bonus: 2 }, { count: 2, sides: 4, bonus: 1 }, { count: 2, sides: 4, bonus: '0' }]) {
    expect(validateDnd5eActiveEffectsStrict([{ ...pending, maximizedDamageRoll: metadata }]).ok).toBe(false)
    expect(normalizeDnd5eActiveEffects([{ ...pending, maximizedDamageRoll: metadata }])).toEqual([])
  }
})
