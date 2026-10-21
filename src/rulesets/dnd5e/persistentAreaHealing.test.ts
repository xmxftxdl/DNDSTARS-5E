import { createDnd5eMechanicalEffect } from './activeEffects'
import { describe, expect, it } from 'vitest'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5ePersistentAreaTrigger, dnd5eCombatantPairKey } from './headlessCombatEngine'
import { normalizeDnd5ePersistentAreaTriggerSnapshot } from './persistentAreaTypes'
import { formatDnd5eCombatLogDetails } from '../../lib/combatLogDetails'
import { scaleDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityScaling'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'

const trigger = { id: 'heal', label: '治疗区域', timing: 'turn-start' as const,
  healing: { amount: 2, dice: { count: 2, sides: 6 } } }
const state = () => startDnd5eHeadlessCombat('healing-area', ['caster', 'target'].map(id => createDnd5eCombatant({
  id, name: id, controller: 'player', initiative: 10,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  proficiencyBonus: 2, armorClass: 10, currentHp: 5, maxHp: 20, temporaryHp: 0,
  speed: 30, position: { x: 0, y: 0 }, concentrating: false,
})))
const input = { areaId: 'area', sourceId: 'caster', targetId: 'target', trigger }

describe('persistent area healing dice', () => {
  it.each([false, true])('maximizes recipient healing dice and audits the effective rolls unless suspended: %s', suspended => {
    const current = state()
    current.combatants.target.maxHp = 50
    current.combatants.target.classState.activeEffects = [{ ...createDnd5eMechanicalEffect({ definitionId: 'test.maximum',
      label: 'Maximum', source: { kind: 'plugin' }, targetId: 'target', modifiers: { maximizeHealingDice: true } }),
      ...(suspended ? { suspendedBy: ['antimagic'] } : {}) }]
    const result = resolveDnd5ePersistentAreaTrigger(current, { ...input, healingRolls: [1, 2] })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    expect(result.state.combatants.target.currentHp).toBe(suspended ? 10 : 19)
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'persistent-area-triggered',
      healingRoll: { sides: 6, rolls: suspended ? [1, 2] : [6, 6], modifier: 2, total: suspended ? 5 : 14 } }))
    expect(resolveDnd5ePersistentAreaTrigger(current, { ...input, healingRolls: [9, 2] }).ok).toBe(false)
    expect(current.combatants.target.currentHp).toBe(5)
  })

  it('requires an explicit source choice and skips dice and healing on decline', () => {
    const request = { ...input, trigger: { ...trigger, sourceMayDecline: true } }
    expect(resolveDnd5ePersistentAreaTrigger(state(), request)).toMatchObject({ ok: false, reason: 'invalid-plugin-action' })
    const declined = resolveDnd5ePersistentAreaTrigger(state(), { ...request, sourceConsent: false })
    expect(declined.ok).toBe(true)
    expect(declined.state.combatants.target.currentHp).toBe(5)
    expect(declined.events).toEqual([expect.objectContaining({ type: 'persistent-area-triggered', declined: true, healing: 0 })])
    expect(resolveDnd5ePersistentAreaTrigger(state(), { ...request, sourceConsent: true, healingRolls: [3, 4] }).state.combatants.target.currentHp).toBe(14)
    expect(normalizeDnd5ePersistentAreaTriggerSnapshot(request.trigger)?.sourceMayDecline).toBe(true)
  })
  it('checks current source visibility while allowing the source to heal itself', () => {
    const before = state()
    const visibleTrigger = { ...trigger, requiresSourceVision: true }
    const request = { ...input, trigger: visibleTrigger, healingRolls: [3, 4] }
    expect(resolveDnd5ePersistentAreaTrigger(before, request).ok).toBe(true)
    before.lineOfSightBlockedByCombatantPair = { [dnd5eCombatantPairKey('caster', 'target')]: true }
    expect(resolveDnd5ePersistentAreaTrigger(before, request)).toMatchObject({ ok: false, reason: 'invalid-target' })
    expect(resolveDnd5ePersistentAreaTrigger(before, { ...request, targetId: 'caster' }).ok).toBe(true)
    before.lineOfSightBlockedByCombatantPair = {}
    expect(resolveDnd5ePersistentAreaTrigger(before, request).ok).toBe(true)
    expect(normalizeDnd5ePersistentAreaTriggerSnapshot(visibleTrigger)?.requiresSourceVision).toBe(true)
    expect(normalizeDnd5ePersistentAreaTriggerSnapshot({ ...visibleTrigger, requiresSourceVision: 'yes' })).toBeUndefined()
  })
  it('scales ongoing healing dice from the cast level without rolling on cast', () => {
    const scaled = scaleDnd5eActivityDefinitionV1({ schemaVersion: 1, id: 'healing-zone', name: 'Healing zone',
      activation: { kind: 'action', cost: 1 }, target: { kind: 'self' },
      automation: automationCapabilityFromLegacyStatus('full'),
      scaling: [{ basis: 'slot-level', baseLevel: 2, adjustments: [{ operationId: 'zone', diceCountPerStep: 1 }] }],
      outcomes: [{ id: 'create', when: { kind: 'always' }, operations: [{ id: 'zone', kind: 'create-persistent-area', label: 'zone', durationRounds: 10, concentration: true, triggers: [{ ...trigger, healing: { amount: 0, dice: { count: 1, sides: 6 } } }] }] }],
    }, { actor: { level: 7, proficiencyBonus: 3 }, castLevel: 4 }).activity
    const operation = scaled.outcomes[0].operations[0]
    expect(operation.kind).toBe('create-persistent-area')
    if (operation.kind !== 'create-persistent-area') throw new Error('missing-area')
    expect(operation.triggers?.[0].healing).toEqual({ amount: 0, dice: { count: 3, sides: 6 } })
  })
  it.each(['undead', '不死生物', 'construct', '构装生物'])('rejects excluded creature type %s at the Host', creatureType => {
    const before = state(); before.combatants.target.creatureType = creatureType
    const filtered = { ...trigger, excludedCreatureTypes: ['construct', 'undead'] }
    const result = resolveDnd5ePersistentAreaTrigger(before, { ...input, trigger: filtered, healingRolls: [3, 4] })
    expect(result).toMatchObject({ ok: false, reason: 'invalid-target' })
    expect(result.state.combatants.target.currentHp).toBe(5)
  })
  it('normalizes filters and rejects unknown or duplicate type ids', () => {
    expect(normalizeDnd5ePersistentAreaTriggerSnapshot({ ...trigger, excludedCreatureTypes: ['undead'] })?.excludedCreatureTypes).toEqual(['undead'])
    for (const types of [['zombie'], ['undead', 'undead'], []]) {
      expect(normalizeDnd5ePersistentAreaTriggerSnapshot({ ...trigger, excludedCreatureTypes: types })).toBeUndefined()
    }
    const before = state(); before.combatants.target.creatureType = '野兽'
    expect(resolveDnd5ePersistentAreaTrigger(before, { ...input, trigger: { ...trigger, includedCreatureTypes: ['beast'] }, healingRolls: [3, 4] }).ok).toBe(true)
    expect(resolveDnd5ePersistentAreaTrigger(before, { ...input, trigger: { ...trigger, includedCreatureTypes: ['humanoid'] }, healingRolls: [3, 4] })).toMatchObject({ ok: false, reason: 'invalid-target' })
  })
  it('preserves dice through normalization and heals from rolls plus the fixed bonus', () => {
    expect(normalizeDnd5ePersistentAreaTriggerSnapshot(trigger)?.healing).toEqual({ ...trigger.healing, onlyIfAtZero: false })
    const before = state()
    const result = resolveDnd5ePersistentAreaTrigger(before, { ...input, healingRolls: [3, 4] })
    expect(result.ok).toBe(true)
    expect(result.state.combatants.target.currentHp).toBe(14)
    expect(before.combatants.target.currentHp).toBe(5)
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'persistent-area-triggered', healing: 9 }))
    expect(formatDnd5eCombatLogDetails(result.events, { resolveName: id => id }).join('\n')).toContain('治疗骰 2d6（3 + 4）+2 = 9')
  })
  it.each([[], [3], [3, 4, 5], [0, 4], [7, 4], [1.5, 4]].map(rolls => ({ rolls })))('rejects invalid healing dice $rolls without changing HP', ({ rolls }) => {
    const result = resolveDnd5ePersistentAreaTrigger(state(), { ...input, healingRolls: rolls })
    expect(result).toMatchObject({ ok: false, reason: 'invalid-dice' })
    expect(result.state.combatants.target.currentHp).toBe(5)
  })
  it('caps healing, respects zero-only healing and retains fixed healing compatibility', () => {
    const capped = state(); capped.combatants.target.currentHp = 19
    const result = resolveDnd5ePersistentAreaTrigger(capped, { ...input, healingRolls: [6, 6] })
    expect(result.state.combatants.target.currentHp).toBe(20)
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'persistent-area-triggered', healing: 1 }))
    const zeroOnly = resolveDnd5ePersistentAreaTrigger(state(), { ...input, trigger: { ...trigger, healing: { ...trigger.healing, onlyIfAtZero: true } }, healingRolls: [6, 6] })
    expect(zeroOnly.state.combatants.target.currentHp).toBe(5)
    const fixed = { ...input, trigger: { ...trigger, healing: { amount: 3 } } }
    expect(resolveDnd5ePersistentAreaTrigger(state(), fixed).state.combatants.target.currentHp).toBe(8)
    expect(resolveDnd5ePersistentAreaTrigger(state(), { ...fixed, healingRolls: [3] })).toMatchObject({ ok: false, reason: 'invalid-dice' })
  })
  it.each([{ count: 0, sides: 6 }, { count: 101, sides: 6 }, { count: 1, sides: 7 }, { count: 1, sides: '6' }])('rejects malformed dice declarations %j', dice => {
    expect(normalizeDnd5ePersistentAreaTriggerSnapshot({ ...trigger, healing: { amount: 0, dice } })).toBeUndefined()
  })
})
