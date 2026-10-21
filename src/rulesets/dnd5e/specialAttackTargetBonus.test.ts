import { expect, it } from 'vitest'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { createDnd5eCombatant, dnd5eCombatantPairKey, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'

const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative,
  controller: id === 'hunter' ? 'player' : 'dm', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  proficiencyBonus: 2, armorClass: 15, currentHp: 40, maxHp: 40, temporaryHp: 0, speed: 30,
  concentrating: false, position: { x: 0, y: 0 } })
const mark = (targetId: string, actorId: string) => createDnd5eMechanicalEffect({ definitionId: 'mark', label: 'Mark', targetId,
  source: { kind: 'feature', actorId }, modifiers: { damageRollsBySourceBonus: 2 } })

it.each(['own', 'hunter', 'suspended', 'critical', 'invalid'] as const)('redirected attacks use the original attacker source: %s', mode => {
  const state = startDnd5eHeadlessCombat('redirect-bonus', [make('actor', 20), make('hunter', 10), make('target', 5)])
  Object.assign(state.combatants.hunter, { classId: 'ranger', subclassId: 'hunter', level: 15,
    classSelections: { 'superior-hunters-defense': ['stand-against-tide'] } })
  state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('actor', 'hunter')]: 5,
    [dnd5eCombatantPairKey('actor', 'target')]: 5, [dnd5eCombatantPairKey('hunter', 'target')]: 5 }
  state.combatants.target.classState.activeEffects = [mark('target', mode === 'hunter' ? 'hunter' : 'actor')]
  if (mode === 'suspended') state.combatants.target.classState.activeEffects![0].suspendedBy = ['antimagic']
  const before = structuredClone(state)
  const result = resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: 'actor', targetId: 'hunter', d20: 2, attackModifier: 5,
    classDamageContext: { mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
      damageType: 'slashing', adjacentEnemyOfTarget: false },
    damage: { count: 1, sides: 8, bonus: 3, rolls: [], type: 'slashing' },
    standAgainstTide: { targetId: 'target', distanceFeet: 5, d20: mode === 'critical' ? 20 : 15,
      damageRolls: [mode === 'critical' ? [3, 4] : [mode === 'invalid' ? 9 : 6]] } })
  expect(result.ok, JSON.stringify(result)).toBe(mode !== 'invalid')
  expect(result.state.combatants.hunter.currentHp).toBe(40)
  expect(result.state.combatants.target.currentHp).toBe(40 - ({ own: 11, hunter: 9, suspended: 9, critical: 12, invalid: 0 }[mode]))
  expect(result.state.combatants.hunter.turn.reactionAvailable).toBe(mode === 'invalid')
  if (!result.ok) { expect(result.reason).toBe('invalid-dice'); expect(result.state).toEqual(before) }
  else expect(result.events.filter(event => event.type === 'damage-roll-bonus-applied')).toHaveLength(['own', 'critical'].includes(mode) ? 1 : 0)
  expect(state).toEqual(before)
})

it.each([false, true])('each Flurry attack owns a bonus and later invalid dice roll back ki and damage: %s', invalid => {
  const state = startDnd5eHeadlessCombat('flurry-bonus', [make('actor', 20), make('target', 10)])
  Object.assign(state.combatants.actor, { classId: 'monk', level: 2,
    classResources: { 'dnd5e-ki': { current: 2, max: 2 } } })
  state.combatants.actor.classState.monkAttackActionTurnKey = 'flurry-bonus:1:actor'
  state.combatants.target.classState.activeEffects = [mark('target', 'actor')]
  state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('actor', 'target')]: 5 }
  const before = structuredClone(state)
  const result = resolveDnd5eHeadlessAction(state, { type: 'monk-unarmed-bonus', actorId: 'actor', mode: 'flurry',
    attackModifier: 5, reachFeet: 5, damageType: 'bludgeoning', damage: { count: 1, sides: 4, bonus: 0 },
    attacks: [{ targetId: 'target', d20: 15, damageRolls: [3] },
      { targetId: 'target', d20: 20, damageRolls: [2, invalid ? 5 : 3] }] })
  expect(result.ok, JSON.stringify(result)).toBe(!invalid)
  expect(result.state.combatants.target.currentHp).toBe(invalid ? 40 : 28)
  expect(result.state.combatants.actor.classResources['dnd5e-ki'].current).toBe(invalid ? 2 : 1)
  expect(result.state.combatants.actor.turn.bonusActionAvailable).toBe(invalid)
  if (!result.ok) { expect(result.reason).toBe('invalid-dice'); expect(result.state).toEqual(before) }
  else expect(result.events.filter(event => event.type === 'damage-roll-bonus-applied')).toHaveLength(2)
  expect(state).toEqual(before)
})


