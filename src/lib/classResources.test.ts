import { describe, expect, it } from 'vitest'
import type { Character } from '../types/character'
import { registerClassDefinition, type ClassDefinition } from './classDefinitionRegistry'
import {
  classResourceDisplayLabel,
  getClassResource,
  restoreClassResources,
  spendClassResource,
  syncCharacterClassResources,
} from './classResources'
import { registerDnd5eRulesPlugin } from '../rulesets/dnd5e/pluginApi'
import { recoverDnd5eCombatStartResources } from '../rulesets/dnd5e/combatStartResources'
import { migrateCharacterToDnd5e, createCombatantFromDnd5eCharacter } from '../rulesets/dnd5e/character'
import { restoreDnd5eCombatShortRestResources } from '../rulesets/dnd5e/combatRestResources'

function character(patch: Partial<Character> = {}): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1', id: 'hero', name: '英雄', player: '', avatar: '', accent: '',
    race: '人类', charClass: '战士', level: 2, background: '士兵', experience: 0, reputation: 0,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }, savingThrows: ['str', 'con'], skills: [],
    maxHp: 20, currentHp: 20, tempHp: 0, hitDice: '2d10', ac: 16, speed: 30, initiativeBonus: 0,
    saveDC: 12, passivePerception: 10, inspiration: 0, conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    ...patch,
  }
}

