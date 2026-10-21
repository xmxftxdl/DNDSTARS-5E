import { describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { dnd5eSpellActivityEntryAudit, dnd5eSpellActivityReachabilityIssues } from './dnd5eSpellActivityReachability'

const activity = (id: string): Dnd5eActivityDefinitionV1 => ({ schemaVersion: 1, id, name: id,
  activation: { kind: 'free' }, target: { kind: 'self' }, outcomes: [],
  automation: automationCapabilityFromLegacyStatus('full'), legacySource: { kind: 'spell', id: 'sample' } })
describe('spell follow-up reachability', () => {
  it.each(['valid', 'no-slot', 'no-choice', 'wrong-event', 'grant-only'] as const)('audits witnessed-death reaction entry contracts: %s', mode => {
    const reaction = activity('capture')
    reaction.activation = { kind: 'reaction' }
    reaction.invocation = { kind: 'triggered', event: mode === 'wrong-event' ? 'turn-start' : 'creature-died',
      confirmation: mode === 'no-choice' ? 'automatic' : 'actor-choice' }
    reaction.consumption = mode === 'no-slot' ? [] : [{ kind: 'spell-slot', minimumLevel: 6, level: 'selected', amount: 1, consumeOn: 'resolve' }]
    reaction.requiresEffectGrant = mode === 'grant-only' ? true : undefined
    const before = structuredClone(reaction)
    const audit = dnd5eSpellActivityEntryAudit([reaction], 'sample', { level: 6, castingTime: { unit: 'reaction', value: 1 } })
    expect(audit.selectedActivityId).toBe(mode === 'valid' ? 'capture' : undefined)
    expect(reaction).toEqual(before)
  })
  it('separates incomplete automation from grant authorization without mutating either', () => {
    const partial = activity('partial'), granted = activity('granted')
    partial.automation = automationCapabilityFromLegacyStatus('partial', ['Unimplemented rule'])
    partial.outcomes = [{ id: 'manual', when: { kind: 'always' }, operations: [{ id: 'manual', kind: 'manual-adjudication', prompt: 'Resolve', reason: 'Unimplemented rule', requiresDmApproval: true }] }]
    granted.requiresEffectGrant = true
    const input = [partial, granted], before = JSON.stringify(input)
    const audit = dnd5eSpellActivityEntryAudit(input, 'sample')
    expect(audit.selectedActivityId).toBeUndefined()
    expect(audit.candidates[0]).toMatchObject({ reasons: ['automation-not-full'], limitations: ['Activity 包含显式 DM 裁定 operation。'] })
    expect(audit.candidates[1]).toMatchObject({ reasons: ['requires-effect-grant'] })
    expect(JSON.stringify(input)).toBe(before)
  })
  it('retains actionable reaction slot failures and excludes unrelated spells', () => {
    const reaction = activity('reaction'), unrelated = activity('unrelated')
    reaction.activation = { kind: 'reaction' }
    reaction.invocation = { kind: 'triggered', event: 'before-damage', confirmation: 'actor-choice' }
    unrelated.legacySource = { kind: 'spell', id: 'other' }
    const audit = dnd5eSpellActivityEntryAudit([unrelated, reaction], 'sample', { level: 1, castingTime: { unit: 'reaction', value: 1 } })
    expect(audit.candidates).toHaveLength(1)
    expect(audit.candidates[0].reasons).toEqual(['reaction-spell-slot-contract-invalid'])
    expect(dnd5eSpellActivityEntryAudit([unrelated], 'sample').candidates).toEqual([])
  })
  it('requires an actual grant before an effect-only listener can make downstream actions reachable', () => {
    const cast = activity('cast'), listener = activity('listener'), follow = activity('follow')
    listener.requiresEffectGrant = true
    listener.invocation = { kind: 'triggered', event: 'turn-start', confirmation: 'automatic' }
    follow.requiresEffectGrant = true
    listener.effects = [{ schemaVersion: 1, id: 'later', name: 'Later', duration: { kind: 'permanent' }, stacking: 'replace', grants: ['follow'] }]
    listener.outcomes = [{ id: 'later', when: { kind: 'always' }, operations: [{ id: 'apply', kind: 'apply-effect', target: 'actor', effectId: 'later' }] }]
    const definitions = [cast, listener, follow]
    const before = JSON.stringify(definitions)
    expect(dnd5eSpellActivityReachabilityIssues(definitions, 'sample')).toHaveLength(2)
    expect(JSON.stringify(definitions)).toBe(before)
    cast.effects = [{ schemaVersion: 1, id: 'armed', name: 'Armed', duration: { kind: 'permanent' }, stacking: 'replace', grants: ['listener'] }]
    expect(dnd5eSpellActivityReachabilityIssues(definitions, 'sample')).toHaveLength(2)
    cast.outcomes = [{ id: 'arm', when: { kind: 'always' }, operations: [{ id: 'apply', kind: 'apply-effect', target: 'actor', effectId: 'armed' }] }]
    expect(dnd5eSpellActivityReachabilityIssues(definitions, 'sample')).toEqual([])
    listener.effects![0].grants = ['listener']
    expect(dnd5eSpellActivityReachabilityIssues(definitions, 'sample')).toHaveLength(1)
  })
  it.each(['valid', 'wrong-event', 'no-slot', 'wrong-level', 'automatic', 'wrong-casting-time'] as const)('recognizes a reaction spell entry only with its metadata and slot contract (%s)', mode => {
    const reaction = activity('reaction')
    reaction.activation = { kind: 'reaction' }
    reaction.invocation = { kind: 'triggered', event: mode === 'wrong-event' ? 'reaction-window' : 'before-damage', confirmation: mode === 'automatic' ? 'automatic' : 'actor-choice' }
    reaction.consumption = mode === 'no-slot' ? [] : [{ kind: 'spell-slot', minimumLevel: mode === 'wrong-level' ? 2 : 1, level: 'selected', amount: 1, consumeOn: 'resolve' }]
    const metadata = { level: 1, castingTime: { unit: mode === 'wrong-casting-time' ? 'action' : 'reaction', value: 1 } }
    expect(dnd5eSpellActivityReachabilityIssues([reaction], 'sample', metadata).length).toBe(mode === 'valid' ? 0 : 1)
    expect(dnd5eSpellActivityReachabilityIssues([reaction], 'sample')).toHaveLength(1)
  })
  it('rejects a spell containing only an effect-authorized follow-up', () => {
    const follow = activity('follow')
    follow.requiresEffectGrant = true
    expect(dnd5eSpellActivityReachabilityIssues([follow], 'sample').join('\n')).toContain('缺少无需效果授权')
  })
  it('starts at the cast even when an effect-only follow-up is listed first', () => {
    const cast = activity('cast'), follow = activity('follow')
    follow.requiresEffectGrant = true
    cast.effects = [{ schemaVersion: 1, id: 'grant', name: 'Grant', duration: { kind: 'rounds', rounds: 2, expiresAt: 'target-turn-end' }, stacking: 'replace', grants: ['follow'] }]
    cast.outcomes = [{ id: 'grant', when: { kind: 'always' }, operations: [{ id: 'apply', kind: 'apply-effect', target: 'actor', effectId: 'grant' }] }]
    expect(dnd5eSpellActivityReachabilityIssues([follow, cast], 'sample')).toEqual([])
  })
  it('rejects orphaned follow-ups and un-applied grant definitions', () => {
    const cast = activity('cast'), command = activity('command')
    cast.effects = [{ schemaVersion: 1, id: 'grant', name: 'Grant', duration: { kind: 'concentration', maximumRounds: 10 }, stacking: 'replace', grants: ['command'] }]
    expect(dnd5eSpellActivityReachabilityIssues([cast, command], 'sample')).toHaveLength(1)
    cast.outcomes = [{ id: 'grant', when: { kind: 'always' }, operations: [{ id: 'apply', kind: 'apply-effect', target: 'actor', effectId: 'grant' }] }]
    expect(dnd5eSpellActivityReachabilityIssues([cast, command], 'sample')).toEqual([])
  })
  it('does not accept disconnected cycles as a player entry', () => {
    const cast = activity('cast'), a = activity('a'), b = activity('b')
    for (const [source, target] of [[a, b], [b, a]]) source.outcomes = [{ id: 'call', when: { kind: 'always' },
      operations: [{ id: 'call', kind: 'invoke-activity', activityId: target.id, target: 'actor', repeat: { kind: 'constant', value: 1 } }] }]
    expect(dnd5eSpellActivityReachabilityIssues([cast, a, b], 'sample')).toHaveLength(2)
    cast.continuation = { nextActivityId: 'a', finishActivityId: 'b', maximumSteps: 2, excludePreviousTargets: false }
    expect(dnd5eSpellActivityReachabilityIssues([cast, a, b], 'sample')).toEqual([])
  })
})

it('follows only applied timed completion grants', () => {
  const cast = activity('cast'), finish = activity('finish')
  cast.effects = [{ schemaVersion: 1, id: 'timer', name: 'Timer', duration: { kind: 'rounds', rounds: 10, expiresAt: 'target-turn-end' }, stacking: 'replace', completionGrant: { activityIds: ['finish'], availableRounds: 10 } }]
  expect(dnd5eSpellActivityReachabilityIssues([cast, finish], 'sample')).toHaveLength(1)
  cast.outcomes = [{ id: 'prepare', when: { kind: 'always' }, operations: [{ id: 'apply', kind: 'apply-effect', target: 'actor', effectId: 'timer' }] }]
  expect(dnd5eSpellActivityReachabilityIssues([cast, finish], 'sample')).toEqual([])
})
