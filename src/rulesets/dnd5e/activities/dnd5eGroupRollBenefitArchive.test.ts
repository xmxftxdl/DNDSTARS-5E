import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { createDnd5eConditionEffect } from '../activeEffects'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { dnd5eSavingThrowMode } from '../passiveDefenses'
import { dnd5eCombatantPairKey } from '../headlessCombatPrimitives'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

it.each(['direct', 'compiled'] as const)('preserves hearing-gated group benefits and source-turn expiry through archive reinstall (%s)', async route => {
  const namespace = 'test.group-roll-benefit'
  const activity: Dnd5eActivityDefinitionV1 = {
    schemaVersion: 1, id: 'grant', name: 'Synthetic group benefit', activation: { kind: 'bonus-action', cost: 1 },
    legacySource: { kind: 'feature', id: 'benefit' }, automation: automationCapabilityFromLegacyStatus('full'),
    target: { kind: 'creature', relation: 'any', count: 10, rangeFeet: 60, includeSelf: false },
    requirements: [{ kind: 'can-hear-source' }],
    consumption: [{ kind: 'action-economy', economy: 'bonus-action', amount: 1, consumeOn: 'resolve' }],
    effects: [{ schemaVersion: 1, id: 'benefit', name: 'Synthetic group benefit', stacking: 'replace',
      duration: { kind: 'rounds', rounds: 1, expiresAt: 'source-turn-start' },
      modifiers: [{ kind: 'attack-roll', mode: 'advantage' }, { kind: 'saving-throw', mode: 'advantage' },
        { kind: 'death-saving-throw', mode: 'advantage' }] }],
    outcomes: [{ id: 'benefit', when: { kind: 'always' }, operations: [{ id: 'benefit', kind: 'apply-effect', target: 'all-targets', effectId: 'benefit' }] }],
  }
  const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Synthetic group benefit', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' },
    assets: [], definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'benefit',
      name: 'Synthetic group benefit', automation: activity.automation, activities: [activity],
      payload: { id: 'benefit', name: 'Synthetic group benefit', summary: 'Synthetic', description: 'Synthetic', automation: 'full' } }] }
  const original = structuredClone(bundle)
  let archive = await exportDnd5eStarMod(bundle)
  for (let installation = 0; installation < 2; installation++) {
    const decoded = await readDnd5eStarMod(archive)
    expect(decoded.bundle.definitions[0].activities).toEqual([activity])
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
    try {
      for (const scenario of ['valid', 'maximum', 'deaf-recipient', 'silent-source', 'distant', 'self', 'too-many'] as const) {
        const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative, controller: 'player',
          abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 15,
          currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
        const source = make('source', 30), recipient = make('recipient', 20), other = make('other', 10)
        source.pluginFeatureIds = [`${namespace}:benefit`]
        if (scenario === 'silent-source') source.soundSuppressed = true
        if (scenario === 'deaf-recipient') {
          recipient.conditions = ['deafened']
          recipient.classState.activeEffects = [createDnd5eConditionEffect({ condition: 'deafened', targetId: recipient.id,
            source: { kind: 'feature', actorId: source.id } })]
        }
        const extras = scenario === 'too-many' || scenario === 'maximum'
          ? Array.from({ length: scenario === 'maximum' ? 8 : 9 }, (_, i) => make(`extra-${i}`, -i)) : []
        const state = startDnd5eHeadlessCombat('group-benefit', [source, recipient, other, ...extras])
        const targetIds = scenario === 'self' ? [source.id] : [recipient.id, other.id, ...extras.map(actor => actor.id)]
        state.distanceFeetByCombatantPair = Object.fromEntries(targetIds.map(id =>
          [dnd5eCombatantPairKey(source.id, id), scenario === 'distant' && id === recipient.id ? 65 : 5]))
        const before = structuredClone(state)
        const cast = route === 'compiled' ? { phase: 'commit' as const, result: resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: namespace,
          actionId: 'grant', featureId: `${namespace}:benefit`, actorId: source.id, targetId: targetIds[0], targetIds, rolls: {}, distanceFeet: 5 }) }
          : resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1, confirmedBy: 'actor', authoritativeRolls: {},
            command: { schemaVersion: 1, commandId: 'grant', actorId: source.id, packageId: namespace, packageVersion: '1.0.0',
              activityId: 'grant', targetIds, expectedRevision: 1 } })
        expect(cast.result.ok, `${scenario}: ${JSON.stringify(cast.result)}`).toBe(scenario === 'valid' || scenario === 'maximum')
        expect(state).toEqual(before)
        expect(state.combatants.other.classState.activeEffects ?? []).toEqual([])
        if (!cast.result.ok) {
          if (cast.phase === 'commit') expect(cast.result.state).toEqual(state)
          continue
        }
        if (cast.phase !== 'commit' || !cast.result.ok) throw Error('Expected commit')
        let current = JSON.parse(JSON.stringify(cast.result.state)) as typeof state
        expect(current.combatants.source.turn.bonusActionAvailable).toBe(false)
        expect(state.combatants.source.turn.bonusActionAvailable).toBe(true)
        for (const id of targetIds) for (const ability of ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const) {
          expect(dnd5eSavingThrowMode(current.combatants[id], ability, { effectVisible: true })).toBe('advantage')
        }
        // The source's own turn ending must not expire benefits on recipients.
        const sourceEnd = resolveDnd5eHeadlessAction(current, { type: 'end-turn', actorId: source.id })
        expect(sourceEnd.ok).toBe(true)
        current = sourceEnd.state
        const check = resolveDnd5eHeadlessAction(current, { type: 'ability-check', actorId: recipient.id, ability: 'wis', d20: 2, d20Second: 18, dc: 12 })
        expect(check.ok).toBe(true)
        expect(check.events).toContainEqual(expect.objectContaining({ type: 'ability-check-resolved', d20: 2, success: false }))
        current = check.state
        for (let attack = 0; attack < 2; attack++) {
          const hit = resolveDnd5eHeadlessAction(current, { type: 'attack', actorId: recipient.id, targetId: source.id,
            attackModifier: 0, d20: 2, d20Second: 18, spendAction: false,
            damage: { count: 1, sides: 4, rolls: [2], bonus: 0, type: 'force' } })
          expect(hit.ok, JSON.stringify(hit)).toBe(true)
          expect(hit.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 18, hit: true }))
          current = hit.state
        }
        current.combatants.recipient.concentrating = true
        current.combatants.recipient.classState.concentrationSpellId = 'synthetic'
        const save = resolveDnd5eHeadlessAction(current, { type: 'concentration-save', actorId: recipient.id, d20: 2, d20Second: 18, dc: 12 })
        expect(save.ok).toBe(true)
        expect(save.events).toContainEqual(expect.objectContaining({ type: 'concentration-resolved', d20: 18, success: true }))
        current = save.state
        // Death saves have no ability key and require the explicit death-save modifier.
        const deathState = structuredClone(current)
        deathState.combatants.recipient.currentHp = 0
        const deathSave = resolveDnd5eHeadlessAction(deathState, { type: 'death-save', actorId: recipient.id, d20: 2, d20Second: 18 })
        expect(deathSave.ok).toBe(true)
        expect(deathSave.events).toContainEqual(expect.objectContaining({ type: 'death-save-resolved', d20: 18, successes: 1 }))
        const recipientEnd = resolveDnd5eHeadlessAction(current, { type: 'end-turn', actorId: recipient.id })
        expect(recipientEnd.ok).toBe(true)
        expect(dnd5eSavingThrowMode(recipientEnd.state.combatants.recipient, 'wis', { effectVisible: true })).toBe('advantage')
        current = recipientEnd.state
        for (const actorId of [other.id, ...extras.map(actor => actor.id)]) {
          expect(dnd5eSavingThrowMode(current.combatants.recipient, 'wis', { effectVisible: true })).toBe('advantage')
          const ended = resolveDnd5eHeadlessAction(current, { type: 'end-turn', actorId })
          expect(ended.ok).toBe(true)
          current = ended.state
        }
        for (const id of targetIds) {
          expect(dnd5eSavingThrowMode(current.combatants[id], 'wis', { effectVisible: true })).toBe('normal')
          expect(current.combatants[id].classState.activeEffects?.some(effect => effect.definitionId.endsWith(':benefit')) ?? false).toBe(false)
        }
      }
      archive = await exportDnd5eStarMod(decoded.bundle)
    } finally { dispose() }
  }
  expect(bundle).toEqual(original)
}, 20000)