describe('D&D 5e class resources', () => {
  it.each(['feature', 'feat'] as const)('carries conditional %s rest recovery into character and combat paths', kind => {
    const pluginId = `test.partial-rest-${kind}`
    const resourceId = `${pluginId}:surges`
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: pluginId, name: 'Synthetic partial rest', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0' },
      setup(api) {
        const definition = { id: 'option', name: 'Option', summary: 'Test', description: 'Test', automation: 'full' as const,
          resources: [{ id: 'surges', label: 'Surges', maximum: 5, resetOn: 'long-rest' as const,
            restRecovery: {
              'short-rest': { mode: 'restore' as const, amount: 1, onlyWhenEmpty: true },
              'long-rest': { mode: 'set' as const, amount: 1 },
            },
          }],
        }
        if (kind === 'feature') api.registerFeature(definition)
        else api.registerFeat(definition)
      },
    })
    try {
      for (const balance of [0, 2, 5]) {
        const source = character({
          ...(kind === 'feature' ? { dnd5ePluginFeatureIds: [`${pluginId}:option`] } : { dnd5eFeatIds: [`${pluginId}:option`] }),
          classResources: { [resourceId]: { current: balance, max: 5 } },
        })
        const expected = balance === 0 ? 1 : balance
        expect(restoreClassResources(source, 'short-rest').classResources?.[resourceId].current).toBe(expected)
        expect(restoreClassResources(source, 'long-rest').classResources?.[resourceId].current).toBe(1)
        const snapshot = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(source), controller: 'player', initiativeD20: 10, position: { x: 0, y: 0 } })
        const reloaded = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot
        restoreDnd5eCombatShortRestResources(reloaded, [])
        expect(reloaded.classResources[resourceId].current).toBe(expected)
        expect(snapshot.classResources[resourceId].current).toBe(balance)
        expect(source.classResources?.[resourceId].current).toBe(balance)
      }
    } finally { dispose() }
  })
  it.each(['feature', 'feat'] as const)('restores owned %s combat resources only at the explicit combat-start boundary', kind => {
    const pluginId = `test.combat-rest-${kind}`
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: pluginId, name: 'Synthetic combat recovery', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0' },
      setup(api) {
        const definition = { id: 'options', name: 'Options', summary: 'Test', description: 'Test',
          automation: 'full' as const,
          resources: [...(['combat', 'short-rest', 'long-rest'] as const).map(resetOn => ({
            id: resetOn, label: resetOn, maximum: 2, resetOn,
          })), { id: 'combined', label: 'Combined', maximum: 1, resetOn: 'short-rest' as const, restoreOnCombatStart: true }],
        }
        if (kind === 'feature') api.registerFeature(definition)
        else api.registerFeat(definition)
      },
    })
    try {
      const key = `${pluginId}:combat`
      const owned = character(kind === 'feature'
        ? { dnd5ePluginFeatureIds: [`${pluginId}:options`] }
        : { dnd5eFeatIds: [`${pluginId}:options`] })
      let spent = syncCharacterClassResources(owned)
      for (const cadence of ['combat', 'short-rest', 'long-rest']) {
        spent = spendClassResource(spent, `${pluginId}:${cadence}`, 2)!
      }
      const combinedKey = `${pluginId}:combined`
      spent = spendClassResource(spent, combinedKey, 1)!
      const recovered = recoverDnd5eCombatStartResources(spent)
      expect(recovered.classResources?.[key]).toEqual({ current: 2, max: 2 })
      expect(recovered.classResources?.[combinedKey].current).toBe(1)
      for (const rest of ['short-rest', 'long-rest'] as const) {
        expect(restoreClassResources(spent, rest).classResources?.[combinedKey].current).toBe(1)
      }
      expect(recovered.classResources?.[`${pluginId}:short-rest`].current).toBe(0)
      expect(recovered.classResources?.[`${pluginId}:long-rest`].current).toBe(0)
      expect(spent.classResources?.[key].current).toBe(0)
      const spentAgain = spendClassResource(recovered, key, 2)!
      const reloaded = syncCharacterClassResources(JSON.parse(JSON.stringify(spentAgain)))
      expect(reloaded.classResources?.[key].current).toBe(0)
      expect(recoverDnd5eCombatStartResources(reloaded).classResources?.[key].current).toBe(2)
      expect(recoverDnd5eCombatStartResources(character()).classResources?.[key]).toBeUndefined()
    } finally { dispose() }
  })
  it('presents persisted built-in resource ids with Chinese labels', () => {
    const fighter = character()
    expect(classResourceDisplayLabel(fighter, 'fighterSecondWind')).toBe('回气')
    expect(classResourceDisplayLabel(fighter, 'dnd5e-sorcery-points')).toBe('术法点')
    expect(classResourceDisplayLabel(fighter, 'dnd5e-mystic-arcanum-7')).toBe('秘法奥秘（7环）')
    expect(classResourceDisplayLabel(fighter, 'dnd5e-spell-slot-4')).toBe('4环法术位')
  })

  it('creates, spends and restores fighter short-rest resources', () => {
    const synced = syncCharacterClassResources(character())
    expect(getClassResource(synced, 'fighterSecondWind')).toEqual({ current: 1, max: 1 })
    expect(getClassResource(synced, 'fighterActionSurge')).toEqual({ current: 1, max: 1 })
    const spent = spendClassResource(synced, 'fighterActionSurge', 1)
    expect(spent?.classResources?.fighterActionSurge.current).toBe(0)
    expect(restoreClassResources(spent!, 'short-rest').classResources?.fighterActionSurge.current).toBe(1)
  })

  it('restores full-caster spell slots on a long rest', () => {
    const wizard = syncCharacterClassResources(character({ charClass: '法师', level: 5, hitDice: '5d6' }))
    const spent = spendClassResource(wizard, 'dnd5e-spell-slot-3', 1)
    expect(spent?.classResources?.['dnd5e-spell-slot-3'].current).toBe(1)
    expect(restoreClassResources(spent!, 'long-rest').classResources?.['dnd5e-spell-slot-3'].current).toBe(2)
  })

  it('removes stale built-in resources from inactive classes while preserving custom resources', () => {
    const wizard = syncCharacterClassResources(character({
      charClass: '法师',
      level: 5,
      hitDice: '5d6',
      dnd5eClassLevels: { wizard: 5 },
      classResources: {
        fighterSecondWind: { current: 1, max: 1 },
        fighterActionSurge: { current: 1, max: 1 },
        'dnd5e-sorcery-points': { current: 5, max: 5 },
        'custom:charges': { current: 2, max: 3 },
      },
    }))
    expect(wizard.classResources?.fighterSecondWind).toBeUndefined()
    expect(wizard.classResources?.fighterActionSurge).toBeUndefined()
    expect(wizard.classResources?.['dnd5e-sorcery-points']).toBeUndefined()
    expect(wizard.classResources?.['custom:charges']).toEqual({ current: 2, max: 3 })
    expect(wizard.classResources?.['dnd5e-arcane-recovery']).toEqual({ current: 1, max: 1 })
  })

  it('supports namespaced plugin resources without legacy mirror fields', () => {
    const definition: ClassDefinition = {
      id: 'test-class', classNames: ['测试职业'], matchesClassName: (name) => name === '测试职业',
      resources: [{
        key: 'com.example:test-charge', label: '测试充能', isAvailable: () => true,
        max: (candidate) => candidate.level, resetOn: 'long-rest', initialCurrent: 1,
      }],
    }
    const unregister = registerClassDefinition(definition)
    try {
      const synced = syncCharacterClassResources(character({ charClass: '测试职业', level: 3 }))
      expect(synced.classResources?.['com.example:test-charge']).toEqual({ current: 1, max: 3 })
      expect(getClassResource(character({ charClass: '测试职业', level: 3 }), 'com.example:test-charge')?.current).toBe(1)
      const spent = spendClassResource(synced, 'com.example:test-charge', 1)!
      expect(syncCharacterClassResources({ ...spent, level: 5 }).classResources?.['com.example:test-charge']).toEqual({ current: 0, max: 5 })
    } finally {
      unregister()
    }
  })

  it('adds feat-owned resource contributions to an existing shared pool', () => {
    const pluginId = 'local.test.additive-resource'
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId, name: 'Additive resource fixture', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerResource({
          id: 'shared-dice', label: '共享骰', classId: 'fighter',
          minimumLevel: 1, maximum: 4, resetOn: 'short-rest',
        })
        api.registerFeat({
          id: 'extra-die', name: '额外骰', summary: '测试。', description: '测试。',
          resources: [{
            id: 'shared-dice', label: '共享骰', maximum: 1,
            resetOn: 'short-rest', stacking: 'additive',
          }],
          automation: 'full', automationReasons: ['由通用资源叠加协议结算。'],
        })
      },
    })
    try {
      const resourceId = `${pluginId}:shared-dice`
      expect(syncCharacterClassResources(character()).classResources?.[resourceId])
        .toEqual({ current: 4, max: 4 })
      const withFeat = syncCharacterClassResources(character({
        dnd5eFeatIds: [`${pluginId}:extra-die`],
      }))
      expect(withFeat.classResources?.[resourceId]).toEqual({ current: 5, max: 5 })
    } finally {
      dispose()
    }
  })

  it('combines multiclass spell slots and preserves pact slots separately', () => {
    const synced = syncCharacterClassResources(character({
      charClass: '法师', level: 10, hitDice: '5d6',
      dnd5eClassLevels: { wizard: 5, paladin: 4, warlock: 1 },
    }))
    expect(synced.classResources?.['dnd5e-spell-slot-1']).toEqual({ current: 4, max: 4 })
    expect(synced.classResources?.['dnd5e-spell-slot-4']).toEqual({ current: 1, max: 1 })
    expect(synced.classResources?.['dnd5e-pact-slot']).toEqual({ current: 1, max: 1 })
  })

  it('persists and restores racial combat resources independently', () => {
    const dragonborn = syncCharacterClassResources(character({
      race: '龙裔',
      dnd5eRaceId: 'dragonborn',
      dnd5eRacialChoices: { dragonbornAncestry: 'red' },
    }))
    expect(dragonborn.classResources?.['dnd5e-racial-dragonborn-breath']).toEqual({
      current: 1,
      max: 1,
    })
    const spentBreath = spendClassResource(
      dragonborn,
      'dnd5e-racial-dragonborn-breath',
      1,
    )!
    expect(
      restoreClassResources(spentBreath, 'short-rest')
        .classResources?.['dnd5e-racial-dragonborn-breath'].current,
    ).toBe(1)

    const halfOrc = syncCharacterClassResources(character({
      race: '半兽人',
      dnd5eRaceId: 'half-orc',
    }))
    const spentEndurance = spendClassResource(
      halfOrc,
      'dnd5e-racial-half-orc-relentless-endurance',
      1,
    )!
    expect(
      restoreClassResources(spentEndurance, 'short-rest')
        .classResources?.['dnd5e-racial-half-orc-relentless-endurance'].current,
    ).toBe(0)
    expect(
      restoreClassResources(spentEndurance, 'long-rest')
        .classResources?.['dnd5e-racial-half-orc-relentless-endurance'].current,
    ).toBe(1)

    const pluginId = 'local.test.class-resource-race'
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId,
        name: 'Class resource race fixture',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Tests',
        license: 'CC0-1.0',
      },
      setup(api) {
        api.registerRace({
          id: 'shadow-elf',
          name: 'Shadow Elf',
          speedFeet: 30,
          coreRaceMechanicsId: 'elf',
          innateSpells: [
            { spellId: 'dancing-lights', minimumLevel: 1, ability: 'cha', castAtLevel: 0, resetOn: 'at-will' },
            { spellId: 'faerie-fire', minimumLevel: 3, ability: 'cha', castAtLevel: 1, resetOn: 'long-rest' },
            { spellId: 'darkness', minimumLevel: 5, ability: 'cha', castAtLevel: 2, resetOn: 'long-rest' },
          ],
        })
      },
    })
    try {
      const localRace = syncCharacterClassResources(character({
        race: 'Shadow Elf',
        dnd5eRaceId: `${pluginId}:shadow-elf`,
        level: 5,
      }))
      expect(localRace.classResources?.['dnd5e-racial-spell-faerie-fire']).toEqual({
        current: 1,
        max: 1,
      })
      expect(localRace.classResources?.['dnd5e-racial-spell-darkness']).toEqual({
        current: 1,
        max: 1,
      })
      expect(localRace.classResources?.['dnd5e-racial-spell-dancing-lights']).toBeUndefined()
    } finally {
      dispose()
    }
  })
})
