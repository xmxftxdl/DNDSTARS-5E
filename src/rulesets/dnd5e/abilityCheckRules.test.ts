import { expect, it } from 'vitest'
import { createDnd5eMechanicalEffect, normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict } from './activeEffects'
import { dnd5eAbilityCheckMode } from './checks'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { resolveDnd5eActivity } from './activities/dnd5eActivityExecutor'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './activities/dnd5eActivityCombatAuthority'
import { dnd5eActivitySequentialCheckModesV1 } from './activities/dnd5eActivitySequentialCheckModes'
import { validateDnd5eEffectDefinitionV1 } from './activities/dnd5eActivityValidation'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import type { Dnd5eAbilityCheckRule } from './abilityCheckRules'

const rules: Dnd5eAbilityCheckRule[] = [
  { mode: 'advantage', ability: 'cha', skill: 'intimidation' },
  { mode: 'disadvantage', ability: 'cha', excludedSkills: ['intimidation'] },
]

it('preserves smell-only perception advantage through authoring, reload and Host settlement', () => {
  const definition = { schemaVersion: 1 as const, id: 'smell', name: 'Smell', stacking: 'replace' as const,
    duration: { kind: 'permanent' as const }, modifiers: [
      { kind: 'ability-check' as const, mode: 'advantage' as const, ability: 'wis' as const, skill: 'perception', sense: 'smell' as const },
    ] }
  expect(validateDnd5eEffectDefinitionV1(definition)).toEqual([])
  const effects = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([createDnd5eMechanicalEffect({
    definitionId: 'smell', label: 'Smell', source: { kind: 'plugin' }, targetId: 'actor',
    modifiers: { abilityCheckRules: [{ mode: 'advantage', ability: 'wis', skill: 'perception', sense: 'smell' }] },
  })])))
  expect(validateDnd5eActiveEffectsStrict(effects).ok).toBe(true)
  const actor = createDnd5eCombatant({ id: 'actor', name: 'Actor', controller: 'player', initiative: 20,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, armorClass: 12,
    proficiencyBonus: 2, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, concentrating: false, position: { x: 0, y: 0 } })
  actor.classState.activeEffects = effects
  for (const context of ['smell', 'hearing', 'sight', undefined] as const) {
    const state = startDnd5eHeadlessCombat('smell-check', [structuredClone(actor), { ...structuredClone(actor), id: 'enemy', controller: 'dm', initiative: 1 }])
    const result = resolveDnd5eHeadlessAction(state, { type: 'ability-check', actorId: 'actor', ability: 'wis',
      skill: 'perception', context, d20: 4, d20Second: 18, dc: 10 })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'ability-check-resolved', total: context === 'smell' ? 18 : 4 }))
  }
  const invalid = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('invalid-smell', [actor, { ...structuredClone(actor), id: 'enemy', controller: 'dm', initiative: 1 }]), {
    type: 'ability-check', actorId: 'actor', ability: 'wis', skill: 'insight', context: 'smell', d20: 18,
  })
  expect(invalid.ok).toBe(false)
})
const effect = () => createDnd5eMechanicalEffect({ definitionId: 'test:conditional-check', label: 'Conditional checks',
  source: { kind: 'plugin' }, targetId: 'actor', modifiers: { abilityCheckRules: rules } })

