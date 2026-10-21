import { expect, it } from 'vitest'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { createDnd5eCombatant, dnd5eCombatantPairKey, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'

const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, controller: 'player', initiative,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 10,
  currentHp: 40, maxHp: 40, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
const mark = () => createDnd5eMechanicalEffect({ definitionId: 'mark', label: 'Mark', targetId: 'target',
  source: { kind: 'feature', actorId: 'source' }, modifiers: { damageRollsBySourceBonus: 2 } })

it.each(['failed', 'successful-progress', 'resistant', 'foreign', 'missing-source', 'invalid'] as const)(
  'repeat-save damage qualifies only on a failed save using the actual effect source: %s', mode => {
  const state = startDnd5eHeadlessCombat('repeat-bonus', [make('target', 20), make('source', 10)])
  state.combatants.target.classState.activeEffects = [createDnd5eMechanicalEffect({ id: 'fear', definitionId: 'fear', label: 'Fear',
    targetId: 'target', source: { kind: 'spell', actorId: mode === 'missing-source' ? 'missing' : 'source', rulesId: 'synthetic-fear' },
    repeatSave: { timing: 'target-turn-end', ability: 'wis', dc: 10, onSuccess: 'remove', successesRequired: 2,
      damageOnFailure: { count: 1, sides: 8, type: 'psychic' } } }), mark()]
  if (mode === 'foreign') state.combatants.target.classState.activeEffects[1].source.actorId = 'someone-else'
  if (mode === 'resistant') state.combatants.target.damageResistances = ['psychic']
  const before = structuredClone(state)
  const result = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: 'target', deferNextTurnStart: true,
    activeEffectSavingThrows: [{ effectId: 'fear', d20: mode === 'successful-progress' ? 20 : 1,
      damageRolls: [mode === 'invalid' ? 9 : 7] }] })
  expect(result.ok, JSON.stringify(result)).toBe(mode !== 'invalid')
  expect(result.state.combatants.target.currentHp).toBe(40 - ({ failed: 9, 'successful-progress': 0, resistant: 4, foreign: 7, 'missing-source': 7, invalid: 0 }[mode]))
  if (mode === 'successful-progress') expect(result.state.combatants.target.classState.activeEffects?.find(effect => effect.id === 'fear')?.repeatSave?.successes).toBe(1)
  expect(result.events.filter(event => event.type === 'damage-roll-bonus-applied')).toHaveLength(['failed', 'resistant'].includes(mode) ? 1 : 0)
  if (!result.ok) { expect(result.reason).toBe('invalid-dice'); expect(result.state).toEqual(before) }
  expect(state).toEqual(before)
})

it.each(['failed', 'half-vulnerable', 'half-resistant', 'foreign', 'invalid'] as const)(
  'Hellish Rebuke reaction damage adds before half saves and defenses: %s', mode => {
  const state = startDnd5eHeadlessCombat('rebuke-bonus', [make('target', 20), make('source', 10)])
  state.combatants.target.controller = 'dm'
  Object.assign(state.combatants.source, { classId: 'warlock', level: 1, classSelections: { 'spell-known': ['hellish-rebuke'] },
    classResources: { 'dnd5e-pact-slot': { current: 1, max: 1 } } })
  state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('source', 'target')]: 30 }
  state.combatants.target.classState.activeEffects = [mark()]
  if (mode === 'foreign') state.combatants.target.classState.activeEffects[0].source.actorId = 'other'
  if (mode === 'half-vulnerable') state.combatants.target.damageVulnerabilities = ['fire']
  if (mode === 'half-resistant') state.combatants.target.damageResistances = ['fire']
  const before = structuredClone(state)
  const result = resolveDnd5eHeadlessAction(state, { type: 'hellish-rebuke', actorId: 'source', targetId: 'target', slotLevel: 1,
    triggerDamageAmount: 5, savingThrowD20: mode.startsWith('half-') ? 20 : 1, effectRolls: [3, mode === 'invalid' ? 11 : 4] })
  expect(result.ok, JSON.stringify(result)).toBe(mode !== 'invalid')
  expect(result.state.combatants.target.currentHp).toBe(40 - ({ failed: 9, 'half-vulnerable': 8, 'half-resistant': 2, foreign: 7, invalid: 0 }[mode]))
  if (!result.ok) { expect(result.reason).toBe('invalid-dice'); expect(result.state).toEqual(before) }
  else expect(result.state.combatants.source.turn.reactionAvailable).toBe(false)
  expect(state).toEqual(before)
})
