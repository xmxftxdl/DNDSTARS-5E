import { expect, it } from 'vitest'
import { prepareDnd5eLocalContentJson } from './localContentCollection'
import { dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2'
import { registerDnd5eRulesPlugin, dnd5eEffectiveAttacksPerAttackAction } from './pluginApi'
import { normalizeCharacter } from '../../store/characters'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from './character'
import { startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './activities/dnd5eActivityCombatAuthority'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'

it('preserves an imported own-turn attack bonus through Activity commit, save and expiry', async () => {
  const { package: pkg } = await prepareDnd5eLocalContentJson(JSON.stringify({
    name: 'Temporary attack bonus', version: '1.0.0',
    features: [{ id: 'extra', name: 'Extra', description: 'Synthetic', summary: 'Synthetic', automation: 'full' }],
    activities: [{ schemaVersion: 1, id: 'extra', name: 'Extra', legacySource: { kind: 'feature', id: 'extra' },
      automation: automationCapabilityFromLegacyStatus('full'), activation: { kind: 'free' }, target: { kind: 'self' },
      effects: [{ schemaVersion: 1, id: 'extra', name: 'Extra', stacking: 'replace',
        duration: { kind: 'rounds', rounds: 1, expiresAt: 'source-turn-start' },
        modifiers: [{ kind: 'own-turn-attack-action-bonus', attacks: 1 }] }],
      outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [
        { id: 'apply', kind: 'apply-effect', target: 'actor', effectId: 'extra' },
      ] }],
    }],
  }))
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
  try {
    const character = normalizeCharacter({ id: 'actor', charClass: '战士', level: 5, currentHp: 40, maxHp: 40,
      dnd5ePluginFeatureIds: [`${pkg.manifest.id}:extra`] })
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character),
      controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    const other = { ...structuredClone(actor), id: 'other', controller: 'dm' as const, initiative: 1 }
    const state = startDnd5eHeadlessCombat('extra', [actor, other])
    const before = JSON.stringify(state)
    const resolved = resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1, authoritativeRolls: {},
      command: { schemaVersion: 1, commandId: 'extra', actorId: 'actor', targetIds: ['actor'], expectedRevision: 1,
        packageId: pkg.manifest.id, packageVersion: pkg.manifest.version, activityId: 'extra' } })
    expect(resolved.result.ok, JSON.stringify(resolved)).toBe(true)
    expect(JSON.stringify(state)).toBe(before)
    if (!resolved.result.ok || resolved.phase !== 'commit') throw Error('Expected committed activity')
    const persisted = JSON.parse(JSON.stringify(resolved.result.state))
    const saved = normalizeCharacter({ ...character, dnd5eCombatState: persisted.combatants.actor.classState })
    expect(dnd5eEffectiveAttacksPerAttackAction(saved, true)).toBe(3)
    expect(dnd5eEffectiveAttacksPerAttackAction(saved, false)).toBe(2)
    const ended = resolveDnd5eHeadlessAction(persisted, { type: 'end-turn', actorId: 'actor' })
    expect(ended.ok).toBe(true)
    const expired = resolveDnd5eHeadlessAction(ended.state, { type: 'end-turn', actorId: 'other' })
    expect(expired.ok).toBe(true)
    expect(dnd5eEffectiveAttacksPerAttackAction({ ...character,
      dnd5eCombatState: expired.state.combatants.actor.classState }, true)).toBe(2)
  } finally { dispose() }
})