it.each([
  ['cha', 'intimidation', 'advantage', 18], ['cha', 'persuasion', 'disadvantage', 4],
  ['cha', undefined, 'disadvantage', 4], ['str', 'intimidation', 'normal', 4],
  ['wis', 'perception', 'normal', 4],
] as const)('preserves %s/%s selectors through reload, ordinary Host and Activity checks', (ability, skill, mode, total) => {
  const effects = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([effect()])))
  expect(effects[0].modifiers?.abilityCheckRules).toEqual(rules)
  const character = { charClass: '战士', level: 1, dnd5eCombatState: { activeEffects: effects } }
  expect(dnd5eAbilityCheckMode(character, { ability, skill })).toBe(mode)
  const actor = createDnd5eCombatant({ id: 'actor', name: 'Actor', controller: 'player', initiative: 20,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, armorClass: 12,
    proficiencyBonus: 2, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, concentrating: false, position: { x: 0, y: 0 } })
  const authoring: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'grant', name: 'Grant',
    activation: { kind: 'free' }, target: { kind: 'self' },
    effects: [{ schemaVersion: 1, id: 'effect', name: 'Effect', stacking: 'replace', duration: { kind: 'permanent' },
      modifiers: rules.map(rule => ({ kind: 'ability-check', ...rule })) }],
    outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [
      { id: 'apply', kind: 'apply-effect', target: 'actor', effectId: 'effect' },
    ] }], automation: automationCapabilityFromLegacyStatus('full') }
  const grantSnapshot = dnd5eActivityActorSnapshotFromCombatantV1(actor)
  const grant = resolveDnd5eActivity({ activity: authoring, actor: grantSnapshot, targets: [grantSnapshot], rolls: {} })
  expect(grant.ok, JSON.stringify(grant)).toBe(true)
  if (!grant.ok) throw Error('grant failed')
  const proposal = grant.proposals.find(p => p.kind === 'apply-effect')
  if (!proposal || proposal.kind !== 'apply-effect') throw Error('missing effect')
  expect(proposal.modifierGroups[0].abilityCheckRules).toEqual(rules)
  actor.classState.activeEffects = effects
  const state = startDnd5eHeadlessCombat('conditional-checks', [actor, { ...structuredClone(actor), id: 'enemy', controller: 'dm', initiative: 1 }])
  const host = resolveDnd5eHeadlessAction(state, { type: 'ability-check', actorId: 'actor',
    ability, skill, d20: 4, d20Second: 18, dc: 10 })
  if (ability === 'str') {
    // The ordinary check command permits standard skill/ability pairings only.
    expect(host).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  } else {
    expect(host.ok, JSON.stringify(host)).toBe(true)
    expect(host.events).toContainEqual(expect.objectContaining({ type: 'ability-check-resolved', total }))
  }
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'check', name: 'Check',
    activation: { kind: 'free' }, target: { kind: 'self' },
    checks: [{ id: 'check', rollId: 'check', ability, dc: { kind: 'constant', value: 10 }, rollMode: 'host-derived',
      ...(skill ? { kind: 'skill-check', skill } : { kind: 'ability-check' }) }],
    outcomes: [{ id: 'done', when: { kind: 'always' }, operations: [
      { id: 'done', kind: 'mechanic', target: 'actor', handlerId: 'core.resolve-only' },
    ] }], automation: automationCapabilityFromLegacyStatus('full') }
  const snapshot = dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.actor)
  const resolved = resolveDnd5eActivity({ activity, actor: snapshot, targets: [snapshot],
    rolls: { check: { values: mode === 'normal' ? [4] : [4, 18] } },
    resolveSequentialCheckRollModes: dnd5eActivitySequentialCheckModesV1({ activity, actor: state.combatants.actor,
      combatants: state.combatants, sourceDistanceFeet: () => 0 }) })
  expect(resolved.ok, JSON.stringify(resolved)).toBe(true)
  if (resolved.ok) expect(resolved.checks[0]).toMatchObject({ rollMode: mode, total })
})

it('keeps exceptions local, honors suspension, and copies nested selectors', () => {
  const applied = effect()
  const other = createDnd5eMechanicalEffect({ definitionId: 'test:other', label: 'Other', source: { kind: 'plugin' },
    targetId: 'actor', modifiers: { abilityCheckDisadvantages: ['cha'] } })
  const mode = (effects: typeof applied[]) => dnd5eAbilityCheckMode({ charClass: '战士', level: 1,
    dnd5eCombatState: { activeEffects: effects } }, { ability: 'cha', skill: 'intimidation' })
  expect(mode([applied, other])).toBe('normal')
  expect(mode([{ ...applied, suspendedBy: ['antimagic'] }])).toBe('normal')
  expect(applied.modifiers!.abilityCheckRules![1].excludedSkills).not.toBe(rules[1].excludedSkills)
})

