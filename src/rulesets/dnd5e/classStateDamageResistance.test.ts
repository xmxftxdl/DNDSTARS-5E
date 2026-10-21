import { expect, it } from 'vitest'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { readDnd5eDeclaredDamageTraitReport } from './damageTraitReport'
import type { Dnd5eDamageType } from './damageTypes'
import { createDnd5eConditionEffect, createDnd5eMechanicalEffect } from './activeEffects'

it.each([
  ['rage', 'slashing', true], ['rage', 'fire', false],
  ['empty-body', 'cold', true], ['empty-body', 'force', false],
  ['draconic', 'fire', true], ['draconic', 'cold', false],
  ['petrified', 'psychic', true], ['expired', 'fire', false],
  ['poison-ward', 'poison', true], ['suspended-poison-ward', 'poison', false],
  ['fiend', 'fire', true], ['fiend', 'cold', false],
  ['low-fiend', 'fire', false], ['wrong-subclass', 'fire', false],
] as const)('keeps damage settlement and disclosure consistent for %s/%s', (mode, damageType, resisted) => {
  const actor = (id: string, initiative: number) => createDnd5eCombatant({
    id, name: id, controller: 'dm', initiative, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2, armorClass: 10, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30,
    position: { x: 0, y: 0 }, concentrating: false,
  })
  const target = actor('target', 1)
  if (mode === 'fiend' || mode === 'low-fiend' || mode === 'wrong-subclass') {
    target.classId = 'warlock'
    target.level = mode === 'low-fiend' ? 9 : 10
    target.classLevels = { warlock: target.level }
    target.subclassIds = { warlock: mode === 'wrong-subclass' ? 'archfey' : 'fiend' }
    target.classSelections['fiendish-resilience'] = ['fire']
  }
  if (mode === 'poison-ward' || mode === 'suspended-poison-ward') {
    const ward = createDnd5eMechanicalEffect({
      id: 'poison-ward', definitionId: 'srd-5.1:spell:protection-from-poison',
      label: 'Poison ward', targetId: 'target', source: { kind: 'spell', actorId: 'target' },
      modifiers: {},
    })
    if (mode === 'suspended-poison-ward') ward.suspendedBy = ['antimagic']
    target.classState.activeEffects = [ward]
  }
  if (mode === 'rage') target.classState.raging = true
  if (mode === 'empty-body') target.classState.emptyBodyRoundsRemaining = 1
  if (mode === 'draconic' || mode === 'expired') {
    target.classState.draconicResistanceType = 'fire'
    target.classState.draconicResistanceRoundsRemaining = mode === 'expired' ? 0 : 1
  }
  if (mode === 'petrified') {
    target.conditions = ['petrified']
    target.classState.activeEffects = [createDnd5eConditionEffect({
      condition: 'petrified', targetId: 'target', source: { kind: 'dm' }, duration: { type: 'permanent' },
    })]
  }
  const state = startDnd5eHeadlessCombat('traits', [actor('attacker', 20), target])
  const report = readDnd5eDeclaredDamageTraitReport(state.combatants.target, { state, targetId: 'target' })
  expect(report.resistances.includes(damageType as Dnd5eDamageType)).toBe(resisted)
  const result = resolveDnd5eHeadlessAction(state, {
    type: 'attack', actorId: 'attacker', targetId: 'target', d20: 15, attackModifier: 10,
    damage: { count: 1, sides: 8, bonus: 0, rolls: [8], type: damageType },
  })
  expect(result.ok).toBe(true)
  expect(result.state.combatants.target.currentHp).toBe(resisted ? 26 : 22)
})
