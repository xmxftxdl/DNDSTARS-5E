import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, type Dnd5eAction } from './headlessCombatEngine'
import { resolveDnd5eActionWithDamageReactions } from './damageReactionFlow'
import { registerDnd5eActivityPackage } from './activities/dnd5eActivityRegistry'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'

it.each([3, 4, 7].flatMap(level => [false, true].flatMap(critical => ['formula', 'weapon', 'faces'].map(mode => ({level, critical, mode})))))
('plans and resolves the same scaled hit formula (%j)', async ({level, critical, mode}) => {
  const weapon = mode === 'weapon', faces = mode === 'faces'
  const activity: Dnd5eActivityDefinitionV1 = {
    schemaVersion: 1, id: 'scaled', name: 'Synthetic level rider', activation: {kind: 'free'},
    invocation: {kind: 'triggered', event: 'attack-hit', confirmation: 'automatic'},
    legacySource: {kind: 'feature', id: 'scaled'}, automation: automationCapabilityFromLegacyStatus('full'),
    target: {kind: 'creature', count: 1, relation: 'enemy'},
    requirements: [{kind: 'once-per-turn', key: 'test:scaled'}],
    scaling: [{basis: 'class-level', classId: 'fighter', baseLevel: 3, maximumSteps: 2,
      adjustments: [{operationId: 'damage', diceCountPerStep: 1, flatAmountPerStep: 2, ...(faces ? {diceSidesPerStep: 2} : {})}]}],
    outcomes: [{id: 'hit', when: {kind: 'always'}, operations: [{id: 'damage', kind: 'damage', target: 'target',
      amount: weapon ? {kind: 'constant', value: 0} : {kind: 'dice', rollId: 'extra', count: 1, sides: 4},
      ...(weapon ? {weaponDiceFromTrigger: {rollId: 'extra', count: 1}} : {}),
      damageType: 'inherit-primary', critical: 'double-dice'}]}],
  }
  const registration = registerDnd5eActivityPackage({packageId: 'test.hit-scaling', packageVersion: '1.0.0', activities: [activity]})
  try {
    const make = (id: string) => createDnd5eCombatant({id, name: id, level: 20, classLevels: {fighter: level},
      initiative: id === 'actor' ? 20 : 10, controller: id === 'actor' ? 'player' : 'dm',
      abilities: {str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10}, proficiencyBonus: 6,
      armorClass: 10, currentHp: 40, maxHp: 40, temporaryHp: 0, speed: 30, concentrating: false, position: {x: 0, y: 0}})
    const actor = make('actor'), target = make('target')
    actor.pluginFeatureIds = ['scaled']; target.damageResistances = ['slashing']
    const state = startDnd5eHeadlessCombat('scaled-hit', [actor, target]), original = structuredClone(state)
    const action: Dnd5eAction = {type: 'attack', actorId: 'actor', targetId: 'target', d20: critical ? 20 : 18, attackModifier: 5,
      damage: {count: 1, sides: 6, bonus: 0, rolls: critical ? [3, 3] : [3], type: 'slashing'},
      classDamageContext: {mode: 'melee', weaponId: 'sword', weaponDamageSides: 6, finesse: false, strengthBased: true,
        damageType: 'slashing', adjacentEnemyOfTarget: false}}
    const steps = Math.min(2, level - 3), factor = critical ? 2 : 1
    const expectedSides = weapon ? 6 : faces ? 4 + 2 * steps : 4
    const rolledValue = faces ? expectedSides : 3
    let rolls = 0
    const result = await resolveDnd5eActionWithDamageReactions({state, action, combatRevision: 1, authorityUnchanged: () => true,
      confirm: async () => { throw Error('automatic rider must not ask') },
      roll: async request => { rolls++; expect(request).toMatchObject({count: (1 + steps) * factor, sides: expectedSides}); return Array(request.count).fill(rolledValue) },
    })
    expect(result.ok, result.ok ? '' : result.reason).toBe(true)
    expect(rolls).toBe(1)
    expect(result.state.combatants.target.currentHp).toBe(40 - Math.floor((3 * factor + rolledValue * (1 + steps) * factor + 2 * steps) / 2))
    expect(result.events.filter(event => event.type === 'damage-applied')).toHaveLength(1)
    expect(Object.keys(result.state.combatants.actor.classState.declarativeUsedTurnKeys ?? {})).toEqual(['test:scaled'])
    expect(state).toEqual(original)
    expect(activity.outcomes[0].operations[0]).toMatchObject({amount: weapon ? {kind: 'constant', value: 0} : {kind: 'dice', count: 1}})
  } finally { registration.dispose() }
})
