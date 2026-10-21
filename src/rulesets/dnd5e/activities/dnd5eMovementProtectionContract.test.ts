import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { commitDnd5eActivityExecution, createDnd5eCombatant, dnd5eCombatantPairKey, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from '../headlessCombatEngine'
import { validateDnd5eActiveEffectsStrict } from '../activeEffects'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './dnd5eActivityCombatAuthority'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

const actor = (id: string, initiative: number) => createDnd5eCombatant({
  id, name: id, initiative, controller: 'player', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  proficiencyBonus: 2, armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30,
  position: { x: 0, y: 0 }, concentrating: false,
})

it('projects public protection, rejects direct opportunity attacks without cost, and restores attacks on expiry', () => {
  const activity: Dnd5eActivityDefinitionV1 = JSON.parse(JSON.stringify({
    schemaVersion: 1, id: 'movement-protection', name: 'Movement protection', activation: { kind: 'action' },
    target: { kind: 'self' }, consumption: [],
    effects: [{ schemaVersion: 1, id: 'protected', name: 'Protected', stacking: 'replace',
      duration: { kind: 'rounds', rounds: 2, expiresAt: 'target-turn-end' },
      modifiers: [{ kind: 'prevent-movement-opportunity-attacks' }] }],
    outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [{ id: 'apply', kind: 'apply-effect', target: 'actor', effectId: 'protected' }] }],
    automation: automationCapabilityFromLegacyStatus('full'),
  }))
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  expect(() => compileDnd5eActivityHeadlessAction(activity)).not.toThrow()
  let state = startDnd5eHeadlessCombat('movement-protection', [actor('mover', 20), actor('attacker', 10)])
  state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('mover', 'attacker')]: 5 }
  state.combatants.attacker.opportunityAttacksIgnoreDisengage = true
  const committed = commitDnd5eActivityExecution(state, { actorId: 'mover', activityId: activity.id, castLevel: 1,
    targetIds: ['mover'], source: { kind: 'spell', id: activity.id, packageId: 'test.movement' },
    resolution: resolveDnd5eActivity({ activity, actor: dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.mover),
      targets: [dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.mover)], castLevel: 1, rolls: {}, distanceFeetByTargetId: { mover: 0 } }),
  })
  expect(committed.ok).toBe(true)
  state = committed.state
  const effects = state.combatants.mover.classState.activeEffects!
  expect(validateDnd5eActiveEffectsStrict(JSON.parse(JSON.stringify(effects)))).toMatchObject({ ok: true, effects: [{ modifiers: { preventMovementOpportunityAttacks: true } }] })
  const malformed = structuredClone(effects) as any
  malformed[0].modifiers.preventMovementOpportunityAttacks = 'yes'
  expect(validateDnd5eActiveEffectsStrict(malformed).ok).toBe(false)
  const attack = { type: 'opportunity-attack' as const, actorId: 'attacker', targetId: 'mover', attackModifier: 5,
    d20: 15, damage: { count: 1, sides: 4, bonus: 0, rolls: [2] } }
  const rejected = resolveDnd5eHeadlessAction(state, attack)
  expect(rejected).toMatchObject({ ok: false, reason: 'invalid-target' })
  expect(rejected.state.combatants.attacker.turn.reactionAvailable).toBe(true)
  expect(rejected.state.combatants.mover.currentHp).toBe(20)
  // Independent reaction attacks are not movement provocations.
  const retaliation = structuredClone(state)
  Object.assign(retaliation.combatants.attacker, { classId: 'barbarian', subclassId: 'berserker', level: 14 })
  retaliation.combatants.attacker.classState.berserkerRetaliationTrigger = { sourceId: 'mover', round: 1 }
  expect(resolveDnd5eHeadlessAction(retaliation, { ...attack, reactionFeature: 'berserker-retaliation' }).ok).toBe(true)
  // A spell replacing a movement opportunity attack cannot bypass protection.
  const wizard = structuredClone(state)
  Object.assign(wizard.combatants.attacker, { classId: 'wizard', level: 5, controller: 'dm',
    abilities: { ...wizard.combatants.attacker.abilities, int: 16 },
    classSelections: { 'spell-cantrips': ['fire-bolt'] }, opportunityAttackSpellReplacement: true })
  const spell = { type: 'cast-spell' as const, actorId: 'attacker', targetId: 'mover', targetIds: ['mover'],
    castingClassId: 'wizard' as const, spellId: 'fire-bolt', slotLevel: 0, opportunityAttackSpell: true,
    d20: 15, effectRolls: [6, 5] }
  expect(resolveDnd5eHeadlessAction(wizard, spell)).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  expect(resolveDnd5eHeadlessAction(wizard, { ...spell, opportunityAttackSpell: false })).toMatchObject({ ok: false, reason: 'stale-turn' })
  wizard.combatants.mover.classState.activeEffects = []
  expect(resolveDnd5eHeadlessAction(wizard, spell).ok).toBe(true)
  const suspended = structuredClone(state)
  suspended.combatants.mover.classState.activeEffects![0].suspendedBy = ['test-antimagic']
  expect(resolveDnd5eHeadlessAction(suspended, attack).ok).toBe(true)
  for (const actorId of ['mover', 'attacker', 'mover', 'attacker', 'mover', 'attacker']) {
    const ended = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId })
    expect(ended.ok).toBe(true)
    state = ended.state
  }
  expect(resolveDnd5eHeadlessAction(state, attack).ok).toBe(true)
})


