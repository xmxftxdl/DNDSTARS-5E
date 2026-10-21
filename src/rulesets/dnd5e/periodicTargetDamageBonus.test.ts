import { expect, it } from 'vitest'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'

it.each(['source-turn-start', 'target-turn-end'] as const)('keeps separate periodic pools and target ownership at %s', timing => {
  const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, controller: 'dm', initiative,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 10,
    currentHp: 50, maxHp: 50, temporaryHp: 0, speed: 30, concentrating: false, position: { x: 0, y: 0 } })
  const source = make('source', timing === 'source-turn-start' ? 30 : 10), target = make('target', 20)
  const pulse = (id: string) => createDnd5eMechanicalEffect({ id, definitionId: id, label: id, targetId: target.id,
    source: { kind: 'spell', actorId: source.id, rulesId: 'pulse' },
    periodicDamage: { timing, count: 1, sides: 8, type: 'fire' } })
  target.classState.activeEffects = [pulse('one'), pulse('two'), createDnd5eMechanicalEffect({ definitionId: 'mark', label: 'Mark',
    targetId: target.id, source: { kind: 'feature', actorId: source.id }, modifiers: { damageRollsBySourceBonus: 2 } })]
  const state = startDnd5eHeadlessCombat('two-pulses', [source, target])
  const rolls = [{ effectId: 'one', targetId: target.id, rolls: [3] }, { effectId: 'two', targetId: target.id, rolls: [4] }]
  const result = resolveDnd5eHeadlessAction(state, timing === 'source-turn-start'
    ? { type: 'begin-turn', actorId: source.id, turnSlotId: source.id, turnStartActiveEffectPeriodicDamageRolls: rolls }
    : { type: 'end-turn', actorId: target.id, activeEffectPeriodicDamageRolls: rolls, deferNextTurnStart: true })
  expect(result.ok, JSON.stringify(result)).toBe(true)
  expect(result.state.combatants.target.currentHp).toBe(39)
  expect(result.state.combatants.source.currentHp).toBe(50)
  expect(result.events.filter(event => event.type === 'damage-roll-bonus-applied')).toEqual([
    expect.objectContaining({ actorId: source.id, targetId: target.id, effectId: 'one', amount: 2 }),
    expect.objectContaining({ actorId: source.id, targetId: target.id, effectId: 'two', amount: 2 }),
  ])
})

it.each([
  ['normal', 9], ['half', 4], ['half-resistant', 2], ['half-vulnerable', 8], ['immune', 0], ['save-none', 0],
  ['foreign', 7], ['suspended', 7], ['removed', 7], ['missing-source', 7], ['negative-base', 0], ['invalid', 0],
] as const)('settles the source-owned periodic damage roll before save and defenses: %s', (mode, expected) => {
  const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, controller: 'dm', initiative,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 10,
    currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, concentrating: false, position: { x: 0, y: 0 } })
  const source = make('source', 10), target = make('target', 20)
  const save = mode.startsWith('half') || mode === 'save-none'
  const pulse = createDnd5eMechanicalEffect({ id: 'pulse', definitionId: 'pulse', label: 'Pulse', targetId: target.id,
    source: { kind: 'spell', actorId: mode === 'missing-source' ? 'absent' : source.id, rulesId: 'synthetic', spellLevel: 2 },
    periodicDamage: { timing: 'target-turn-start', count: 1, sides: 8, type: 'fire', modifier: mode === 'negative-base' ? -10 : 0,
      savingThrow: save ? { ability: 'con', dc: 10, damageOnSuccessfulSave: mode === 'save-none' ? 'none' : 'half' } : undefined } })
  const mark = createDnd5eMechanicalEffect({ definitionId: 'mark', label: 'Mark', targetId: target.id,
    source: { kind: 'feature', actorId: mode === 'foreign' ? 'other' : source.id },
    modifiers: { damageRollsBySourceBonus: 2 }, suspendedBy: mode === 'suspended' ? ['antimagic'] : undefined })
  target.classState.activeEffects = mode === 'removed' ? [pulse] : [pulse, mark]
  if (mode === 'half-resistant') target.damageResistances = ['fire']
  if (mode === 'half-vulnerable') target.damageVulnerabilities = ['fire']
  if (mode === 'immune') target.damageImmunities = ['fire']
  const state = startDnd5eHeadlessCombat('pulse', [target, source])
  const before = structuredClone(state)
  const result = resolveDnd5eHeadlessAction(state, { type: 'begin-turn', actorId: target.id, turnSlotId: target.id,
    turnStartActiveEffectPeriodicDamageRolls: [{ effectId: pulse.id, targetId: target.id, rolls: [mode === 'invalid' ? 9 : 7],
      ...(save ? { d20: 15 } : {}) }] })
  expect(result.ok, JSON.stringify(result)).toBe(mode !== 'invalid')
  expect(result.state.combatants.target.currentHp).toBe(30 - expected)
  expect(state).toEqual(before)
  if (!result.ok) return
  const qualifies = !['foreign', 'suspended', 'removed', 'missing-source'].includes(mode)
  const bonuses = result.events.filter(event => event.type === 'damage-roll-bonus-applied')
  expect(bonuses).toHaveLength(qualifies ? 1 : 0)
  if (qualifies) expect(bonuses[0]).toMatchObject({ actorId: source.id, targetId: target.id, amount: 2, group: 'periodic-damage', effectId: pulse.id })
  const retry = resolveDnd5eHeadlessAction(JSON.parse(JSON.stringify(result.state)), {
    type: 'begin-turn', actorId: target.id, turnSlotId: target.id,
  })
  expect(retry.ok).toBe(true)
  expect(retry.state.combatants.target.currentHp).toBe(30 - expected)
  expect(retry.events.some(event => event.type === 'damage-roll-bonus-applied')).toBe(false)
})
