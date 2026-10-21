import { expect, it } from 'vitest'
import { getDnd5eSrdMonster } from './monsters'
import { formatDnd5eCombatLogDetails } from '../../lib/combatLogDetails'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { createDnd5eCombatant, dnd5eCombatantPairKey, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat, type Dnd5eAction } from './headlessCombatEngine'

function fixture() {
  const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative,
    controller: id === 'actor' ? 'player' : 'dm', abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
    proficiencyBonus: 2, armorClass: 10, currentHp: 50, maxHp: 50, temporaryHp: 0, speed: 30,
    concentrating: false, position: { x: 0, y: 0 } })
  const state = startDnd5eHeadlessCombat('spell-bonus', [make('actor', 20), make('target', 10), make('other', 5)])
  Object.assign(state.combatants.actor, { classId: 'wizard', level: 3,
    classSelections: { 'spell-cantrips': ['fire-bolt'], 'spell-prepared': ['scorching-ray', 'acid-arrow'] },
    classResources: { 'dnd5e-spell-slot-2': { current: 2, max: 2 } } })
  state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('actor', 'target')]: 30, [dnd5eCombatantPairKey('actor', 'other')]: 30 }
  state.combatants.target.classState.activeEffects = [createDnd5eMechanicalEffect({ definitionId: 'mark', label: 'Mark',
    targetId: 'target', source: { kind: 'feature', actorId: 'actor' }, modifiers: { damageRollsBySourceBonus: 2 } })]
  const action: Extract<Dnd5eAction, { type: 'cast-spell' }> = { type: 'cast-spell', actorId: 'actor', targetId: 'target',
    spellId: 'fire-bolt', slotLevel: 0, d20: 15, effectRolls: [5] }
  return { state, action }
}

it.each([
  ['ordinary', 7], ['critical', 9], ['resistance', 3], ['vulnerability', 14], ['immune', 0],
  ['miss', 0], ['foreign', 5], ['suspended', 5], ['removed', 5], ['invalid', 0],
] as const)('native spell attack adds a source bonus before defenses (%s)', (mode, damage) => {
  const { state, action } = fixture()
  const target = state.combatants.target
  if (mode === 'critical') { action.d20 = 20; action.effectRolls = [3, 4] }
  if (mode === 'resistance') target.damageResistances = ['fire']
  if (mode === 'vulnerability') target.damageVulnerabilities = ['fire']
  if (mode === 'immune') target.damageImmunities = ['fire']
  if (mode === 'miss') { action.d20 = 1; action.effectRolls = [] }
  if (mode === 'foreign') target.classState.activeEffects![0].source.actorId = 'other'
  if (mode === 'suspended') target.classState.activeEffects![0].suspendedBy = ['antimagic']
  if (mode === 'removed') target.classState.activeEffects = []
  if (mode === 'invalid') action.effectRolls = [11]
  const before = structuredClone(state)
  const result = resolveDnd5eHeadlessAction(state, action)
  expect(result.ok, JSON.stringify(result)).toBe(mode !== 'invalid')
  expect(result.state.combatants.target.currentHp).toBe(50 - damage)
  expect(result.events.filter(event => event.type === 'damage-roll-bonus-applied')).toHaveLength(
    ['ordinary', 'critical', 'resistance', 'vulnerability', 'immune'].includes(mode) ? 1 : 0)
  expect(state).toEqual(before)
})

it.each([false, true])('separate rays each qualify only against the marked target, with transactional rollback (%s)', invalid => {
  const { state } = fixture()
  const before = structuredClone(state)
  const result = resolveDnd5eHeadlessAction(state, { type: 'cast-spell', actorId: 'actor', targetId: 'target',
    spellId: 'scorching-ray', slotLevel: 2, effectRolls: [], targetIds: ['target', 'other'], projectileTargetIds: ['target', 'other', 'target'],
    targetAttacks: [
      { targetId: 'target', d20: 15, effectRolls: [3, 4] },
      { targetId: 'other', d20: 20, effectRolls: [2, 2, 2, 2] },
      { targetId: 'target', d20: 15, effectRolls: [3, invalid ? 7 : 4] },
    ] })
  expect(result.ok, JSON.stringify(result)).toBe(!invalid)
  if (!result.ok) expect(result.reason).toBe('invalid-dice')
  expect(result.state.combatants.target.currentHp).toBe(invalid ? 50 : 32)
  expect(result.state.combatants.other.currentHp).toBe(invalid ? 50 : 42)
  expect(result.state.combatants.actor.classResources['dnd5e-spell-slot-2'].current).toBe(invalid ? 2 : 1)
  if (!invalid) expect(result.events.filter(event => event.type === 'damage-roll-bonus-applied')).toEqual([
    expect.objectContaining({ targetId: 'target', amount: 2, group: 'spell-attack' }),
    expect.objectContaining({ targetId: 'target', amount: 2, group: 'spell-attack' }),
  ])
  expect(state).toEqual(before)
})

