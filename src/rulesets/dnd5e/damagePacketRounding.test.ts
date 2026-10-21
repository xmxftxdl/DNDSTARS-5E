import { expect, it } from 'vitest'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from './headlessCombatEngine'

it.each([
  { defense: 'resistance', expected: 3 }, { defense: 'vulnerability', expected: 12 },
  { defense: 'both', expected: 6 }, { defense: 'immunity', expected: 0 },
  { defense: 'different-type', expected: 4 }, { defense: 'different-magic', expected: 4 },
])('rounds compatible damage together and preserves source boundaries ($defense)', ({ defense, expected }) => {
  const make = (id: string) => createDnd5eCombatant({ id, name: id, initiative: id === 'actor' ? 20 : 10,
    controller: id === 'actor' ? 'player' : 'dm', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2, armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30,
    concentrating: false, position: { x: 0, y: 0 } })
  const actor = make('actor'), target = make('target')
  if (['resistance', 'both', 'different-type'].includes(defense)) target.damageResistances = ['slashing']
  if (['vulnerability', 'both'].includes(defense)) target.damageVulnerabilities = ['slashing']
  if (defense === 'immunity') target.damageImmunities = ['slashing']
  if (defense === 'different-magic') target.damageDefenseRules = [{ outcome: 'resistant', damageTypes: ['slashing'], magical: false }]
  const effect = createDnd5eMechanicalEffect({ id: 'rider', definitionId: 'test:rider', label: 'Rider', targetId: 'actor',
    source: { kind: 'spell', actorId: 'actor', magical: defense === 'different-magic' },
    duration: { type: 'permanent' }, modifiers: { onHitBonusDamage: {
      count: 1, sides: 6, bonus: 0, damageType: defense === 'different-type' ? 'fire' : 'slashing',
      appliesTo: 'all-weapon-attacks', doubleDiceOnCritical: true, oncePerTurn: false, consumeEffectOnHit: false,
    } } })
  actor.classState.activeEffects = [effect]
  const state = startDnd5eHeadlessCombat('rounding', [actor, target])
  const result = resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: 'actor', targetId: 'target', d20: 18, attackModifier: 5,
    damage: { count: 1, sides: 6, rolls: [3], bonus: 0, type: 'slashing' },
    classDamageContext: { mode: 'melee', weaponId: 'sword', finesse: false, strengthBased: true,
      weaponDamageSides: 6, damageType: 'slashing', adjacentEnemyOfTarget: false },
    classDamageRolls: [{ source: 'activity-effect-rider', rollId: 'activity-on-hit:rider', rolls: [3] }],
  })
  expect(result.ok, result.ok ? '' : result.reason).toBe(true)
  expect(result.state.combatants.target.currentHp).toBe(20 - expected)
  expect(result.events.filter(event => event.type === 'damage-applied')).toHaveLength(1)
  expect(result.events).toContainEqual(expect.objectContaining({ type: 'class-damage-applied', source: 'activity-effect-rider' }))
  expect(state.combatants.target.currentHp).toBe(20)
})
