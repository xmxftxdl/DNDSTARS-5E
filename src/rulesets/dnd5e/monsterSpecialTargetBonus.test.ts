import { expect, it } from 'vitest'
import { createDnd5eConditionEffect, createDnd5eMechanicalEffect } from './activeEffects'
import { createDnd5eCombatant, dnd5eCombatantPairKey, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { DND5E_SRD_MONSTERS } from './monsters'

const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative,
  controller: id === 'actor' ? 'dm' : 'player', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  proficiencyBonus: 2, armorClass: 12, currentHp: 100, maxHp: 100, temporaryHp: 0, speed: 30,
  concentrating: false, position: { x: 0, y: 0 } })
const mark = (source = 'actor', targetId = 'target') => createDnd5eMechanicalEffect({ definitionId: 'mark', label: 'Mark', targetId,
  source: { kind: 'feature', actorId: source }, modifiers: { damageRollsBySourceBonus: 3 } })

it.each(['saving-throw-damage-and-max-hp-reduction', 'conditioned-damage-and-healing'] as const)(
  'special damage feeds actual damage taken into downstream HP effects: %s', kind => {
    const monster = DND5E_SRD_MONSTERS.find(monster => [...monster.actions, ...(monster.legendaryActions ?? [])].some(action => action.rule?.kind === kind))!
    const definition = [...monster.actions, ...(monster.legendaryActions ?? [])].find(action => action.rule?.kind === kind)!
    const legendary = !!monster.legendaryActions?.includes(definition)
    const rule = definition.rule!
    if (rule.kind !== 'saving-throw-damage-and-max-hp-reduction' && rule.kind !== 'conditioned-damage-and-healing') throw Error('Fixture rule')
    for (const mode of ['own', 'foreign', 'resistant', 'invalid', 'half'] as const) {
      const state = startDnd5eHeadlessCombat('special-bonus', [make('actor', legendary ? 10 : 20), make('target', legendary ? 20 : 10)])
      Object.assign(state.combatants.actor, { statBlockId: monster.id, currentHp: 40 })
      state.combatants.actor.classState.monsterLegendaryActionPoints = 3
      state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('actor', 'target')]: 5 }
      state.combatants.target.classState.activeEffects = [mark(mode === 'foreign' ? 'other' : 'actor')]
      if (rule.kind === 'conditioned-damage-and-healing') state.combatants.target.classState.activeEffects.push(createDnd5eConditionEffect({
        condition: rule.requiredCondition, targetId: 'target', source: { kind: 'monster', actorId: 'actor', rulesId: `monster:${monster.id}:enslave` } }))
      if (rule.kind === 'conditioned-damage-and-healing') state.combatants.target.conditions = [rule.requiredCondition]
      if (mode === 'resistant') state.combatants.target.damageResistances = [rule.damage.type]
      const before = structuredClone(state)
      const result = resolveDnd5eHeadlessAction(state, { type: legendary ? 'monster-legendary-special-action' : 'monster-special-action', actorId: 'actor', targetId: 'target', actionId: definition.id,
        ...(rule.kind === 'saving-throw-damage-and-max-hp-reduction' ? { targetWilling: true, d20: mode === 'half' ? 20 : 1 } : {}),
        damageRolls: Array(rule.damage.count).fill(mode === 'invalid' ? rule.damage.sides + 1 : 1) })
      expect(result.ok, `${monster.slug}/${mode}: ${JSON.stringify(result)}`).toBe(mode !== 'invalid')
      if (!result.ok) { expect(result.state).toEqual(before); continue }
      let expected = rule.damage.count + rule.damage.bonus + (mode === 'foreign' ? 0 : 3)
      if (mode === 'half' && rule.kind === 'saving-throw-damage-and-max-hp-reduction') expected = Math.floor(expected / 2)
      if (mode === 'resistant') expected = Math.floor(expected / 2)
      expect(result.state.combatants.target.currentHp).toBe(100 - expected)
      if (rule.kind === 'conditioned-damage-and-healing') expect(result.state.combatants.actor.currentHp).toBe(40 + expected)
      else expect(result.state.combatants.target.maxHp).toBe(100 - expected)
      expect(result.events.filter(event => event.type === 'damage-roll-bonus-applied')).toHaveLength(mode === 'foreign' ? 0 : 1)
      expect(state).toEqual(before)
    }
  })

it.each(['own', 'foreign', 'resistant', 'invalid'] as const)('legendary wing shared dice apply bonuses only to failed-save recipients: %s', mode => {
  const monster = DND5E_SRD_MONSTERS.find(monster => monster.slug === 'adult-red-dragon')!
  const definition = monster.legendaryActions!.find(action => action.rule?.kind === 'legendary-wing-attack')!
  const rule = definition.rule!
  if (rule.kind !== 'legendary-wing-attack') throw Error('Wing fixture')
  const state = startDnd5eHeadlessCombat('wing-bonus', [make('actor', 10), make('target', 20), make('saved', 15)])
  Object.assign(state.combatants.actor, { statBlockId: monster.id, movementSpeeds: monster.speed })
  state.combatants.actor.classState.monsterLegendaryActionPoints = 3
  state.combatants.target.classState.activeEffects = [mark(mode === 'foreign' ? 'other' : 'actor')]
  state.combatants.saved.classState.activeEffects = [mark('actor', 'saved')]
  state.combatants.saved.savingThrowBonuses.dex = 40
  state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('actor', 'target')]: 5, [dnd5eCombatantPairKey('actor', 'saved')]: 5 }
  if (mode === 'resistant') state.combatants.target.damageResistances = [rule.damage.type]
  const before = structuredClone(state)
  const result = resolveDnd5eHeadlessAction(state, { type: 'monster-adjudicated-action', actorId: 'actor', actionId: definition.id, legendary: true, effects: [],
    damageRolls: Array(rule.damage.count).fill(1), targetSavingThrows: [{ targetId: 'target', d20: 1 }, { targetId: 'saved', d20: mode === 'invalid' ? 21 : 20 }] })
  expect(result.ok, JSON.stringify(result)).toBe(mode !== 'invalid')
  if (!result.ok) expect(result.state).toEqual(before)
  else {
    const raw = rule.damage.count + rule.damage.bonus + (mode === 'foreign' ? 0 : 3)
    expect(result.state.combatants.target.currentHp).toBe(100 - (mode === 'resistant' ? Math.floor(raw / 2) : raw))
    expect(result.state.combatants.saved.currentHp).toBe(100)
    expect(result.state.combatants.actor.classState.monsterLegendaryActionPoints).toBe(1)
    expect(result.events.filter(event => event.type === 'damage-roll-bonus-applied')).toHaveLength(mode === 'foreign' ? 0 : 1)
  }
  expect(state).toEqual(before)
})