it('includes the bonus before acid-arrow miss damage is halved and resisted', () => {
  const { state, action } = fixture()
  state.combatants.target.damageResistances = ['acid']
  Object.assign(action, { spellId: 'acid-arrow', slotLevel: 2, d20: 1, effectRolls: [2, 2, 2, 1] })
  const result = resolveDnd5eHeadlessAction(state, action)
  expect(result.ok, JSON.stringify(result)).toBe(true)
  expect(result.state.combatants.target.currentHp).toBe(48)
  expect(result.events.filter(event => event.type === 'damage-roll-bonus-applied')).toHaveLength(1)
})

it.each([false, true])('shared saving-throw pool keeps per-target bonuses separate (half=%s)', half => {
  const { state } = fixture()
  state.combatants.actor.classSelections['spell-prepared'] = ['burning-hands']
  state.combatants.actor.classResources['dnd5e-spell-slot-1'] = { current: 1, max: 1 }
  state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('actor', 'target')]: 10, [dnd5eCombatantPairKey('actor', 'other')]: 10 }
  state.combatants.target.damageVulnerabilities = ['fire']
  const before = structuredClone(state)
  const result = resolveDnd5eHeadlessAction(state, { type: 'cast-spell', actorId: 'actor', targetId: 'target',
    targetIds: ['target', 'other'], spellId: 'burning-hands', slotLevel: 1, effectRolls: [2, 2, 3],
    targetSavingThrows: ['target', 'other'].map(targetId => ({ targetId, d20: half ? 20 : 1 })) })
  expect(result.ok, JSON.stringify(result)).toBe(true)
  expect(result.state.combatants.target.currentHp).toBe(half ? 42 : 32)
  expect(result.state.combatants.other.currentHp).toBe(half ? 47 : 43)
  expect(result.events.filter(event => event.type === 'damage-roll-bonus-applied')).toEqual([
    expect.objectContaining({ targetId: 'target', amount: 2, group: 'spell-save' }),
  ])
  expect(state).toEqual(before)
})

it.each([false, true])('single save damage uses the same source bonus ordering (half=%s)', half => {
  const { state } = fixture()
  state.combatants.actor.classSelections['spell-prepared'] = ['burning-hands']
  state.combatants.actor.classResources['dnd5e-spell-slot-1'] = { current: 1, max: 1 }
  state.distanceFeetByCombatantPair![dnd5eCombatantPairKey('actor', 'target')] = 10
  state.combatants.target.damageResistances = ['fire']
  const result = resolveDnd5eHeadlessAction(state, { type: 'cast-spell', actorId: 'actor', targetId: 'target',
    spellId: 'burning-hands', slotLevel: 1, effectRolls: [2, 2, 3], savingThrowD20: half ? 20 : 1 })
  expect(result.ok, JSON.stringify(result)).toBe(true)
  expect(result.state.combatants.target.currentHp).toBe(half ? 48 : 46)
})

it.each([false, true])('multi-type shared pool applies one bonus and spends Cutting Words once (reaction=%s)', reaction => {
  const { state } = fixture()
  Object.assign(state.combatants.actor, { level: 7, classSelections: { 'spell-prepared': ['ice-storm'] },
    classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } } })
  Object.assign(state.combatants.other, { classId: 'bard', subclassId: 'lore', level: 5,
    classResources: { 'dnd5e-bardic-inspiration': { current: 2, max: 3 } } })
  const result = resolveDnd5eHeadlessAction(state, { type: 'cast-spell', actorId: 'actor', targetId: 'target',
    targetIds: ['target', 'other'], spellId: 'ice-storm', slotLevel: 4, effectRolls: [3, 4], additionalEffectRolls: [[1, 1, 1, 1]],
    targetSavingThrows: ['target', 'other'].map(targetId => ({ targetId, d20: 1 })),
    ...(reaction ? { cuttingWordsDamage: { bardId: 'other', roll: 3, distanceFeet: 30 } } : {}) })
  expect(result.ok, JSON.stringify(result)).toBe(true)
  expect(result.state.combatants.target.currentHp).toBe(reaction ? 40 : 37)
  expect(result.state.combatants.other.currentHp).toBe(reaction ? 42 : 39)
  expect(result.state.combatants.other.classResources['dnd5e-bardic-inspiration'].current).toBe(reaction ? 1 : 2)
  expect(result.events.filter(event => event.type === 'damage-roll-bonus-applied')).toEqual([
    expect.objectContaining({ targetId: 'target', amount: 2, damageType: 'bludgeoning' }),
  ])
})