it.each([
  { mode: 'other' }, { mode: 'advantage', ability: 'bad' },
  { mode: 'advantage', excludedSkills: 'intimidation' },
  { mode: 'advantage', skill: 'intimidation', excludedSkills: ['intimidation'] },
  { mode: 'advantage', excludedSkills: [null] },
  { mode: 'advantage', sense: 'invalid-sense' },
])('rejects malformed selectors at authoring and persistence boundaries: %j', bad => {
  const definition = { schemaVersion: 1 as const, id: 'test', name: 'Test', stacking: 'replace' as const,
    duration: { kind: 'permanent' as const }, modifiers: [{ kind: 'ability-check', ...bad }] }
  expect(validateDnd5eEffectDefinitionV1(definition as Parameters<typeof validateDnd5eEffectDefinitionV1>[0]).length).toBeGreaterThan(0)
  expect(validateDnd5eActiveEffectsStrict([{ ...effect(), modifiers: { abilityCheckRules: [bad] } }]).ok).toBe(false)
})

it('round-trips sensory selectors without applying hearing advantage to other checks', () => {
  const definition = { schemaVersion: 1 as const, id: 'hearing', name: 'Hearing', stacking: 'replace' as const,
    duration: { kind: 'permanent' as const }, modifiers: [
      { kind: 'ability-check' as const, mode: 'advantage' as const, skill: 'perception', sense: 'hearing' as const },
    ] }
  expect(validateDnd5eEffectDefinitionV1(definition)).toEqual([])
  const combatant = createDnd5eCombatant({ id: 'actor', name: 'Actor', controller: 'player', initiative: 20,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, armorClass: 12,
    proficiencyBonus: 2, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, concentrating: false, position: { x: 0, y: 0 } })
  const snapshot = dnd5eActivityActorSnapshotFromCombatantV1(combatant)
  const grant = resolveDnd5eActivity({ activity: {
    schemaVersion: 1, id: 'grant', name: 'Grant', activation: { kind: 'free' }, target: { kind: 'self' },
    effects: [definition], outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [
      { id: 'apply', kind: 'apply-effect', target: 'actor', effectId: definition.id },
    ] }], automation: automationCapabilityFromLegacyStatus('full'),
  }, actor: snapshot, targets: [snapshot], rolls: {} })
  expect(grant.ok, JSON.stringify(grant)).toBe(true)
  if (!grant.ok) throw Error('grant failed')
  const proposal = grant.proposals.find(p => p.kind === 'apply-effect')
  if (!proposal || proposal.kind !== 'apply-effect') throw Error('missing effect')
  expect(proposal.modifierGroups[0].abilityCheckRules).toEqual([
    { mode: 'advantage', skill: 'perception', sense: 'hearing' },
  ])
  expect(validateDnd5eEffectDefinitionV1({ ...definition, modifiers: [
    { ...definition.modifiers[0], mode: 'add', value: { kind: 'constant', value: 2 } },
  ] } as Parameters<typeof validateDnd5eEffectDefinitionV1>[0]).length).toBeGreaterThan(0)
  const hearing = createDnd5eMechanicalEffect({ definitionId: 'hearing', label: 'Hearing',
    source: { kind: 'plugin' }, targetId: 'actor', modifiers: {
      abilityCheckRules: [{ mode: 'advantage', skill: 'perception', sense: 'hearing' }],
    } })
  const effects = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([hearing])))
  expect(validateDnd5eActiveEffectsStrict(effects).ok).toBe(true)
  const actor = { charClass: '战士', level: 1, dnd5eCombatState: { activeEffects: effects } }
  expect(dnd5eAbilityCheckMode(actor, { ability: 'wis', skill: 'perception', sense: 'hearing' })).toBe('advantage')
  expect(dnd5eAbilityCheckMode(actor, { ability: 'wis', skill: 'perception', sense: 'sight' })).toBe('normal')
  expect(dnd5eAbilityCheckMode(actor, { ability: 'wis', skill: 'perception' })).toBe('normal')
  expect(dnd5eAbilityCheckMode(actor, { ability: 'wis', skill: 'insight', sense: 'hearing' })).toBe('normal')
  effects.push(createDnd5eMechanicalEffect({ definitionId: 'penalty', label: 'Penalty', source: { kind: 'plugin' },
    targetId: 'actor', modifiers: { abilityCheckDisadvantages: ['wis'] } }))
  expect(dnd5eAbilityCheckMode(actor, { ability: 'wis', skill: 'perception', sense: 'hearing' })).toBe('normal')
})
