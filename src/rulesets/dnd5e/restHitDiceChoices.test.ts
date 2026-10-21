import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import type { SharedCampaignTimeState } from '../../lib/campaignTime'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { reconcileDnd5eCharacterCampaignTime } from './campaignTimeRules'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from './character'
import { startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { registerDnd5eActivityPackage } from './activities/dnd5eActivityRegistry'
import { settleDnd5eRestActivityV1 } from './activities/dnd5eRestActivitySettlement'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './activities/dnd5eActivityCombatAuthority'

it('spends selected Hit Dice only inside an unconsumed authoritative rest window', () => {
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'rest-dice', name: 'Rest dice', activation: { kind: 'free' },
    invocation: { kind: 'triggered', event: 'long-rest-complete', confirmation: 'actor-choice', retention: 'single-event' },
    target: { kind: 'self' }, legacySource: { kind: 'feature', id: 'rest-dice' }, automation: automationCapabilityFromLegacyStatus('full'),
    choices: [{ id: 'count', label: '生命骰数量', options: [{ id: 'one', label: '1d6' }, { id: 'two', label: '2d6' }] }],
    consumption: [1, 2].map(count => ({ kind: 'hit-die', resourceId: 'hit-die:d6', amount: { kind: 'constant', value: count }, consumeOn: 'resolve', maximumTotalFraction: 0.5,
      whenChoice: { choiceId: 'count', optionIds: [count === 1 ? 'one' : 'two'] } })),
    outcomes: [1, 2].map(count => ({ id: `benefit-${count}`, when: { kind: 'choice', choiceId: 'count', optionId: count === 1 ? 'one' : 'two' },
      operations: [{ id: `hp-${count}`, kind: 'temporary-hit-points', target: 'actor', amount: { kind: 'add', values: [
        { kind: 'dice', rollId: `dice-${count}`, count, sides: 6 },
        { kind: 'multiply', values: [{ kind: 'constant', value: count }, { kind: 'reference', reference: { kind: 'actor-ability-modifier', ability: 'con' } }] },
      ] } }] })),
  }
  const registration = registerDnd5eActivityPackage({ packageId: 'test.rest-dice', packageVersion: '1.0.0', activities: [activity] })
  try {
    const clock: SharedCampaignTimeState = { schemaVersion: 2, worldMinute: 480, displayMode: 'campaign-day', displayMinuteOffset: 0, timers: [], updatedAt: 1,
      advances: [{ id: 'rest-1', kind: 'long-rest', fromWorldMinute: 0, toWorldMinute: 480, minutes: 480, reason: 'Test', dawnsCrossed: 0, expiredTimerIds: [], createdAt: 1, beneficiaryCharacterIds: ['hero'] }] }
    const initial = normalizeCharacter({ id: 'hero', name: 'Hero', charClass: '法师', level: 5, currentHp: 30, maxHp: 30, dnd5eWorldTimeAppliedMinute: 0,
      abilities: { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 }, hitPointDice: [{ sides: 6, current: 5, max: 5 }] })
    const owner = reconcileDnd5eCharacterCampaignTime(initial, clock).character
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(owner), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    actor.pluginFeatureIds = ['rest-dice']
    const state = startDnd5eHeadlessCombat('rest-dice', [actor])
    const input = { state, combatRevision: 1, actorCharacter: owner, clock, restEventId: owner.dnd5eRestActivityWindow!.eventId,
      decision: 'use' as const, confirmedBy: 'actor' as const, authoritativeRolls: { 'dice-2': { values: [3, 4] } },
      command: { schemaVersion: 1 as const, commandId: 'rest-use', packageId: 'test.rest-dice', packageVersion: '1.0.0', activityId: activity.id,
        actorId: 'hero', targetIds: ['hero'], expectedRevision: 1, choices: { count: 'two' } } }
    const before = structuredClone(input)
    expect(state.active).toBe(false)
    const ordinary = resolveRegisteredDnd5eActivityInCombatV1({ ...input,
      command: { ...input.command, triggerEventId: input.restEventId },
      triggerContext: { event: 'long-rest-complete', eventId: input.restEventId, eligibleActorIds: ['hero'], eligibleTargetIds: ['hero'], source: { kind: 'combat', id: 'long-rest-complete' } } })
    expect(ordinary.phase).toBe('commit')
    expect(ordinary.result.ok).toBe(false)
    const invalid = settleDnd5eRestActivityV1({ ...input, authoritativeRolls: { 'dice-2': { values: [3] } } })
    expect(invalid.ok).toBe(false)
    expect(invalid).not.toHaveProperty('receiptPatch')
    expect(input).toEqual(before)
    const used = settleDnd5eRestActivityV1(input)
    expect(used.ok, used.ok ? undefined : JSON.stringify({ reason: used.reason, resolution: 'resolution' in used ? used.resolution : undefined },
      (key, value) => ['state', 'actor', 'targets'].includes(key) ? undefined : value).slice(0, 1800)).toBe(true)
    if (!used.ok || used.outcome !== 'used' || used.resolution.phase !== 'commit' || !used.resolution.result.ok) throw Error('Rest dice failed')
    const resolved = used.resolution.result.state.combatants.hero
    expect(used.resolution.result.state.active).toBe(false)
    expect(resolved.hitPointDice?.[0].current).toBe(3)
    expect(resolved.temporaryHp).toBe(11)
    const saved = normalizeCharacter(JSON.parse(JSON.stringify({ ...owner, hitPointDice: resolved.hitPointDice, tempHp: resolved.temporaryHp, ...used.receiptPatch })))
    expect(settleDnd5eRestActivityV1({ ...input, actorCharacter: saved }).ok).toBe(false)
    expect(settleDnd5eRestActivityV1({ ...input, clock: { ...clock, worldMinute: 481 } }).ok).toBe(false)
    const declined = settleDnd5eRestActivityV1({ ...input, decision: 'decline' })
    expect(declined.ok).toBe(true)
    if (!declined.ok) throw Error('Decline failed')
    expect(settleDnd5eRestActivityV1({ ...input, actorCharacter: { ...owner, ...declined.receiptPatch } }).ok).toBe(false)
    expect(owner.hitPointDice?.[0].current).toBe(5)
  } finally { registration.dispose() }
})