it.each(['player', 'monster'] as const)('automatic projectiles keep each target bonus and defense separate: %s', caster => {
  for (const mode of ['normal', 'resistant', 'shield', 'invalid'] as const) {
    const { state } = fixture()
    const actor = state.combatants.actor
    if (caster === 'monster') {
      actor.statBlockId = 'srd-5.1:mage'
      actor.classState.monsterSpellSlots = { 1: { current: 1, max: 1 } }
    } else {
      actor.classSelections['spell-prepared'] = ['magic-missile']
      actor.classResources['dnd5e-spell-slot-1'] = { current: 1, max: 1 }
    }
    if (mode === 'resistant') state.combatants.target.damageResistances = ['force']
    if (mode === 'shield') Object.assign(state.combatants.target, { classId: 'wizard', level: 1,
      classSelections: { 'spell-prepared': ['shield'] }, classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } } })
    const before = structuredClone(state)
    const rolls = [2, 3, mode === 'invalid' ? 5 : 4]
    const shared = { targetIds: ['target', 'other'], projectileTargetIds: ['target', 'other', 'target'],
      ...(mode === 'shield' ? { shieldSpellReactionTargetIds: ['target'] } : {}) }
    const result = resolveDnd5eHeadlessAction(state, caster === 'monster'
      ? { type: 'monster-core-spell', actorId: 'actor', spellId: 'magic-missile', slotLevel: 1,
          resolution: { schemaVersion: 1, ...shared, effectRolls: rolls.map(value => [value]) } }
      : { type: 'cast-spell', actorId: 'actor', targetId: 'target', spellId: 'magic-missile', slotLevel: 1,
          ...shared, effectRolls: rolls })
    expect(result.ok, JSON.stringify({ caster, mode, result })).toBe(mode !== 'invalid')
    if (!result.ok) {
      expect(result.reason).toBe('invalid-dice')
      expect(result.state).toEqual(before)
    } else {
      expect(result.state.combatants.target.currentHp).toBe(mode === 'shield' ? 50 : mode === 'resistant' ? 45 : 38)
      expect(result.state.combatants.other.currentHp).toBe(46)
      expect(result.events.filter(event => event.type === 'damage-roll-bonus-applied')).toHaveLength(mode === 'shield' ? 0 : 2)
      const details = result.events.find(event => event.type === 'magic-missile-damage-resolved')!
      if (details.type === 'magic-missile-damage-resolved') {
        expect(details.projectiles.map(projectile => projectile.targetBonus ?? 0)).toEqual(mode === 'shield' ? [0, 0, 0] : [2, 0, 2])
        if (mode !== 'shield') expect(formatDnd5eCombatLogDetails([details], { resolveName: id => id }).join(' ')).toContain('伤害骰加值 +2')
      }
    }
    expect(state).toEqual(before)
  }
})

it('repeated automatic Heat Metal damage qualifies a new roll without spending a second spell slot', () => {
  const { state } = fixture()
  Object.assign(state.combatants.actor, { classId: 'bard', level: 3, classSelections: { 'spell-known': ['heat-metal'] } })
  state.combatants.target.damageResistances = ['fire']
  const cast = resolveDnd5eHeadlessAction(state, { type: 'cast-spell', actorId: 'actor', targetId: 'target',
    spellId: 'heat-metal', slotLevel: 2, effectRolls: [3, 4] })
  expect(cast.ok, JSON.stringify(cast)).toBe(true)
  expect(cast.state.combatants.target.currentHp).toBe(46)
  const repeat = resolveDnd5eHeadlessAction(cast.state, { type: 'cast-spell', actorId: 'actor', targetId: 'target',
    spellId: 'heat-metal', slotLevel: 2, sustainedEffectAttack: 'heat-metal', effectRolls: [3, 4] })
  expect(repeat.ok, JSON.stringify(repeat)).toBe(true)
  expect(repeat.state.combatants.target.currentHp).toBe(42)
  expect(repeat.state.combatants.actor.classResources['dnd5e-spell-slot-2'].current).toBe(1)
  expect(repeat.state.combatants.actor.turn.bonusActionAvailable).toBe(false)
  expect(repeat.events.filter(event => event.type === 'damage-roll-bonus-applied')).toHaveLength(1)
})