it.each(['own', 'foreign', 'resistant', 'failed-save', 'invalid'] as const)('Quivering Palm only adds to the successful-save damage pool: %s', mode => {
  const state = startDnd5eHeadlessCombat('palm-bonus', [make('hunter', 20), make('target', 10)])
  Object.assign(state.combatants.hunter, { classId: 'monk', subclassId: 'open-hand', level: 17 })
  state.combatants.hunter.classState.quiveringPalmTargetId = 'target'
  state.combatants.target.classState.activeEffects = [mark('target', mode === 'foreign' ? 'other' : 'hunter')]
  if (mode === 'resistant') state.combatants.target.damageResistances = ['necrotic']
  const before = structuredClone(state)
  const result = resolveDnd5eHeadlessAction(state, { type: 'monk-quivering-palm-release', actorId: 'hunter', targetId: 'target',
    savingThrowD20: mode === 'failed-save' ? 1 : 20,
    damageRolls: mode === 'failed-save' ? [] : Array(10).fill(mode === 'invalid' ? 11 : 1) })
  expect(result.ok, JSON.stringify(result)).toBe(mode !== 'invalid')
  expect(result.state.combatants.target.currentHp).toBe(({ own: 28, foreign: 30, resistant: 34, 'failed-save': 0, invalid: 40 })[mode])
  if (!result.ok) { expect(result.reason).toBe('invalid-dice'); expect(result.state).toEqual(before) }
  else {
    expect(result.state.combatants.hunter.classState.quiveringPalmTargetId).toBeUndefined()
    expect(result.state.combatants.hunter.turn.actionAvailable).toBe(false)
    expect(result.events.filter(event => event.type === 'damage-roll-bonus-applied')).toHaveLength(['own', 'resistant'].includes(mode) ? 1 : 0)
  }
  expect(state).toEqual(before)
})

it.each(['own', 'foreign', 'critical', 'miss', 'decline', 'invalid'] as const)('returned missiles use the monk source and preserve transactional catch state: %s', mode => {
  const state = startDnd5eHeadlessCombat('return-bonus', [make('target', 20), make('hunter', 10)])
  Object.assign(state.combatants.hunter, { classId: 'monk', level: 3,
    classResources: { 'dnd5e-ki': { current: 2, max: 2 } } })
  Object.assign(state.combatants.hunter.classState, { deflectMissilesCatchTurnKey: 'return-bonus:1:target',
    deflectMissilesCatchSourceId: 'target', deflectMissilesCatchDamageType: 'piercing' })
  state.combatants.target.classState.activeEffects = [mark('target', mode === 'foreign' ? 'target' : 'hunter')]
  state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('hunter', 'target')]: 20 }
  const before = structuredClone(state)
  const result = resolveDnd5eHeadlessAction(state, { type: 'monk-deflect-missiles-return', actorId: 'hunter', targetId: 'target', distanceFeet: 20,
    decline: mode === 'decline', d20: mode === 'critical' ? 20 : mode === 'miss' ? 1 : 15,
    damageRolls: mode === 'critical' ? [2, 3] : ['miss', 'decline'].includes(mode) ? [] : [mode === 'invalid' ? 5 : 3] })
  expect(result.ok, JSON.stringify(result)).toBe(mode !== 'invalid')
  expect(result.state.combatants.target.currentHp).toBe(({ own: 35, foreign: 37, critical: 33, miss: 40, decline: 40, invalid: 40 })[mode])
  expect(result.state.combatants.hunter.classResources['dnd5e-ki'].current).toBe(['invalid', 'decline'].includes(mode) ? 2 : 1)
  if (!result.ok) { expect(result.reason).toBe('invalid-dice'); expect(result.state).toEqual(before) }
  else {
    expect(result.state.combatants.hunter.classState.deflectMissilesCatchSourceId).toBeUndefined()
    expect(result.events.filter(event => event.type === 'damage-roll-bonus-applied')).toHaveLength(['own', 'critical'].includes(mode) ? 1 : 0)
  }
  expect(state).toEqual(before)
})

it.each([1, 20, undefined])('resolves nested Shield casting saves on a redirected attack: %s', d20 => {
  const state = startDnd5eHeadlessCombat('pain-redirect', [make('actor', 20), make('hunter', 10), make('target', 5)])
  Object.assign(state.combatants.hunter, { classId: 'ranger', subclassId: 'hunter', level: 15,
    classSelections: { 'superior-hunters-defense': ['stand-against-tide'] } })
  Object.assign(state.combatants.target, { classId: 'wizard', level: 5,
    classSelections: { 'spell-prepared': ['shield'] }, classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } } })
  const pain = createDnd5eMechanicalEffect({ definitionId: 'pain', label: 'Pain', targetId: 'target',
    source: { kind: 'spell' }, spellcastingSave: { ability: 'con', dc: 18 } })
  state.combatants.target.classState.activeEffects = [pain]
  state.distanceFeetByCombatantPair = Object.fromEntries([['actor', 'hunter'], ['actor', 'target'], ['hunter', 'target']]
    .map(([a, b]) => [dnd5eCombatantPairKey(a, b), 5]))
  const result = resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: 'actor', targetId: 'hunter', d20: 2, attackModifier: 5,
    classDamageContext: { mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
      damageType: 'slashing', adjacentEnemyOfTarget: false },
    damage: { count: 1, sides: 8, bonus: 0, type: 'slashing', rolls: [] },
    standAgainstTide: { targetId: 'target', distanceFeet: 5, d20: 11, shieldSpellReaction: true,
      shieldSpellcastingSavingThrows: d20 == null ? undefined : [{ effectId: pain.id, d20 }],
      damageRolls: d20 === 20 ? [] : [[4]] } })
  expect(result.ok, result.ok ? '' : result.reason).toBe(d20 != null)
  if (!result.ok) { expect(result.state.combatants.target.classResources['dnd5e-spell-slot-1'].current).toBe(1); return }
  expect(result.state.combatants.target.currentHp).toBe(d20 === 20 ? 40 : 36)
  expect(result.state.combatants.target.classResources['dnd5e-spell-slot-1'].current).toBe(0)
  expect(result.state.combatants.target.turn.reactionAvailable).toBe(false)
  expect(result.events.filter(e => e.type === 'spell-cast' && e.spellId === 'shield')).toHaveLength(1)
})