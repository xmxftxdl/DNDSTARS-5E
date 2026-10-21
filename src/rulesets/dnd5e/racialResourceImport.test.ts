import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { syncCharacterClassResources } from '../../lib/classResources'
import { DND5E_RACIAL_RESOURCE_KEYS } from './racialResourceCatalog'
import { exportPdfContentModule } from './pdfContentModule'
import { projectDnd5eStarModRuntime } from './starModAdapter'
import { parseDnd5eContentPackageV2, dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { getRegisteredDnd5eActivity } from './activities/dnd5eActivityRegistry'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './activities/dnd5eActivityCombatAuthority'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from './character'
import { startDnd5eHeadlessCombat } from './headlessCombatEngine'

it('imports a replacement resource use without duplicating racial resources or performing the original breath attack', async () => {
  const key = DND5E_RACIAL_RESOURCE_KEYS.dragonbornBreath
  const packageId = 'test.racial-resource-import'
  const draft = { schemaVersion: 1 as const, assumptions: [], unsupported: [], contentJson: JSON.stringify({
    name: 'Synthetic racial resource use',
    features: [{ id: 'ward', name: 'Ward', summary: 'Synthetic', description: 'Synthetic resource-only fixture', automation: 'full' }],
    activities: [{ schemaVersion: 1, id: 'ward-use', name: 'Ward use', activation: { kind: 'free' }, target: { kind: 'self' },
      legacySource: { kind: 'feature', id: 'ward' },
      consumption: [{ kind: 'resource', resourceId: key, amount: { kind: 'constant', value: 1 }, consumeOn: 'resolve' }],
      outcomes: [{ id: 'ward', when: { kind: 'always' }, operations: [{ id: 'ward', kind: 'temporary-hit-points', target: 'actor', amount: { kind: 'constant', value: 4 } }] }],
      automation: { schemaVersion: 1, level: 'full', supportedPhases: ['effects'], manualPhases: [], limitations: [] },
    }],
  }) }
  const archive = await exportPdfContentModule({ id: packageId, name: 'Synthetic', version: '1.0.0', inventoryComplete: true,
    entries: [{ sourceId: 'synthetic', name: 'Synthetic', draft }] })
  const pkg = parseDnd5eContentPackageV2(await projectDnd5eStarModRuntime(archive.bytes))!
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
  try {
    expect(getRegisteredDnd5eActivity(packageId, 'ward-use')?.consumption?.[0]).toMatchObject({ resourceId: key })
    for (const scenario of ['available', 'spent', 'wrong-race', 'missing-ancestry', 'not-owned'] as const) {
      const character = syncCharacterClassResources(normalizeCharacter({ id: 'hero', name: 'Hero', maxHp: 20, currentHp: 20,
        race: scenario === 'wrong-race' ? '人类' : '龙裔',
        dnd5eRacialChoices: scenario === 'missing-ancestry' ? undefined : { dragonbornAncestry: 'red' },
        dnd5ePluginFeatureIds: scenario === 'not-owned' ? [] : [`${packageId}:ward`],
      }))
      if (scenario === 'spent') character.classResources![key].current = 0
      const actor = { ...createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } }), id: 'actor' }
      const state = startDnd5eHeadlessCombat(`racial-resource-${scenario}`, [actor,
        { ...structuredClone(actor), id: 'enemy', controller: 'dm', initiative: 1, pluginFeatureIds: [] }])
      const before = structuredClone(state)
      const command = { schemaVersion: 1 as const, commandId: 'use', actorId: 'actor', packageId, packageVersion: '1.0.0', activityId: 'ward-use', targetIds: ['actor'], expectedRevision: 1 }
      const result = resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1, command, authoritativeRolls: {}, confirmedBy: 'actor' })
      expect(result.result.ok, `${scenario}: ${JSON.stringify(result.result)}`).toBe(scenario === 'available')
      expect(state).toEqual(before)
      if (scenario === 'available') {
        if (result.phase !== 'commit' || !result.result.ok) throw Error('expected committed resource use')
        expect(result.result.state.combatants.actor.classResources[key].current).toBe(0)
        expect(result.result.state.combatants.actor.currentHp).toBe(20)
        expect(result.result.state.combatants.actor.temporaryHp).toBe(4)
        expect(Object.keys(result.result.state.combatants.actor.classResources).some(id => id.startsWith(`${packageId}:`))).toBe(false)
        const again = resolveRegisteredDnd5eActivityInCombatV1({ state: result.result.state, combatRevision: 1,
          command: { ...command, commandId: 'second-use' }, authoritativeRolls: {}, confirmedBy: 'actor' })
        expect(again.result.ok).toBe(false)
      }
    }
  } finally { dispose() }
})