it.each(['ordinary', 'critical', 'resistant', 'foreign', 'invalid'] as const)('monster core spell attack respects the source mark: %s', mode => {
  const { state } = fixture()
  state.combatants.actor.controller = 'dm'
  state.combatants.actor.statBlockId = 'srd-5.1:mage'
  state.combatants.target.controller = 'player'
  if (mode === 'resistant') state.combatants.target.damageResistances = ['fire']
  if (mode === 'foreign') state.combatants.target.classState.activeEffects![0].source.actorId = 'other'
  const before = structuredClone(state)
  const result = resolveDnd5eHeadlessAction(state, { type: 'monster-core-spell', actorId: 'actor',
    spellId: 'fire-bolt', slotLevel: 0, resolution: { schemaVersion: 1, targetIds: ['target'],
      d20: mode === 'critical' ? 20 : 15, effectRolls: [mode === 'critical' ? [1, 2, 3, 4] : [3, mode === 'invalid' ? 11 : 4]] } })
  expect(result.ok, JSON.stringify(result)).toBe(mode !== 'invalid')
  expect(result.state.combatants.target.currentHp).toBe(50 - ({ ordinary: 9, critical: 12, resistant: 4, foreign: 7, invalid: 0 }[mode]))
  if (!result.ok) { expect(result.reason).toBe('invalid-dice'); expect(result.state).toEqual(before) }
  expect(state).toEqual(before)
})

it.each([false, true])('monster shared spell save keeps target-specific bonuses isolated (half=%s)', half => {
  const { state } = fixture()
  state.combatants.actor.controller = 'dm'
  Object.assign(state.combatants.actor, { statBlockId: 'srd-5.1:mage',
    classState: { monsterSpellSlots: { 3: { current: 1, max: 1 } } } })
  state.combatants.target.controller = state.combatants.other.controller = 'player'
  state.distanceFeetByCombatantPair![dnd5eCombatantPairKey('target', 'other')] = 10
  state.combatants.target.damageVulnerabilities = ['fire']
  const result = resolveDnd5eHeadlessAction(state, { type: 'monster-core-spell', actorId: 'actor',
    spellId: 'fireball', slotLevel: 3, resolution: { schemaVersion: 1, targetIds: ['target', 'other'],
      effectRolls: [[1, 1, 1, 1, 1, 1, 1, 2]],
      targetSavingThrows: ['target', 'other'].map(targetId => ({ targetId, d20: half ? 20 : 1 })) } })
  expect(result.ok, JSON.stringify(result)).toBe(true)
  expect(result.state.combatants.target.currentHp).toBe(half ? 40 : 28)
  expect(result.state.combatants.other.currentHp).toBe(half ? 46 : 41)
  expect(result.events.filter(event => event.type === 'damage-roll-bonus-applied')).toEqual([
    expect.objectContaining({ actorId: 'actor', targetId: 'target', amount: 2, group: 'spell-save' }),
  ])
})

it.each(['ordinary', 'critical', 'resistant', 'foreign', 'invalid'] as const)('monster weapon pools receive one fixed source bonus: %s', mode => {
  const { state } = fixture()
  state.combatants.actor.controller = 'dm'
  state.combatants.actor.statBlockId = 'srd-5.1:goblin'
  state.combatants.target.controller = 'player'
  state.distanceFeetByCombatantPair![dnd5eCombatantPairKey('actor', 'target')] = 5
  if (mode === 'resistant') state.combatants.target.damageResistances = ['slashing']
  if (mode === 'foreign') state.combatants.target.classState.activeEffects![0].source.actorId = 'other'
  const before = structuredClone(state)
  const result = resolveDnd5eHeadlessAction(state, { type: 'monster-action', actorId: 'actor', actionId: 'scimitar',
    rolls: [{ targetId: 'target', d20: mode === 'critical' ? 20 : 15,
      damageRolls: [mode === 'critical' ? [3, 4] : [mode === 'invalid' ? 7 : 5]] }] })
  expect(result.ok, JSON.stringify(result)).toBe(mode !== 'invalid')
  expect(result.state.combatants.target.currentHp).toBe(50 - ({ ordinary: 9, critical: 11, resistant: 4, foreign: 7, invalid: 0 }[mode]))
  if (!result.ok) { expect(result.reason).toBe('invalid-dice'); expect(result.state).toEqual(before) }
  expect(state).toEqual(before)
})

