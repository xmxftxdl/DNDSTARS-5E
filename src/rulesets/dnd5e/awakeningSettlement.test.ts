import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { createDnd5eConditionEffect, createDnd5eMechanicalEffect } from './activeEffects'
import { advanceDnd5eCampaignTimedActiveEffects } from './campaignTimeRules'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from './character'
import { startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { registerDnd5eActivityPackage, clearDnd5eActivityRegistryForTests } from './activities/dnd5eActivityRegistry'
import { settleDnd5eAwakeningActivity } from './activities/dnd5eAwakeningActivitySettlement'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'

it('settles imported waking damage only with the original grant and consumes its durable event once', () => {
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'nightmare-wake', name: 'Waking damage',
    activation: { kind: 'free' }, target: { kind: 'self' }, requiresEffectGrant: true,
    invocation: { kind: 'triggered', event: 'creature-awakened', confirmation: 'automatic', retention: 'single-event' },
    legacySource: { kind: 'feature', id: 'nightmare-wake' }, automation: automationCapabilityFromLegacyStatus('full'),
    outcomes: [{ id: 'wake', when: { kind: 'always' }, operations: [{ id: 'damage', kind: 'damage', target: 'actor',
      amount: { kind: 'dice', rollId: 'wake-damage', count: 3, sides: 6 }, damageType: 'psychic' }] }] }
  registerDnd5eActivityPackage({ packageId: 'test.dream', packageVersion: '1.0.0', activities: [JSON.parse(JSON.stringify(activity))] })
  try {
    const sleep = createDnd5eConditionEffect({ id: 'sleep', condition: 'unconscious', targetId: 'hero',
      source: { kind: 'spell', rulesId: 'sleep' }, breakOn: ['awakened'],
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' } })
    const grant = createDnd5eMechanicalEffect({ id: 'nightmare', definitionId: 'nightmare', label: 'Nightmare', targetId: 'hero',
      source: { kind: 'plugin', pluginId: 'test.dream', rulesId: 'dream', actorId: 'caster' },
      duration: { type: 'permanent' }, modifiers: { preventRestBenefits: true },
      grantedActivities: ['nightmare-wake'], grantedActivitiesSingleUse: true })
    const sleeping = normalizeCharacter({ id: 'hero', name: 'Hero', currentHp: 20, maxHp: 20,
      dnd5eWorldTimeAppliedMinute: 480, dnd5eCombatState: { activeEffects: [sleep, grant] } })
    const owner = normalizeCharacter(JSON.parse(JSON.stringify({ ...advanceDnd5eCampaignTimedActiveEffects(sleeping, 1),
      dnd5eWorldTimeAppliedMinute: 481 })))
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(owner), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    const state = startDnd5eHeadlessCombat('wake', [actor])
    const input = { state, combatRevision: 1, actorCharacter: owner, worldMinute: 481,
      awakeningEventId: owner.dnd5eAwakeningEvents![0].id, confirmedBy: 'system' as const,
      authoritativeRolls: { 'wake-damage': { values: [2, 3, 4], total: 9 } },
      command: { schemaVersion: 1 as const, commandId: 'wake', actorId: 'hero', packageId: 'test.dream',
        packageVersion: '1.0.0', activityId: 'nightmare-wake', grantEffectId: grant.id, targetIds: ['hero'], expectedRevision: 1 } }
    expect(settleDnd5eAwakeningActivity({ ...input, awakeningEventId: 'forged' }).ok).toBe(false)
    expect(settleDnd5eAwakeningActivity({ ...input, authoritativeRolls: {} }).ok).toBe(false)
    expect(settleDnd5eAwakeningActivity({ ...input, command: { ...input.command, grantEffectId: 'later-grant' } }).ok).toBe(false)
    const result = settleDnd5eAwakeningActivity(input)
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    expect(result.resolution.result.state.combatants.hero.currentHp).toBe(11)
    expect(result.resolution.result.state.combatants.hero.classState.activeEffects?.some(effect => effect.id === grant.id) ?? false).toBe(false)
    expect(owner.currentHp).toBe(20)
    const saved = normalizeCharacter(JSON.parse(JSON.stringify({ ...owner, ...result.receiptPatch })))
    expect(settleDnd5eAwakeningActivity({ ...input, actorCharacter: saved }).ok).toBe(false)
  } finally { clearDnd5eActivityRegistryForTests() }
})