it('multi-type monster bite receives one bonus across physical and elemental components', () => {
  const { state } = fixture()
  state.combatants.actor.statBlockId = 'srd-5.1:young-red-dragon'
  state.combatants.actor.controller = 'dm'
  state.combatants.target.controller = 'player'
  state.distanceFeetByCombatantPair![dnd5eCombatantPairKey('actor', 'target')] = 5
  const bite = getDnd5eSrdMonster('srd-5.1:young-red-dragon')!.actions.find(action => action.id === 'bite')!.attack!
  expect(bite.damage).toHaveLength(2)
  const action: Extract<Dnd5eAction, { type: 'monster-action' }> = { type: 'monster-action', actorId: 'actor', actionId: 'bite',
    rolls: [{ targetId: 'target', d20: 15, damageRolls: bite.damage.map(component => Array(component.count).fill(2)) }] }
  const marked = resolveDnd5eHeadlessAction(state, action)
  state.combatants.target.classState.activeEffects = []
  const unmarked = resolveDnd5eHeadlessAction(state, action)
  expect(marked.ok, JSON.stringify(marked)).toBe(true)
  expect(unmarked.ok, JSON.stringify(unmarked)).toBe(true)
  expect(unmarked.state.combatants.target.currentHp - marked.state.combatants.target.currentHp).toBe(2)
  expect(marked.events.filter(event => event.type === 'damage-roll-bonus-applied')).toHaveLength(1)
})

it.each(['failed', 'half-vulnerable', 'half-resistant', 'foreign', 'invalid'] as const)('monster shared breath bonus precedes saves and defenses: %s', mode => {
  const { state } = fixture()
  Object.assign(state.combatants.actor, { controller: 'dm', statBlockId: 'srd-5.1:adult-black-dragon',
    classState: { schemaVersion: 2, monsterRechargeReadyByActionId: { 'acid-breath': true } } })
  state.combatants.target.controller = state.combatants.other.controller = 'player'
  if (mode === 'half-vulnerable' || mode === 'foreign') state.combatants.target.damageVulnerabilities = ['acid']
  if (mode === 'half-resistant') state.combatants.target.damageResistances = ['acid']
  if (mode === 'foreign') state.combatants.target.classState.activeEffects![0].source.actorId = 'other'
  const before = structuredClone(state)
  const result = resolveDnd5eHeadlessAction(state, { type: 'monster-area-action', actorId: 'actor', actionId: 'acid-breath',
    resolution: { schemaVersion: 1, targetIds: ['target', 'other'],
      targetSavingThrows: ['target', 'other'].map(targetId => ({ targetId, d20: mode === 'failed' ? 1 : 20 })),
      damageRolls: [mode === 'invalid' ? 9 : 2, ...Array(11).fill(1)] } })
  expect(result.ok, JSON.stringify(result)).toBe(mode !== 'invalid')
  const amount = { failed: 15, 'half-vulnerable': 14, 'half-resistant': 3, foreign: 12, invalid: 0 }[mode]
  expect(result.state.combatants.target.currentHp).toBe(50 - amount)
  expect(result.state.combatants.other.currentHp).toBe(mode === 'invalid' ? 50 : mode === 'failed' ? 37 : 44)
  if (!result.ok) { expect(result.reason).toBe('invalid-dice'); expect(result.state).toEqual(before) }
  else expect(result.state.combatants.actor.classState.monsterRechargeReadyByActionId?.['acid-breath']).toBe(false)
  expect(state).toEqual(before)
})

it('independent Kraken bolts each qualify even when the target is repeated', () => {
  const { state } = fixture()
  Object.assign(state.combatants.actor, { controller: 'dm', statBlockId: 'srd-5.1:kraken',
    classState: { monsterLegendaryActionPoints: 3 } })
  state.combatants.target.controller = state.combatants.other.controller = 'player'
  state.combatants.target.baseSavingThrowBonuses.dex = state.combatants.target.savingThrowBonuses.dex = 4
  const result = resolveDnd5eHeadlessAction(state, { type: 'monster-area-action', actorId: 'actor', actionId: 'lightning-storm',
    resolution: { schemaVersion: 1, targetIds: ['target', 'target', 'other'],
      targetSavingThrows: [{ targetId: 'target', d20: 1 }, { targetId: 'target', d20: 20 }, { targetId: 'other', d20: 1 }],
      damageRolls: [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3] } })
  expect(result.ok, JSON.stringify(result)).toBe(true)
  expect(result.state.combatants.target.currentHp).toBe(39)
  expect(result.state.combatants.other.currentHp).toBe(38)
  expect(result.events.filter(event => event.type === 'damage-roll-bonus-applied')).toHaveLength(2)
})
